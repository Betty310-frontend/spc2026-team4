import { ApiError } from '@/lib/retry'
import type { ConfirmButton } from '@/types/message'

export interface ErrorMessage {
  content: string
  confirmButtons?: ConfirmButton[]
}

export type ErrorContext = 'competitors' | 'population' | 'density' | 'general'

export function getApiErrorMessage(
  err: unknown,
  context: ErrorContext = 'general',
): ErrorMessage {
  // 네트워크 연결 자체 실패 (fetch가 throw한 경우)
  if (!(err instanceof ApiError)) {
    return {
      content:
        '서버에 연결할 수 없어요. 네트워크 상태를 확인하고 다시 시도해주세요.',
      confirmButtons: [
        { label: '다시 시도', variant: 'outline', action: 'retry_analysis' },
      ],
    }
  }

  switch (err.status) {
    case 400:
      return {
        content:
          context === 'competitors'
            ? '위치나 업종 정보를 인식하지 못했어요. 좀 더 구체적으로 알려주시겠어요?\n예) "연남동에서 카페 창업을 생각 중이에요"'
            : '요청 정보에 문제가 있어요. 다시 입력해주시겠어요?',
        confirmButtons: [
          { label: '다시 입력할게요', variant: 'outline', action: 'retry_input' },
        ],
      }

    case 404:
      return {
        content:
          '해당 지역의 데이터를 찾지 못했어요. 다른 위치로 시도해주시겠어요?',
        confirmButtons: [
          { label: '다른 위치 입력', variant: 'outline', action: 'retry_input' },
        ],
      }

    case 408:
    case 504:
      return {
        content: '분석에 시간이 너무 걸리고 있어요. 잠시 후 다시 시도해볼게요.',
        confirmButtons: [
          { label: '다시 시도', variant: 'outline', action: 'retry_analysis' },
        ],
      }

    case 429:
      return {
        content: '요청이 너무 많아요. 잠시 후 다시 시도해주세요.',
        confirmButtons: [
          { label: '다시 시도', variant: 'outline', action: 'retry_analysis' },
        ],
      }

    case 502:
    case 503:
      return {
        content: '서버에 일시적인 문제가 발생했어요. 잠시 후 다시 시도해주세요. 🙏',
        confirmButtons: [
          { label: '다시 시도', variant: 'outline', action: 'retry_analysis' },
          { label: '취소', variant: 'outline', action: 'cancel' },
        ],
      }

    default:
      return {
        content: '분석 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
        confirmButtons: [
          { label: '다시 시도', variant: 'outline', action: 'retry_analysis' },
        ],
      }
  }
}
