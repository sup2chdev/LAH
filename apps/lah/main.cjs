/** LAH's account-free desktop carrier; model requests use the fork's agent loop. */
const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron')
const { readFile, writeFile, mkdir, rename, stat } = require('node:fs/promises')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { randomUUID } = require('node:crypto')
const { createLahKernel } = require('./kernel.cjs')
const { trajectoryPage, trajectoryDetail } = require('./desktop/trajectory.cjs')
const { createDiagnosticLog, errorFields } = require('./desktop/diagnostics.cjs')

app.setName('LAH')
if (process.platform === 'win32') app.setAppUserModelId('LocalAgentHarness.LAH')
// The desktop UI leaves scarce GPU memory available to the separate local model server.
app.disableHardwareAcceleration()
const dataArgument = process.argv.find(value => value.startsWith('--lah-data='))
app.setPath('userData', dataArgument ? resolve(dataArgument.slice('--lah-data='.length)) : join(app.getPath('appData'), 'LocalAgentHarness'))
const smoke = process.argv.includes('--lah-smoke')
const statePath = join(app.getPath('userData'), 'lah-state.json')
const diagnosticLog = createDiagnosticLog(join(app.getPath('userData'), 'logs'))
const defaultSettings = { endpoint: 'http://127.0.0.1:1234/v1', model: '', contextWindow: 32768, maxTokens: 4096, workspace: '' }
let state = { settings: { ...defaultSettings }, sessions: [] }
let window
let kernel
let busy = false
let stopRequested = false
let closing = false
let writeQueue = Promise.resolve()
let activeRunId
const tools = [
  { name: 'list_directory', description: 'Список файлов и папок' },
  { name: 'search_files', description: 'Поиск файлов по имени' },
  { name: 'search_content', description: 'Поиск текста в файлах' },
  { name: 'read_file', description: 'Чтение файла с номерами строк' },
]

function parseEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Укажите адрес локального сервера.')
  const url = new URL(value)
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!['http:', 'https:'].includes(url.protocol) || !(host === 'localhost' || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host))) {
    throw new Error('В этой преальфе поддерживаются серверы на localhost, 127.0.0.1 или ::1.')
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('Адрес сервера должен быть без ключей, пароля и параметров.')
  return url.href.replace(/\/+$/, '')
}
function parseSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные настройки.')
  const endpoint = parseEndpoint(value.endpoint)
  if (typeof value.model !== 'string' || value.model.length > 256) throw new Error('Некорректный ID модели.')
  if (typeof value.workspace !== 'string' || value.workspace.length > 4096) throw new Error('Некорректная папка проекта.')
  const contextWindow = Number(value.contextWindow)
  const maxTokens = Number(value.maxTokens)
  if (!Number.isSafeInteger(contextWindow) || contextWindow < 1024 || contextWindow > 1048576) throw new Error('Размер контекста: от 1024 до 1048576 токенов.')
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || maxTokens >= contextWindow) throw new Error('Лимит ответа должен быть положительным и меньше контекста.')
  return { endpoint, model: value.model.trim(), workspace: value.workspace ? resolve(value.workspace) : '', contextWindow, maxTokens }
}
function publicState() {
  return { settings: state.settings, sessions: state.sessions.map(({ events, failures, ...session }) => ({ ...session, eventCount: events.length, failureCount: failures?.length ?? 0 })), tools, version: '0.0.1-prealpha', diagnostics: diagnosticLog.status() }
}
function emit(event) {
  if (window && !window.isDestroyed()) window.webContents.send('lah:event', event)
}
function publish() { emit({ type: 'state', state: publicState() }) }
function diagnose(level, event, fields = {}) {
  void diagnosticLog.write(level, event, fields).catch(error => { console.error('LAH diagnostic log:', error.message); emit({ type: 'diagnostic-error', message: error.message }) })
}
function sessionById(id) {
  if (typeof id !== 'string') throw new Error('Некорректный ID чата.')
  const session = state.sessions.find(item => item.id === id)
  if (!session) throw new Error('Чат не найден.')
  return session
}
function kernelEvent(event) {
  if (event.type === 'trajectory-snapshot') {
    const session = state.sessions.find(item => item.id === event.sessionId)
    if (session && event.events) { session.events = [...event.events]; emit({ type: 'trajectory', sessionId: session.id, revision: session.events.length }) }
    return
  }
  if (event.type !== 'trajectory') { emit(event); return }
  const session = state.sessions.find(item => item.id === event.sessionId)
  if (!session || !event.event) return
  const record = event.event
  if (record.seq === session.events.length) session.events.push(record)
  else if (record.seq < session.events.length) session.events[record.seq] = record
  else { diagnose('error', 'session/sequence-gap', { sessionId: session.id, expected: session.events.length, actual: record.seq }); return }
  const failure = record.type === 'turn/end' && record.data.reason?.kind === 'error' ? record.data.reason.error : undefined
  diagnose(failure || record.data.message?.isError ? 'error' : 'info', record.type, { sessionId: session.id, runId: activeRunId, seq: record.seq, turn: record.data.turn, step: record.data.step, tool: record.type === 'tool/call' ? record.data.name : undefined, callId: record.data.callId ?? record.data.message?.toolCallId, ...(failure ? { code: failure.code, status: failure.status, message: failure.message?.slice(0, 2048) } : {}) })
  emit({ type: 'trajectory', sessionId: session.id, revision: session.events.length })
  if (['turn/start', 'turn/end', 'tool/call', 'tool/result', 'assistant/message', 'assistant/attempt'].includes(record.type)) {
    void checkpoint(session.id)
  }
}
async function checkpoint(sessionId) {
  try { await persist() }
  catch (error) { diagnose('error', 'state/write-error', errorFields(error)); emit({ type: 'error', sessionId, message: 'Не удалось сохранить историю: ' + error.message }) }
}
function handle(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    assertOwner(event)
    const measured = !['lah:state', 'lah:trajectory', 'lah:trajectory-detail', 'lah:renderer-error'].includes(name)
    const requestId = randomUUID(), started = performance.now()
    if (measured) diagnose('info', 'ipc/start', { operation: name, requestId })
    try {
      const result = await handler(event, ...args)
      if (measured) diagnose('info', 'ipc/end', { operation: name, requestId, durationMs: Math.round(performance.now() - started) })
      return result
    } catch (error) {
      diagnose('error', 'ipc/error', { operation: name, requestId, durationMs: Math.round(performance.now() - started), ...errorFields(error) })
      throw error
    }
  })
}
function persist() {
  const document = JSON.stringify({ format: 1, ...state })
  if (Buffer.byteLength(document) > 64 * 1024 * 1024) throw new Error('История LAH достигла 64 МиБ. Новые данные не сохранены.')
  writeQueue = writeQueue.catch(() => {}).then(async () => {
    await mkdir(app.getPath('userData'), { recursive: true })
    const temporary = `${statePath}.${randomUUID()}.tmp`
    await writeFile(temporary, document, { mode: 0o600, flag: 'wx' })
    await rename(temporary, statePath)
  })
  return writeQueue
}
function assertOwner(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый отправитель запроса.')
}
function requireIdle() { if (busy) throw new Error('Дождитесь ответа или нажмите «Остановить».') }
async function closeKernel() {
  if (kernel) { const owned = kernel; kernel = undefined; await owned.close() }
}
function newSession() {
  if (state.sessions.length >= 100) throw new Error('В преальфе поддерживается до 100 чатов.')
  const session = { id: `lah-${randomUUID()}`, title: 'Новый чат', messages: [], events: [], workspace: state.settings.workspace }
  state.sessions.unshift(session)
  return session
}

