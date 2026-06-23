import { Button } from '@/components/ui/button'
import { AgentMessage, UserMessage } from '@/types/message'
import { AgentMarkdown } from './AgentMarkdown'

interface MessageBubbleProps {
  message: UserMessage | AgentMessage
  isStreaming?: boolean
  onConfirmAction?: (action: string) => void
}

export function MessageBubble({ message, isStreaming, onConfirmAction }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <span className="mb-1 text-right text-[10px] text-muted-foreground">나</span>
        <div className="ml-auto max-w-[88%] self-end rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <span className="mb-1 text-[10px] text-muted-foreground">에이전트</span>
      <div className="max-w-[93%] self-start rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
        <AgentMarkdown content={message.content} />
        {isStreaming && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-foreground align-middle" />
        )}
      </div>
      {message.confirmButtons && message.confirmButtons.length > 0 && (
        <div className="mt-2 flex gap-2">
          {message.confirmButtons.map((btn) => (
            <Button
              key={btn.action}
              variant={btn.variant === 'primary' ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
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
