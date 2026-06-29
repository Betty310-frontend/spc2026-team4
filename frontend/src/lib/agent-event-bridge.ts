'use client'

import type { UIMessage } from 'ai'
import { applyCompetitorsFromRest as applyCompetitorsFromAnalysisStore } from '@/store/analysisResult'
import type { CompetitorItem, SearchCompetitorsToolResponse } from '@/types/api'

export type AgentEvent = {
  event: 'tool' | 'status' | 'delta'
  name?: string
  status?: 'success' | 'error' | 'timeout'
  args?: unknown
  payload?: unknown
  phase?: string
  tool?: string
}

export type CompetitorsApiResponse = {
  same_count?: number
  similar_count?: number
  competitors?: CompetitorItem[]
  center?: { lat: number; lng: number }
  source?: string
  as_of?: string
  fallback?: boolean
  radius_m?: number
  total?: number
  data?: CompetitorItem[]
  same_type?: number
  similar_type?: number
  data_source?: string
  base_date?: string
  fallback_reason?: string | null
} | SearchCompetitorsToolResponse

export type NormalizedCompetitors = {
  sameCount: number
  similarCount?: number
  items: CompetitorItem[]
  center?: { lat: number; lng: number }
  source?: string
  asOf?: string
  fallback?: boolean
  radiusM?: number
  total?: number
}

function toCompetitorItem(item: Partial<CompetitorItem> | null | undefined): CompetitorItem {
  return {
    id: item?.id ?? '',
    name: item?.name ?? '',
    lat: typeof item?.lat === 'number' ? item.lat : 0,
    lng: typeof item?.lng === 'number' ? item.lng : 0,
    type: item?.type === 'similar' ? 'similar' : 'same',
    category: item?.category ?? null,
    address: item?.address ?? null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSearchCompetitorsToolResponse(
  value: CompetitorsApiResponse,
): value is SearchCompetitorsToolResponse {
  return isRecord(value) && 'metrics' in value && 'top_competitors' in value
}

export function parseAgentEventLine(line: string): AgentEvent | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const jsonText = trimmed.startsWith('data:') ? trimmed.slice(5).trimStart() : trimmed

  try {
    const parsed = JSON.parse(jsonText)
    if (!isRecord(parsed) || typeof parsed.event !== 'string') return null

    return parsed as AgentEvent
  } catch {
    return null
  }
}

export function normalizeCompetitors(input: CompetitorsApiResponse): NormalizedCompetitors {
  const isSearch = isSearchCompetitorsToolResponse(input)
  const items = isSearch ? [] : (input.competitors ?? input.data ?? []).map((item) => toCompetitorItem(item))
  const metrics = isSearch ? input.metrics : null
  const sameCount =
    ('same_count' in input ? input.same_count : undefined) ??
    ('same_type' in input ? input.same_type : undefined) ??
    metrics?.competitor_count ??
    items.filter((item) => item.type === 'same').length
  const similarCount =
    ('similar_count' in input ? input.similar_count : undefined) ??
    ('similar_type' in input ? input.similar_type : undefined) ??
    items.filter((item) => item.type === 'similar').length
  const center = !isSearch && 'center' in input ? input.center : undefined
  const source = isSearch
    ? '소상공인시장진흥공단'
    : ('source' in input ? input.source : undefined) ??
      ('data_source' in input ? input.data_source : undefined)
  const asOf =
    ('as_of' in input ? input.as_of : undefined) ??
    ('base_date' in input ? input.base_date : undefined) ??
    metrics?.data_reference_month
  const fallback = 'fallback' in input ? input.fallback : false
  const radiusM = !isSearch && 'radius_m' in input ? input.radius_m : undefined
  const total =
    ('total' in input ? input.total : undefined) ?? metrics?.competitor_count ?? items.length

  return {
    sameCount,
    similarCount,
    items,
    center,
    source,
    asOf,
    fallback,
    radiusM,
    total,
  }
}

export function applyCompetitors(normalized: NormalizedCompetitors): void {
  applyCompetitorsFromAnalysisStore(normalized)
}

export function applyAgentEventToStore(evt: AgentEvent): void {
  if (evt.event !== 'tool' || evt.name !== 'search_competitors' || evt.status !== 'success') {
    return
  }

  if (!evt.payload || !isRecord(evt.payload)) return

  applyCompetitors(normalizeCompetitors(evt.payload as CompetitorsApiResponse))
}

export function extractCompetitorsFromMessage(message: UIMessage): NormalizedCompetitors | null {
  for (const part of message.parts) {
    if (!part || typeof part !== 'object' || !('type' in part)) continue

    if (part.type === 'dynamic-tool') {
      if (part.toolName !== 'search_competitors' || part.state !== 'output-available') continue
      if (!isRecord(part.output)) continue
      return normalizeCompetitors(part.output as CompetitorsApiResponse)
    }

    if (part.type === 'tool-search_competitors') {
      if (part.state !== 'output-available') continue
      if (!isRecord(part.output)) continue
      return normalizeCompetitors(part.output as CompetitorsApiResponse)
    }
  }

  return null
}
