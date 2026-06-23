import { AnalysisContext } from '@/types/analysis'

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
