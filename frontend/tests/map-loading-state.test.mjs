import test from 'node:test'
import assert from 'node:assert/strict'

import mapLoadingStateModule from '../src/lib/mapLoadingState.js'

const { hasMapLoading } = mapLoadingStateModule

test('chat 로딩만 있으면 지도 로딩으로 보지 않는다', () => {
  const loadingKeys = new Set(['chat'])

  assert.equal(hasMapLoading(loadingKeys), false)
})

test('분석 API 로딩이 있으면 지도 로딩으로 본다', () => {
  const loadingKeys = new Set(['chat', 'competitors'])

  assert.equal(hasMapLoading(loadingKeys), true)
})
