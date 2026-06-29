export const CATEGORY_PLACEHOLDER_VALUES = new Set(['어떤'])

export const CATEGORY_ALIASES: Record<string, string> = {
  카페: '카페',
  커피: '카페',
  커피숍: '카페',
  커피전문점: '카페',
  카페테리아: '카페',
  음료: '카페',
  제과점: '베이커리',
  제과제빵: '베이커리',
  베이커리: '베이커리',
  음식점: '한식',
  식당: '한식',
  밥집: '한식',
  한식집: '한식',
  한식: '한식',
  분식집: '분식',
  분식: '분식',
  김밥: '분식',
  만두: '분식',
  고깃집: '고깃집',
  고기집: '고깃집',
  돼지고기: '고깃집',
  요리주점: '요리주점',
  술집: '요리주점',
  주점: '요리주점',
  일식집: '일식',
  초밥: '일식',
  회: '일식',
  일식: '일식',
  치킨집: '치킨',
  후라이드치킨: '치킨',
  치킨: '치킨',
  미용실: '미용실',
  헤어: '미용실',
  헤어샵: '미용실',
  뷰티: '미용실',
  피부관리: '피부관리',
  피부: '피부관리',
  네일샵: '네일샵',
  네일: '네일샵',
  학원: '학원',
  교육: '학원',
  입시학원: '입시학원',
  교과학원: '입시학원',
  입시: '입시학원',
  요가: '요가필라테스',
  필라테스: '요가필라테스',
  요가필라테스: '요가필라테스',
  편의점: '편의점',
  슈퍼마켓: '편의점',
  약국: '약국',
  병원: '병원',
  세탁: '세탁',
}

export const isValidCategory = (value: string | null | undefined): value is string => {
  if (!value) return false
  if (CATEGORY_PLACEHOLDER_VALUES.has(value)) return false
  if (value.trim() === '') return false
  return true
}

export function normalizeCategory(value: string | null | undefined): string | null {
  if (!isValidCategory(value)) return null
  const trimmed = value.trim()
  return CATEGORY_ALIASES[trimmed] ?? trimmed
}
