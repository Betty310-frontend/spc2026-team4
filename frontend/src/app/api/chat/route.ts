import { createUIMessageStream, createUIMessageStreamResponse, UIMessage } from 'ai'

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const lastMessage = messages[messages.length - 1]
  const userText =
    lastMessage?.parts?.find((p) => p.type === 'text')?.text ?? ''

  // FastAPI 연동 전, 프론트 단독 테스트용 더미 응답
  const mockAnswer = `(이것은 테스트용 더미 응답입니다.) "${userText}"에 대한 답변입니다. 강남역 인근 카페 업종의 1년 생존율은 약 72%이며, 최근 3개월 매출 트렌드는 상승세입니다. 유동인구 기준 20~30대 비중이 높은 상권입니다.`

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: 'text-start', id: 'mock-1' })

      for (const word of mockAnswer.split(' ')) {
        writer.write({ type: 'text-delta', id: 'mock-1', delta: word + ' ' })
        await new Promise((r) => setTimeout(r, 80)) // 스트리밍 속도 시뮬레이션
      }

      writer.write({ type: 'text-end', id: 'mock-1' })
    },
  })

  return createUIMessageStreamResponse({ stream })
}