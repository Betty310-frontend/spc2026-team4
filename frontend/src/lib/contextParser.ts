import { AnalysisContext } from '@/types/analysis'
import { normalizeCategory } from '@/lib/category'

export function extractRadiusFromText(text: string): number | null {
  const radiusMatch =
    text.match(/(?:반경\s*)?(\d{2,4})\s*m(?:\s*로)?/i) ??
    text.match(/(?:반경\s*)?(\d{2,4})\s*미터/i)

  if (!radiusMatch?.[1]) return null

  const radius = Number(radiusMatch[1])
  return Number.isFinite(radius) ? radius : null
}

export function parseContextFromToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void,
) {
  if (toolName === 'search_competitors') {
    const rawCategory =
      (typeof args.category === 'string' && args.category) ||
      (typeof args['업종'] === 'string' && args['업종']) ||
      null
    const rawLocation =
      (typeof args.station === 'string' && args.station) ||
      (typeof args.location === 'string' && args.location) ||
      (typeof args['위치'] === 'string' && args['위치']) ||
      null
    const rawRadius =
      (typeof args.radius === 'number' && args.radius) ||
      (typeof args['반경'] === 'number' && args['반경']) ||
      null

    setAnalysisContext({
      industry: normalizeCategory(rawCategory) ?? rawCategory,
      location: rawLocation,
      radius: rawRadius,
    })
  }
}

export function parseContextFromAssistantText(
  text: string,
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void,
) {
  const radiusMatch = extractRadiusFromText(text)
  const partial: Partial<AnalysisContext> = {}

  if (radiusMatch != null) {
    partial.radius = radiusMatch
  }

  if (Object.keys(partial).length > 0) {
    setAnalysisContext(partial)
  }
}
