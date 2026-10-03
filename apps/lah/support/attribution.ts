/** Build-owned identity for the bundled LAH application. */
import manifest from '../package.json'
export interface AppIdentity { product: string; version: string; url: string }
export const APP_IDENTITY: AppIdentity = { product: 'local-agent-harness', version: manifest.version, url: 'urn:lah:local-agent-harness' }
/** Public product identity; contains no user or machine identifiers. */
export function userAgent(identity: AppIdentity = APP_IDENTITY): string {
  return `${identity.product}/${identity.version} (+${identity.url})`
}
/** Non-secret product header for the local model endpoint. */
export function attributionHeaders(identity: AppIdentity = APP_IDENTITY): Record<string, string> {
  return { 'user-agent': userAgent(identity) }
}
