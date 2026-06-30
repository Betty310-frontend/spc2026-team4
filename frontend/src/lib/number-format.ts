type FormatNumberOptions = {
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatNumber(value: number | null | undefined, options: FormatNumberOptions = {}) {
  if (value == null || !Number.isFinite(value)) return '—'

  if (
    options.minimumFractionDigits == null &&
    options.maximumFractionDigits == null
  ) {
    return value.toLocaleString('ko-KR')
  }

  return new Intl.NumberFormat('ko-KR', options).format(value)
}

export function formatKoreanAxisNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'

  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(0)}억`
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(0)}만`
  }

  return value.toLocaleString('ko-KR')
}

export function formatPopulation(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString('ko-KR')
}
