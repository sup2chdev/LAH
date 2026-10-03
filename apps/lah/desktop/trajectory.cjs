/** Presentation of the original session ledger; raw events remain unchanged. */
function messageText(message) {
  return (Array.isArray(message?.content) ? message.content : []).filter(block => block.type === 'text' || block.type === 'reasoning').map(block => block.text).join('\n')
}
function elapsed(start, end) {
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start : undefined
}
function projectTrajectory(events, failures = []) {
  let turn = 0, step = 0
  const calls = new Map(), steps = new Map(), turns = new Map()
  let tokens = 0, usageCount = 0, durationMs = 0, durationCount = 0
  const rows = events.map(event => {
    const data = event.data ?? {}
    turn = data.turn ?? turn
    step = event.type === 'turn/start' ? 0 : data.step ?? step
    const row = { key: `event:${event.seq}`, seq: event.seq, time: event.time, type: event.type, turn, step, kind: 'system', label: event.type, preview: '', status: '', durationMs: undefined }
    if (event.type === 'turn/start') { turns.set(turn, event.time); row.label = 'Начало хода' }
    else if (event.type === 'step/start') { steps.set(`${turn}:${step}`, row); row.kind = 'model'; row.label = 'Шаг модели'; row.status = 'running' }
    else if (event.type === 'user/message') { row.kind = 'input'; row.label = 'USER'; row.preview = messageText(data) }
    else if (event.type === 'assistant/message' || event.type === 'assistant/attempt') {
      row.kind = 'model'; row.label = event.type === 'assistant/attempt' ? 'Попытка модели' : 'ASSISTANT'
      row.preview = messageText(data.message) || (data.message?.content ?? []).filter(block => block.type === 'tool-call').map(block => block.name).join(', ')
      row.durationMs = elapsed(steps.get(`${turn}:${step}`)?.time, event.time)
      row.status = event.type === 'assistant/attempt' || data.interrupted ? 'interrupted' : 'complete'
      const finish = (data.stream ?? []).find(record => record.type === 'chunk' && record.chunk.type === 'finish')?.chunk.reason
      if (finish?.kind === 'error') { row.kind = 'error'; row.status = 'error'; row.preview = finish.failure?.message ?? 'Ошибка ответа модели' }
      if (data.usage) { tokens += data.usage.totalTokens ?? (data.usage.inputTokens ?? 0) + (data.usage.cacheReadTokens ?? 0) + (data.usage.cacheWriteTokens ?? 0) + (data.usage.outputTokens ?? 0); usageCount++ }
    } else if (event.type === 'tool/call') {
      row.kind = 'tool'; row.label = data.name; row.preview = data.arguments; row.callId = data.callId; row.status = 'running'; calls.set(data.callId, row)
    } else if (event.type === 'tool/result') {
      row.kind = data.message?.isError ? 'error' : 'tool'; row.status = data.message?.isError ? 'error' : 'complete'
      const call = calls.get(data.message?.toolCallId)
      row.label = call?.label ?? 'Результат инструмента'; row.preview = data.error?.reason ?? messageText(data.message)
      row.durationMs = elapsed(call?.time, event.time); row.callId = data.message?.toolCallId
      if (call) { call.status = row.status; call.durationMs = row.durationMs }
    } else if (event.type === 'turn/end') {
      const reason = data.reason?.kind
      row.kind = reason === 'error' ? 'error' : 'system'; row.label = 'Конец хода'; row.preview = data.reason?.error?.message ?? reason ?? ''
      row.status = reason === 'completed' ? 'complete' : reason === 'error' ? 'error' : 'interrupted'
      row.durationMs = elapsed(turns.get(turn), event.time)
      if (row.durationMs !== undefined) { durationMs += row.durationMs; durationCount++ }
      const openedStep = steps.get(`${turn}:${step}`)
      if (openedStep && (openedStep.status === 'running' || reason !== 'completed')) openedStep.status = row.status
    } else if (event.type === 'request/header') {
      row.label = 'Контекст и инструменты'; row.preview = (data.header?.tools ?? []).map(tool => tool.name).join(', ')
    } else if (event.type === 'system/message') { row.label = 'Системные инструкции'; row.preview = messageText(data.message) }
    else if (event.type === 'step/end') { row.label = 'Конец шага'; const openedStep = steps.get(`${turn}:${step}`); row.durationMs = elapsed(openedStep?.time, event.time); if (openedStep) { openedStep.status = 'complete'; openedStep.durationMs = row.durationMs } }
    else row.preview = JSON.stringify(data)
    row.preview = String(row.preview ?? '').slice(0, 320)
    return row
  })
  for (const failure of failures) rows.push({ key: `failure:${failure.id}`, time: failure.time, type: 'desktop/error', kind: 'error', label: 'Ошибка приложения', preview: String(failure.message).slice(0, 320), status: 'error', turn: 0, step: 0 })
  rows.sort((a, b) => a.time - b.time || (a.seq ?? Infinity) - (b.seq ?? Infinity))
  return { rows, summary: { events: events.length, turns: turns.size, steps: steps.size, calls: calls.size, errors: rows.filter(row => row.kind === 'error' || row.status === 'error').length, durationMs: durationCount ? durationMs : undefined, tokens: usageCount ? tokens : null } }
}
function trajectoryPage(session, input = {}) {
  const trace = projectTrajectory(session.events, session.failures)
  const query = input.query ?? '', kind = input.kind ?? 'all'
  if (typeof query !== 'string' || query.length > 256 || !['all', 'input', 'model', 'tool', 'error', 'system'].includes(kind)) throw new Error('Некорректный фильтр траектории.')
  const search = query.trim().toLowerCase()
  const records = search ? new Map([...session.events.map(event => [`event:${event.seq}`, event]), ...(session.failures ?? []).map(failure => [`failure:${failure.id}`, failure])]) : null
  trace.rows = trace.rows.filter(row => (kind === 'all' || row.kind === kind || (kind === 'error' && row.status === 'error')) && (!search || `${row.type} ${row.label} ${row.preview}`.toLowerCase().includes(search) || JSON.stringify(records.get(row.key)).toLowerCase().includes(search)))
  trace.summary.matches = trace.rows.length
  const limit = input.limit ?? 300
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('Некорректный размер страницы траектории.')
  const end = input.before === undefined ? trace.rows.length : trace.rows.findIndex(row => row.key === input.before)
  if (end < 0) throw new Error('Событие траектории не найдено.')
  const start = Math.max(0, end - limit)
  return { rows: trace.rows.slice(start, end), summary: trace.summary, before: start ? trace.rows[start].key : null }
}
function trajectoryDetail(session, key, maxCharacters = 262144) {
  const record = key.startsWith('event:') ? session.events.find(event => `event:${event.seq}` === key) : (session.failures ?? []).find(failure => `failure:${failure.id}` === key)
  if (!record) throw new Error('Событие траектории не найдено.')
  const text = JSON.stringify(record, null, 2)
  return { text: text.slice(0, maxCharacters), truncated: text.length > maxCharacters }
}
module.exports = { projectTrajectory, trajectoryPage, trajectoryDetail }
