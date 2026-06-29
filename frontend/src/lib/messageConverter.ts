import { UIMessage } from 'ai'
import { ChatMessage, ToolCallMessage } from '@/types/message'

export function convertToChatMessages(sdkMessages: UIMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []

  for (let msgIdx = 0; msgIdx < sdkMessages.length; msgIdx++) {
    const msg = sdkMessages[msgIdx]

    if (msg.role === 'user') {
      const textPart = msg.parts.find((p) => p.type === 'text')
      const text = textPart && 'text' in textPart ? (textPart as { text: string }).text : ''
      result.push({ id: msg.id, role: 'user', content: text })
      continue
    }

    if (msg.role === 'assistant') {
      let textAccum = ''
      let textPartCount = 0

      for (const part of msg.parts) {
        if (!part || typeof part !== 'object' || !('type' in part)) {
          continue
        }

        if (part.type === 'text' && 'text' in part) {
          textAccum += (part as { text: string }).text
        }

        if (part.type === 'dynamic-tool' || part.type.startsWith('tool-')) {
          if (textAccum.trim()) {
            result.push({
              id: `${msg.id}-${msgIdx}-text-${textPartCount++}`,
              role: 'agent',
              content: textAccum.trim(),
            })
            textAccum = ''
          }

          if (part.type === 'dynamic-tool') {
            const p = part as {
              type: 'dynamic-tool'
              toolName: string
              toolCallId: string
              state: string
              input?: unknown
              output?: unknown
              errorText?: string
            }

            const toolMsg: ToolCallMessage = {
              id: `${p.toolCallId}-${msgIdx}`,
              role: 'tool',
              toolName: p.toolName,
              params:
                p.state !== 'input-streaming' && p.input
                  ? (p.input as Record<string, unknown>)
                  : {},
              status:
                p.state === 'output-available'
                  ? 'done'
                  : p.state === 'output-error'
                    ? 'error'
                    : 'loading',
              resultText:
                p.state === 'output-available'
                  ? formatToolResult(p.toolName, p.output)
                  : undefined,
              errorText: p.state === 'output-error' ? p.errorText : undefined,
            }
            result.push(toolMsg)
            continue
          }

          const p = part as {
            type: `tool-${string}`
            toolCallId: string
            state: string
            input?: unknown
            output?: unknown
            errorText?: string
          }
          const toolName = part.type.replace(/^tool-/, '')

          const toolMsg: ToolCallMessage = {
            id: `${p.toolCallId}-${msgIdx}`,
            role: 'tool',
            toolName,
            params:
              p.state !== 'input-streaming' && p.input ? (p.input as Record<string, unknown>) : {},
            status:
              p.state === 'output-available'
                ? 'done'
                : p.state === 'output-error'
                  ? 'error'
                  : 'loading',
            resultText:
              p.state === 'output-available' ? formatToolResult(toolName, p.output) : undefined,
            errorText: p.state === 'output-error' ? p.errorText : undefined,
          }
          result.push(toolMsg)
        }
      }

      if (textAccum.trim()) {
        result.push({
          id: `${msg.id}-${msgIdx}-tail`,
          role: 'agent',
          content: textAccum.trim(),
        })
      }
    }
  }

  return result
}

function formatToolResult(toolName: string, result: unknown): string {
  if (!result) return '완료'
  const r = result as Record<string, unknown>
  switch (toolName) {
    case 'search_competitors':
      if ('metrics' in r && r.metrics && typeof r.metrics === 'object') {
        const metrics = r.metrics as Record<string, unknown>
        const count = metrics.competitor_count ?? metrics.competitorCount ?? r.count
        const density = metrics.competition_percentile ?? r.percentile
        return `완료 — 동일 업종 ${count}곳${density != null ? ` · 경쟁 밀집도 ${density}P` : ''}`
      }
      return `완료 — 동일 업종 ${r.count}곳`
    case 'get_population_flow':
      if (r.avg_peak_population != null) {
        const peakHour = typeof r.peak_population_hour === 'string' ? ` · ${r.peak_population_hour}` : ''
        return `완료 — 유동인구 ${r.avg_peak_population}명${peakHour}`
      }
      return `완료 — 유동인구 ${r.percentile}P`
    case 'calc_competition_percentile':
      return `완료 — 경쟁 밀집도 ${r.competition_percentile ?? r.percentile}P`
    default:
      return '완료'
  }
}
