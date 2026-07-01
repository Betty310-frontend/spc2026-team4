'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, ExternalLink, Info } from 'lucide-react'
import { useAnalysisContext } from '@/store/analysisContext'
import { useAnalysisResult } from '@/store/analysisResult'
import { fetchReport } from '@/lib/api-client'
import { isValidCategory } from '@/lib/category'
import { formatKoreanAxisNumber, formatNumber, formatPopulation } from '@/lib/number-format'
import { generateReportPdf } from '@/lib/report-pdf'
import type { ReportResponse } from '@/types/report'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { REPORT_CHART_COLORS } from '@/styles/chart-colors'

const FORBIDDEN_PATTERN =
  /성공\s*보장|매출\s*예측|폐업\s*확률|성공\s*가능성|수익\s*보장|반드시\s*성공|확실히\s*성공|높은\s*성공률/g

function maskForbiddenText(text: string, forbiddenViolated: boolean): string {
  if (!forbiddenViolated) return text
  FORBIDDEN_PATTERN.lastIndex = 0
  return text.replace(FORBIDDEN_PATTERN, '마스킹된 문구')
}

function parseSlotRange(label: string): { start: number; end: number } | null {
  const rangeMatch = label.match(/(\d{1,2})~(\d{1,2})/)
  if (rangeMatch) {
    const start = Number(rangeMatch[1])
    const end = Number(rangeMatch[2])
    if (Number.isFinite(start) && Number.isFinite(end)) return { start, end }
  }

  const hourMatch = label.match(/(\d{1,2})/)
  if (!hourMatch) return null
  const hour = Number(hourMatch[1])
  if (!Number.isFinite(hour)) return null
  return { start: hour, end: hour + 1 }
}

function buildHourlySeries(report: ReportResponse) {
  const series = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    population: 0,
    sales: 0,
  }))

  for (const item of report.charts.population_hourly ?? []) {
    const hour = Number(item.label.replace(/[^\d]/g, ''))
    if (Number.isFinite(hour) && hour >= 0 && hour < 24) {
      series[hour].population = item.value
    }
  }

  for (const item of report.charts.sales_by_timeslot ?? []) {
    const range = parseSlotRange(item.label)
    if (!range) continue
    const mid = Math.max(0, Math.min(23, Math.round((range.start + range.end) / 2)))
    series[mid].sales = item.value
  }

  return series
}

function formatChartTooltipValue(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? formatNumber(numericValue) : String(value)
}

function formatPlannerTooltipValue(value: unknown, name?: string | number) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue)) return String(value)
  return name === 'population' ? formatPopulation(numericValue) : formatNumber(numericValue)
}

function getDominantGenderInsight(data: Array<{ label: string; value: number }>) {
  if (!data.length) return null

  const female = data.find((item) => item.label === '여성')?.value ?? 0
  const male = data.find((item) => item.label === '남성')?.value ?? 0
  const total = female + male
  if (!Number.isFinite(total) || total <= 0) return null

  const dominantGender = female >= male ? '여성' : '남성'
  const dominantValue = dominantGender === '여성' ? female : male
  return {
    dominantGender,
    dominantValue,
    ratioText: `${formatNumber((dominantValue / total) * 100, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`,
    insight: `${dominantGender} 고객 비중이 높습니다.`,
  }
}

function getCompetitionChipTone(percentile: number) {
  if (percentile >= 67) {
    return { label: '높은 경쟁', bg: 'bg-red-500', shadow: 'shadow-md' }
  }

  if (percentile >= 34) {
    return { label: '중간 경쟁', bg: 'bg-amber-400', shadow: 'shadow-md' }
  }

  return { label: '낮은 경쟁', bg: 'bg-emerald-500', shadow: 'shadow-md' }
}

