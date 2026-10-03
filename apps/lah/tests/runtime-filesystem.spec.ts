import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import LlmRuntime, { ToolCallId } from '@deepseek-ai/dsh-llm'
import { ReadOnlyWorkspace } from '../runtime/filesystem.ts'
import { createTools } from '../runtime/index.ts'
import * as LocalRuntime from '../runtime/index.ts'
import type { Config } from '../runtime/config.ts'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

async function fixture(overrides: Partial<Config> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lah-runtime-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const workspace = path.join(root, 'workspace')
  await mkdir(workspace)
  const config: Config = {
    endpoint: 'http://127.0.0.1:1234/v1', model: 'test-local', workspace,
    appVersion: '0.0.1-prealpha', contextWindow: 32768, maxTokens: 4096,
    requestTimeoutMs: 10000, maxFileBytes: 1024, maxOutputChars: 512,
    maxResults: 10, maxVisitedEntries: 100, maxDepth: 4, excludedDirectories: ['.git', 'node_modules'],
    ...overrides,
  }
  return { root, workspace, config, reader: await ReadOnlyWorkspace.create(config) }
}

describe('LAH read-only tools', () => {
  it('reads line windows and searches literal content without changing files', async () => {
    const { workspace, reader } = await fixture()
    await mkdir(path.join(workspace, 'docs'))
    const target = path.join(workspace, 'docs', 'Guide.md')
    const original = 'first\nNEEDLE.* is literal\nthird\n'
    await writeFile(target, original)
    expect(await reader.read('docs/Guide.md', 2, 1)).toEqual({
      path: 'docs/Guide.md', content: 'NEEDLE.* is literal', startLine: 2, endLine: 2, totalLines: 3, truncated: true,
    })
    expect((await reader.searchFiles('GUIDE')).paths).toEqual(['docs/Guide.md'])
    expect((await reader.searchContent('needle.*')).matches).toEqual([{ path: 'docs/Guide.md', line: 2, text: 'NEEDLE.* is literal' }])
    expect((await reader.searchContent('needle.*', '.', true)).matches).toEqual([])
    expect(await readFile(target, 'utf8')).toBe(original)
  })

  it('rejects traversal and external junctions and does not search through links', async () => {
    const { root, workspace, reader } = await fixture()
    const outside = path.join(root, 'outside')
    await mkdir(outside)
    await writeFile(path.join(outside, 'secret.txt'), 'outside')
    await symlink(outside, path.join(workspace, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
    await expect(reader.read('../outside/secret.txt')).rejects.toMatchObject({ code: 'PATH_DENIED' })
    await expect(reader.read('linked/secret.txt')).rejects.toMatchObject({ code: 'PATH_DENIED' })
    expect((await reader.searchFiles('secret')).paths).toEqual([])
    expect((await reader.list()).paths).toEqual([])
  })

  it('reports limits and skips oversized or binary content', async () => {
    const { workspace, reader } = await fixture({ maxResults: 1, maxFileBytes: 16 })
    await writeFile(path.join(workspace, 'a.txt'), 'one\ntwo\n')
    await writeFile(path.join(workspace, 'b.txt'), 'two')
    await writeFile(path.join(workspace, 'large.txt'), 'x'.repeat(17))
    await writeFile(path.join(workspace, 'binary.dat'), Buffer.from([0, 1, 2]))
    await expect(reader.read('large.txt')).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
    await expect(reader.read('binary.dat')).rejects.toMatchObject({ code: 'NOT_TEXT_FILE' })
    expect((await reader.searchFiles('.txt')).truncated).toBe(true)
    const misses = await reader.searchContent('absent')
    expect(misses.skipped).toBe(2)
    expect(misses.matches).toEqual([])
    await expect(reader.read('a.txt', 0)).rejects.toMatchObject({ code: 'INVALID_ARGS' })
    await expect(reader.searchFiles('', '.', 2)).rejects.toMatchObject({ code: 'INVALID_ARGS' })
  })

  it('executes through the actual registry and refuses invalid arguments or unregistered writers', async () => {
    const { workspace, reader } = await fixture()
    await writeFile(path.join(workspace, 'a.txt'), 'hello')
    const ctx = new Context()
    cleanup.push(() => ctx.fiber.dispose())
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    for (const tool of createTools(reader)) ctx.tools.register(tool)
    expect(ctx.tools.schemas().map(tool => tool.name).sort()).toEqual(['list_directory', 'read_file', 'search_content', 'search_files'])
    const signal = new AbortController().signal
    const result = await ctx.tools.execute({ name: 'read_file', callId: ToolCallId('read'), arguments: { path: 'a.txt' }, signal })
    expect(result.isError).toBe(false)
    const invalid = await ctx.tools.execute({ name: 'read_file', callId: ToolCallId('invalid'), arguments: { path: 123 }, signal })
    expect(invalid.isError).toBe(true)
    const denied = await ctx.tools.execute({ name: 'write_file', callId: ToolCallId('write'), arguments: { path: 'a.txt', content: 'changed' }, signal })
    expect(denied.isError).toBe(true)
    expect(await readFile(path.join(workspace, 'a.txt'), 'utf8')).toBe('hello')
  })

  it('bounds complete JSON output including escaped text and location metadata', async () => {
    const { workspace, reader } = await fixture({ maxOutputChars: 180 })
    await writeFile(path.join(workspace, 'quotes.txt'), '"'.repeat(300))
    const read = await reader.read('quotes.txt')
    expect(JSON.stringify(read).length).toBeLessThanOrEqual(180)
    expect(read.truncated).toBe(true)
    const matches = await reader.searchContent('"')
    expect(JSON.stringify(matches).length).toBeLessThanOrEqual(180)
    expect(matches.truncated).toBe(true)
  })

  it('unregisters the local adapter, tools, and prompt when its contributing fiber unloads', async () => {
    const { config } = await fixture()
    const ctx = new Context()
    cleanup.push(() => ctx.fiber.dispose())
    await ctx.plugin(LlmRuntime)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    const fiber = await ctx.plugin(LocalRuntime, config)
    expect(ctx.llm.listProviders().map(provider => provider.id)).toEqual(['lah-local'])
    expect(ctx.tools.schemas()).toHaveLength(4)
    await fiber.dispose()
    expect(ctx.llm.listProviders()).toEqual([])
    expect(ctx.tools.schemas()).toEqual([])
    expect((await ctx.systemPrompt.assemble()).sections.some(section => section.name === 'lah:workspace')).toBe(false)
  })
})
