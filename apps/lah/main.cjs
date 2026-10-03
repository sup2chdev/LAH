/** LAH's account-free desktop carrier; model requests use the fork's agent loop. */
const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron')
const { readFile, writeFile, mkdir, rename, stat } = require('node:fs/promises')
const { join, resolve } = require('node:path')
const { pathToFileURL } = require('node:url')
const { randomUUID } = require('node:crypto')
const { createLahKernel } = require('./kernel.cjs')

app.setName('LAH')
// The desktop UI leaves scarce GPU memory available to the separate local model server.
app.disableHardwareAcceleration()
const dataArgument = process.argv.find(value => value.startsWith('--lah-data='))
app.setPath('userData', dataArgument ? resolve(dataArgument.slice('--lah-data='.length)) : join(app.getPath('appData'), 'LocalAgentHarness'))
const smoke = process.argv.includes('--lah-smoke')
const statePath = join(app.getPath('userData'), 'lah-state.json')
const defaultSettings = { endpoint: 'http://127.0.0.1:1234/v1', model: '', contextWindow: 32768, maxTokens: 4096, workspace: '' }
let state = { settings: { ...defaultSettings }, sessions: [] }
let window
let kernel
let busy = false
let stopRequested = false
let closing = false
let writeQueue = Promise.resolve()
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
  return { settings: state.settings, sessions: state.sessions.map(({ events, ...session }) => session), tools, version: '0.0.1-prealpha' }
}
function emit(event) {
  if (window && !window.isDestroyed()) window.webContents.send('lah:event', event)
}
function publish() { emit({ type: 'state', state: publicState() }) }
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

