import { AgentStatus } from '@/types/agent'
import { AGENT_STATUS_COLORS } from '@/styles/colors'

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle:      '대기 중',
  analyzing: '분석 중',
  done:      '분석 완료',
  chatting:  '대화 중',
}

interface AgentHeaderProps {
  status: AgentStatus
}

export function AgentHeader({ status }: AgentHeaderProps) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b px-3 py-2.5">
      <span className="text-sm font-medium">AI 에이전트</span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="size-[5px] flex-shrink-0 rounded-full"
          style={{ background: AGENT_STATUS_COLORS[status] }}
        />
        {STATUS_LABELS[status]}
      </span>
    </div>
  )
}
