const ANALYSIS_TOOL_NAMES = [
  'search_competitors',
  'get_population_flow',
  'calc_competition_percentile',
  'get_positioning_data',
]

function createChatRefreshGuard() {
  let hasRagSources = false
  let hasAnalysisTool = false

  return {
    markRagSources() {
      hasRagSources = true
    },
    markAnalysisTool() {
      hasAnalysisTool = true
    },
    shouldRefreshReport(hasAnalysisToolResult) {
      return (hasAnalysisToolResult || hasAnalysisTool) && !hasRagSources
    },
    reset() {
      hasRagSources = false
      hasAnalysisTool = false
    },
  }
}

module.exports = {
  ANALYSIS_TOOL_NAMES,
  createChatRefreshGuard,
}
