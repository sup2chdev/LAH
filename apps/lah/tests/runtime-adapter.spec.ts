import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LocalAdapter, serializeRequest } from '../runtime/adapter.ts'
import { localEndpoint, resolveConfig } from '../runtime/config.ts'
import type { Config } from '../runtime/config.ts'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import { createAssistantMessage, createMessage, ToolCallId } from '@deepseek-ai/dsh-llm'

const cleanup: (() => Promise<void>)[] = []
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose()
})

const config = {
  endpoint: 'http://127.0.0.1:1234/v1', model: 'local-test', workspace: '.', appVersion: '0.0.1-prealpha',
  contextWindow: 32768, maxTokens: 4096, requestTimeoutMs: 10000, maxFileBytes: 1024,
  maxOutputChars: 512, maxResults: 10, maxVisitedEntries: 100, maxDepth: 4, excludedDirectories: [],
} satisfies Config

async function server(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const http = createServer(handler)
  cleanup.push(() => new Promise<void>((resolve, reject) => {
    http.close((error) => { if (error === undefined) resolve(); else reject(error) })
    http.closeAllConnections()
  }))
  await new Promise<void>((resolve, reject) => {
    http.once('error', reject)
    http.listen(0, '127.0.0.1', resolve)
  })
  const address = http.address()
  if (address === null || typeof address === 'string') throw new Error('Expected a bound TCP server')
  return `http://127.0.0.1:${address.port}/v1`
}

async function collect(adapter: LocalAdapter, overrides: Partial<GenerateOptions> = {}): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of adapter.stream({ provider: 'lah-local', model: 'local-test', messages: [{ role: 'user', content: [{ type: 'text', text: 'read files' }] }], ...overrides })) chunks.push(chunk)
  return chunks
}

