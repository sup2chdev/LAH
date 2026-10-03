/** Isolated DOM checks for the account-free desktop UI and untrusted transcript text. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { JSDOM } from 'jsdom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rendererRoot = resolve(import.meta.dirname, '../renderer')
const html = readFileSync(resolve(rendererRoot, 'index.html'), 'utf8')
const script = readFileSync(resolve(rendererRoot, 'app.js'), 'utf8')

type Settings = {
  endpoint: string
  model: string
  workspace: string
  contextWindow: number
  maxTokens: number
}
type UiState = {
  version: string
  settings: Settings
  tools: { name: string; description: string }[]
  sessions: { id: string; title: string; messages: { role: string; content: string }[] }[]
}
type UiEvent = { type: string; [key: string]: unknown }
const owned: JSDOM[] = []

function fixture(configured = false, preferences: Record<string, string> = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' })
  owned.push(dom)
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  dom.window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  dom.window.HTMLElement.prototype.hidePopover = function () {}
  dom.window.HTMLElement.prototype.scrollIntoView = function () {}
  for (const [key, value] of Object.entries(preferences)) dom.window.localStorage.setItem(key, value)
  const state: UiState = {
    version: '0.0.1-prealpha',
    settings: { endpoint: 'http://127.0.0.1:1234/v1', model: configured ? 'local-model' : '', workspace: configured ? 'Z:\\project' : '', contextWindow: 8192, maxTokens: 1024 },
    tools: [{ name: 'read_file', description: 'Read a file' }],
    sessions: [],
  }
  let eventListener: (event: UiEvent) => void = () => {}
  const bridge = {
    getState: vi.fn(async () => structuredClone(state)),
    saveSettings: vi.fn(async (settings: Settings) => { state.settings = settings; return structuredClone(state) }),
    chooseWorkspace: vi.fn(async () => { state.settings.workspace = 'Z:\\project'; return { workspace: state.settings.workspace } }),
    discoverModels: vi.fn(async () => ({ models: [{ id: 'local-model' }] })),
    send: vi.fn(async (_input: { sessionId?: string; message: string }) => ({ sessionId: 'session-1', content: '' })),
    newSession: vi.fn(async () => { state.sessions.unshift({ id: 'session-1', title: 'Новый сеанс', messages: [] }); return { sessionId: 'session-1' } }),
    stop: vi.fn(async () => {}),
    onEvent: vi.fn((callback: (event: UiEvent) => void) => { eventListener = callback; return () => {} }),
  }
  Object.defineProperty(dom.window, 'lah', { value: bridge })
  dom.window.eval(script)
  function query<T extends HTMLElement = HTMLElement>(id: string): T {
    const node = dom.window.document.getElementById(id)
    if (!node) throw new Error(`Missing UI fixture element: ${id}`)
    return node as T
  }
  function submit(id: string) { query(id).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })) }
  return { dom, state, bridge, query, submit, emit: (event: UiEvent) => eventListener(event) }
}

afterEach(() => { for (const dom of owned.splice(0)) dom.window.close() })

describe('LAH desktop renderer', () => {
  it('requires a configured model and workspace before sending a task', async () => {
    const app = fixture()
    await vi.waitFor(() => expect(app.dom.window.document.body.dataset.lahReady).toBe('true'))
    expect(app.query<HTMLButtonElement>('send').disabled).toBe(true)
    expect(app.query('composer-hint').textContent).toContain('выберите рабочую папку')
    app.dom.window.document.querySelector<HTMLButtonElement>('[data-suggestion]')?.click()
    expect(app.query<HTMLTextAreaElement>('message-input').value).toContain('структуру')
    app.query('workspace').click()
    await vi.waitFor(() => expect(app.query('workspace-name').textContent).toBe('project'))
    expect(app.query('composer-hint').textContent).toContain('модель')
    expect(app.query<HTMLButtonElement>('send').disabled).toBe(true)
    expect(app.bridge.send).not.toHaveBeenCalled()
  })

  it('renders tool arguments and model content as text and matches results by call ID', async () => {
    const app = fixture(true)
    await vi.waitFor(() => expect(app.dom.window.document.body.dataset.lahReady).toBe('true'))
    let finish: (result: { sessionId: string; content: string }) => void = () => {}
    app.bridge.send.mockImplementation((input) => {
      app.state.sessions[0].messages.push({ role: 'user', content: input.message })
      app.emit({ type: 'state', state: structuredClone(app.state) })
      return new Promise((resolve) => { finish = resolve })
    })
    const payload = '<img src="x" onerror="window.compromised=true">'
    app.query<HTMLTextAreaElement>('message-input').value = payload
    app.query('message-input').dispatchEvent(new app.dom.window.Event('input'))
    app.submit('composer')
    app.submit('composer')
    await vi.waitFor(() => expect(app.bridge.send).toHaveBeenCalledOnce())
    expect(app.bridge.newSession).toHaveBeenCalledOnce()
    expect(app.query<HTMLButtonElement>('stop').hidden).toBe(false)
    expect(app.query('messages').textContent).toContain(payload)
    expect(app.query('messages').querySelector('img')).toBeNull()
    app.emit({ type: 'tool', sessionId: 'session-1', id: 'call-1', name: 'read_file', args: { path: payload } })
    app.emit({ type: 'tool', sessionId: 'session-1', id: 'call-1', result: payload })
    expect(app.query('tool-count').textContent).toBe('1')
    expect(app.query('tool-events').textContent).toContain('read_file')
    expect(app.query('tool-events').textContent).toContain('Завершён')
    expect(app.query('tool-events').querySelector('img')).toBeNull()
    app.state.sessions[0].messages.push({ role: 'assistant', content: payload })
    finish({ sessionId: 'session-1', content: payload })
    await vi.waitFor(() => expect(app.query<HTMLButtonElement>('stop').hidden).toBe(true))
    expect(app.query('messages').querySelectorAll('.message')).toHaveLength(2)
    expect(app.query('messages').querySelector('img')).toBeNull()
  })

  it('discovers a local model and keeps invalid token settings visible for correction', async () => {
    const app = fixture()
    await vi.waitFor(() => expect(app.dom.window.document.body.dataset.lahReady).toBe('true'))
    app.query('model-status').click()
    expect(app.query<HTMLDialogElement>('settings-dialog').open).toBe(true)
    expect(app.query('settings-models').hidden).toBe(false)
    app.query('discover-models').click()
    await vi.waitFor(() => expect(app.query<HTMLInputElement>('model-input').value).toBe('local-model'))
    expect(app.query('discovery-status').textContent).toContain('Найдено моделей: 1')
    app.query<HTMLInputElement>('context-input').value = '1024'
    app.query<HTMLInputElement>('max-tokens-input').value = '1024'
    app.submit('settings-form')
    expect(app.bridge.saveSettings).not.toHaveBeenCalled()
    expect(app.query('settings-error').textContent).toContain('меньше окна контекста')
    expect(app.query<HTMLDialogElement>('settings-dialog').open).toBe(true)
    app.query<HTMLInputElement>('max-tokens-input').value = '512'
    app.submit('settings-form')
    await vi.waitFor(() => expect(app.query<HTMLDialogElement>('settings-dialog').open).toBe(false))
    expect(app.bridge.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ model: 'local-model', maxTokens: 512 }))
  })

  it('switches settings sections without losing model edits and applies the selected appearance', async () => {
    const app = fixture(true)
    await vi.waitFor(() => expect(app.dom.window.document.body.dataset.lahReady).toBe('true'))
    app.query('open-settings').click()
    expect(app.query('settings-general').hidden).toBe(false)
    expect(app.query('settings-footer').hidden).toBe(true)
    app.query('settings-models-tab').click()
    app.query<HTMLInputElement>('model-input').value = 'edited-local-model'
    app.query('settings-general-tab').click()
    app.dom.window.document.querySelector<HTMLButtonElement>('[data-theme-choice="light"]')?.click()
    expect(app.dom.window.document.body.hasAttribute('data-ds-dark-theme')).toBe(false)
    expect(app.dom.window.document.documentElement.dataset.theme).toBe('light')
    app.query('settings-tools-tab').click()
    expect(app.query('tools-panel').textContent).toContain('read_file')
    app.query('settings-models-tab').click()
    expect(app.query<HTMLInputElement>('model-input').value).toBe('edited-local-model')
    expect(app.query('settings-footer').hidden).toBe(false)
    expect(app.bridge.saveSettings).not.toHaveBeenCalled()
  })

  it('restores appearance and sidebar preferences and keeps settings drafts across keyboard shortcuts', async () => {
    const app = fixture(true, { 'lah.theme': 'light', 'lah.sidebar': 'hidden' })
    await vi.waitFor(() => expect(app.dom.window.document.body.dataset.lahReady).toBe('true'))
    expect(app.dom.window.document.documentElement.dataset.theme).toBe('light')
    expect(app.query('sidebar').hidden).toBe(true)
    app.query('toggle-sidebar').click()
    expect(app.query('sidebar').hidden).toBe(false)
    expect(app.dom.window.localStorage.getItem('lah.sidebar')).toBe('visible')
    app.query('theme-toggle').click()
    expect(app.dom.window.localStorage.getItem('lah.theme')).toBe('dark')
    const shortcut = (key: string) => app.dom.window.document.dispatchEvent(new app.dom.window.KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }))
    shortcut(',')
    expect(app.query('settings-models').hidden).toBe(false)
    app.query<HTMLInputElement>('model-input').value = 'draft-model'
    shortcut(',')
    expect(app.query<HTMLInputElement>('model-input').value).toBe('draft-model')
    shortcut('n')
    expect(app.bridge.newSession).not.toHaveBeenCalled()
    app.query('close-settings').click()
    shortcut('b')
    expect(app.query('sidebar').hidden).toBe(true)
    app.query<HTMLTextAreaElement>('message-input').value = 'Unsent draft from the previous chat'
    shortcut('n')
    await vi.waitFor(() => expect(app.bridge.newSession).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(app.query<HTMLTextAreaElement>('message-input').value).toBe(''))
  })
})
