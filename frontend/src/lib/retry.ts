// 상태 코드를 포함하는 커스텀 에러
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const DEFAULT_RETRYABLE_STATUSES = [503, 502, 408, 429]

interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  retryableStatuses?: number[]
}

/**
 * 지수 백오프 재시도 래퍼
 * 1차 실패 → 1초 대기 → 2차 실패 → 2초 대기 → 3차 실패 → throw
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 1000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (attempt === maxRetries) break

      // 재시도 불가 상태 코드 (400, 404 등) → 즉시 throw
      if (err instanceof ApiError && !retryableStatuses.includes(err.status)) {
        throw err
      }

      // 지수 백오프 대기
      await sleep(baseDelayMs * Math.pow(2, attempt))
    }
  }

  throw lastError
}
