/** LAH's isolated renderer consumes the preload API and never reads files or contacts model servers. */

/** @typedef {{endpoint: string, model: string, contextWindow: number, maxTokens: number, workspace: string}} Settings */
/** @typedef {{role: string, content: string}} Message */
/** @typedef {{id: string, title: string, messages: Message[]}} Session */
/** @typedef {{settings: Settings, sessions: Session[], tools: {name: string, description: string}[], version: string}} AppState */

/** @type {Readonly<Record<string, string>>} */
const ru = Object.freeze({
  stage: 'преальфа',
  newSession: 'Новый сеанс',
  sessions: 'Сеансы',
  sessionsAria: 'Сеансы',
  historyAria: 'История сеансов',
  conversationAria: 'Переписка',
  messageAria: 'Сообщение',
  sessionLabel: 'РАБОЧИЙ СЕАНС',
  noSessions: 'Здесь появятся ваши сеансы',
  untitledSession: 'Новый сеанс',
  workspace: 'Рабочая папка',
  chooseWorkspace: 'Выбрать папку',
  workspaceNotSelected: 'Папка ещё не выбрана',
  readOnly: 'Только чтение',
  localOnly: 'На вашем компьютере',
  settings: 'Настройки',
  lightTheme: 'Светлая тема',
  darkTheme: 'Тёмная тема',
  modelNotConnected: 'Модель не настроена',
  emptyEyebrow: 'ВАШ ЛОКАЛЬНЫЙ АГЕНТ',
  emptyTitle: 'Что исследуем сегодня?',
  emptyDescription: 'Ваш локальный агент для работы с проектами',
  pickFolder: 'Выбрать папку',
  pickFolderDetail: 'Агент сможет читать и искать только внутри неё',
  connectModel: 'Подключить модель',
  connectModelDetail: 'LM Studio, llama.cpp или vLLM · OpenAI API',
  examples: 'Например, можно попросить',
  suggestionStructure: 'Объясни структуру этой папки',
  suggestionSearch: 'Найди, где настраивается запуск проекта',
  suggestionRead: 'Прочитай README и кратко опиши проект',
  suggestionStructureLabel: 'Изучить проект',
  suggestionSearchLabel: 'Найти в файлах',
  suggestionReadLabel: 'Прочитать README',
  messagePlaceholder: 'Что найти или изучить в рабочей папке?',
  send: 'Отправить',
  readMode: 'Чтение и поиск',
  stop: 'Остановить',
  working: 'Локальная модель обрабатывает запрос',
  hintReady: 'Enter — отправить · Shift+Enter — новая строка',
  hintWorkspace: 'Сначала выберите рабочую папку',
  hintModel: 'Укажите локальный сервер и модель в настройках',
  hintRunning: 'Можно остановить текущий запрос',
  composerCaption: 'Локально. Файлы остаются без изменений.',
  availableTools: 'Инструменты агента',
  toolTrace: 'Вызовы инструментов',
  toolPending: 'Выполняется',
  toolCompleted: 'Завершён',
  toolFailed: 'Ошибка',
  toolResult: 'Результат',
  user: 'Вы',
  assistant: 'LAH',
  tool: 'Инструмент',
  settingsEyebrow: 'ПОДКЛЮЧЕНИЕ',
  modelSettings: 'Локальная модель',
  settingsDescription: 'Запустите модель в своём локальном сервере, затем укажите его адрес и ID модели. LAH не загружает модели и не требует аккаунта или API-ключа.',
  endpoint: 'Адрес OpenAI-совместимого сервера',
  endpointHelp: 'URL с /v1. Пример для LM Studio: http://127.0.0.1:1234/v1',
  modelId: 'ID модели',
  modelPlaceholder: 'ID модели на локальном сервере',
  discoverModels: 'Найти модели',
  discoveringModels: 'Проверяем локальный сервер…',
  modelsFound: 'Найдено моделей: {count}. Выберите ID в поле выше.',
  noModelsFound: 'Сервер доступен, но список моделей пуст. Загрузите модель в сервере.',
  discoveryFailed: 'Не удалось получить список моделей: {error}',
  contextWindow: 'Окно контекста, токенов',
  contextHelp: 'Укажите размер, заданный в локальном сервере',
  maxTokens: 'Максимум ответа, токенов',
  maxTokensHelp: 'Должен быть меньше окна контекста',
  settingsLimit: 'Модель должна поддерживать вызов инструментов (tool calling). В этой преальфе агент только читает файлы и выполняет поиск.',
  closeSettings: 'Закрыть настройки',
  cancel: 'Отмена',
  save: 'Сохранить',
  saving: 'Сохраняем…',
  validationTokens: 'Максимум ответа должен быть меньше окна контекста.',
  unexpectedError: 'Не удалось выполнить действие.',
  bridgeUnavailable: 'Не удалось подключиться к приложению. Перезапустите LAH.',
  toolListDirectory: 'Посмотреть файлы и папки',
  toolSearchFiles: 'Найти файлы по имени',
  toolSearchContent: 'Найти текст в файлах',
  toolReadFile: 'Прочитать файл',
});