handle('lah:state', () => publicState())
handle('lah:trajectory', (_event, input) => {
  if (!input || typeof input !== 'object') throw new Error('Некорректный запрос траектории.')
  return trajectoryPage(sessionById(input.sessionId), input)
})
handle('lah:trajectory-detail', (_event, input) => {
  if (!input || typeof input.key !== 'string' || input.key.length > 128) throw new Error('Некорректный запрос события.')
  return trajectoryDetail(sessionById(input.sessionId), input.key)
})
handle('lah:export-session', async (_event, sessionId) => {
  requireIdle()
  const session = structuredClone(sessionById(sessionId))
  const result = await dialog.showSaveDialog(window, { title: 'Экспорт траектории', defaultPath: 'LAH-trajectory.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (result.canceled || !result.filePath) return { canceled: true }
  const diagnostics = await diagnosticLog.readRecords()
  await writeFile(result.filePath, JSON.stringify({ format: 1, exportedAt: new Date().toISOString(), app: { name: 'LAH', version: '0.0.1-prealpha', electron: process.versions.electron, platform: process.platform }, session, diagnostics }, null, 2), { mode: 0o600 })
  return { canceled: false, path: result.filePath }
})
handle('lah:open-diagnostics', async () => {
  await mkdir(join(app.getPath('userData'), 'logs'), { recursive: true })
  const error = await shell.openPath(join(app.getPath('userData'), 'logs'))
  if (error) throw new Error(error)
})
handle('lah:renderer-error', (_event, input) => {
  if (!input || typeof input.message !== 'string') throw new Error('Некорректный отчёт об ошибке.')
  diagnose('error', 'renderer/error', { message: input.message.slice(0, 2048), stack: typeof input.stack === 'string' ? input.stack.slice(0, 8192) : undefined })
})
handle('lah:settings', async (_event, input) => {
  requireIdle()
  const settings = parseSettings(input)
  if (settings.workspace && !(await stat(settings.workspace)).isDirectory()) throw new Error('Выберите существующую папку проекта.')
  await closeKernel()
  state.settings = settings
  await persist(); publish()
  return publicState()
})
handle('lah:workspace', async () => {
  requireIdle()
  const result = await dialog.showOpenDialog(window, { title: 'Выберите папку проекта', properties: ['openDirectory'] })
  if (!result.canceled && result.filePaths[0]) {
    await closeKernel()
    state.settings.workspace = result.filePaths[0]
    await persist(); publish()
  }
  return { workspace: state.settings.workspace }
})
handle('lah:models', async (_event, endpoint) => {
  const base = parseEndpoint(endpoint)
  const response = await fetch(`${base}/models`, { signal: AbortSignal.timeout(10000), redirect: 'error' })
  if (!response.ok) throw new Error(`Сервер вернул HTTP ${response.status}. Проверьте URL с окончанием /v1.`)
  if (Number(response.headers.get('content-length')) > 1048576) throw new Error('Слишком большой список моделей.')
  const reader = response.body.getReader(); const chunks = []; let bytes = 0
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 1048576) { await reader.cancel(); throw new Error('Слишком большой список моделей.') }
      chunks.push(chunk.value)
    }
  } finally { reader.releaseLock() }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!Array.isArray(data.data)) throw new Error('Сервер не вернул OpenAI-совместимый список моделей.')
  return { models: data.data.filter(item => item && typeof item.id === 'string').slice(0, 1000).map(({ id }) => ({ id })) }
})
handle('lah:new-session', async () => {
  requireIdle()
  const session = newSession()
  await persist(); publish()
  return { sessionId: session.id }
})
handle('lah:send', async (_event, input) => {
  requireIdle()
  if (!input || typeof input.message !== 'string' || !input.message.trim() || input.message.length > 32000) throw new Error('Введите сообщение длиной до 32000 символов.')
  if (!state.settings.model || !state.settings.workspace) throw new Error('Выберите папку проекта и укажите модель в настройках.')
  if (input.sessionId !== undefined && typeof input.sessionId !== 'string') throw new Error('Некорректный ID чата.')
  let session = input.sessionId ? state.sessions.find(item => item.id === input.sessionId) : undefined
  if (input.sessionId && !session) throw new Error('Чат не найден.')
  session ??= newSession()
  if (session.workspace !== state.settings.workspace && session.messages.length) throw new Error('Этот чат относится к другой папке. Создайте новый чат.')
  session.workspace = state.settings.workspace
  busy = true
  stopRequested = false
  activeRunId = randomUUID()
  const started = performance.now()
  diagnose('info', 'run/start', { sessionId: session.id, runId: activeRunId, model: state.settings.model, endpoint: state.settings.endpoint, contextWindow: state.settings.contextWindow, maxTokens: state.settings.maxTokens })
  const message = input.message.trim()
  try {
    kernel ??= await createLahKernel(state.settings, kernelEvent)
    if (stopRequested) return { sessionId: session.id, content: '' }
    session.messages.push({ role: 'user', content: message })
    if (session.messages.length === 1) session.title = message.slice(0, 56)
    await persist(); publish()
    const result = await kernel.run(session.id, message, session.events)
    session.events = [...result.events]
    if (result.content) session.messages.push({ role: 'assistant', content: result.content })
    await persist(); publish()
    if (result.error) throw new Error(result.error)
    return { sessionId: session.id, content: result.content }
  } catch (error) {
    session.failures ??= []
    session.failures.push({ id: randomUUID(), time: Date.now(), runId: activeRunId, ...errorFields(error) })
    session.failures = session.failures.slice(-100)
    try { await persist(); publish() } catch (saveError) { diagnose('error', 'state/write-error', errorFields(saveError)) }
    diagnose('error', 'run/error', { sessionId: session.id, runId: activeRunId, ...errorFields(error) })
    emit({ type: 'error', sessionId: session.id, message: error.message })
    throw error
  } finally { diagnose('info', 'run/end', { sessionId: session.id, runId: activeRunId, durationMs: Math.round(performance.now() - started), stopped: stopRequested }); activeRunId = undefined; busy = false; emit({ type: 'status', sessionId: session.id, status: 'idle' }) }
})
handle('lah:stop', async () => { stopRequested = true; await kernel?.stop() })

