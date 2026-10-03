/** LAH's isolated renderer consumes the preload API and never reads files or contacts model servers. */

/** @typedef {{endpoint: string, model: string, contextWindow: number, maxTokens: number, workspace: string}} Settings */
/** @typedef {{role: string, content: string}} Message */
/** @typedef {{id: string, title: string, messages: Message[], eventCount?: number, failureCount?: number}} Session */
/** @typedef {{settings: Settings, sessions: Session[], tools: {name: string, description: string}[], version: string, diagnostics?: {path: string, error?: string}}} AppState */
/** @typedef {{key: string, seq?: number, time: number, type: string, kind: string, label: string, preview: string, turn: number, step: number, status: string, durationMs?: number}} TraceRow */

/** @type {Readonly<Record<string, string>>} */
const ru = Object.freeze({
  stage: 'преальфа',
  newSession: 'Новый сеанс',
  sessions: 'Сеансы',
  sessionsAria: 'Сеансы',
  historyAria: 'История сеансов',
  conversationAria: 'Переписка',
  messageAria: 'Сообщение',
  noSessions: 'Здесь появятся ваши сеансы',
  untitledSession: 'Новый сеанс',
  workspace: 'Рабочая папка',
  chooseWorkspace: 'Выбрать папку',
  workspaceNotSelected: 'Папка ещё не выбрана',
  readOnly: 'Только чтение',
  localOnly: 'На вашем компьютере',
  settings: 'Настройки',
  hideSidebar: 'Скрыть боковую панель · Ctrl+B',
  showSidebar: 'Показать боковую панель · Ctrl+B',
  lightTheme: 'Светлая тема',
  darkTheme: 'Тёмная тема',
  modelNotConnected: 'Модель не настроена',
  emptyTitle: 'Что исследуем сегодня?',
  localMode: 'Локальный агент',
  pickFolder: 'Выбрать папку',
  quickActions: 'Быстрые действия',
  suggestionStructure: 'Объясни структуру этой папки',
  suggestionSearch: 'Найди, где настраивается запуск проекта',
  suggestionRead: 'Прочитай README и кратко опиши проект',
  suggestionStructureLabel: 'Изучить проект',
  suggestionSearchLabel: 'Найти в файлах',
  suggestionReadLabel: 'Прочитать README',
  messagePlaceholder: 'Что найти или изучить в рабочей папке?',
  send: 'Отправить',
  stop: 'Остановить',
  working: 'Локальная модель обрабатывает запрос',
  hintReady: 'Enter — отправить · Shift+Enter — новая строка',
  hintWorkspace: 'Сначала выберите рабочую папку',
  hintModel: 'Укажите локальный сервер и модель в настройках',
  hintRunning: 'Можно остановить текущий запрос',
  availableTools: 'Инструменты агента',
  toolTrace: 'Вызовы инструментов',
  toolPending: 'Выполняется',
  toolCompleted: 'Завершён',
  toolFailed: 'Ошибка',
  toolResult: 'Результат',
  user: 'Вы',
  assistant: 'LAH',
  tool: 'Инструмент',
  modelSettings: 'Локальная модель',
  generalSettings: 'Основные',
  modelsSettings: 'Модели',
  toolsSettings: 'Инструменты',
  appearance: 'Оформление',
  accessMode: 'Режим доступа',
  readOnlyHelp: 'Чтение и поиск внутри выбранной папки',
  themeHelp: 'Тема и положение боковой панели сохраняются на этом компьютере.',
  toolsHelp: 'Эти инструменты доступны агенту для чтения и поиска в рабочей папке.',
  settingsDescription: 'Подключите модель, уже запущенную в LM Studio, llama.cpp или другом локальном сервере.',
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
  sessionView: 'Содержимое сеанса',
  chatTab: 'Чат',
  trajectoryTab: 'Траектория',
  traceSearch: 'Поиск по всем событиям',
  traceFilter: 'Тип событий',
  traceAll: 'Все события',
  traceInput: 'Ввод',
  traceModel: 'Модель',
  traceTools: 'Инструменты',
  traceErrors: 'Ошибки',
  traceSystem: 'Система',
  traceExport: 'Экспорт JSON',
  traceExportHelp: 'Экспортировать полный журнал сеанса с сообщениями, аргументами и результатами',
  traceTimeline: 'Шкала загруженных событий',
  traceOlder: 'Загрузить предыдущие события',
  traceLoading: 'Загружаем события…',
  traceEmpty: 'Здесь появятся шаги модели, вызовы инструментов и результаты.',
  traceNoMatches: 'По этому фильтру событий нет.',
  traceShown: 'Показано {shown} из {total} событий',
  traceStats: '{turns} ходов · {steps} шагов · {calls} вызовов · {errors} событий с ошибками · {duration} работы',
  traceInterrupted: 'прервано',
  traceTruncated: 'Показана начальная часть большого события. Полная запись доступна в экспорте JSON.',
  traceExported: 'Траектория сохранена: {path}',
  diagnosticsTitle: 'Диагностический журнал',
  openDiagnostics: 'Открыть папку',
  diagnosticsPending: 'Журнал сохраняется локально в папке приложения.',
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
  menu: element('composer-menu'),
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
let selectedView = 'chat';
let trajectorySessionId = null;
let trajectoryRequest = 0;
let trajectoryBefore = null;
let trajectoryBusy = false;
let trajectoryAgain = false;
let trajectorySearchTimer;
/** @type {TraceRow[]} */
let trajectoryRows = [];

document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.getAttribute('data-i18n')); });
document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.setAttribute('placeholder', t(node.getAttribute('data-i18n-placeholder'))); });
document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.getAttribute('data-i18n-aria'))); });
document.querySelectorAll('[data-suggestion]').forEach(node => {
  const suggestion = t(node.getAttribute('data-suggestion'));
  const label = node.querySelector('[data-suggestion-label]');
  if (label) label.textContent = t(label.getAttribute('data-suggestion-label'));
  node.addEventListener('click', () => { controls.input.value = suggestion; controls.menu.hidePopover(); updateComposer(); controls.input.focus(); });
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
  ['workspace', 'setup-workspace', 'settings-workspace', 'composer-add'].forEach(id => { /** @type {HTMLButtonElement} */ (element(id)).disabled = !bridgeReady || running; });
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
  element('setup-workspace-label').textContent = workspace ? controls.workspaceName.textContent : t('chooseWorkspace');
  element('model-status-label').textContent = state.settings.model || t('modelNotConnected');
  element('model-status').title = state.settings.model || t('modelSettings');
  element('version').textContent = state.version;
  element('diagnostics-path').textContent = state.diagnostics?.path || t('diagnosticsPending');
  if (state.diagnostics?.error) { element('diagnostics-error').textContent = state.diagnostics.error; element('diagnostics-error').hidden = false; }
  renderSessionView();
  updateComposer();
}

/** @param {number | undefined} milliseconds @returns {string} */
function durationText(milliseconds) {
  return milliseconds === undefined ? '—' : milliseconds < 1000 ? `${Math.round(milliseconds)} мс` : `${(milliseconds / 1000).toFixed(1)} с`;
}

/** @returns {void} */
function renderSessionView() {
  element('session-tabs').hidden = !currentSession();
  const trajectory = selectedView === 'trajectory' && Boolean(currentSession());
  controls.conversation.hidden = trajectory;
  element('trajectory').hidden = !trajectory;
  document.body.classList.toggle('trajectory-active', trajectory);
  for (const view of ['chat', 'trajectory']) {
    element(`${view}-tab`).setAttribute('aria-selected', String(view === (trajectory ? 'trajectory' : 'chat')));
    element(`${view}-tab`).tabIndex = view === (trajectory ? 'trajectory' : 'chat') ? 0 : -1;
  }
  /** @type {HTMLButtonElement} */ (element('export-trajectory')).disabled = running || !currentSession();
  if (trajectory && trajectorySessionId !== currentSessionId) {
    trajectorySessionId = currentSessionId;
    trajectoryRequest++;
    trajectoryRows = []; trajectoryBefore = null;
    delete element('trajectory').dataset.ready;
    element('trajectory-rows').replaceChildren();
    element('trajectory-lanes').replaceChildren();
    element('trajectory-stats').textContent = '';
    void refreshTrajectory();
  }
}

/** @param {'chat' | 'trajectory'} view @returns {void} */
function selectSessionView(view) {
  const alreadyLoaded = trajectorySessionId === currentSessionId;
  selectedView = view;
  renderSessionView();
  if (view === 'trajectory' && currentSessionId && alreadyLoaded) void refreshTrajectory();
}

/** @param {TraceRow[]} rows @returns {void} */
function renderTrajectoryRows(rows) {
  const container = element('trajectory-rows');
  const existing = new Map(Array.from(container.children).map(node => [/** @type {HTMLElement} */ (node).dataset.key, node]));
  let cursor = container.firstElementChild;
  for (const row of rows) {
    let details = /** @type {HTMLDetailsElement | undefined} */ (existing.get(row.key));
    if (!details) {
      details = document.createElement('details'); details.className = 'trace-event'; details.dataset.key = row.key;
      const summary = document.createElement('summary');
      for (const name of ['location', 'tag', 'preview', 'status', 'duration']) { const span = document.createElement('span'); span.className = `trace-${name}`; summary.append(span); }
      const content = document.createElement('pre'); content.textContent = t('traceLoading');
      details.append(summary, content);
      const owned = details, sessionId = currentSessionId;
      owned.addEventListener('toggle', async () => {
        if (!owned.open || owned.dataset.loaded) return;
        try {
          const result = await window.lah.getTrajectoryDetail({ sessionId, key: owned.dataset.key });
          if (sessionId !== currentSessionId || !owned.isConnected) return;
          content.textContent = result.text + (result.truncated ? '\n\n' + t('traceTruncated') : ''); owned.dataset.loaded = 'true';
        } catch (error) { content.textContent = errorText(error); }
      });
    }
    details.dataset.kind = row.kind;
    const cells = details.querySelector('summary').children;
    cells[0].textContent = row.turn ? `${row.turn} · ${row.step || '—'}` : `#${row.seq ?? '—'}`;
    cells[1].textContent = row.label; /** @type {HTMLElement} */ (cells[1]).title = row.type;
    cells[2].textContent = row.preview.replace(/\s+/g, ' ');
    cells[3].textContent = row.status === 'running' ? '…' : row.status === 'error' ? t('traceErrors') : row.status === 'interrupted' ? t('traceInterrupted') : '';
    cells[4].textContent = row.durationMs === undefined ? '' : durationText(row.durationMs);
    details.querySelector('summary').title = new Date(row.time).toLocaleTimeString('ru-RU') + ' · ' + row.type;
    if (details !== cursor) container.insertBefore(details, cursor);
    cursor = details.nextElementSibling;
    existing.delete(row.key);
  }
  for (const obsolete of existing.values()) obsolete.remove();
  const lanes = element('trajectory-lanes'); lanes.replaceChildren();
  const start = rows[0]?.time ?? 0, end = rows.at(-1)?.time ?? start, span = Math.max(1, end - start);
  for (const kind of ['input', 'model', 'tool']) {
    const lane = document.createElement('div'); lane.className = 'timeline-lane';
    for (const row of rows.filter(item => kind === 'input' ? item.type === 'user/message' : kind === 'model' ? ['assistant/message', 'assistant/attempt'].includes(item.type) || (item.type === 'step/start' && item.status === 'running') : item.type === 'tool/call')) {
      const mark = document.createElement('button'); mark.type = 'button'; mark.className = 'timeline-mark'; mark.dataset.kind = row.kind;
      if (row.status === 'error') mark.dataset.kind = 'error';
      const begins = row.type.startsWith('assistant/') ? row.time - (row.durationMs ?? 0) : row.time;
      const left = Math.max(0, Math.min(99, (begins - start) / span * 99));
      mark.style.left = `${left}%`; mark.style.width = `${Math.max(.3, Math.min(100 - left, (row.durationMs ?? 0) / span * 99))}%`;
      mark.title = `${row.label} · ${durationText(row.durationMs)}`; mark.setAttribute('aria-label', mark.title);
      mark.addEventListener('click', () => { const target = Array.from(element('trajectory-rows').children).find(node => /** @type {HTMLElement} */ (node).dataset.key === row.key); if (target) { /** @type {HTMLDetailsElement} */ (target).open = true; target.scrollIntoView({ block: 'nearest' }); /** @type {HTMLElement} */ (target.querySelector('summary')).focus(); } });
      lane.append(mark);
    }
    lanes.append(lane);
  }
}

/** @param {boolean} [older] @returns {Promise<void>} */
async function refreshTrajectory(older = false) {
  if (selectedView !== 'trajectory' || !currentSessionId || !bridgeReady) return;
  if (trajectoryBusy) { trajectoryAgain = true; return; }
  const sessionId = currentSessionId, request = ++trajectoryRequest;
  trajectoryBusy = true;
  const status = element('trajectory-status');
  if (!trajectoryRows.length) status.textContent = t('traceLoading');
  const olderButton = /** @type {HTMLButtonElement} */ (element('trajectory-older')); olderButton.disabled = true;
  try {
    const result = await window.lah.getTrajectory({ sessionId, before: older ? trajectoryBefore : undefined, query: /** @type {HTMLInputElement} */ (element('trajectory-search')).value, kind: /** @type {HTMLSelectElement} */ (element('trajectory-filter')).value });
    if (request !== trajectoryRequest || sessionId !== currentSessionId) return;
    trajectoryRows = older ? [...result.rows, ...trajectoryRows] : result.rows;
    trajectoryBefore = result.before;
    element('trajectory').dataset.ready = 'true';
    renderTrajectoryRows(trajectoryRows);
    const summary = result.summary;
    element('trajectory-stats').textContent = t('traceStats', { ...summary, duration: durationText(summary.durationMs) }) + (summary.tokens === null ? '' : ` · ${summary.tokens} токенов по отчётам сервера`);
    status.textContent = trajectoryRows.length ? (trajectoryBefore ? t('traceShown', { shown: trajectoryRows.length, total: summary.matches }) : '') : t(summary.events ? 'traceNoMatches' : 'traceEmpty');
    olderButton.hidden = !trajectoryBefore;
  } catch (error) { if (request === trajectoryRequest) status.textContent = errorText(error); }
  finally { trajectoryBusy = false; olderButton.disabled = false; if (trajectoryAgain) { trajectoryAgain = false; void refreshTrajectory(); } }
}

/** @param {AppState} next @returns {void} */
function receiveState(next) {
  state = next;
  if (!state.sessions.some(session => session.id === currentSessionId)) currentSessionId = state.sessions[0]?.id ?? null;
  if (pendingMessage && currentSession()?.messages.slice(pendingMessageIndex).some(message => message.role === 'user' && message.content === pendingMessage)) pendingMessage = '';
  render();
}

/** @param {'general' | 'models' | 'tools'} section @returns {void} */
function selectSettingsSection(section) {
  document.querySelectorAll('[data-settings-section]').forEach(node => {
    if (node.getAttribute('data-settings-section') === section) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  });
  ['general', 'models', 'tools'].forEach(name => { element(`settings-${name}`).hidden = name !== section; });
  element('settings-footer').hidden = section !== 'models';
  element('settings-error').hidden = true;
}

/** @param {'general' | 'models' | 'tools'} [section] @returns {void} */
function openSettings(section = 'general') {
  if (!controls.settings.open) {
    controls.endpoint.value = state.settings.endpoint;
    controls.model.value = state.settings.model;
    controls.context.value = String(state.settings.contextWindow);
    controls.maxTokens.value = String(state.settings.maxTokens);
    element('discovery-status').textContent = '';
    element('settings-error').hidden = true;
  }
  selectSettingsSection(section);
  if (!controls.settings.open) controls.settings.showModal();
}

/** @param {string} key @returns {string | null} */
function readPreference(key) {
  try { return localStorage.getItem(key); }
  catch (error) { console.debug('LAH appearance preferences are unavailable', error); return null; }
}

/** Appearance storage is optional; its failure does not block model or file access. @param {string} key @param {string} value @returns {void} */
function writePreference(key, value) {
  try { localStorage.setItem(key, value); }
  catch (error) { console.debug('LAH appearance preference was not saved', error); }
}

/** @param {'light' | 'dark'} theme @param {boolean} [remember] @returns {void} */
function setTheme(theme, remember = true) {
  document.documentElement.dataset.theme = theme;
  document.body.toggleAttribute('data-ds-dark-theme', theme === 'dark');
  element('theme-toggle').setAttribute('aria-label', t(theme === 'dark' ? 'lightTheme' : 'darkTheme'));
  element('theme-tooltip').textContent = t(theme === 'dark' ? 'lightTheme' : 'darkTheme');
  element('theme-icon').setAttribute('href', theme === 'dark' ? '#icon-light' : '#icon-dark');
  document.querySelectorAll('[data-theme-choice]').forEach(node => { node.setAttribute('aria-pressed', String(node.getAttribute('data-theme-choice') === theme)); });
  if (remember) writePreference('lah.theme', theme);
}

/** @param {boolean} collapsed @param {boolean} [remember] @returns {void} */
function setSidebarCollapsed(collapsed, remember = true) {
  const sidebar = element('sidebar');
  const toggle = element('toggle-sidebar');
  if (collapsed && sidebar.contains(document.activeElement)) toggle.focus();
  sidebar.hidden = collapsed;
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  toggle.setAttribute('aria-expanded', String(!collapsed));
  toggle.setAttribute('aria-label', t(collapsed ? 'showSidebar' : 'hideSidebar'));
  element('sidebar-tooltip').textContent = t(collapsed ? 'showSidebar' : 'hideSidebar');
  if (remember) writePreference('lah.sidebar', collapsed ? 'hidden' : 'visible');
}

/** Fit the action menu above or below the input card without clipping it at a window edge. @returns {void} */
function placeComposerMenu() {
  const card = element('composer').getBoundingClientRect();
  const width = Math.min(card.width, window.innerWidth - 32);
  const above = Math.max(0, card.top - 24);
  const below = Math.max(0, window.innerHeight - card.bottom - 24);
  controls.menu.style.width = `${width}px`;
  controls.menu.style.left = `${Math.max(16, Math.min(card.left, window.innerWidth - width - 16))}px`;
  controls.menu.style.maxHeight = `${Math.max(above, below)}px`;
  controls.menu.style.top = above >= below ? 'auto' : `${card.bottom + 8}px`;
  controls.menu.style.bottom = above >= below ? `${window.innerHeight - card.top + 8}px` : 'auto';
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
    selectedView = 'chat';
    pendingMessage = '';
    controls.input.value = '';
    controls.input.style.height = '';
    controls.menu.hidePopover();
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
    errorNode.scrollIntoView({ block: 'nearest' });
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
    errorNode.scrollIntoView({ block: 'nearest' });
  } finally {
    button.textContent = t('save');
    updateComposer();
  }
}

