/** Keyless OpenAI chat-completions transport for local text models and native tools. */
import { EventSourceParserStream } from 'eventsource-parser/stream'
import {
  attributionHeaders, LlmAdapter, LlmError, ToolCallId,
} from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock, GenerateOptions, LlmModelInfo, LlmResolvedModelInfo,
  RequestMessage, StreamChunk, TokenUsage,
} from '@deepseek-ai/dsh-llm'
import type { Config } from './config.ts'

/** Stable local provider route selected when creating an agent. */
export const LOCAL_PROVIDER = 'lah-local'

/** Validate an untrusted provider JSON object without coercion. */
function object(value: unknown, subject: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new LlmError(`${subject} must be a JSON object`, 'MALFORMED_RESPONSE')
  }
  return value as Record<string, unknown>
}

/** Refuse non-text input that the prealpha cannot serialize faithfully. */
function text(content: readonly ContentBlock[]): string {
  return content.map((block) => {
    switch (block.type) {
      case 'text': return block.text
      case 'reasoning': return ''
      case 'tool-call': return ''
      default: throw new LlmError(`LAH cannot send content block ${block.type} to a local text model`, 'UNSUPPORTED_CONTENT')
    }
  }).join('')
}

/** Serialize one existing logged message; tool ids and raw arguments remain exact. */
function wireMessage(message: RequestMessage): Record<string, unknown> {
  if (message.role === 'developer') throw new LlmError('LAH received an unprojected developer message', 'UNSUPPORTED_CONTENT')
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: text(message.content) }
  }
  const result: Record<string, unknown> = { role: message.role, content: text(message.content) }
  if (message.role === 'assistant') {
    const calls = message.content.filter(block => block.type === 'tool-call')
    if (calls.length > 0) {
      result.tool_calls = calls.map(call => ({
        id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments },
      }))
    }
    const reasoning = message.content.filter(block => block.type === 'reasoning').map(block => block.text).join('')
    if (reasoning.length > 0) {
      const metadata = message.source.replayState
      let field = 'reasoning_content'
      if (metadata !== null && typeof metadata === 'object' && 'response' in metadata) {
        const response = metadata.response
        if (response !== null && typeof response === 'object' && 'reasoningField' in response && response.reasoningField === 'reasoning') field = 'reasoning'
      }
      result[field] = reasoning
    }
  }
  return result
}

/** Produce the actual OpenAI-compatible JSON request.
 * @param options - immutable harness request.
 * @returns provider JSON with native tool schemas and no credentials.
 */
export function serializeRequest(options: GenerateOptions): Record<string, unknown> {
  const messages = options.messages.map(wireMessage)
  if (options.system !== undefined && options.system.length > 0) messages.unshift({ role: 'system', content: options.system })
  return {
    model: options.model, messages, stream: true, stream_options: { include_usage: true },
    ...options.tools === undefined || options.tools.length === 0 ? {} : {
      tools: options.tools.map(tool => ({
        type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      })),
      tool_choice: 'auto',
    },
    ...options.temperature === undefined ? {} : { temperature: options.temperature },
    ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
    ...options.stop === undefined ? {} : { stop: options.stop },
  }
}

/** Mutable streamed block, owned by exactly one response. */
interface StreamBlock {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  value: string
  id: string
  name: string
  started: boolean
}