describe('LAH local model adapter', () => {
  it('sends keyless native schemas and preserves interleaved tool arguments and usage', async () => {
    let requestBody = ''
    let authorization: string | undefined
    let url: string | undefined
    const endpoint = await server((request, response) => {
      authorization = request.headers.authorization
      url = request.url
      request.setEncoding('utf8')
      request.on('data', (data) => { requestBody += String(data) })
      request.on('end', () => {
        response.writeHead(200, { 'content-type': 'text/event-stream' })
        const frames = [
          { choices: [{ index: 0, delta: { reasoning_content: 'Inspect' }, finish_reason: null }] },
          { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'read_file', arguments: '{"path":' } }, { index: 1, id: 'call_b', function: { name: 'list_directory', arguments: '{' } }] }, finish_reason: null }] },
          { choices: [{ index: 0, delta: { tool_calls: [{ index: 1, function: { arguments: '"path":"."}' } }, { index: 0, function: { arguments: '"a.txt"}' } }] }, finish_reason: null }] },
          { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] },
          { choices: [], usage: {
            prompt_tokens: 20, completion_tokens: 5, total_tokens: 25, prompt_tokens_details: { cached_tokens: 3 },
          } },
        ]
        response.end(frames.map(frame => `data: ${JSON.stringify(frame)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n')
      })
    })
    const chunks = await collect(new LocalAdapter({ ...config, endpoint }), {
      tools: [{ name: 'read_file', description: 'Read text', parameters: { type: 'object', properties: { path: { type: 'string' } } } }], maxTokens: 10,
    })
    expect(authorization).toBeUndefined()
    expect(url).toBe('/v1/chat/completions')
    expect(JSON.parse(requestBody)).toMatchObject({ model: 'local-test', max_tokens: 10, tool_choice: 'auto', tools: [{ type: 'function', function: { name: 'read_file' } }] })
    expect(chunks.filter(chunk => chunk.type === 'block-end').map(chunk => chunk.block)).toEqual([
      { type: 'reasoning', text: 'Inspect' },
      { type: 'tool-call', id: 'call_a', name: 'read_file', arguments: '{"path":"a.txt"}' },
      { type: 'tool-call', id: 'call_b', name: 'list_directory', arguments: '{"path":"."}' },
    ])
    expect(chunks.slice(-2)).toEqual([{ type: 'usage', usage: { inputTokens: 17, outputTokens: 5, cacheReadTokens: 3, totalTokens: 25 } }, { type: 'finish', reason: { kind: 'tool-calls' }, replayState: { response: { reasoningField: 'reasoning_content' } } }])
  })

  it('refuses truncated streams and HTTP errors rather than reporting successful text', async () => {
    const truncated = await server((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end('data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n')
    })
    await expect(collect(new LocalAdapter({ ...config, endpoint: truncated }))).rejects.toMatchObject({ code: 'INCOMPLETE_RESPONSE' })
    const failed = await server((_request, response) => { response.writeHead(503); response.end('unavailable') })
    await expect(collect(new LocalAdapter({ ...config, endpoint: failed }))).rejects.toMatchObject({ code: 'HTTP_ERROR', failure: { status: 503 } })
  })

  it('supports vLLM reasoning deltas and replays their field name', async () => {
    const endpoint = await server((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end('data: {"choices":[{"index":0,"delta":{"reasoning":"inspect","content":"answer"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')
    })
    const chunks = await collect(new LocalAdapter({ ...config, endpoint }))
    expect(chunks.at(-1)).toEqual({ type: 'finish', reason: { kind: 'stop' }, replayState: { response: { reasoningField: 'reasoning' } } })
    const replay = serializeRequest({
      provider: 'lah-local', model: 'local-test', messages: [createAssistantMessage({
        source: { provider: 'lah-local', model: 'local-test', replayState: { response: { reasoningField: 'reasoning' } } },
        content: [{ type: 'reasoning', text: 'inspect' }, { type: 'text', text: 'answer' }],
      })],
    })
    expect(replay.messages).toEqual([{ role: 'assistant', content: 'answer', reasoning: 'inspect' }])
  })

  it('aborts a live HTTP response through the caller signal', async () => {
    let received!: () => void
    const requestReceived = new Promise<void>((resolve) => { received = resolve })
    const endpoint = await server((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.flushHeaders()
      received()
    })
    const controller = new AbortController()
    const stream = collect(new LocalAdapter({ ...config, endpoint }), { signal: controller.signal })
    await requestReceived
    controller.abort()
    await expect(stream).rejects.toMatchObject({ code: 'ABORTED' })
  })

  it('reports its configured deadline when a server never completes the response', async () => {
    const endpoint = await server((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.flushHeaders()
    })
    await expect(collect(new LocalAdapter({ ...config, endpoint, requestTimeoutMs: 100 }))).rejects.toMatchObject({ code: 'TIMEOUT' })
  })

  it('replays exact native tool correlation and refuses nonlocal or credentialed endpoints', () => {
    const id = ToolCallId('call_1')
    const body = serializeRequest({
      provider: 'lah-local', model: 'local-test', messages: [
        createAssistantMessage({ source: { provider: 'lah-local', model: 'local-test' }, content: [{ type: 'tool-call', id, name: 'read_file', arguments: '{"path":"a.txt"}' }] }),
        createMessage({ role: 'tool', source: { kind: 'tool', callId: id }, toolCallId: id, content: [{ type: 'text', text: 'hello' }] }),
      ],
    })
    expect(body.messages).toEqual([
      { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.txt"}' } }] },
      { role: 'tool', tool_call_id: 'call_1', content: 'hello' },
    ])
    expect(() => localEndpoint('https://example.com/v1')).toThrow('loopback')
    expect(() => localEndpoint('http://user:pass@localhost:1234/v1')).toThrow('credentials')
    expect(() => localEndpoint('http://localhost:1234/v1/chat/completions')).toThrow('API root')
    expect(localEndpoint('http://[::1]:8080/v1/')).toBe('http://[::1]:8080/v1')
    expect(() => resolveConfig({ ...config, maxTokens: config.contextWindow })).toThrow('smaller')
  })
})
