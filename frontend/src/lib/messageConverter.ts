import { UIMessage } from 'ai'
import { ChatMessage, ToolCallMessage } from '@/types/message'

export function convertToChatMessages(sdkMessages: UIMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []

  for (const msg of sdkMessages) {
    if (msg.role === 'user') {
      const textPart = msg.parts.find((p) => p.type === 'text')
      const text = textPart && 'text' in textPart ? (textPart as { text: string }).text : ''
      result.push({ id: msg.id, role: 'user', content: text })
      continue
    }

    if (msg.role === 'assistant') {
      let textAccum = ''

      for (const part of msg.parts) {
        if (part.type === 'text' && 'text' in part) {
          textAccum += (part as { text: string }).text
        }

        if (part.type === 'dynamic-tool') {
          if (textAccum.trim()) {
            result.push({
              id: `${msg.id}-text-${result.length}`,
              role: 'agent',
              content: textAccum.trim(),
            })
            textAccum = ''
          }

          // DynamicToolUIPart states: input-streaming | input-available | output-available | output-error | ...
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
            id: p.toolCallId,
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
        }
      }

      if (textAccum.trim()) {
        result.push({
          id: `${msg.id}-tail`,
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
      return `완료 — 동일 업종 ${r.count}곳 (${r.source} · ${r.date})`
    case 'get_population_flow':
      return `완료 — 유동인구 ${r.percentile}P (${r.timeRange})`
    case 'calc_competition_percentile':
      return `완료 — 경쟁 밀집도 ${r.percentile}P`
    default:
      return '완료'
  }
}
