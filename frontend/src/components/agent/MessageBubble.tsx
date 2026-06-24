import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AgentMessage, UserMessage } from '@/types/message'
import { AgentMarkdown } from './AgentMarkdown'

interface MessageBubbleProps {
  message: UserMessage | AgentMessage
  isStreaming?: boolean
  isError?: boolean
  buttonsDisabled?: boolean
  onConfirmAction?: (action: string) => void
}

export function MessageBubble({
  message,
  isStreaming,
  isError = false,
  buttonsDisabled,
  onConfirmAction,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <span className="text-muted-foreground mb-1 text-right text-[10px]">나</span>
        <div className="bg-primary text-primary-foreground ml-auto max-w-[88%] self-end rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  const showButtons =
    message.confirmButtons && message.confirmButtons.length > 0 && !message.confirmedAction

  return (
    <div className="flex flex-col items-start">
      <span className="text-muted-foreground mb-1 text-[10px]">에이전트</span>
      <div
        className={cn(
          'max-w-[93%] self-start rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed',
          // 에러: bg-muted 유지 + 옅은 destructive 테두리
          isError ? 'bg-muted border border-destructive/30' : 'bg-muted',
        )}
      >
        {/* 에러 아이콘 — 강조는 아이콘으로만 */}
        {isError && (
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="text-sm">⚠️</span>
            <span className="text-muted-foreground text-xs font-medium">문제가 발생했어요</span>
          </div>
        )}
        <AgentMarkdown content={message.content} />
        {isStreaming && (
          <span className="bg-foreground/70 ml-0.5 inline-block h-3.5 w-0.5 animate-pulse align-middle rounded-full" />
        )}
      </div>

      {showButtons && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.confirmButtons!.map((btn) => (
            <Button
              key={btn.action}
              variant={btn.variant === 'primary' ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              disabled={buttonsDisabled}
              onClick={() => onConfirmAction?.(btn.action)}
            >
              {btn.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
