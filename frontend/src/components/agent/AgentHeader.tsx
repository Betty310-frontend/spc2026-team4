import { AgentStatus } from '@/types/agent'

const STATUS_CONFIG: Record<AgentStatus, { dotClass: string; label: string }> = {
  idle: { dotClass: 'bg-green-500', label: '대기 중' },
  analyzing: { dotClass: 'bg-amber-500 animate-pulse', label: '분석 중' },
  done: { dotClass: 'bg-green-500', label: '분석 완료' },
  chatting: { dotClass: 'bg-green-500', label: '대기 중' },
}

interface AgentHeaderProps {
  status: AgentStatus
}

export function AgentHeader({ status }: AgentHeaderProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b px-3 py-2.5">
      <span className="text-sm font-medium">AI 에이전트</span>
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${config.dotClass}`} />
        <span className="text-muted-foreground text-xs">{config.label}</span>
      </span>
    </div>
  )
}
