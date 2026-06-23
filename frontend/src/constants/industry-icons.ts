export const INDUSTRY_ICON: Record<string, string> = {
  // 카페·음료
  커피전문점: '☕',
  카페: '☕',
  음료: '🧃',
  제과점: '🥐',
  제과제빵: '🥐',

  // 음식
  한식: '🍚',
  일식: '🍱',
  중식: '🍜',
  양식: '🍝',
  분식: '🍜',
  치킨: '🍗',
  피자: '🍕',
  패스트푸드: '🍔',
  음식점: '🍽️',

  // 미용·뷰티
  미용실: '✂️',
  헤어: '✂️',
  네일: '💅',
  피부관리: '🧴',

  // 교육
  학원: '📚',
  교육: '📚',

  // 편의·생활
  편의점: '🏪',
  슈퍼마켓: '🛒',
  약국: '💊',
  병원: '🏥',
  세탁: '👔',

  // 기타
  default: '🏪',
}

export function getIndustryIcon(indsMclsNm?: string, indsSclsNm?: string): string {
  return (
    INDUSTRY_ICON[indsSclsNm ?? ''] ??
    INDUSTRY_ICON[indsMclsNm ?? ''] ??
    INDUSTRY_ICON.default
  )
}
