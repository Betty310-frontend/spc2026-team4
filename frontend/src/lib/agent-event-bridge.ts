'use client'

import type { UIMessage } from 'ai'
import { applyCompetitorsFromRest as applyCompetitorsFromAnalysisStore } from '@/store/analysisResult'
import type { CompetitorItem } from '@/types/api'

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
}

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
  const items = (input.competitors ?? input.data ?? []).map((item) => toCompetitorItem(item))
  const sameCount = input.same_count ?? input.same_type ?? items.filter((item) => item.type === 'same').length
  const similarCount =
    input.similar_count ?? input.similar_type ?? items.filter((item) => item.type === 'similar').length

  return {
    sameCount,
    similarCount,
    items,
    center: input.center,
    source: input.source ?? input.data_source,
    asOf: input.as_of ?? input.base_date,
    fallback: input.fallback,
    radiusM: input.radius_m,
    total: input.total ?? items.length,
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
