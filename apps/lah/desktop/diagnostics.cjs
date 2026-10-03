/** Bounded local JSONL diagnostics. Message bodies and tool results are not logged here. */
const { mkdir, appendFile, stat, rename, rm, readFile } = require('node:fs/promises')
const { join } = require('node:path')

function errorFields(error) {
  return { name: String(error?.name ?? 'Error'), code: String(error?.code ?? 'UNKNOWN'), message: String(error?.message ?? error).slice(0, 2048), stack: typeof error?.stack === 'string' ? error.stack.slice(0, 8192) : undefined }
}
function createDiagnosticLog(directory, { maxBytes = 2 * 1024 * 1024, retained = 3, clock = () => new Date().toISOString() } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 256 || !Number.isSafeInteger(retained) || retained < 1 || retained > 10) throw new Error('Invalid diagnostic log limits')
  const path = join(directory, 'diagnostics.jsonl')
  let queue = Promise.resolve(), lastError = null
  async function size(file) { try { return (await stat(file)).size } catch (error) { if (error.code !== 'ENOENT') throw error; return 0 } }
  function write(level, event, fields = {}) {
    const line = JSON.stringify({ time: clock(), level, event, ...fields }) + '\n'
    if (Buffer.byteLength(line) > maxBytes) return Promise.reject(new Error('Diagnostic record exceeds log size limit'))
    queue = queue.catch(() => {}).then(async () => {
      await mkdir(directory, { recursive: true })
      if (await size(path) + Buffer.byteLength(line) > maxBytes) {
        for (let index = retained - 1; index >= 1; index--) {
          const previous = index === 1 ? path : `${path}.${index - 1}`
          const next = `${path}.${index}`
          await rm(next, { force: true })
          if (await size(previous)) await rename(previous, next)
        }
        if (retained === 1) await rm(path, { force: true })
      }
      await appendFile(path, line, { mode: 0o600 })
      lastError = null
    }).catch(error => { lastError = error.message; throw error })
    return queue
  }
  function readRecords() {
    const reading = queue.then(async () => {
      const records = []
      for (let index = retained - 1; index >= 0; index--) {
        try { const text = await readFile(index ? `${path}.${index}` : path, 'utf8'); records.push(...text.split('\n').filter(Boolean).map(line => JSON.parse(line))) }
        catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      return records
    })
    queue = reading.then(() => {}, () => {})
    return reading
  }
  return { write, flush: () => queue, readRecords, status: () => ({ path, maxBytes, retained, error: lastError }) }
}
module.exports = { createDiagnosticLog, errorFields }
