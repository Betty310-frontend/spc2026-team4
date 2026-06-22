import { MessageRole } from '@/types/agent'

interface MessageBubbleProps {
  role: MessageRole
  content: string
}

export function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex flex-col items-end">
        <span className="mb-1 text-right text-[10px] text-muted-foreground">나</span>
        <div className="max-w-[88%] self-end whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <span className="mb-1 text-[10px] text-muted-foreground">에이전트</span>
      <div className="max-w-[93%] self-start whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
        {content}
      </div>
    </div>
  )
}
