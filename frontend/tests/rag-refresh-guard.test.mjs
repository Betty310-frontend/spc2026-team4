import test from 'node:test'
import assert from 'node:assert/strict'

import chatRefreshGuardModule from '../src/lib/chatRefreshGuard.js'

const { createChatRefreshGuard } = chatRefreshGuardModule

test('RAG 응답은 출처가 있으면 리포트 갱신을 막는다', () => {
  const guard = createChatRefreshGuard()

  guard.markRagSources()
  guard.markAnalysisTool()

  assert.equal(guard.shouldRefreshReport(true), false)
  assert.equal(guard.shouldRefreshReport(false), false)
})

test('분석 응답은 출처가 없을 때만 리포트를 갱신한다', () => {
  const guard = createChatRefreshGuard()

  guard.markAnalysisTool()

  assert.equal(guard.shouldRefreshReport(true), true)
  assert.equal(guard.shouldRefreshReport(false), true)
})

test('reset 이후에는 다음 요청 상태가 초기화된다', () => {
  const guard = createChatRefreshGuard()

  guard.markRagSources()
  guard.markAnalysisTool()
  guard.reset()

  assert.equal(guard.shouldRefreshReport(true), true)
})
