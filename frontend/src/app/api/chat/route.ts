/**
 * [아키텍처 노트]
 *
 * FastAPI /api/v1/chat 엔드포인트로 프록시.
 * FastAPI가 Vercel AI SDK Data Stream Protocol 형식으로 SSE 응답.
 * useChat의 api 옵션은 '/api/chat' 유지 — FE 수정 불필요.
 */

import { proxyPostStream } from '@/lib/proxy'

export async function POST(req: Request) {
  return proxyPostStream(req, '/api/v1/chat')
}
