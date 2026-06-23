const FORBIDDEN_PATTERN = /성공|매출|확률|점수|보장|예측|수익|폐업 확률/g

export function hasForbiddenWord(text: string): boolean {
  FORBIDDEN_PATTERN.lastIndex = 0 // 전역 플래그 리셋 필수
  return FORBIDDEN_PATTERN.test(text)
}
