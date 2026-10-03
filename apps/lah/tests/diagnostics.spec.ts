import { createRequire } from 'node:module'
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
type Log = {
  write(level: string, event: string, fields?: Record<string, unknown>): Promise<void>
  flush(): Promise<void>
  readRecords(): Promise<{ index: number }[]>
  status(): { error: string | null }
}
const { createDiagnosticLog, errorFields } = require('../desktop/diagnostics.cjs') as {
  createDiagnosticLog: (directory: string, options?: { maxBytes?: number; retained?: number; clock?: () => string }) => Log
  errorFields: (error: Error) => { message: string; stack: string }
}
const owned: string[] = []
afterEach(async () => { for (const path of owned.splice(0)) await rm(path, { recursive: true, force: true }) })
async function directory() { const path = await mkdtemp(join(tmpdir(), 'lah-diagnostics-')); owned.push(path); return path }

describe('bounded local diagnostics', () => {
  it('serializes concurrent writes and reads across rotation into complete bounded JSONL files', async () => {
    const path = await directory(), log = createDiagnosticLog(path, { maxBytes: 256, retained: 3, clock: () => 'fixed' })
    const writes = Array.from({ length: 8 }, (_, index) => log.write('info', 'test', { index }))
    const snapshot = log.readRecords()
    writes.push(log.write('info', 'test', { index: 8 }))
    await Promise.all(writes)
    expect((await snapshot).at(-1)?.index).toBe(7)
    expect((await log.readRecords()).at(-1)?.index).toBe(8)
    await log.flush()
    const files = await readdir(path)
    expect(files.length).toBeLessThanOrEqual(3)
    for (const file of files) {
      expect((await stat(join(path, file))).size).toBeLessThanOrEqual(256)
      for (const line of (await readFile(join(path, file), 'utf8')).trim().split('\n')) expect(() => { JSON.parse(line) }).not.toThrow()
    }
  })
  it('reports actual filesystem failures and rejects oversized records without losing earlier logs', async () => {
    const path = await directory(), obstruction = join(path, 'file')
    await writeFile(obstruction, 'owned fixture')
    const broken = createDiagnosticLog(obstruction)
    await expect(broken.write('error', 'test')).rejects.toThrow()
    expect(broken.status().error).toBeTruthy()
    await expect(broken.flush()).rejects.toThrow()
    const log = createDiagnosticLog(path, { maxBytes: 256 })
    await log.write('info', 'first')
    await expect(log.write('info', 'large', { text: 'x'.repeat(500) })).rejects.toThrow('exceeds')
    expect(await log.readRecords()).toHaveLength(1)
    expect(errorFields(new Error('failure')).message).toBe('failure')
  })
})
