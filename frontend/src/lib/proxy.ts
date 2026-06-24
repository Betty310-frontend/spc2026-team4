const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:8000'

// AI SDK Data Stream Protocol v1이 인식하는 event type 목록
// https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
const AI_SDK_KNOWN_TYPES = new Set([
  'text-start', 'text-delta', 'text-end',
  'error',
  'tool-input-start', 'tool-input-delta', 'tool-input-available', 'tool-input-error',
  'tool-approval-request',
  'tool-output-available', 'tool-output-error', 'tool-output-denied',
  'reasoning-start', 'reasoning-delta', 'reasoning-end',
  'source-url', 'source-document', 'file',
  'start-step', 'finish-step',
  'start', 'finish', 'abort',
  'message-metadata',
])

function normalizeAiSdkEventPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload

  const event = payload as Record<string, unknown>

  if (event.type !== 'error') return payload

  if (typeof event.errorText === 'string') return payload

  const code = typeof event.code === 'string' ? event.code : 'AGENT_ERROR'
  const message =
    typeof event.message === 'string'
      ? event.message
      : 'Unknown upstream error'

  return {
    type: 'error',
    errorText: `[${code}] ${message}`,
  }
}

/**
 * FastAPI SSE 스트림에서 AI SDK가 모르는 이벤트 타입(예: "session")을 제거.
 * 미인식 타입이 그대로 클라이언트에 도달하면 AI_TypeValidationError 발생.
 *
 * SSE 이벤트는 \n\n 으로 구분되며, 각 이벤트의 data: 줄에서 JSON type을 확인한다.
 */
function filterAiSdkStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true })

        // 이벤트 경계: \n\n
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const event of parts) {
          if (!event.trim()) continue

          const dataLine = event.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) {
            // data 줄 없는 이벤트(comment 등) — 그대로 통과
            controller.enqueue(encoder.encode(event + '\n\n'))
            continue
          }

          const jsonStr = dataLine.slice(6).trim()
          try {
            const parsed = normalizeAiSdkEventPayload(JSON.parse(jsonStr)) as {
              type?: string
            }
            const t = parsed.type

            if (
              !t || // type 필드 없음 — 통과
              AI_SDK_KNOWN_TYPES.has(t) || // 인식된 타입 — 통과
              t.startsWith('data-') // custom data-* 타입 — 통과
            ) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`),
              )
            }
            // "session", "thread" 등 미인식 타입 — 무시
          } catch {
            // JSON 파싱 실패 — 그대로 통과
            controller.enqueue(encoder.encode(event + '\n\n'))
          }
        }
      },
      flush(controller) {
        if (buffer.trim()) {
          controller.enqueue(encoder.encode(buffer))
        }
      },
    }),
  )
}

/**
 * GET 요청 프록시
 * Next.js Route Handler의 searchParams를 그대로 FastAPI로 전달
 */
export async function proxyGet(req: Request, path: string): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const url = `${API_BASE_URL}${path}?${searchParams}`

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await upstream.json()
    return Response.json(data, { status: upstream.status })
  } catch (err) {
    console.error(`[proxy:GET] ${path} 오류:`, err)
    return Response.json(
      { error: 'FastAPI 서버에 연결할 수 없습니다.' },
      { status: 503 },
    )
  }
}

/**
 * POST 요청 프록시 (SSE 스트리밍)
 * chat 엔드포인트용 — body를 전달하고 AI SDK 미인식 SSE 이벤트를 필터링해 통과
 */
export async function proxyPostStream(req: Request, path: string): Promise<Response> {
  const body = await req.json()
  const url = `${API_BASE_URL}${path}`

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!upstream.ok) {
      return Response.json({ error: 'FastAPI 서버 오류' }, { status: upstream.status })
    }

    if (!upstream.body) {
      return Response.json({ error: '빈 응답' }, { status: 502 })
    }

    return new Response(filterAiSdkStream(upstream.body), {
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream',
        'X-Vercel-AI-Data-Stream': 'v1',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error(`[proxy:POST] ${path} 오류:`, err)
    return Response.json(
      { error: 'FastAPI 서버에 연결할 수 없습니다.' },
      { status: 503 },
    )
  }
}
