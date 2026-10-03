/** Run the actual desktop IPC path and real tools with a deterministic local model substitute. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const appRoot = resolve(import.meta.dirname, '..')
const outputRoot = resolve(appRoot, 'test-output')
await mkdir(outputRoot, { recursive: true })
const ownedRoot = await mkdtemp(join(outputRoot, 'desktop-e2e-'))
const workspace = join(ownedRoot, 'workspace')
const userData = join(ownedRoot, 'data')
await mkdir(workspace)
await writeFile(join(workspace, 'README.md'), 'Desktop marker: violet-472\n')
let modelCalls = 0
const server = createServer(async (request, response) => {
  assert.equal(request.headers.authorization, undefined)
  assert.equal(request.headers.cookie, undefined)
  if (request.method === 'GET' && request.url === '/v1/models') {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ data: [{ id: 'lah-test' }] })); return
  }
  const chunks = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  assert.equal(body.model, 'lah-test')
  assert.equal(body.tools.length, 4)
  response.writeHead(200, { 'Content-Type': 'text/event-stream' })
  const delta = ++modelCalls === 1
    ? { tool_calls: [{ index: 0, id: 'desktop-read', type: 'function', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] }
    : { content: 'Маркер в README.md: violet-472.' }
  if (modelCalls === 2) assert.ok(body.messages.some(message => message.role === 'tool' && message.content.includes('violet-472')))
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`)
  response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: modelCalls === 1 ? 'tool_calls' : 'stop' }] })}\n\n`)
  response.end('data: [DONE]\n\n')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let child
try {
  const address = server.address()
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE
  child = spawn(require('electron'), [resolve(appRoot, 'dist'), '--lah-smoke', `--lah-data=${userData}`, `--lah-e2e-url=http://127.0.0.1:${address.port}/v1`, `--lah-e2e-workspace=${workspace}`], { windowsHide: true, stdio: 'pipe', env })
  let diagnostics = ''
  child.stdout.on('data', chunk => { diagnostics += chunk.toString() })
  child.stderr.on('data', chunk => { diagnostics += chunk.toString() })
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', resolve)
    const deadline = setTimeout(() => { child.kill(); reject(new Error('LAH desktop e2e timed out')) }, 60000)
    child.once('exit', () => clearTimeout(deadline))
  })
  assert.equal(code, 0, diagnostics)
  const result = JSON.parse(await readFile(join(userData, 'smoke-result.json'), 'utf8'))
  assert.equal(result.title, 'LAH — Local Agent Harness')
  assert.equal(result.integration.models.models[0].id, 'lah-test')
  assert.equal(result.integration.reply.content, 'Маркер в README.md: violet-472.')
  assert.equal(result.integration.state.sessions[0].messages.length, 2)
  assert.equal(modelCalls, 2)
  assert.equal(await readFile(join(workspace, 'README.md'), 'utf8'), 'Desktop marker: violet-472\n')
  const persisted = JSON.parse(await readFile(join(userData, 'lah-state.json'), 'utf8'))
  assert.ok(persisted.sessions[0].events.some(event => event.type === 'tool/result'))
  await writeFile(join(outputRoot, 'desktop-e2e-result.json'), JSON.stringify({ result: 'PASS', modelCalls, title: result.title, tools: result.state.tools.map(tool => tool.name) }, null, 2))
  await writeFile(join(outputRoot, 'desktop-e2e.png'), await readFile(join(userData, 'desktop.png')))
  console.log('LAH_DESKTOP_E2E_PASS: own window, settings, discovery, tool execution, history; no model installed.')
} finally {
  if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)) }
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  // The directory was allocated atomically under this app's test-output root.
  if (!ownedRoot.startsWith(outputRoot + '\\') && !ownedRoot.startsWith(outputRoot + '/')) throw new Error('Unexpected test directory')
  await rm(ownedRoot, { recursive: true, force: true })
}