app.on('before-quit', event => {
  if (closing) return
  event.preventDefault(); closing = true
  diagnose('info', 'app/stop')
  void closeKernel().then(() => writeQueue).then(() => diagnosticLog.flush()).then(() => app.quit()).catch(error => { console.error(error); app.exit(1) })
})
app.on('window-all-closed', () => app.quit())
function fatal(error, source) {
  console.error(error)
  void diagnosticLog.write('error', source, errorFields(error)).catch(logError => console.error(logError)).finally(() => app.exit(1))
}
process.on('uncaughtException', error => fatal(error, 'main/uncaught-exception'))
process.on('unhandledRejection', error => fatal(error, 'main/unhandled-rejection'))

app.whenReady().then(async () => {
  diagnose('info', 'app/start', { version: '0.0.1-prealpha', electron: process.versions.electron, node: process.versions.node, platform: process.platform })
  try {
    const saved = JSON.parse(await readFile(statePath, 'utf8'))
    if (saved.format !== 1 || !Array.isArray(saved.sessions)) throw new Error('Формат истории LAH не поддерживается.')
    state.settings = parseSettings(saved.settings)
    state.sessions = saved.sessions.filter(session => typeof session.id === 'string' && Array.isArray(session.messages) && Array.isArray(session.events)).slice(0, 100)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(error)
      await diagnosticLog.write('error', 'state/read-error', errorFields(error)).catch(logError => console.error(logError))
      if (!smoke) await dialog.showMessageBox({ type: 'error', title: 'LAH', message: 'Не удалось прочитать историю. Файл сохранён без изменений.', detail: error.message })
      app.exit(1); return
    }
  }
  Menu.setApplicationMenu(null)
  window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 680, title: 'LAH — Local Agent Harness', backgroundColor: '#151517', show: !smoke,
    icon: join(__dirname, 'renderer/brand/lah-icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#92949b', height: 40 },
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('render-process-gone', (_event, details) => diagnose('error', 'renderer/process-gone', details))
  window.webContents.on('did-fail-load', (_event, code, description) => diagnose('error', 'renderer/load-error', { code, description }))
  window.on('unresponsive', () => diagnose('warn', 'renderer/unresponsive'))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  await window.loadURL(pathToFileURL(join(__dirname, 'renderer/index.html')).href)
  if (smoke) {
    const snapshot = await window.webContents.executeJavaScript(`new Promise(resolve => { const inspect = async () => { if (!document.querySelector('[data-lah-ready]')) { setTimeout(inspect, 50); return; } resolve({ title: document.title, text: document.body.innerText, state: await window.lah.getState() }); }; inspect(); })`)
    const endpointArgument = process.argv.find(value => value.startsWith('--lah-e2e-url='))
    const workspaceArgument = process.argv.find(value => value.startsWith('--lah-e2e-workspace='))
    if (endpointArgument && workspaceArgument) {
      const settings = parseSettings({ ...defaultSettings, model: 'lah-test', endpoint: endpointArgument.slice('--lah-e2e-url='.length), workspace: workspaceArgument.slice('--lah-e2e-workspace='.length) })
      snapshot.integration = await window.webContents.executeJavaScript(`(async () => {
        await window.lah.saveSettings(${JSON.stringify(settings)});
        const models = await window.lah.discoverModels(${JSON.stringify(settings.endpoint)});
        const created = ${process.argv.includes('--lah-e2e-resume')} ? { sessionId: (await window.lah.getState()).sessions[0].id } : await window.lah.newSession();
        const reply = await window.lah.send({ sessionId: created.sessionId, message: 'Read README.md and tell me the marker.' });
        const state = await window.lah.getState();
        let failure;
        if (${process.argv.includes('--lah-e2e-failure')}) {
          try { await window.lah.send({ sessionId: created.sessionId, message: 'Exercise the diagnostic failure.' }); }
          catch (error) { failure = error.message; }
          if (!failure) throw new Error('Expected the fixture model failure');
        }
        const trajectory = await window.lah.getTrajectory({ sessionId: created.sessionId });
        const result = trajectory.rows.find(row => row.type === 'tool/result');
        const detail = result ? await window.lah.getTrajectoryDetail({ sessionId: created.sessionId, key: result.key }) : null;
        return { models, reply, state, failure, trajectory, detail };
      })()`)
      snapshot.text = await window.webContents.executeJavaScript('document.body.innerText')
    }
    const output = join(app.getPath('userData'), 'smoke-result.json')
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(output, JSON.stringify(snapshot, null, 2))
    await writeFile(join(app.getPath('userData'), 'desktop.png'), (await window.webContents.capturePage()).toPNG())
    if (process.argv.includes('--lah-design-review')) {
      window.webContents.setBackgroundThrottling(false)
      window.showInactive()
      window.focus()
      window.webContents.focus()
      const motion = []
      window.webContents.debugger.attach('1.3')
      try {
        for (const preference of ['no-preference', 'reduce']) {
          await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: preference }] })
          const result = await window.webContents.executeJavaScript(`(async () => {
            const inspect = async node => {
              const style = getComputedStyle(node), name = style.animationName, duration = style.animationDuration;
              const animations = node.getAnimations();
              if (animations.some(animation => { const end = animation.effect.getComputedTiming().endTime; return !Number.isFinite(end) || end > 200; })) throw new Error('LAH surface motion must be finite and at most 200ms');
              await Promise.all(animations.map(animation => animation.finished));
              return { name, duration, count: animations.length, opacity: getComputedStyle(node).opacity };
            };
            document.getElementById('open-settings').click();
            const dialog = await inspect(document.getElementById('settings-dialog'));
            document.getElementById('settings-models-tab').click();
            const page = await inspect(document.getElementById('settings-models'));
            document.getElementById('close-settings').click();
            document.getElementById('composer-add').click();
            const menu = await inspect(document.getElementById('composer-menu'));
            document.getElementById('composer-menu').hidePopover();
            return { reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, dialog, page, menu };
          })()`)
          if (result.reduced !== (preference === 'reduce')) throw new Error('LAH motion preference was not applied')
          for (const surface of [result.dialog, result.page, result.menu]) {
            if (surface.opacity !== '1' || (result.reduced ? surface.name !== 'none' || surface.count !== 0 : surface.name === 'none' || surface.count === 0 || parseFloat(surface.duration) > .2)) throw new Error('LAH surface motion did not settle or respect reduced motion')
          }
          motion.push({ preference, ...result })
        }
      } finally {
        try { await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [] }) }
        finally { window.webContents.debugger.detach() }
      }
      await writeFile(join(app.getPath('userData'), 'motion-review.json'), JSON.stringify(motion, null, 2))
      await window.webContents.insertCSS('*, *::before, *::after { transition: none !important; animation: none !important; }')
      const waitForMenuDismissal = `new Promise(resolve => {
        const deadline = performance.now() + 1000;
        const inspect = () => {
          const dismissed = !document.getElementById('composer-menu').matches(':popover-open');
          if (dismissed || performance.now() >= deadline) resolve(dismissed);
          else setTimeout(inspect, 16);
        };
        inspect();
      })`
      const review = []
      for (const [name, theme, section, menuOpen, width, height, sidebarCollapsed = false] of [
        ['home-dark', 'dark', null, false, 1280, 820], ['home-light', 'light', null, false, 1280, 820],
        ['settings-light', 'light', 'general', false, 1280, 820], ['settings-dark', 'dark', 'general', false, 1280, 820],
        ['models-dark', 'dark', 'models', false, 1280, 820], ['tools-dark', 'dark', 'tools', false, 1280, 820],
        ['actions-dark', 'dark', null, true, 1280, 820],
        ['sidebar-hidden', 'dark', null, false, 1280, 820, true],
        ['compact-dark', 'dark', null, false, 960, 680], ['compact-settings', 'dark', 'models', false, 960, 680],
        ['compact-actions', 'dark', null, true, 960, 680],
        ['trajectory-dark', 'dark', 'trajectory', false, 1280, 820],
        ['trajectory-light', 'light', 'trajectory', false, 1280, 820],
        ['compact-trajectory', 'dark', 'trajectory', false, 960, 680],
        ['trajectory-detail', 'dark', 'trajectory-detail', false, 1280, 820],
      ]) {
        window.setSize(width, height)
        const traceReview = section === 'trajectory' || section === 'trajectory-detail'
        const settingsReview = Boolean(section) && !traceReview
        const layout = await window.webContents.executeJavaScript(`(async () => {
          if (document.getElementById('sidebar').hidden !== ${sidebarCollapsed}) document.getElementById('toggle-sidebar').click();
          if (document.documentElement.dataset.theme !== ${JSON.stringify(theme)}) document.getElementById('theme-toggle').click();
          const dialog = document.getElementById('settings-dialog');
          if (${settingsReview} && !dialog.open) document.getElementById('open-settings').click();
          if (!${settingsReview} && dialog.open) document.getElementById('close-settings').click();
          if (${settingsReview}) document.querySelector('[data-settings-section="' + ${JSON.stringify(section)} + '"]').click();
          if (${traceReview}) {
            if (!(await window.lah.getState()).sessions.length) await window.lah.newSession();
            document.getElementById('trajectory-tab').click();
            await new Promise((resolve, reject) => {
              const deadline = performance.now() + 5000;
              const inspect = () => {
                if (document.getElementById('trajectory').dataset.ready === 'true') resolve();
                else if (performance.now() >= deadline) reject(new Error('Trajectory did not load'));
                else setTimeout(inspect, 16);
              }; inspect();
            });
            if (${section === 'trajectory-detail'}) {
              const details = Array.from(document.querySelectorAll('.trace-event')).find(node => node.querySelector('.trace-tag').title === 'tool/result');
              if (details) {
                details.open = true;
                await new Promise((resolve, reject) => {
                  const deadline = performance.now() + 5000;
                  const inspect = () => { if (details.dataset.loaded) resolve(); else if (performance.now() >= deadline) reject(new Error('Event detail did not load')); else setTimeout(inspect, 16); }; inspect();
                });
                details.scrollIntoView({ block: 'center' });
              }
            }
          } else document.getElementById('chat-tab').click();
          if (${menuOpen}) document.getElementById('composer-add').click();
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 150));
          const elements = ['empty-state', 'composer', 'settings-dialog', 'save-settings', 'composer-menu', 'session-tabs', 'trajectory', 'trajectory-toolbar', 'trajectory-scroll'].map(id => {
            const node = document.getElementById(id), rect = node.getBoundingClientRect(), style = getComputedStyle(node);
            return { id, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor };
          });
          return { theme: document.documentElement.dataset.theme, viewport: [innerWidth, innerHeight], elements, fonts: document.fonts.check('500 23px Montserrat'), symbols: document.querySelectorAll('symbol').length, overlay: navigator.windowControlsOverlay?.visible, menuOpen: document.getElementById('composer-menu').matches(':popover-open'), sidebarCollapsed: document.getElementById('sidebar').hidden };
        })()`)
        await writeFile(join(app.getPath('userData'), `${name}.png`), (await window.webContents.capturePage()).toPNG())
        if (traceReview) {
          for (const id of ['session-tabs', 'trajectory', 'trajectory-toolbar', 'trajectory-scroll', 'composer']) {
            const rect = layout.elements.find(element => element.id === id)
            if (rect.width <= 0 || rect.height <= 0 || rect.x < 0 || rect.y < 40 || rect.right > width || rect.bottom > height) throw new Error(`LAH ${id} escapes ${name}`)
          }
        }
        if (menuOpen) {
          const menuRect = layout.elements.find(element => element.id === 'composer-menu')
          if (!layout.menuOpen || menuRect.x < 0 || menuRect.y < 40 || menuRect.right > width || menuRect.bottom > height) throw new Error(`LAH action menu escapes ${name}`)
          window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
          window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
          layout.escapeDismissed = await window.webContents.executeJavaScript(waitForMenuDismissal)
          if (!layout.escapeDismissed) throw new Error('LAH action menu did not close on Escape')
          await window.webContents.executeJavaScript('document.getElementById("composer-add").click()')
          window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', x: width - 8, y: 88, clickCount: 1 })
          window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', x: width - 8, y: 88, clickCount: 1 })
          layout.outsideDismissed = await window.webContents.executeJavaScript(waitForMenuDismissal)
          if (!layout.outsideDismissed) throw new Error('LAH action menu did not close on outside click')
        }
        review.push({ name, ...layout })
      }
      await window.webContents.executeJavaScript(`document.getElementById('theme-toggle').click(); document.getElementById('toggle-sidebar').click();`)
      const loaded = new Promise(resolve => window.webContents.once('did-finish-load', resolve))
      window.webContents.reload()
      await loaded
      const restored = await window.webContents.executeJavaScript(`new Promise(resolve => {
        const inspect = () => {
          if (!document.querySelector('[data-lah-ready]')) { setTimeout(inspect, 16); return; }
          resolve({ name: 'preferences-restored', theme: document.documentElement.dataset.theme, sidebarCollapsed: document.getElementById('sidebar').hidden });
        };
        inspect();
      })`)
      if (restored.theme !== 'light' || !restored.sidebarCollapsed) throw new Error('LAH appearance preferences did not survive reload')
      review.push(restored)
      await writeFile(join(app.getPath('userData'), 'design-review.json'), JSON.stringify(review, null, 2))
    }
    console.log(`LAH_SMOKE_OK ${output}`)
    app.quit()
  }
}).catch(error => fatal(error, 'app/start-error'))