/** @param {{type: string, [key: string]: unknown}} event @returns {void} */
function handleEvent(event) {
  if (event.type === 'state') receiveState(event.state);
  else if (event.type === 'status') { running = event.status === 'running'; renderSessions(); updateComposer(); renderSessionView(); if (!running) void refreshTrajectory(); }
  else if (event.type === 'trajectory' && event.sessionId === currentSessionId) void refreshTrajectory();
  else if (event.type === 'diagnostic-error') { element('diagnostics-error').textContent = String(event.message); element('diagnostics-error').hidden = false; }
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
element('chat-tab').addEventListener('click', () => selectSessionView('chat'));
element('trajectory-tab').addEventListener('click', () => selectSessionView('trajectory'));
element('session-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const view = event.key === 'Home' ? 'chat' : event.key === 'End' ? 'trajectory' : selectedView === 'chat' ? 'trajectory' : 'chat';
  selectSessionView(view); element(`${view}-tab`).focus();
});
element('trajectory-search').addEventListener('input', () => { clearTimeout(trajectorySearchTimer); trajectoryRequest++; trajectorySearchTimer = setTimeout(() => { void refreshTrajectory(); }, 180); });
element('trajectory-filter').addEventListener('change', () => { trajectoryRequest++; void refreshTrajectory(); });
element('trajectory-older').addEventListener('click', () => { void refreshTrajectory(true); });
element('export-trajectory').addEventListener('click', async () => { try { const result = await window.lah.exportSession(currentSessionId); if (!result.canceled) element('trajectory-status').textContent = t('traceExported', { path: result.path }); } catch (error) { element('trajectory-status').textContent = errorText(error); } });
element('open-diagnostics').addEventListener('click', async () => { try { await window.lah.openDiagnostics(); } catch (error) { element('diagnostics-error').textContent = errorText(error); element('diagnostics-error').hidden = false; } });
function reportRendererError(error) { if (window.lah?.reportError) void window.lah.reportError({ message: errorText(error), stack: error instanceof Error ? error.stack : undefined }).catch(failure => console.error('LAH error report failed', failure)); }
window.addEventListener('error', event => reportRendererError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => reportRendererError(event.reason));
['workspace', 'setup-workspace', 'settings-workspace'].forEach(id => { element(id).addEventListener('click', chooseWorkspace); });
element('open-settings').addEventListener('click', () => openSettings('general'));
['model-status', 'menu-model'].forEach(id => { element(id).addEventListener('click', () => openSettings('models')); });
['sidebar-tools', 'menu-tools'].forEach(id => { element(id).addEventListener('click', () => openSettings('tools')); });
document.querySelectorAll('[data-settings-section]').forEach(node => { node.addEventListener('click', () => selectSettingsSection(/** @type {'general' | 'models' | 'tools'} */ (node.getAttribute('data-settings-section')))); });
document.querySelectorAll('[data-theme-choice]').forEach(node => { node.addEventListener('click', () => setTheme(/** @type {'light' | 'dark'} */ (node.getAttribute('data-theme-choice')))); });
controls.menu.addEventListener('beforetoggle', event => { if (event.newState === 'open') placeComposerMenu(); });
window.addEventListener('resize', () => { if (controls.menu.matches(':popover-open')) placeComposerMenu(); });
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
element('theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(theme);
});
element('toggle-sidebar').addEventListener('click', () => { controls.menu.hidePopover(); setSidebarCollapsed(!element('sidebar').hidden); });
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.repeat || event.isComposing) return;
  const key = event.key.toLowerCase();
  if (key === ',') { event.preventDefault(); openSettings('models'); }
  else if (!controls.settings.open && key === 'b') { event.preventDefault(); element('toggle-sidebar').click(); }
  else if (!controls.settings.open && key === 'n' && bridgeReady && !running) { event.preventDefault(); void newSession(); }
});

element('new-session').title = t('newSession') + ' · Ctrl+N';
setTheme(readPreference('lah.theme') === 'light' ? 'light' : 'dark', false);
setSidebarCollapsed(readPreference('lah.sidebar') === 'hidden', false);
render();
if (!window.lah) showNotice(t('bridgeUnavailable'));
else {
  window.lah.onEvent(handleEvent);
  window.lah.getState().then(next => { bridgeReady = true; receiveState(next); document.body.dataset.lahReady = 'true'; }).catch(error => showNotice(errorText(error)));
}