ipcMain.handle('lah:state', event => { assertOwner(event); return publicState() })
ipcMain.handle('lah:settings', async (event, input) => {
  assertOwner(event); requireIdle()
  const settings = parseSettings(input)
  if (settings.workspace && !(await stat(settings.workspace)).isDirectory()) throw new Error('Выберите существующую папку проекта.')
  await closeKernel()
  state.settings = settings
  await persist(); publish()
  return publicState()
})
ipcMain.handle('lah:workspace', async event => {
  assertOwner(event); requireIdle()
  const result = await dialog.showOpenDialog(window, { title: 'Выберите папку проекта', properties: ['openDirectory'] })
  if (!result.canceled && result.filePaths[0]) {
    await closeKernel()
    state.settings.workspace = result.filePaths[0]
    await persist(); publish()
  }
  return { workspace: state.settings.workspace }
})
ipcMain.handle('lah:models', async (event, endpoint) => {
  assertOwner(event)
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
ipcMain.handle('lah:new-session', async event => {
  assertOwner(event); requireIdle()
  const session = newSession()
  await persist(); publish()
  return { sessionId: session.id }
})
ipcMain.handle('lah:send', async (event, input) => {
  assertOwner(event); requireIdle()
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
  const message = input.message.trim()
  try {
    kernel ??= await createLahKernel(state.settings, event => emit(event))
    if (stopRequested) return { sessionId: session.id, content: '' }
    session.messages.push({ role: 'user', content: message })
    if (session.messages.length === 1) session.title = message.slice(0, 56)
    await persist(); publish()
    const result = await kernel.run(session.id, message, session.events)
    session.events = result.events
    if (result.content) session.messages.push({ role: 'assistant', content: result.content })
    await persist(); publish()
    if (result.error) throw new Error(result.error)
    return { sessionId: session.id, content: result.content }
  } catch (error) {
    emit({ type: 'error', sessionId: session.id, message: error.message })
    throw error
  } finally { busy = false; emit({ type: 'status', sessionId: session.id, status: 'idle' }) }
})
ipcMain.handle('lah:stop', async event => { assertOwner(event); stopRequested = true; await kernel?.stop() })

app.on('before-quit', event => {
  if (closing) return
  event.preventDefault(); closing = true
  void closeKernel().then(() => writeQueue).then(() => app.quit()).catch(error => { console.error(error); app.exit(1) })
})
app.on('window-all-closed', () => app.quit())

app.whenReady().then(async () => {
  try {
    const saved = JSON.parse(await readFile(statePath, 'utf8'))
    if (saved.format !== 1 || !Array.isArray(saved.sessions)) throw new Error('Формат истории LAH не поддерживается.')
    state.settings = parseSettings(saved.settings)
    state.sessions = saved.sessions.filter(session => typeof session.id === 'string' && Array.isArray(session.messages) && Array.isArray(session.events)).slice(0, 100)
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(error)
      if (!smoke) await dialog.showMessageBox({ type: 'error', title: 'LAH', message: 'Не удалось прочитать историю. Файл сохранён без изменений.', detail: error.message })
      app.exit(1); return
    }
  }
  Menu.setApplicationMenu(null)
  window = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 680, title: 'LAH — Local Agent Harness', backgroundColor: '#151517', show: !smoke,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#92949b', height: 40 },
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
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
        const created = await window.lah.newSession();
        const reply = await window.lah.send({ sessionId: created.sessionId, message: 'Read README.md and tell me the marker.' });
        return { models, reply, state: await window.lah.getState() };
      })()`)
      snapshot.text = await window.webContents.executeJavaScript('document.body.innerText')
    }
    const output = join(app.getPath('userData'), 'smoke-result.json')
    await mkdir(app.getPath('userData'), { recursive: true })
    await writeFile(output, JSON.stringify(snapshot, null, 2))
    await writeFile(join(app.getPath('userData'), 'desktop.png'), (await window.webContents.capturePage()).toPNG())
    if (process.argv.includes('--lah-design-review')) {
      window.webContents.setBackgroundThrottling(false)
      await window.webContents.insertCSS('* { transition: none !important; }')
      window.showInactive()
      window.focus()
      window.webContents.focus()
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
      for (const [name, theme, section, menuOpen, width, height] of [
        ['home-dark', 'dark', null, false, 1280, 820], ['home-light', 'light', null, false, 1280, 820],
        ['settings-light', 'light', 'general', false, 1280, 820], ['settings-dark', 'dark', 'general', false, 1280, 820],
        ['models-dark', 'dark', 'models', false, 1280, 820], ['tools-dark', 'dark', 'tools', false, 1280, 820],
        ['actions-dark', 'dark', null, true, 1280, 820],
        ['compact-dark', 'dark', null, false, 960, 680], ['compact-settings', 'dark', 'models', false, 960, 680],
        ['compact-actions', 'dark', null, true, 960, 680],
      ]) {
        window.setSize(width, height)
        const layout = await window.webContents.executeJavaScript(`(async () => {
          if (document.documentElement.dataset.theme !== ${JSON.stringify(theme)}) document.getElementById('theme-toggle').click();
          const dialog = document.getElementById('settings-dialog');
          if (${Boolean(section)} && !dialog.open) document.getElementById('open-settings').click();
          if (!${Boolean(section)} && dialog.open) document.getElementById('close-settings').click();
          if (${Boolean(section)}) document.querySelector('[data-settings-section="' + ${JSON.stringify(section)} + '"]').click();
          if (${menuOpen}) document.getElementById('composer-add').click();
          await document.fonts.ready;
          await new Promise(resolve => setTimeout(resolve, 150));
          const elements = ['empty-state', 'composer', 'settings-dialog', 'save-settings', 'composer-menu'].map(id => {
            const node = document.getElementById(id), rect = node.getBoundingClientRect(), style = getComputedStyle(node);
            return { id, x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor };
          });
          return { theme: document.documentElement.dataset.theme, viewport: [innerWidth, innerHeight], elements, fonts: document.fonts.check('500 23px Montserrat'), symbols: document.querySelectorAll('symbol').length, overlay: navigator.windowControlsOverlay?.visible, menuOpen: document.getElementById('composer-menu').matches(':popover-open') };
        })()`)
        await writeFile(join(app.getPath('userData'), `${name}.png`), (await window.webContents.capturePage()).toPNG())
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
      await writeFile(join(app.getPath('userData'), 'design-review.json'), JSON.stringify(review, null, 2))
    }
    console.log(`LAH_SMOKE_OK ${output}`)
    app.quit()
  }
}).catch(error => { console.error(error); app.exit(1) })
