import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ToolCallMessage } from '@/types/message'

const TOOL_LOADING_TEXT: Record<string, string> = {
  search_competitors: '소상공인진흥공단 API 조회 중…',
  get_population_flow: '서울 열린데이터 광장 API 조회 중…',
  calc_competition_percentile: 'H3 정규화 퍼센타일 계산 중…',
  get_rent_info: '국토부 임대료 데이터 조회 중…',
  get_positioning_data: '카카오플레이스 평점·가격대 조회 중…',
}

function formatParams(params: Record<string, unknown>): string {
  return Object.entries(params)
    .map(([k, v]) => (typeof v === 'string' ? `${k}="${v}"` : `${k}=${v}`))
    .join(', ')
}

interface ToolCallCardProps {
  message: ToolCallMessage
  onRetry?: () => void
}

export function ToolCallCard({ message, onRetry }: ToolCallCardProps) {
  const { toolName, params, status, resultText, errorText } = message
  const callStr = `${toolName}(${formatParams(params)})`

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs text-foreground">
            {status === 'loading' && <span>⚙ </span>}
            {status === 'done' && <span className="text-green-600">✓ </span>}
            {status === 'error' && <span className="text-destructive">✕ </span>}
            {callStr}
          </p>
          {status === 'loading' && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {TOOL_LOADING_TEXT[toolName] ?? 'API 조회 중…'}
            </p>
          )}
          {status === 'done' && resultText && (
            <p className="mt-0.5 text-xs text-muted-foreground">{resultText}</p>
          )}
          {status === 'error' && (
            <p className="mt-0.5 text-xs text-destructive">
              {errorText ?? '데이터를 불러오지 못했어요. 다시 시도해주세요.'}
            </p>
          )}
        </div>
        {status === 'loading' && (
          <Loader2 className="mt-0.5 h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground" />
        )}
        {status === 'error' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto flex-shrink-0 px-2 py-0.5 text-xs"
            onClick={onRetry}
          >
            다시 시도
          </Button>
        )}
      </div>
    </div>
  )
}
