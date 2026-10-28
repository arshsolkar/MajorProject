import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAnalysisTimestamp, sortAnalysisHistory } from './analysisHistory.js'

test('formats persisted timestamps in India Standard Time with seconds', () => {
  assert.equal(formatAnalysisTimestamp('2026-10-28T12:00:00Z'), '28/10/2026, 17:30:00')
  assert.equal(formatAnalysisTimestamp(null), 'Time unavailable')
  assert.equal(formatAnalysisTimestamp('invalid'), 'Time unavailable')
})

test('sorts newest first, breaks ties by descending ID, and keeps missing timestamps last', () => {
  const history = sortAnalysisHistory([
    { id: 'zzzz-older', created_at: '2026-10-28T10:00:00Z', completed_at: '2026-10-28T18:00:00Z', run_number: 1, candidate_count: 1 },
    { id: 'aaaa-newer', created_at: '2026-10-28T11:00:00Z', completed_at: '2026-10-28T11:01:00Z', run_number: 3, candidate_count: 4 },
    { id: 'a', created_at: '2026-10-28T10:00:00Z', candidate_count: 2 },
    { id: 'b', created_at: '2026-10-28T10:00:00Z', candidate_count: 3 },
    { id: 'legacy', created_at: null, candidate_count: 0 },
  ])
  assert.deepEqual(history.map(item => item.id), ['aaaa-newer', 'zzzz-older', 'b', 'a', 'legacy'])
})