function getReportChipTone(kind: 'safe' | 'warn' | 'danger' | 'info') {
  if (kind === 'safe')
    return { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900' }
  if (kind === 'warn')
    return { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900' }
  if (kind === 'danger')
    return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900' }
  return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900' }
}

function getSwotCardTone(label: '강점' | '약점' | '기회' | '위협') {
  switch (label) {
    case '강점':
      return {
        bg: REPORT_CHART_COLORS.swot.strength,
        text: '#047857',
        border: 'border-l-emerald-500',
      }
    case '약점':
      return {
        bg: REPORT_CHART_COLORS.swot.weakness,
        text: '#B91C1C',
        border: 'border-l-red-500',
      }
    case '기회':
      return {
        bg: REPORT_CHART_COLORS.swot.opportunity,
        text: '#1D4ED8',
        border: 'border-l-blue-500',
      }
    case '위협':
      return {
        bg: REPORT_CHART_COLORS.swot.threat,
        text: '#C2410C',
        border: 'border-l-orange-500',
      }
  }
}

function getInsightTone(text: string) {
  const competitionPattern = /경쟁|밀집|업종|업체|비슷|유사/
  const salesPattern = /매출|운영|시간대|런치|피크|주중|주말|전략|인력|배치/
  const customerPattern = /고객|연령|성별|20대|30대|40대|50대|60대/
  const populationPattern = /생활인구|유동인구|유입|방문|사람|혼잡/

  if (competitionPattern.test(text)) {
    return { icon: '⚔️', border: 'border-l-red-500', iconBg: 'bg-red-50', iconText: 'text-red-600' }
  }

  if (salesPattern.test(text)) {
    return {
      icon: '💰',
      border: 'border-l-blue-500',
      iconBg: 'bg-blue-50',
      iconText: 'text-blue-600',
    }
  }

  if (customerPattern.test(text)) {
    return {
      icon: '👥',
      border: 'border-l-violet-500',
      iconBg: 'bg-violet-50',
      iconText: 'text-violet-600',
    }
  }

  if (populationPattern.test(text)) {
    return {
      icon: '🚶',
      border: 'border-l-emerald-500',
      iconBg: 'bg-emerald-50',
      iconText: 'text-emerald-600',
    }
  }

  return {
    icon: '•',
    border: 'border-l-slate-400',
    iconBg: 'bg-slate-50',
    iconText: 'text-slate-500',
  }
}

function ReportSkeleton() {
  return (
    <div className="space-y-3">
      <Card className="border-border/70 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-white shadow-sm">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </CardContent>
        </Card>
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReportSectionBody({
  canFetch,
  queryKey,
  isActive,
}: {
  canFetch: boolean
  queryKey: string
  isActive: boolean
}) {
  const { analysisContext } = useAnalysisContext()
  const {
    reportRequestToken,
    reportRequestSnapshot,
    setReportData,
  } = useAnalysisResult()
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const lastFetchedTokenRef = useRef<number>(0)
  const latestQueryKeyRef = useRef(queryKey)
  const latestReportRequestRef = useRef({
    위치: analysisContext.location ?? '',
    업종: analysisContext.industry ?? '',
    반경: analysisContext.radius ?? undefined,
    lat: analysisContext.confirmedPosition?.lat ?? undefined,
    lng: analysisContext.confirmedPosition?.lng ?? undefined,
  })
 
  const reportContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    latestQueryKeyRef.current = queryKey
  }, [queryKey])

  useEffect(() => {
    latestReportRequestRef.current = {
      위치: analysisContext.location ?? '',
      업종: analysisContext.industry ?? '',
      반경: analysisContext.radius ?? undefined,
      lat: analysisContext.confirmedPosition?.lat ?? undefined,
      lng: analysisContext.confirmedPosition?.lng ?? undefined,
    }
  }, [
    analysisContext.confirmedPosition?.lat,
    analysisContext.confirmedPosition?.lng,
    analysisContext.industry,
    analysisContext.location,
    analysisContext.radius,
  ])

  useEffect(() => {
    let cancelled = false

    if (!canFetch || reportRequestToken <= 0 || reportRequestToken === lastFetchedTokenRef.current) {
      return
    }

    lastFetchedTokenRef.current = reportRequestToken
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      void fetchReport(reportRequestSnapshot ?? latestReportRequestRef.current)
        .then((data) => {
          if (cancelled) return
          setReport(data)
          setReportData(data)
          setChecked({})
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setError(err instanceof Error ? err.message : '리포트를 불러오지 못했습니다.')
          setReport(null)
          setReportData(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    canFetch,
    reportRequestSnapshot,
    reportRequestToken,
    setReportData,
  ])

  const availableQuestions = report?.checklist_questions ?? []
  const checkedCount = Object.values(checked).filter(Boolean).length
  const progressValue =
    availableQuestions.length > 0 ? Math.round((checkedCount / availableQuestions.length) * 100) : 0

  const handleExportPdf = async () => {
    if (!report || isExportingPdf || !reportContentRef.current) return

    setIsExportingPdf(true)
    try {
      await generateReportPdf({
        element: reportContentRef.current,
        meta: report.meta,
      })
  } finally {
    setIsExportingPdf(false)
  }
}

  const reportData = report as ReportResponse

  const weekdayWeekend = report?.sales.weekday_weekend_ratio
  const peakSlot = report?.sales.peak_slot
  const dominantAge = report?.sales.top_age

  const hourlySeries = report ? buildHourlySeries(report) : []
  const ageData = report?.charts.sales_by_age ?? []
  const genderPieData = report?.charts.gender_sales_ratio ?? []
  const weekdayWeekendData = report?.charts.weekday_weekend_sales ?? []
  const dominantGenderInsight = getDominantGenderInsight(genderPieData)
  const peakRange = peakSlot ? parseSlotRange(peakSlot) : null
  const competitionTone = reportData
    ? getCompetitionChipTone(reportData.competition.competition_percentile)
    : null
  const competitionSummaryTone = reportData
    ? reportData.competition.competition_percentile >= 67
      ? 'danger'
      : reportData.competition.competition_percentile >= 34
        ? 'warn'
        : 'safe'
    : 'info'
  const weekdayWeekendTone = (() => {
    if (!weekdayWeekend) return 'info' as const
    const ratio = Number((weekdayWeekend.match(/([0-9.]+):1/)?.[1] ?? '').trim())
    if (!Number.isFinite(ratio)) return 'warn' as const
    if (ratio >= 3) return 'danger' as const
    if (ratio >= 1.5) return 'warn' as const
    return 'safe' as const
  })()
  const swotItems = reportData
    ? [
        { label: '강점' as const, icon: '🟢', items: reportData.swot.강점 },
        { label: '약점' as const, icon: '🔴', items: reportData.swot.약점 },
        { label: '기회' as const, icon: '🟢', items: reportData.swot.기회 },
        { label: '위협' as const, icon: '🟠', items: reportData.swot.위협 },
      ]
    : []

  if (!canFetch && !report) {
    return (
      <section className="mt-2">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="text-muted-foreground px-4 py-6 text-sm">
            분석을 시작하면 리포트가 여기에 표시됩니다.
          </CardContent>
        </Card>
      </section>
    )
  }

  if (!isActive) {
    return (
      <section className="mt-2">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="text-muted-foreground px-4 py-6 text-sm">
            리포트 탭을 열면 차트와 요약이 표시됩니다.
          </CardContent>
        </Card>
      </section>
    )
  }

  if (!report && canFetch && reportRequestToken === 0) {
    return (
      <section className="mt-2">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-2 px-4 py-6 text-sm">
            <p className="font-medium text-foreground">리포트를 아직 생성하지 않았어요. 생성할까요?</p>
            <p className="text-muted-foreground text-sm">
              왼쪽 에이전트에서 탐색을 마친 뒤 리포트 생성을 눌러주세요.
            </p>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (loading || (!report && canFetch)) {
    return (
      <section className="mt-2">
        <div className="mb-2 flex items-center justify-between px-1">
          <div>
            <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
              상세 리포트
            </p>
            <p className="text-muted-foreground text-[11px]">초보 창업자용 핵심 해석</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled className="h-8">
            <Download className="mr-1 h-3.5 w-3.5" />
            PDF 저장 중...
          </Button>
        </div>
        {error ? (
          <Card className="mb-3 border-[#FECACA] bg-[#FEF2F2] shadow-sm">
            <CardContent className="px-4 py-3 text-xs text-[#B91C1C]">{error}</CardContent>
          </Card>
        ) : null}
        <ReportSkeleton />
      </section>
    )
  }

  const forbidden = reportData.forbidden_violated
  const mask = (text: string) => maskForbiddenText(text, forbidden)

  return (
    <section className="mt-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <p className="text-muted-foreground text-[10px] font-semibold tracking-[0.06em] uppercase">
            상세 리포트
          </p>
          <p className="text-muted-foreground text-[11px]">초보 창업자용 핵심 해석</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={handleExportPdf}
          disabled={isExportingPdf}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          {isExportingPdf ? 'PDF 저장 중...' : 'PDF 저장'}
        </Button>
      </div>

      <div ref={reportContentRef} className="w-full space-y-6">
        {forbidden && (
          <Card className="border-[#FECACA] bg-[#FEF2F2] shadow-sm">
            <CardContent className="flex items-center gap-2 px-4 py-3 text-xs text-[#B91C1C]">
              <Info className="h-4 w-4 flex-shrink-0" />
              민감 표현이 포함된 문구는 마스킹해서 표시했습니다.
            </CardContent>
          </Card>
        )}

        <div className="w-full">
        <Card className="w-full border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 pr-2">
                <p className="text-muted-foreground text-xs font-semibold">핵심 요약</p>
                <h3 className="text-foreground text-sm font-semibold">
                  {mask(reportData.risk_summary)}
                </h3>
              </div>
              {competitionTone && (
                <Badge
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-base font-semibold text-white ${competitionTone.bg} ${competitionTone.shadow}`}
                >
                  {competitionTone.label}
                </Badge>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
                <SummaryChip
                label="경쟁 수준"
                value={reportData.competition.percentile_label}
                tone={competitionSummaryTone}
              />
              <SummaryChip
                label="런치 피크"
                value={peakSlot ? `런치 피크 ${peakSlot}시` : '데이터 없음'}
                tone={peakSlot ? 'warn' : 'info'}
              />
              <SummaryChip
                label="주중/주말"
                value={
                  weekdayWeekend
                    ? `주중 ${weekdayWeekend.match(/([0-9.]+):1/)?.[1] ?? weekdayWeekend}배`
                    : '데이터 없음'
                }
                tone={weekdayWeekendTone}
              />
              <SummaryChip
                label="핵심 고객"
                value={
                  dominantAge
                    ? `${dominantAge}${dominantGenderInsight ? ` · ${dominantGenderInsight.dominantGender} ${dominantGenderInsight.ratioText}` : ''}`
                    : '데이터 없음'
                }
                tone="info"
              />
            </div>
          </CardContent>
        </Card>
        </div>

        <section className="w-full space-y-2">
          <div>
            <p className="text-gray-700 text-xs font-semibold">인사이트</p>
            <p className="text-sm font-semibold text-gray-700">차트 전에 먼저 읽는 핵심 해석</p>
          </div>
          <ul className="grid gap-1.5">
            {reportData.insights.map((item, index) => (
              (() => {
                const tone = getInsightTone(item)
                return (
                  <li
                    key={`insight-${index}`}
                    className={`flex items-start gap-2 border-l-4 border-black/[0.06] py-1.5 pl-3 pr-2 text-sm leading-snug ${tone.border}`}
                  >
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${tone.iconBg} text-xs ${tone.iconText}`}
                      aria-hidden="true"
                    >
                      {tone.icon}
                    </span>
                    <span>{mask(item)}</span>
                  </li>
                )
              })()
            ))}
          </ul>
        </section>

        <div className="w-full">
        <Card className="w-full border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">시간대 운영 플래너</p>
                <p className="text-foreground text-sm">생활인구와 시간대별 매출 흐름</p>
              </div>
              <Badge
                className="bg-[#EFF6FF] text-[#1D4ED8]"
              >
                10:30~14:30 집중 운영 권장
              </Badge>
            </div>
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={hourlySeries}
                  margin={{ top: 12, right: 18, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={REPORT_CHART_COLORS.grid} />
                  {peakRange && (
                    <ReferenceArea
                      x1={peakRange.start}
                      x2={peakRange.end}
                      fill={REPORT_CHART_COLORS.peakFill}
                      fillOpacity={0.8}
                    />
                  )}
                  <XAxis
                    dataKey="hour"
                    type="number"
                    domain={[0, 23]}
                    tickFormatter={(value) => `${value}시`}
                    ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
                    fontSize={11}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    fontSize={11}
                    tickFormatter={(value) => formatPopulation(Number(value))}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={11}
                    tickFormatter={(value) => formatChartTooltipValue(value)}
                  />
                  <RechartsTooltip formatter={formatPlannerTooltipValue} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="population"
                    stroke={REPORT_CHART_COLORS.tertiary}
                    strokeWidth={2.4}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="sales"
                    fill={REPORT_CHART_COLORS.primary}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="w-full">
          <Card className="border-border/70 bg-white shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">고객 분석</p>
                <p className="text-foreground text-sm">연령대별 매출 분포</p>
              </div>
              <div className="h-60 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 12, right: 8, left: 80, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={REPORT_CHART_COLORS.grid} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(value) => formatKoreanAxisNumber(Number(value))} />
                    <RechartsTooltip formatter={formatChartTooltipValue} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {ageData.map((entry) => (
                        <Cell
                          key={`age-${entry.label}`}
                          fill={entry.label === dominantAge ? REPORT_CHART_COLORS.primary : REPORT_CHART_COLORS.neutral}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted-foreground text-xs">
                {dominantAge
                  ? mask(
                      `${dominantAge} 매출 비중이 가장 높습니다. 런치/테이크아웃 마케팅에 집중하세요.`,
                    )
                  : '연령대별 매출 데이터가 없습니다.'}
              </p>
            </CardContent>
          </Card>
          </div>

          <div className="w-full">
          <Card className="border-border/70 bg-white shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">고객 분석</p>
                <p className="text-foreground text-sm">성별 매출 비율</p>
              </div>
              <div className="relative h-60 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderPieData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={60}
                      outerRadius={84}
                      paddingAngle={4}
                      isAnimationActive={false}
                    >
                      {genderPieData.map((entry) => (
                        <Cell
                          key={`gender-${entry.label}`}
                          fill={entry.label === '여성' ? REPORT_CHART_COLORS.female : REPORT_CHART_COLORS.male}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={formatChartTooltipValue} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-muted-foreground text-xs">중앙 비중</p>
                    <p className="text-foreground text-sm font-semibold">
                      {dominantGenderInsight
                        ? `${dominantGenderInsight.dominantGender} ${dominantGenderInsight.ratioText}`
                        : '데이터 없음'}
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                {dominantGenderInsight
                  ? mask(dominantGenderInsight.insight)
                  : '성별 매출 데이터가 없습니다.'}
              </p>
            </CardContent>
          </Card>
          </div>
        </div>

        <div className="w-full">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold">주중 / 주말 비교</p>
              <p className="text-foreground text-sm">운영 리듬 확인</p>
            </div>
            <div className="h-48 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayWeekendData} margin={{ top: 12, right: 8, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={REPORT_CHART_COLORS.grid} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(value) => formatKoreanAxisNumber(Number(value))} />
                  <RechartsTooltip formatter={formatChartTooltipValue} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                    {weekdayWeekendData.map((entry) => (
                      <Cell
                        key={`ww-${entry.label}`}
                        fill={
                          entry.label === '주중'
                            ? REPORT_CHART_COLORS.primary
                            : REPORT_CHART_COLORS.neutral
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-xl bg-[#EFF6FF] px-3 py-2 text-xs text-[#1D4ED8]">
              {weekdayWeekend
                ? mask('주말 인력 축소, 평일 런치 집중 배치 권장')
                : '주중/주말 데이터가 부족합니다.'}
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="w-full">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-muted-foreground text-xs font-semibold">SWOT</p>
              <p className="text-foreground text-sm">강점 · 약점 · 기회 · 위협</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {swotItems.map((item) => {
                const tone = getSwotCardTone(item.label)
                return (
                  <div
                    key={item.label}
                    className={`rounded-2xl border border-black/[0.08] border-l-4 p-3 ${tone.border}`}
                    style={{ background: tone.bg }}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold" style={{ color: tone.text }}>
                        {item.icon} {item.label}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm leading-relaxed" style={{ color: tone.text }}>
                      {item.items.map((entry, index) => (
                        <li key={`${item.label}-${index}`} className="pl-4">
                          {mask(entry)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="w-full space-y-6">
          <section className="w-full space-y-2">
            <div>
              <p className="text-muted-foreground text-xs font-semibold">전략 제안</p>
              <p className="text-foreground text-sm">실행 우선순위</p>
            </div>
            <div className="w-full rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3 text-left text-sm text-[#1E3A8A]">
              <ul className="space-y-2">
                {reportData.strategy.map((item, index) => (
                  <li key={`strategy-${index}`} className="pl-4 leading-relaxed">
                    {mask(item)}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="w-full space-y-2">
            <div className="flex w-full items-center justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-semibold">체크리스트</p>
                <p className="text-foreground text-sm">완료 항목 진행률</p>
              </div>
              <span className="text-muted-foreground text-xs">
                {checkedCount}/{availableQuestions.length}
              </span>
            </div>
            <Progress value={progressValue} />
            <div className="space-y-2">
              {availableQuestions.map((question, index) => (
                <label
                  key={`check-${index}`}
                  className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={checked[index] ?? false}
                    onCheckedChange={(value) =>
                      setChecked((prev) => ({ ...prev, [index]: Boolean(value) }))
                    }
                    className="mt-0.5"
                  />
                  <span className="leading-relaxed">{mask(question)}</span>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="w-full">
        <Card size="sm" className="w-full border-border/70 bg-white shadow-sm">
          <CardContent className="space-y-2.5 p-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground">데이터 출처</p>
              <p className="text-xs text-foreground">분석 기준 및 제공 기관</p>
            </div>
            <div className="space-y-1.5">
              {reportData.meta.data_sources.map((source) => (
                <a
                  key={`${source.provider}-${source.label}`}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:bg-muted/40 flex items-center justify-between rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-sm transition-colors"
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">{source.provider}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {source.label} · {source.reference}
                    </p>
                  </div>
                  <ExternalLink className="text-muted-foreground h-3.5 w-3.5" />
                </a>
              ))}
            </div>
            <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-[10px] text-muted-foreground">
              데이터 기준일: {reportData.meta.generated_at}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </section>
  )
}

export function ReportSection({ isActive = true }: { isActive?: boolean }) {
  const { analysisContext } = useAnalysisContext()
  const canFetch =
    isValidCategory(analysisContext.industry) &&
    Boolean(analysisContext.location) &&
    Boolean(analysisContext.confirmedPosition)

  const queryKey = useMemo(() => {
    if (!canFetch) return 'disabled'
    return [
      analysisContext.location ?? '',
      analysisContext.industry ?? '',
      analysisContext.radius ?? '',
      analysisContext.confirmedPosition?.lat ?? '',
      analysisContext.confirmedPosition?.lng ?? '',
    ].join('|')
  }, [
    analysisContext.confirmedPosition?.lat,
    analysisContext.confirmedPosition?.lng,
    analysisContext.industry,
    analysisContext.location,
    analysisContext.radius,
    canFetch,
  ])

  return <ReportSectionBody canFetch={canFetch} queryKey={queryKey} isActive={isActive} />
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'safe' | 'warn' | 'danger' | 'info'
}) {
  const color = getReportChipTone(tone)
  return (
    <div
      className={`rounded-xl border px-3 py-3 shadow-sm ${color.bg} ${color.border}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${color.text}`}>{value}</p>
    </div>
  )
}
