/** Bounded file inspection confined to one existing canonical workspace directory. */
import { lstat, open, opendir, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { Config } from './config.ts'

/** One text match with a workspace-relative location and original line number. */
export interface TextMatch { path: string; line: number; text: string }

/** Refuse nonpositive or oversized model-supplied integer limits. */
function bounded(value: number | undefined, fallback: number, maximum: number, field: string): number {
  const resolved = value ?? fallback
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new LlmError(`${field} must be an integer from 1 to ${maximum}`, 'INVALID_ARGS')
  }
  return resolved
}

/** Whether a resolved path remains under the canonical selected directory. */
function contains(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

/** Read-only workspace operations; no shell process or filesystem writer is exposed. */
export class ReadOnlyWorkspace {
  private constructor(readonly root: string, private readonly config: Config) {}

  /** Resolve and verify the selected root before the plugin contributes tools.
   * @param config - validated deployment settings containing an existing workspace.
   * @returns a workspace reader bound to its canonical directory.
   */
  static async create(config: Config): Promise<ReadOnlyWorkspace> {
    const root = await realpath(path.resolve(config.workspace))
    if (!(await stat(root)).isDirectory()) throw new Error('LAH workspace must be an existing directory')
    return new ReadOnlyWorkspace(root, config)
  }

  /** Resolve an existing target and refuse traversal, external links, and device aliases. */
  private async resolve(input: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    if (input.includes('\0') || /^[a-z]:[^\\/]/i.test(input) || /^\\\\[?.]\\/.test(input)) {
      throw new LlmError('Unsupported workspace path', 'PATH_DENIED')
    }
    if (process.platform === 'win32' && input.replace(/^[a-z]:/i, '').includes(':')) {
      throw new LlmError('Windows alternate data streams are not accessible', 'PATH_DENIED')
    }
    const candidate = path.resolve(this.root, input)
    if (!contains(this.root, candidate)) throw new LlmError('Path is outside the selected workspace', 'PATH_DENIED')
    const target = await realpath(candidate)
    signal?.throwIfAborted()
    if (!contains(this.root, target)) throw new LlmError('Linked path resolves outside the selected workspace', 'PATH_DENIED')
    return target
  }

  /** Return portable paths relative to the configured canonical root. */
  private relative(target: string): string { return path.relative(this.root, target).split(path.sep).join('/') || '.' }

  /** Whether the full canonical JSON text fits the configured model-visible budget. */
  private fits(value: object): boolean { return JSON.stringify(value).length <= this.config.maxOutputChars }

  /** Read a bounded regular UTF-8 text file and detect a replaced target. */
  private async textFile(target: string, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted()
    const file = await open(target, 'r')
    try {
      const info = await file.stat()
      if (!info.isFile()) throw new LlmError('Path must name a regular text file', 'NOT_TEXT_FILE')
      if (info.size > this.config.maxFileBytes) throw new LlmError(`File exceeds ${this.config.maxFileBytes} bytes`, 'FILE_TOO_LARGE')
      const verified = await this.resolve(target, signal)
      const current = await lstat(verified)
      if (info.dev !== current.dev || info.ino !== current.ino) throw new LlmError('File changed while opening it; retry the read', 'PATH_CHANGED')
      const buffer = Buffer.alloc(Math.min(info.size + 1, this.config.maxFileBytes + 1))
      let bytesRead = 0
      while (bytesRead < buffer.length) {
        signal?.throwIfAborted()
        const chunk = await file.read(buffer, bytesRead, buffer.length - bytesRead, bytesRead)
        if (chunk.bytesRead === 0) break
        bytesRead += chunk.bytesRead
      }
      signal?.throwIfAborted()
      if (bytesRead > this.config.maxFileBytes || bytesRead > info.size) throw new LlmError('File grew while reading it; retry the read', 'FILE_TOO_LARGE')
      const bytes = buffer.subarray(0, bytesRead)
      if (bytes.includes(0)) throw new LlmError('Binary files are not supported in the LAH prealpha', 'NOT_TEXT_FILE')
      try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch (error) {
        throw new LlmError('File must use UTF-8 text encoding', 'NOT_TEXT_FILE', { cause: error })
      }
    } finally {
      await file.close()
    }
  }

  /** List one directory without following symbolic links or junctions.
   * @param input - absolute or workspace-relative directory.
   * @param limit - result count bounded by deployment maxResults.
   * @param signal - cooperative cancellation.
   * @returns sorted paths and explicit truncation.
   */
  async list(input = '.', limit?: number, signal?: AbortSignal): Promise<{ paths: string[]; truncated: boolean }> {
    const maximum = bounded(limit, this.config.maxResults, this.config.maxResults, 'limit')
    const target = await this.resolve(input, signal)
    const paths: string[] = []
    let truncated = false
    const directory = await opendir(target)
    for await (const entry of directory) {
      signal?.throwIfAborted()
      if (entry.isSymbolicLink()) continue
      const display = `${this.relative(path.join(target, entry.name))}${entry.isDirectory() ? '/' : ''}`
      if (paths.length >= maximum || !this.fits({ paths: [...paths, display], truncated: false })) { truncated = true; break }
      paths.push(display)
    }
    return { paths: paths.sort(), truncated }
  }

  /** Read one line window from a bounded UTF-8 file.
   * @param input - existing text file in the workspace.
   * @param startLine - 1-based first line, default 1.
   * @param maxLines - positive count capped by maxResults.
   * @param signal - cooperative cancellation.
   * @returns original line positions and explicit output truncation.
   */
  async read(input: string, startLine?: number, maxLines?: number, signal?: AbortSignal): Promise<{
    path: string
    content: string
    startLine: number
    endLine: number
    totalLines: number
    truncated: boolean
  }> {
    const start = bounded(startLine, 1, Number.MAX_SAFE_INTEGER, 'start_line')
    const count = bounded(maxLines, this.config.maxResults, this.config.maxResults, 'max_lines')
    const target = await this.resolve(input, signal)
    const text = await this.textFile(target, signal)
    const lines = text.length === 0 ? [] : text.split(/\r?\n/)
    if (lines[lines.length - 1] === '' && text.endsWith('\n')) lines.pop()
    const selected = lines.slice(start - 1, start - 1 + count)
    const full = selected.join('\n')
    const result = {
      path: this.relative(target), content: full.slice(0, this.config.maxOutputChars), startLine: start,
      endLine: selected.length === 0 ? start - 1 : start + selected.length - 1,
      totalLines: lines.length,
      truncated: full.length > this.config.maxOutputChars || start - 1 + selected.length < lines.length,
    }
    if (!this.fits({ ...result, content: '', truncated: true })) {
      throw new LlmError('File location metadata exceeds the configured output budget', 'OUTPUT_TOO_LARGE')
    }
    while (!this.fits(result)) {
      const overflow = JSON.stringify(result).length - this.config.maxOutputChars
      result.content = result.content.slice(0, Math.max(0, result.content.length - Math.max(1, Math.ceil(overflow / 2))))
      result.truncated = true
    }
    result.endLine = result.content.length === 0 ? start - 1 : start + result.content.split('\n').length - 1
    return result
  }

  /** Traverse ordinary directories only; fixed budgets limit work even without a match. */
  private async* walk(input: string, signal?: AbortSignal): AsyncGenerator<{ target: string; truncated: boolean }> {
    const root = await this.resolve(input, signal)
    if (!(await stat(root)).isDirectory()) throw new LlmError('Search path must name a directory', 'INVALID_ARGS')
    const pending = [{ target: root, depth: 0 }]
    let visited = 0
    let cut = false
    while (pending.length > 0) {
      signal?.throwIfAborted()
      const next = pending.pop()
      if (next === undefined) break
      const current = await this.resolve(next.target, signal)
      const directory = await opendir(current)
      for await (const entry of directory) {
        signal?.throwIfAborted()
        visited++
        if (visited > this.config.maxVisitedEntries) { yield { target: '', truncated: true }; return }
        if (entry.isSymbolicLink()) continue
        const target = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (this.config.excludedDirectories.includes(entry.name)) continue
          if (next.depth >= this.config.maxDepth) { cut = true; continue }
          pending.push({ target, depth: next.depth + 1 })
        } else if (entry.isFile()) {
          yield { target: await this.resolve(target, signal), truncated: false }
        }
      }
    }
    if (cut) yield { target: '', truncated: true }
  }

  /** Find files by literal substring of their workspace-relative path.
   * @param query - non-empty literal path text; no regex or glob evaluation.
   * @param input - search directory, default workspace root.
   * @param limit - result count capped by maxResults.
   * @param signal - cooperative cancellation.
   * @returns matching paths, inspected count, and truncation.
   */
  async searchFiles(query: string, input = '.', limit?: number, signal?: AbortSignal): Promise<{ paths: string[]; scanned: number; truncated: boolean }> {
    if (query.length === 0) throw new LlmError('query must not be empty', 'INVALID_ARGS')
    const maximum = bounded(limit, this.config.maxResults, this.config.maxResults, 'limit')
    const paths: string[] = []
    let scanned = 0
    let truncated = false
    for await (const item of this.walk(input, signal)) {
      if (item.truncated) { truncated = true; break }
      scanned++
      const display = this.relative(item.target)
      if (!display.toLowerCase().includes(query.toLowerCase())) continue
      if (paths.length >= maximum || !this.fits({ paths: [...paths, display], scanned, truncated: false })) { truncated = true; break }
      paths.push(display)
    }
    const result = { paths: paths.sort(), scanned, truncated }
    while (!this.fits(result) && result.paths.length > 0) { result.paths.pop(); result.truncated = true }
    return result
  }

  /** Find literal text matches in bounded UTF-8 files.
   * @param query - non-empty literal text; no regular expressions are run.
   * @param input - search directory, default workspace root.
   * @param caseSensitive - whether to preserve case, default false.
   * @param limit - maximum matches capped by maxResults.
   * @param signal - cooperative cancellation.
   * @returns line matches, inspected/skipped file counts, and truncation.
   */
  async searchContent(query: string, input = '.', caseSensitive = false, limit?: number, signal?: AbortSignal): Promise<{
    matches: TextMatch[]
    scanned: number
    skipped: number
    truncated: boolean
  }> {
    if (query.length === 0) throw new LlmError('query must not be empty', 'INVALID_ARGS')
    const maximum = bounded(limit, this.config.maxResults, this.config.maxResults, 'limit')
    const needle = caseSensitive ? query : query.toLowerCase()
    const matches: TextMatch[] = []
    let scanned = 0
    let skipped = 0
    let truncated = false
    for await (const item of this.walk(input, signal)) {
      if (item.truncated) { truncated = true; break }
      scanned++
      let text: string
      try { text = await this.textFile(item.target, signal) } catch (error) {
        if (error instanceof LlmError && ['NOT_TEXT_FILE', 'FILE_TOO_LARGE'].includes(error.code)) { skipped++; continue }
        throw error
      }
      const lines = text.split(/\r?\n/)
      for (let index = 0; index < lines.length; index++) {
        signal?.throwIfAborted()
        const line = lines[index]
        if (line === undefined || !(caseSensitive ? line : line.toLowerCase()).includes(needle)) continue
        const display = this.relative(item.target)
        const match = { path: display, line: index + 1, text: line.slice(0, this.config.maxOutputChars) }
        if (matches.length >= maximum || !this.fits({ matches: [...matches, { ...match, text: '' }], scanned, skipped, truncated: false })) { truncated = true; break }
        while (!this.fits({ matches: [...matches, match], scanned, skipped, truncated: false })) {
          const serializedLength = JSON.stringify({ matches: [...matches, match], scanned, skipped, truncated: false }).length
          const overflow = serializedLength - this.config.maxOutputChars
          match.text = match.text.slice(0, Math.max(0, match.text.length - Math.max(1, Math.ceil(overflow / 2))))
        }
        matches.push(match)
        if (match.text.length < line.length) { truncated = true; break }
      }
      if (truncated) break
    }
    const result = { matches, scanned, skipped, truncated }
    while (!this.fits(result) && result.matches.length > 0) { result.matches.pop(); result.truncated = true }
    return result
  }
}
