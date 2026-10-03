import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
type Event = { seq: number; time: number; type: string; data: Record<string, unknown> }
type Row = {
  key: string
  kind: string
  label: string
  preview: string
  status: string
  durationMs?: number
}
type Session = { events: Event[] }
type PageInput = { before?: string; limit?: number; query?: string; kind?: string }
const { projectTrajectory, trajectoryPage, trajectoryDetail } = require('../desktop/trajectory.cjs') as {
  projectTrajectory: (events: Event[]) => { rows: Row[]; summary: { calls: number; tokens: number | null; durationMs?: number } }
  trajectoryPage: (session: Session, input?: PageInput) => { rows: Row[]; before: string | null }
  trajectoryDetail: (session: Session, key: string, max?: number) => { text: string; truncated: boolean }
}
function ledger(entries: [string, Record<string, unknown>][]): Event[] {
  return entries.map(([type, data], seq) => ({ type, data, seq, time: 1000 + seq * 10 }))
}

describe('persistent trajectory projection', () => {
  it('matches out-of-order tool results by ID and settles model steps without modifying the ledger', () => {
    const events = ledger([
      ['turn/start', { turn: 1 }], ['step/start', { turn: 1, step: 1 }],
      ['tool/call', { callId: 'a', name: 'read_file', arguments: '{"path":"a.txt"}' }],
      ['tool/call', { callId: 'b', name: 'search_content', arguments: '{"query":"marker"}' }],
      ['tool/result', { message: { toolCallId: 'b', content: [{ type: 'text', text: 'found' }] } }],
      ['tool/result', { message: { toolCallId: 'a', isError: true, content: [{ type: 'text', text: 'missing' }] } }],
      ['step/end', { turn: 1, step: 1 }], ['turn/end', { turn: 1, reason: { kind: 'completed' } }],
    ])
    const original = structuredClone(events), result = projectTrajectory(events)
    expect(result.rows[2]).toMatchObject({ label: 'read_file', durationMs: 30, status: 'error' })
    expect(result.rows[3]).toMatchObject({ label: 'search_content', durationMs: 10, status: 'complete' })
    expect(result.rows[1]).toMatchObject({ status: 'complete', durationMs: 50 })
    expect(result.summary).toMatchObject({ calls: 2, tokens: null })
    expect(events).toEqual(original)
  })
  it('keeps failed attempts, errors and interrupted turns visible and leaves unknown elapsed time unset', () => {
    const events = ledger([['turn/start', { turn: 1 }], ['step/start', { step: 1 }], ['assistant/attempt', { stream: [{ type: 'chunk', chunk: { type: 'finish', reason: { kind: 'error', failure: { code: 'HTTP_ERROR', message: 'server failed' } } } }] }], ['step/end', {}], ['turn/end', { reason: { kind: 'error', error: { message: 'server failed' } } }]])
    events[2].time = 500
    const result = projectTrajectory(events)
    expect(result.rows.find(row => row.key === 'event:2')).toMatchObject({ kind: 'error', preview: 'server failed', durationMs: undefined })
    expect(result.rows.find(row => row.key === 'event:1')?.status).toBe('error')
    expect(result.summary).toMatchObject({ errors: 3 })
    expect(trajectoryPage({ events }, { kind: 'error' }).rows).toHaveLength(3)
    expect(projectTrajectory(ledger([['turn/end', { reason: { kind: 'aborted' } }]])).rows[0].status).toBe('interrupted')
  })
  it('pages older records and searches full saved payloads beyond the short preview', () => {
    const events = ledger(Array.from({ length: 7 }, (_, index) => ['user/message', { content: [{ type: 'text', text: index === 0 ? 'x'.repeat(400) + 'hidden-marker' : `message ${index}` }] }]))
    const session = { events }
    const latest = trajectoryPage(session, { limit: 3 })
    expect(latest.rows.map(row => row.key)).toEqual(['event:4', 'event:5', 'event:6'])
    expect(trajectoryPage(session, { before: latest.before!, limit: 3 }).rows.map(row => row.key)).toEqual(['event:1', 'event:2', 'event:3'])
    expect(trajectoryPage(session, { query: 'hidden-marker' }).rows.map(row => row.key)).toEqual(['event:0'])
    expect(trajectoryPage(session, { kind: 'error' }).rows).toEqual([])
    expect(() => trajectoryPage(session, { limit: 1001 })).toThrow()
    expect(() => trajectoryPage(session, { before: 'missing' })).toThrow()
  })
  it('bounds the inspector while retaining the complete original event for export', () => {
    const events = ledger([['extension/event', { text: 'x'.repeat(500) }]])
    expect(trajectoryDetail({ events }, 'event:0', 80)).toMatchObject({ truncated: true })
    expect(trajectoryDetail({ events }, 'event:0', 80).text.length).toBe(80)
    expect(events[0].data.text).toHaveLength(500)
    expect(projectTrajectory(events).rows[0].label).toBe('extension/event')
  })
  it('counts reported usage and active turns without counting idle time between turns', () => {
    const events = ledger([
      ['turn/start', { turn: 1 }],
      ['assistant/message', { usage: { inputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4, outputTokens: 5 } }],
      ['turn/end', { turn: 1, reason: { kind: 'completed' } }],
      ['turn/start', { turn: 2 }],
      ['assistant/message', { usage: { totalTokens: 8, inputTokens: 3, outputTokens: 5 } }],
      ['turn/end', { turn: 2, reason: { kind: 'completed' } }],
    ])
    for (const event of events.slice(3)) event.time += 60000
    expect(projectTrajectory(events).summary).toMatchObject({ tokens: 22, durationMs: 40 })
    expect(projectTrajectory([]).summary).toMatchObject({ tokens: null, durationMs: undefined })
  })
})
