import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AgentMessage, UserMessage } from '@/types/message'
import { AgentMarkdown } from './AgentMarkdown'
import { IndustryQuickButtons } from './IndustryQuickButtons'
import { ExplorationQuickButtons } from './ExplorationQuickButtons'
import { QuickReplyButtons, type QuickReplyType } from './QuickReplyButtons'
import { ChevronRight } from 'lucide-react'

interface MessageBubbleProps {
  message: UserMessage | AgentMessage
  isStreaming?: boolean
  isError?: boolean
  buttonsDisabled?: boolean
  disabledQuickActionIds?: Set<string>
  onConfirmAction?: (action: string) => void
  onIndustryQuickSelect?: (text: string, messageId: string) => void
  onExplorationQuickSelect?: (
    messageId: string,
    type: NonNullable<AgentMessage['messageType']>,
    value: string | number,
  ) => void
  onQuickReplySelect?: (
    messageId: string,
    type: QuickReplyType,
    option: { label: string; text: string; action?: 'generate_report' | 'dismiss' },
  ) => void
  hiddenIndustryPromptId?: string | null
}

function isIndustryQuestion(content: string) {
  const normalized = content.replace(/\s+/g, '')
  return (
    normalized.includes('어떤업종을생각하고계신가요') ||
    normalized.includes('어떤업종을생각하고계신가요?') ||
    normalized.includes('업종을생각하고계신가요')
  )
}

function normalizePromptText(content: string) {
  return content.replace(/\s+/g, '').replace(/[?？,，.。!！:：]/g, '')
}

function detectQuickReplyType(content: string): QuickReplyType | null {
  const normalized = normalizePromptText(content)

  if (
    /직접운영(예정)?(인가요|할예정인가요|하실예정인가요)?/.test(normalized) ||
    /직접운영예정/.test(normalized) ||
    /직원(을)?(고용|채용)(계획|예정|도생각|도고려)/.test(normalized) ||
    /직원고용계획/.test(normalized) ||
    /직원고용도생각/.test(normalized) ||
    /고용계획(이|은)?있나요/.test(normalized) ||
    /운영방식(은|이)?/.test(normalized)
  ) {
    return 'operation'
  }

  if (
    /손익분기점달성목표기간/.test(normalized) ||
    /손익분기점/.test(normalized) ||
    /손익분기/.test(normalized) ||
    /몇개월/.test(normalized) ||
    /목표기간/.test(normalized)
  ) {
    return 'breakeven'
  }

  if (/차별화/.test(normalized) || /차별점/.test(normalized)) {
    return 'differentiation'
  }

  if (
    /반경/.test(normalized) &&
    /(바꿔|조정|늘려|줄여|유지|넓혀|좁혀)/.test(normalized)
  ) {
    return 'radius'
  }

  if (
    /리포트/.test(normalized) &&
    /(생성|받아|만들|원하시)/.test(normalized)
  ) {
    return 'report_offer'
  }

  return null
}

export function MessageBubble({
  message,
  isStreaming,
  isError = false,
  buttonsDisabled,
  disabledQuickActionIds,
  onConfirmAction,
  onIndustryQuickSelect,
  onExplorationQuickSelect,
  onQuickReplySelect,
  hiddenIndustryPromptId,
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
  const showIndustryButtons =
    !isError &&
    !message.confirmedAction &&
    hiddenIndustryPromptId !== message.id &&
    isIndustryQuestion(message.content)
  const quickReplyType =
    !isError && !message.confirmedAction && !isStreaming
      ? message.messageType === 'report_offer'
        ? 'report_offer'
        : detectQuickReplyType(message.content)
      : null
  const showExplorationButtons =
    !isError &&
    !message.confirmedAction &&
    message.messageType != null &&
    message.messageType !== 'report_offer' &&
    onExplorationQuickSelect != null &&
    !isStreaming &&
    quickReplyType == null &&
    (disabledQuickActionIds?.has(message.id) !== true)
  const showQuickReplies =
    quickReplyType != null &&
    onQuickReplySelect != null &&
    (disabledQuickActionIds?.has(message.id) !== true)

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

      {showIndustryButtons && onIndustryQuickSelect && (
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[10px]">빠른 선택</span>
          <IndustryQuickButtons
            disabled={buttonsDisabled}
            onSelect={(text) => onIndustryQuickSelect(text, message.id)}
          />
        </div>
      )}

      {showExplorationButtons && (
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[10px]">빠른 답변</span>
          <ExplorationQuickButtons
            type={message.messageType!}
            disabled={buttonsDisabled}
            onSelect={(value) =>
              onExplorationQuickSelect(message.id, message.messageType!, value)
            }
          />
        </div>
      )}

      {showQuickReplies && quickReplyType && (
        <div className="mt-2 flex flex-col gap-1.5">
          <span className="text-muted-foreground text-[10px]">빠른 답변</span>
          <QuickReplyButtons
            type={quickReplyType}
            disabled={buttonsDisabled}
            onSelect={(option) => onQuickReplySelect(message.id, quickReplyType, option)}
          />
        </div>
      )}

      {showButtons && (
        <div className="mt-2 flex flex-wrap gap-2">
          {message.confirmButtons!.map((btn) => (
            btn.action === 'open_report' || btn.action === 'regenerate_report' || btn.action === 'generate_report' ? (
              <button
                key={btn.action}
                type="button"
                disabled={buttonsDisabled}
                onClick={() => onConfirmAction?.(btn.action)}
                className="flex w-fit items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>📊</span>
                <span>{btn.label}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : btn.action === 'dismiss_location_change' || btn.action === 'dismiss_report_offer' ? (
              <button
                key={btn.action}
                type="button"
                disabled={buttonsDisabled}
                onClick={() => onConfirmAction?.(btn.action)}
                className="flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{btn.label}</span>
              </button>
            ) : (
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
            )
          ))}
        </div>
      )}
    </div>
  )
}