/** @param {string} key @param {Record<string, string | number>} [values] @returns {string} */
function t(key, values = {}) {
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), ru[key] ?? key);
}

/** @template {HTMLElement} T @param {string} id @returns {T} */
function element(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing renderer element: ${id}`);
  return /** @type {T} */ (node);
}

const controls = {
  sessions: element('session-list'),
  title: element('session-title'),
  workspaceName: element('workspace-name'),
  workspacePath: element('workspace-path'),
  empty: element('empty-state'),
  messages: element('messages'),
  conversation: element('conversation'),
  input: /** @type {HTMLTextAreaElement} */ (element('message-input')),
  send: /** @type {HTMLButtonElement} */ (element('send')),
  stop: /** @type {HTMLButtonElement} */ (element('stop')),
  settings: /** @type {HTMLDialogElement} */ (element('settings-dialog')),
  endpoint: /** @type {HTMLInputElement} */ (element('endpoint-input')),
  model: /** @type {HTMLInputElement} */ (element('model-input')),
  context: /** @type {HTMLInputElement} */ (element('context-input')),
  maxTokens: /** @type {HTMLInputElement} */ (element('max-tokens-input')),
  trace: /** @type {HTMLDetailsElement} */ (element('tool-trace')),
  toolEvents: element('tool-events'),
};

/** @type {AppState} */
let state = { settings: { endpoint: 'http://127.0.0.1:1234/v1', model: '', contextWindow: 8192, maxTokens: 1024, workspace: '' }, sessions: [], tools: [], version: '' };
let currentSessionId = null;
let running = false;
let pendingMessage = '';
let pendingMessageIndex = 0;
let bridgeReady = false;
/** @type {Map<string, {name: string, args?: unknown, result?: unknown, error?: unknown, callId?: string}[]>} */
const traces = new Map();

document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.getAttribute('data-i18n')); });
document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder'))); });
document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria'))); });
document.querySelectorAll('[data-suggestion]').forEach(node => {
  const suggestion = t(node.getAttribute('data-suggestion'));
  const label = node.querySelector('[data-suggestion-label]');
  if (label) label.textContent = t(label.getAttribute('data-suggestion-label'));
  node.addEventListener('click', () => { controls.input.value = suggestion; updateComposer(); controls.input.focus(); });
});

/** @param {unknown} error @returns {string} */
function errorText(error) {
  return error instanceof Error ? error.message : typeof error === 'string' ? error : t('unexpectedError');
}

/** @param {string} message @returns {void} */
function showNotice(message) {
  const notice = element('notice');
  notice.textContent = message;
  notice.hidden = !message;
}

/** @param {unknown} value @returns {string} */
function printable(value) {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try { return JSON.stringify(value, null, 2); } catch (error) { return errorText(error); }
}

/** @returns {Session | undefined} */
function currentSession() { return state.sessions.find(session => session.id === currentSessionId); }

/** @returns {void} */
function updateComposer() {
  const hasWorkspace = Boolean(state.settings.workspace);
  const hasModel = Boolean(state.settings.model && state.settings.endpoint);
  controls.send.disabled = !bridgeReady || running || !hasWorkspace || !hasModel || !controls.input.value.trim();
  controls.send.hidden = running;
  controls.stop.hidden = !running;
  element('working-indicator').hidden = !running;
  element('composer-hint').textContent = t(running ? 'hintRunning' : !hasWorkspace ? 'hintWorkspace' : !hasModel ? 'hintModel' : 'hintReady');
  /** @type {HTMLButtonElement} */ (element('new-session')).disabled = !bridgeReady || running;
  ['workspace', 'setup-workspace', 'settings-workspace'].forEach(id => { /** @type {HTMLButtonElement} */ (element(id)).disabled = !bridgeReady || running; });
  /** @type {HTMLButtonElement} */ (element('save-settings')).disabled = !bridgeReady || running;
  /** @type {HTMLButtonElement} */ (element('discover-models')).disabled = !bridgeReady || running;
}

/** @returns {void} */
function renderSessions() {
  controls.sessions.replaceChildren();
  if (!state.sessions.length) {
    const hint = document.createElement('p');
    hint.className = 'no-sessions';
    hint.textContent = t('noSessions');
    controls.sessions.append(hint);
  }
  for (const session of state.sessions) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `session-row${session.id === currentSessionId ? ' active' : ''}`;
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'icon');
    icon.setAttribute('aria-hidden', 'true');
    const glyph = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    glyph.setAttribute('href', '#icon-chat');
    icon.append(glyph);
    const title = document.createElement('span');
    title.className = 'session-row-label';
    title.textContent = session.title || t('untitledSession');
    row.append(icon, title);
    row.title = title.textContent;
    row.disabled = running;
    if (session.id === currentSessionId) row.setAttribute('aria-current', 'page');
    row.addEventListener('click', () => { currentSessionId = session.id; pendingMessage = ''; showNotice(''); render(); });
    controls.sessions.append(row);
  }
}

/** @param {Message} message @returns {HTMLElement} */
function renderMessage(message) {
  const article = document.createElement('article');
  article.className = `message ${message.role === 'user' ? 'user' : message.role === 'tool' ? 'tool' : 'assistant'}`;
  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = t(message.role === 'user' ? 'user' : message.role === 'tool' ? 'tool' : 'assistant');
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = printable(message.content);
  article.append(label, content);
  return article;
}

/** @returns {void} */
function renderMessages() {
  const messages = (currentSession()?.messages ?? []).filter(message => ['user', 'assistant', 'tool'].includes(message.role) && message.content);
  controls.messages.replaceChildren(...messages.map(renderMessage));
  if (pendingMessage) controls.messages.append(renderMessage({ role: 'user', content: pendingMessage }));
  controls.empty.hidden = messages.length > 0 || Boolean(pendingMessage);
  document.body.classList.toggle('has-conversation', controls.empty.hidden);
}

/** @returns {void} */
function renderTrace() {
  const entries = traces.get(currentSessionId) ?? [];
  controls.trace.hidden = !entries.length;
  element('tool-count').textContent = String(entries.length);
  controls.toolEvents.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement('div');
    item.className = `tool-event${entry.error ? ' error' : ''}`;
    const heading = document.createElement('div');
    heading.className = 'tool-event-heading';
    const name = document.createElement('code');
    name.textContent = entry.name;
    const status = document.createElement('span');
    status.className = 'tool-event-status';
    status.textContent = t(entry.error ? 'toolFailed' : entry.result !== undefined ? 'toolCompleted' : 'toolPending');
    heading.append(name, status);
    item.append(heading);
    const args = document.createElement('pre');
    args.textContent = printable(entry.args);
    item.append(args);
    if (entry.result !== undefined || entry.error) {
      const output = document.createElement('details');
      output.className = 'tool-output';
      const summary = document.createElement('summary');
      summary.textContent = t('toolResult');
      const result = document.createElement('pre');
      result.textContent = printable(entry.error ?? entry.result);
      output.append(summary, result);
      item.append(output);
    }
    controls.toolEvents.append(item);
  }
}

/** @returns {void} */
function renderTools() {
  const descriptions = { list_directory: 'toolListDirectory', search_files: 'toolSearchFiles', search_content: 'toolSearchContent', read_file: 'toolReadFile' };
  element('tools-panel').replaceChildren(...state.tools.map(tool => {
    const item = document.createElement('div');
    item.className = 'tool-description';
    const name = document.createElement('code');
    name.textContent = tool.name;
    const description = document.createElement('span');
    description.textContent = descriptions[tool.name] ? t(descriptions[tool.name]) : tool.description;
    item.append(name, description);
    return item;
  }));
}

/** @returns {void} */
function render() {
  renderSessions();
  renderMessages();
  renderTrace();
  renderTools();
  controls.title.textContent = currentSession()?.title || t('untitledSession');
  const workspace = state.settings.workspace;
  controls.workspaceName.textContent = workspace ? workspace.split(/[\\/]/).filter(Boolean).at(-1) || workspace : t('chooseWorkspace');
  controls.workspacePath.textContent = workspace || t('workspaceNotSelected');
  /** @type {HTMLButtonElement} */ (element('workspace')).title = workspace || t('chooseWorkspace');
  element('settings-workspace-path').textContent = workspace || t('workspaceNotSelected');
  element('workspace-check').textContent = workspace ? '✓' : '';
  element('model-check').textContent = state.settings.model ? '✓' : '';
  element('setup-workspace-label').textContent = workspace ? controls.workspaceName.textContent : t('chooseWorkspace');
  element('setup-model-label').textContent = state.settings.model || t('connectModel');
  element('setup-workspace').classList.toggle('complete', Boolean(workspace));
  element('setup-model').classList.toggle('complete', Boolean(state.settings.model));
  element('model-status-label').textContent = state.settings.model || t('modelNotConnected');
  element('model-status').classList.toggle('ready', Boolean(state.settings.model));
  element('version').textContent = state.version;
  updateComposer();
}

/** @param {AppState} next @returns {void} */
function receiveState(next) {
  state = next;
  if (!state.sessions.some(session => session.id === currentSessionId)) currentSessionId = state.sessions[0]?.id ?? null;
  if (pendingMessage && currentSession()?.messages.slice(pendingMessageIndex).some(message => message.role === 'user' && message.content === pendingMessage)) pendingMessage = '';
  render();
}

/** @returns {void} */
function openSettings() {
  controls.endpoint.value = state.settings.endpoint;
  controls.model.value = state.settings.model;
  controls.context.value = String(state.settings.contextWindow);
  controls.maxTokens.value = String(state.settings.maxTokens);
  element('discovery-status').textContent = '';
  element('settings-error').hidden = true;
  if (!controls.settings.open) controls.settings.showModal();
}

/** @returns {Promise<void>} */
async function chooseWorkspace() {
  try {
    const result = await window.lah.chooseWorkspace();
    if (result?.workspace) receiveState(await window.lah.getState());
  } catch (error) { showNotice(errorText(error)); }
}

/** @returns {Promise<void>} */
async function newSession() {
  if (running) return;
  try {
    const result = await window.lah.newSession();
    currentSessionId = result.sessionId;
    pendingMessage = '';
    showNotice('');
    receiveState(await window.lah.getState());
    controls.input.focus();
  } catch (error) { showNotice(errorText(error)); }
}

/** @returns {Promise<void>} */
async function sendMessage() {
  if (controls.send.disabled) return;
  const message = controls.input.value.trim();
  showNotice('');
  running = true;
  renderSessions();
  updateComposer();
  try {
    if (!currentSessionId) {
      const created = await window.lah.newSession();
      currentSessionId = created.sessionId;
      receiveState(await window.lah.getState());
    }
    pendingMessage = message;
    pendingMessageIndex = currentSession()?.messages.length ?? 0;
    controls.input.value = '';
    controls.input.style.height = '';
    render();
    controls.conversation.scrollTop = controls.conversation.scrollHeight;
    const result = await window.lah.send({ sessionId: currentSessionId, message });
    currentSessionId = result.sessionId;
    receiveState(await window.lah.getState());
  } catch (error) {
    pendingMessage = '';
    showNotice(errorText(error));
    try { receiveState(await window.lah.getState()); } catch (stateError) { showNotice(`${errorText(error)} ${errorText(stateError)}`); }
  } finally {
    running = false;
    render();
    controls.conversation.scrollTop = controls.conversation.scrollHeight;
    controls.input.focus();
  }
}

/** @returns {Promise<void>} */
async function discoverModels() {
  const status = element('discovery-status');
  const button = /** @type {HTMLButtonElement} */ (element('discover-models'));
  status.classList.remove('error');
  status.textContent = t('discoveringModels');
  button.disabled = true;
  try {
    const result = await window.lah.discoverModels(controls.endpoint.value.trim());
    if (result.error) throw new Error(result.error);
    const options = result.models.map(model => { const option = document.createElement('option'); option.value = model.id; return option; });
    element('models-list').replaceChildren(...options);
    if (!controls.model.value && result.models.length === 1) controls.model.value = result.models[0].id;
    status.textContent = result.models.length ? t('modelsFound', { count: result.models.length }) : t('noModelsFound');
  } catch (error) {
    status.classList.add('error');
    status.textContent = t('discoveryFailed', { error: errorText(error) });
  } finally { button.disabled = !bridgeReady || running; }
}

/** @param {SubmitEvent} event @returns {Promise<void>} */
async function saveSettings(event) {
  event.preventDefault();
  const errorNode = element('settings-error');
  errorNode.hidden = true;
  const contextWindow = Number(controls.context.value);
  const maxTokens = Number(controls.maxTokens.value);
  if (maxTokens >= contextWindow) {
    errorNode.textContent = t('validationTokens');
    errorNode.hidden = false;
    return;
  }
  const button = /** @type {HTMLButtonElement} */ (element('save-settings'));
  button.disabled = true;
  button.textContent = t('saving');
  try {
    const next = await window.lah.saveSettings({ ...state.settings, endpoint: controls.endpoint.value.trim(), model: controls.model.value.trim(), contextWindow, maxTokens });
    receiveState(next);
    controls.settings.close();
  } catch (error) {
    errorNode.textContent = errorText(error);
    errorNode.hidden = false;
  } finally {
    button.textContent = t('save');
    updateComposer();
  }
}

/** @param {{type: string, [key: string]: unknown}} event @returns {void} */
function handleEvent(event) {
  if (event.type === 'state') receiveState(event.state);
  else if (event.type === 'status') { running = event.status === 'running'; renderSessions(); updateComposer(); }
  else if (event.type === 'error') showNotice(String(event.message));
  else if (event.type === 'tool') {
    const sessionId = event.sessionId ?? currentSessionId;
    if (!sessionId) return;
    const entries = traces.get(sessionId) ?? [];
    const callId = event.callId ?? event.id;
    const pending = entries.findLast(entry => callId ? entry.callId === callId : entry.name === event.name && entry.result === undefined && !entry.error);
    if (pending && (event.result !== undefined || event.error)) Object.assign(pending, event);
    else entries.push({ name: String(event.name), args: event.args, result: event.result, error: event.error, callId });
    traces.set(sessionId, entries);
    if (sessionId === currentSessionId) renderTrace();
  }
}

element('new-session').addEventListener('click', newSession);
['workspace', 'setup-workspace', 'settings-workspace'].forEach(id => { element(id).addEventListener('click', chooseWorkspace); });
['open-settings', 'setup-model', 'model-status'].forEach(id => { element(id).addEventListener('click', openSettings); });
['close-settings', 'cancel-settings'].forEach(id => { element(id).addEventListener('click', () => controls.settings.close()); });
controls.settings.addEventListener('click', event => {
  if (event.target !== controls.settings) return;
  const rect = controls.settings.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) controls.settings.close();
});
element('settings-form').addEventListener('submit', saveSettings);
element('discover-models').addEventListener('click', discoverModels);
element('composer').addEventListener('submit', event => { event.preventDefault(); void sendMessage(); });
controls.input.addEventListener('input', () => { controls.input.style.height = 'auto'; controls.input.style.height = `${Math.min(controls.input.scrollHeight, 160)}px`; updateComposer(); });
controls.input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void sendMessage(); }
});
controls.stop.addEventListener('click', async () => {
  controls.stop.disabled = true;
  try { await window.lah.stop(); } catch (error) { showNotice(errorText(error)); }
  finally { controls.stop.disabled = false; }
});
element('tools-toggle').addEventListener('click', () => {
  const panel = element('tools-panel');
  panel.hidden = !panel.hidden;
  element('tools-toggle').setAttribute('aria-expanded', String(!panel.hidden));
});
element('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark');
  element('theme-toggle').setAttribute('aria-label', t(theme === 'dark' ? 'lightTheme' : 'darkTheme'));
  element('theme-tooltip').textContent = t(theme === 'dark' ? 'lightTheme' : 'darkTheme');
  element('theme-icon').setAttribute('href', theme === 'dark' ? '#icon-light' : '#icon-dark');
});

render();
if (!window.lah) showNotice(t('bridgeUnavailable'));
else {
  window.lah.onEvent(handleEvent);
  window.lah.getState().then(next => { bridgeReady = true; receiveState(next); document.body.dataset.lahReady = 'true'; }).catch(error => showNotice(errorText(error)));
}
