import { ReactNode } from 'react'

export type AgentStatus = 'idle' | 'analyzing' | 'done' | 'chatting'

const STATUS_CONFIG: Record<AgentStatus, { label: string; dotColor: string }> = {
  idle: { label: '대기 중', dotColor: '#639922' },
  analyzing: { label: '분석 중', dotColor: '#BA7517' },
  done: { label: '분석 완료', dotColor: '#639922' },
  chatting: { label: '대화 중', dotColor: '#639922' },
}

interface RightPanelProps {
  status: AgentStatus
  messages: ReactNode
  input: ReactNode
}

export default function RightPanel({ status, messages, input }: RightPanelProps) {
  const { label, dotColor } = STATUS_CONFIG[status]

  return (
    <div className="flex h-full flex-col px-[10px] pt-[10px]">
      {/* 에이전트 헤더 */}
      <div className="mb-2 flex flex-shrink-0 items-center justify-between border-b border-black/[0.11] pb-[6px]">
        <span className="text-[10px] font-medium text-gray-900">AI 에이전트</span>
        <span className="flex items-center gap-[3px] text-[9px] text-[#999]">
          <span
            className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
            style={{ background: dotColor }}
          />
          {label}
        </span>
      </div>

      {/* 메시지 스레드 — 스크롤 */}
      <div className="flex flex-1 flex-col gap-[5px] overflow-y-auto pb-2">{messages}</div>

      {/* 채팅 입력창 — 하단 고정 */}
      <div className="flex-shrink-0 pt-[5px] pb-[5px]">{input}</div>
    </div>
  )
}
