/**
 * [아키텍처 노트]
 *
 * 현재: @ai-sdk/openai 직접 연결 (tool execute는 목업)
 * 목표: FastAPI 프록시로 전환
 *
 * FastAPI 전환 조건:
 *   1. FastAPI /chat 엔드포인트 SSE 스트리밍 구현 완료
 *   2. Vercel AI SDK UI Message Stream Protocol 형식으로 응답
 *   3. .env에 API_BASE_URL 설정 (API_BASE_URL=http://your-ec2-host:8000)
 *
 * 전환 작업 범위: 이 파일(route.ts)만 수정. FE 컴포넌트 수정 불필요.
 */

import { streamText, convertToModelMessages, UIMessage, tool, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const model = openai(process.env.OPENAI_MODEL_NAME ?? 'gpt-4o-mini')

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const result = await streamText({
    model,
    system: `너는 서울 소상공인 예비창업자를 위한 상권 리스크 해석 도구다.
제공된 공공 데이터 수치 외 추정·예측·확률·매출 언급은 절대 금지.
모르면 모른다고 답해라.
금지 표현: 성공, 매출, 확률, 점수, 보장

[출력 형식]
- 헤더(##, ###) 사용 금지
- 구분선(---) 사용 금지
- 강조는 **볼드**만 사용
- 목록이 필요한 경우 - 불릿 사용
- 간결하게 2~4문장 또는 불릿 3개 이내로 답변`,
    messages: await convertToModelMessages(messages),
    tools: {
      search_competitors: tool({
        description: '반경 내 동일 업종 경쟁업체 조회',
        inputSchema: z.object({
          업종: z.string(),
          위치: z.string(),
          반경: z.number(),
        }),
        // TODO: [FastAPI 교체] execute를 FastAPI 호출로 교체
        execute: async () => ({
          count: 18,
          source: '소상공인진흥공단',
          date: '2025.01',
          tier: 'high' as const,
          percentile: 82,
        }),
      }),
      get_population_flow: tool({
        description: '행정동 생활인구 데이터 조회',
        inputSchema: z.object({
          행정동: z.string(),
          시간대: z.string(),
        }),
        // TODO: [FastAPI 교체] execute를 FastAPI 호출로 교체
        execute: async () => ({
          percentile: 74,
          source: '열린데이터',
          timeRange: '평일 11-17시',
          tier: 'mid' as const,
        }),
      }),
      calc_competition_percentile: tool({
        description: 'H3 정규화 경쟁 밀집도 퍼센타일 계산',
        inputSchema: z.object({
          업종: z.string(),
          h3_grid: z.boolean(),
        }),
        // TODO: [FastAPI 교체] execute를 FastAPI 호출로 교체
        execute: async () => ({
          percentile: 82,
          tier: 'high' as const,
          date: '2025.01',
        }),
      }),
      get_rent_info: tool({
        description: '국토부 임대료 참고 데이터 조회',
        inputSchema: z.object({
          행정동: z.string(),
          업종: z.string(),
        }),
        // TODO: [FastAPI 교체] execute를 FastAPI 호출로 교체
        execute: async () => ({
          avgRent: 280,
          unit: '만원/월',
          source: '국토부',
          date: '2025.01',
        }),
      }),
    },
    stopWhen: stepCountIs(5),
  })

  return result.toUIMessageStreamResponse()
}
