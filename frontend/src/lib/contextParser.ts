import { AnalysisContext } from '@/types/analysis'

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
    setAnalysisContext({
      industry: args['업종'] as string,
      location: args['위치'] as string,
      radius: args['반경'] as number,
    })
  }
}

export function parseContextFromAssistantText(
  text: string,
  setAnalysisContext: (ctx: Partial<AnalysisContext>) => void,
) {
  const locationMatch =
    text.match(/(?:해당 위치는|위치는)\s*([가-힣0-9]+(?:동|가|로|리|읍|면|구))/) ??
    text.match(/([가-힣0-9]+(?:동|가|로|리|읍|면|구))\s*(?:에\s*속합니다|에\s*속해 있습니다|입니다)/)
  const radiusMatch = extractRadiusFromText(text)
  const partial: Partial<AnalysisContext> = {}

  if (locationMatch?.[1]) {
    partial.location = locationMatch[1]
  }

  if (radiusMatch != null) {
    partial.radius = radiusMatch
  }

  if (Object.keys(partial).length > 0) {
    setAnalysisContext(partial)
  }
}
