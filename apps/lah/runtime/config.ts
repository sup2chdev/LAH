/** Validated deployment settings for the LAH local provider and read-only workspace. */
import z from '@deepseek-ai/schemastery'

/** One fixed local connection and workspace used by a running LAH session. */
export interface Config {
  endpoint: string
  model: string
  workspace: string
  appVersion: string
  contextWindow: number
  maxTokens: number
  requestTimeoutMs: number
  maxFileBytes: number
  maxOutputChars: number
  maxResults: number
  maxVisitedEntries: number
  maxDepth: number
  excludedDirectories: string[]
}

/** Loader-validated deployment fields; argument limits remain executor-enforced. */
export const Config = z.object({
  endpoint: z.string().default('http://127.0.0.1:1234/v1'),
  model: z.string().required(),
  workspace: z.string().required(),
  appVersion: z.string().default('0.0.1-prealpha'),
  contextWindow: z.number().step(1).min(512).max(10000000).default(32768),
  maxTokens: z.number().step(1).min(1).max(10000000).default(4096),
  requestTimeoutMs: z.number().step(1).min(100).max(2147483647).default(180000),
  maxFileBytes: z.number().step(1).min(1).max(100000000).default(1048576),
  maxOutputChars: z.number().step(1).min(128).max(1000000).default(24000),
  maxResults: z.number().step(1).min(1).max(1000).default(100),
  maxVisitedEntries: z.number().step(1).min(1).max(1000000).default(20000),
  maxDepth: z.number().step(1).min(0).max(100).default(12),
  excludedDirectories: z.array(z.string()).default(['.git', 'node_modules']),
})

/** Refuse remote endpoints, embedded credentials, and ambiguous endpoint suffixes.
 * @param endpoint - OpenAI-compatible API root, normally ending in /v1.
 * @returns normalized local API root without a trailing slash.
 */
export function localEndpoint(endpoint: string): string {
  const url = new URL(endpoint)
  const local = url.hostname === 'localhost' || url.hostname === '[::1]'
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
  if (!local || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('LAH endpoint must be an HTTP(S) loopback URL (localhost, 127.0.0.1, or ::1)')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('LAH endpoint cannot contain credentials, a query, or a fragment')
  }
  if (/\/chat\/completions\/?$/.test(url.pathname)) {
    throw new Error('LAH endpoint must name the API root, for example http://127.0.0.1:1234/v1')
  }
  return url.toString().replace(/\/+$/, '')
}

/** Resolve self-contained settings before registering any capability.
 * @param config - Loader-validated configuration.
 * @returns detached settings with a normalized endpoint.
 */
export function resolveConfig(config: Config): Config {
  if (config.model.trim().length === 0) throw new Error('LAH model must be a non-empty server model id')
  if (config.workspace.trim().length === 0) throw new Error('LAH workspace must name an existing directory')
  if (config.maxTokens >= config.contextWindow) throw new Error('LAH maxTokens must be smaller than contextWindow')
  return { ...config, model: config.model.trim(), endpoint: localEndpoint(config.endpoint) }
}
