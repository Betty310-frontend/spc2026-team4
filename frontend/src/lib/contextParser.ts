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
  const industryMatch =
    text.match(/반경[^\n]*?내\s*([가-힣0-9]+)\s*(?:는|은)\s*\d+\s*개/) ??
    text.match(/내\s*([가-힣0-9]+)\s*(?:는|은)\s*\d+\s*개/) ??
    text.match(/([가-힣0-9]+)\s*(?:업종|업종은|업종이|업종가)/) ??
    text.match(/내\s*([가-힣0-9]+)\s*업종/) ??
    text.match(/([가-힣0-9]+)\s*업종은/) ??
    text.match(/([가-힣0-9]+)\s*업종/)

  const partial: Partial<AnalysisContext> = {}

  if (locationMatch?.[1]) {
    partial.location = locationMatch[1]
  }

  if (radiusMatch != null) {
    partial.radius = radiusMatch
  }

  if (industryMatch?.[1]) {
    partial.industry = industryMatch[1]
  }

  if (Object.keys(partial).length > 0) {
    setAnalysisContext(partial)
  }
}
