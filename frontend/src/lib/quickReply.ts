export type QuickReplyType =
  | 'operation'
  | 'breakeven'
  | 'differentiation'
  | 'radius'
  | 'report_offer'

function normalizePromptText(content: string) {
  return content.replace(/\s+/g, '').replace(/[?？,，.。!！:：]/g, '')
}

export function detectQuickReplyType(content: string): QuickReplyType | null {
  const normalized = normalizePromptText(content)
  const hasOperationIntent =
    normalized.includes('직접운영') ||
    normalized.includes('직접운영예정') ||
    normalized.includes('운영예정') ||
    normalized.includes('직원고용') ||
    normalized.includes('고용계획') ||
    (normalized.includes('운영') && normalized.includes('직접')) ||
    (normalized.includes('운영') && normalized.includes('직원'))

  if (hasOperationIntent) {
    return 'operation'
  }

  if (
    normalized.includes('손익분기점달성목표기간') ||
    normalized.includes('손익분기점') ||
    normalized.includes('손익분기') ||
    normalized.includes('목표기간') ||
    normalized.includes('몇개월') ||
    normalized.includes('언제') ||
    normalized.includes('얼마나걸리')
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
