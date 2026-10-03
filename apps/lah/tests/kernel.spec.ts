/** Exercise the bundled desktop profile against an owned local HTTP server. */
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { createLahKernel } = require('../dist/kernel.cjs') as typeof import('../kernel.ts')
const cleanup: (() => Promise<void>)[] = []
afterEach(async () => { while (cleanup.length) await cleanup.pop()!() })

type WireRequest = {
  tools: { function: { name: string } }[]
  messages: { role: string; content: string | null }[]
}
type KernelEvent = Parameters<Parameters<typeof createLahKernel>[1]>[0]

async function fixture(handler: (body: WireRequest, response: ServerResponse, request: IncomingMessage) => void) {
  const workspace = await mkdtemp(join(tmpdir(), 'lah-kernel-'))
  cleanup.push(() => rm(workspace, { recursive: true, force: true }))
  await writeFile(join(workspace, 'README.md'), 'LAH fixture: violet-472\nRead only.\n')
  const requests: WireRequest[] = []
  const server = createServer((request, response) => {
    let text = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => { text += String(chunk) })
    request.on('end', () => {
      const body = JSON.parse(text) as WireRequest
      requests.push(body)
      handler(body, response, request)
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanup.push(async () => {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close((error) => { if (error) reject(error); else resolve() }))
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No fixture port')
  return { workspace, requests, settings: { workspace, endpoint: `http://127.0.0.1:${address.port}/v1`, model: 'lah-test', contextWindow: 32768, maxTokens: 1024 } }
}

function stream(response: ServerResponse, delta: Record<string, unknown>, finish: string) {
  response.writeHead(200, { 'Content-Type': 'text/event-stream' })
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`)
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: finish }] })}\n\n`)
  response.end('data: [DONE]\n\n')
}

describe('bundled LAH profile', () => {
  it('calls two native read-only tools, records exact results and resumes logged history without credentials', async () => {
    let calls = 0
    const fixtureData = await fixture((body, response, request) => {
      expect(request.headers.authorization).toBeUndefined()
      expect(request.headers.cookie).toBeUndefined()
      if (++calls === 1) stream(response, { tool_calls: [
        { index: 0, id: 'read-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } },
        { index: 1, id: 'search-1', type: 'function', function: { name: 'search_content', arguments: '{"query":"violet"}' } },
      ] }, 'tool_calls')
      else stream(response, { content: calls === 2 ? 'Found violet-472 in README.md.' : 'Still violet-472.' }, 'stop')
    })
    const events: KernelEvent[] = []
    const kernel = await createLahKernel(fixtureData.settings, event => events.push(event))
    cleanup.push(() => kernel.close())
    const first = await kernel.run('lah-fixture', 'Find the marker in README.')
    expect(first.error).toBeUndefined()
    expect(events.filter(event => event.type === 'trajectory').map(event => event.event)).toEqual(first.events)
    expect(first.content).toBe('Found violet-472 in README.md.')
    expect(fixtureData.requests[0].tools.map(tool => tool.function.name)).toEqual(['list_directory', 'read_file', 'search_content', 'search_files'])
    const results = fixtureData.requests[1].messages.filter(message => message.role === 'tool')
    expect(results).toHaveLength(2)
    expect(results.every(message => message.content?.includes('violet-472'))).toBe(true)
    expect(await readFile(join(fixtureData.workspace, 'README.md'), 'utf8')).toBe('LAH fixture: violet-472\nRead only.\n')
    // The session-driven expected output pins model-visible text and arguments from the real loop.
    const transcript = first.events.filter(event => ['user/message', 'assistant/message', 'tool/call'].includes(event.type)).map((event) => {
      if (event.type === 'user/message') return { role: 'user', content: event.data.content.filter(block => block.type === 'text').map(block => block.text).join('') }
      if (event.type === 'assistant/message') return { role: 'assistant', content: event.data.message.content.filter(block => block.type === 'text').map(block => block.text).join('') }
      if (event.type === 'tool/call') return { tool: event.data.name, arguments: event.data.arguments }
      throw new Error('Unexpected transcript event')
    })
    expect(transcript).toEqual(JSON.parse(await readFile(new URL('./expected/read-only-transcript.json', import.meta.url), 'utf8')))
    await kernel.close()
    const resumedEvents: KernelEvent[] = []
    const resumed = await createLahKernel(fixtureData.settings, event => resumedEvents.push(event))
    cleanup.push(() => resumed.close())
    const second = await resumed.run('lah-fixture', 'Remind me of the marker.', first.events)
    expect(second.content).toBe('Still violet-472.')
    const restoredLedger = resumedEvents.find(event => event.type === 'trajectory-snapshot')?.events
    expect(restoredLedger?.slice(0, first.events.length)).toEqual(first.events)
    expect(restoredLedger?.at(-1)?.type).toBe('session/end-seed')
    expect(resumedEvents.filter(event => event.type === 'trajectory').map(event => event.event)).toEqual(second.events.slice(restoredLedger!.length))
    expect(fixtureData.requests[2].messages.some(message => message.content === 'Found violet-472 in README.md.')).toBe(true)
    expect(events.some(event => event.type === 'tool' && event.result)).toBe(true)
  })

  it('returns a denied tool result for a write call so the same loop can recover', async () => {
    const data = await fixture((body, response) => {
      if (body.messages.at(-1)?.role === 'user') stream(response, { tool_calls: [
        { index: 0, id: 'write-1', type: 'function', function: { name: 'write_file', arguments: '{"path":"README.md","content":"changed"}' } },
      ] }, 'tool_calls')
      else stream(response, { content: 'I can only read files.' }, 'stop')
    })
    const kernel = await createLahKernel(data.settings, () => {})
    cleanup.push(() => kernel.close())
    const result = await kernel.run('lah-no-write', 'Try a write.')
    expect(result.content).toBe('I can only read files.')
    expect(result.events.some(event => event.type === 'tool/result' && event.data.message.isError)).toBe(true)
    expect(await readFile(join(data.workspace, 'README.md'), 'utf8')).toContain('violet-472')
  })
})