/** Decode exact nonnegative token counters; optional counters may be absent. */
function token(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

/** Preserve provider accounting, including disjoint cache-hit input. */
function usageOf(raw: unknown): TokenUsage | undefined {
  if (raw === null || raw === undefined) return undefined
  const value = object(raw, 'usage')
  const prompt = token(value.prompt_tokens)
  const output = token(value.completion_tokens)
  if (prompt === undefined || output === undefined) return undefined
  const details = value.prompt_tokens_details === undefined ? {} : object(value.prompt_tokens_details, 'prompt_tokens_details')
  const cached = token(details.cached_tokens) ?? 0
  const completion = value.completion_tokens_details === undefined ? {} : object(value.completion_tokens_details, 'completion_tokens_details')
  const reasoning = token(completion.reasoning_tokens)
  const total = token(value.total_tokens)
  return {
    inputTokens: prompt - Math.min(cached, prompt), outputTokens: output,
    ...cached > 0 ? { cacheReadTokens: Math.min(cached, prompt) } : {},
    ...reasoning === undefined ? {} : { reasoningTokens: reasoning },
    ...total === undefined || total !== prompt + output ? {} : { totalTokens: total },
  }
}

/** Translate SSE data to harness chunks while preserving several interleaved tool calls.
 * @param body - fetch response body.
 * @param signal - request cancellation and timeout.
 * @returns complete blocks, authoritative usage, and one terminal finish.
 */
export async function* translateResponse(body: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<StreamChunk> {
  const decoder = new TextDecoder()
  const decoded = body.pipeThrough(new TransformStream<Uint8Array, string>({
    transform(chunk, controller) { controller.enqueue(decoder.decode(chunk, { stream: true })) },
    flush(controller) { const tail = decoder.decode(); if (tail) controller.enqueue(tail) },
  }))
  const events = decoded.pipeThrough(new EventSourceParserStream())
  const blocks: StreamBlock[] = []
  const tools = new Map<number, StreamBlock>()
  let plain: StreamBlock | undefined
  let reasoning: StreamBlock | undefined
  let reasoningField: 'reasoning' | 'reasoning_content' | undefined
  let finish: string | undefined
  let usage: TokenUsage | undefined
  let done = false
  for await (const frame of events) {
    signal.throwIfAborted()
    if (frame.data === '[DONE]') { done = true; break }
    let raw: unknown
    try { raw = JSON.parse(frame.data) } catch (error) {
      throw new LlmError('Local model stream contains invalid JSON', 'MALFORMED_RESPONSE', { cause: error })
    }
    const event = object(raw, 'stream event')
    if (event.error !== undefined) throw new LlmError('Local model server returned a stream error', 'PROVIDER_ERROR')
    usage = usageOf(event.usage) ?? usage
    if (!Array.isArray(event.choices)) throw new LlmError('Local model stream has no choices array', 'MALFORMED_RESPONSE')
    for (const rawChoice of event.choices) {
      const choice = object(rawChoice, 'choice')
      if (choice.index !== undefined && choice.index !== 0) throw new LlmError('LAH expects one completion choice', 'MALFORMED_RESPONSE')
      if (choice.finish_reason !== null && choice.finish_reason !== undefined) {
        if (typeof choice.finish_reason !== 'string') throw new LlmError('Invalid finish_reason', 'MALFORMED_RESPONSE')
        finish = choice.finish_reason
      }
      const delta = choice.delta === undefined ? {} : object(choice.delta, 'choice delta')
      if (delta.reasoning !== undefined && delta.reasoning !== null) reasoningField = 'reasoning'
      else if (delta.reasoning_content !== undefined && delta.reasoning_content !== null) reasoningField = 'reasoning_content'
      const updates: ['text' | 'reasoning', unknown][] = [
        ['reasoning', delta.reasoning ?? delta.reasoning_content], ['text', delta.content],
      ]
      for (const [kind, value] of updates) {
        if (value === undefined || value === null || value === '') continue
        if (typeof value !== 'string') throw new LlmError(`Invalid streamed ${kind}`, 'MALFORMED_RESPONSE')
        let block = kind === 'text' ? plain : reasoning
        if (block === undefined) {
          block = { index: blocks.length, kind, value: '', id: '', name: '', started: true }
          blocks.push(block)
          if (kind === 'text') plain = block
          else reasoning = block
          yield { type: 'block-start', index: block.index, blockType: kind }
        }
        block.value += value
        yield { type: kind === 'text' ? 'text-delta' : 'reasoning-delta', index: block.index, text: value }
      }
      if (delta.tool_calls !== undefined && !Array.isArray(delta.tool_calls)) throw new LlmError('Invalid tool_calls delta', 'MALFORMED_RESPONSE')
      if (Array.isArray(delta.tool_calls)) {
        for (const rawTool of delta.tool_calls) {
          const tool = object(rawTool, 'tool call')
          if (typeof tool.index !== 'number' || !Number.isSafeInteger(tool.index) || tool.index < 0) {
            throw new LlmError('Streamed tool call must have a nonnegative index', 'MALFORMED_RESPONSE')
          }
          let block = tools.get(tool.index)
          if (block === undefined) {
            block = { index: blocks.length, kind: 'tool-call', value: '', id: '', name: '', started: false }
            tools.set(tool.index, block)
            blocks.push(block)
          }
          if (tool.id !== undefined) {
            if (typeof tool.id !== 'string' || tool.id.length === 0 || (block.id.length > 0 && block.id !== tool.id)) {
              throw new LlmError('Streamed tool call has an invalid or changing id', 'MALFORMED_RESPONSE')
            }
            block.id = tool.id
          }
          const fn = tool.function === undefined ? {} : object(tool.function, 'tool function')
          if (fn.name !== undefined && typeof fn.name !== 'string') throw new LlmError('Invalid tool function name', 'MALFORMED_RESPONSE')
          if (fn.arguments !== undefined && typeof fn.arguments !== 'string') throw new LlmError('Invalid tool arguments fragment', 'MALFORMED_RESPONSE')
          const nameDelta = typeof fn.name === 'string' ? fn.name : ''
          const argsDelta = typeof fn.arguments === 'string' ? fn.arguments : ''
          block.name += nameDelta
          block.value += argsDelta
          // A missing initial id must not publish a provisional id that later changes.
          if (block.id.length > 0) {
            if (!block.started) {
              block.started = true
              yield { type: 'block-start', index: block.index, blockType: 'tool-call' }
              yield { type: 'tool-call-delta', index: block.index, id: ToolCallId(block.id), name: block.name, argumentsDelta: block.value }
            } else {
              yield { type: 'tool-call-delta', index: block.index, id: ToolCallId(block.id), ...nameDelta.length === 0 ? {} : { name: block.name }, argumentsDelta: argsDelta }
            }
          }
        }
      }
    }
  }
  if (!done || finish === undefined) throw new LlmError('Local model stream ended before completion', 'INCOMPLETE_RESPONSE')
  if (!['stop', 'tool_calls', 'length'].includes(finish)) throw new LlmError(`Unsupported local finish reason: ${finish}`, 'PROVIDER_ERROR')
  for (const block of blocks) {
    if (block.kind === 'tool-call') {
      if (!block.started || block.id.length === 0 || block.name.length === 0) {
        throw new LlmError('Local model returned an incomplete tool call', 'MALFORMED_RESPONSE')
      }
      yield { type: 'block-end', index: block.index, block: { type: 'tool-call', id: ToolCallId(block.id), name: block.name, arguments: block.value } }
    } else {
      yield { type: 'block-end', index: block.index, block: { type: block.kind, text: block.value } }
    }
  }
  if (usage !== undefined) yield { type: 'usage', usage }
  yield {
    type: 'finish', reason: { kind: finish === 'length' ? 'max-tokens' : tools.size > 0 ? 'tool-calls' : 'stop' },
    ...reasoningField === undefined ? {} : { replayState: { response: { reasoningField } } },
  }
}

/** Native-tool adapter with no account, key resolver, cloud discovery, or telemetry. */
export class LocalAdapter extends LlmAdapter {
  constructor(private readonly config: Config) { super() }

  override providerInfo(provider: string) { return { id: provider, name: 'LAH local server' } }

  override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve([{ provider, id: this.config.model, name: this.config.model, inputModalities: ['text'] }])
  }

  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    if (model !== this.config.model) throw new LlmError('Local model id differs from the configured server model', 'MODEL_NOT_CONFIGURED')
    return Promise.resolve({
      provider, id: model, name: model, inputModalities: ['text'],
      context: { contextWindow: this.config.contextWindow }, defaultMaxTokens: this.config.maxTokens,
    })
  }

  override async* stream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const controller = new AbortController()
    const timeout = AbortSignal.timeout(this.config.requestTimeoutMs)
    const signal = AbortSignal.any([controller.signal, timeout, ...options.signal === undefined ? [] : [options.signal]])
    try {
      signal.throwIfAborted()
      const response = await fetch(`${this.config.endpoint}/chat/completions`, {
        method: 'POST', redirect: 'error', signal, body: JSON.stringify(serializeRequest(options)),
        headers: {
          ...attributionHeaders({ product: 'lah', version: this.config.appVersion, url: 'https://github.com/deepseek-ai/deepseek-harness' }),
          'content-type': 'application/json', accept: 'text/event-stream',
        },
      })
      if (!response.ok) {
        await response.body?.cancel()
        throw new LlmError(`Local model server returned HTTP ${response.status}`, 'HTTP_ERROR', { status: response.status })
      }
      if (response.body === null) throw new LlmError('Local model server returned no response body', 'EMPTY_RESPONSE')
      yield* translateResponse(response.body, signal)
    } catch (error) {
      if (options.signal?.aborted) throw new LlmError('Local model request cancelled', 'ABORTED', { cause: error })
      if (timeout.aborted) throw new LlmError('Local model request timed out', 'TIMEOUT', { cause: error })
      if (error instanceof LlmError) throw error
      throw new LlmError('Cannot contact local model server', 'TRANSPORT', { cause: error })
    } finally {
      controller.abort()
    }
  }
}
