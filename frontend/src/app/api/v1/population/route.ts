import { proxyGet } from '@/lib/proxy'

export async function GET(req: Request) {
  return proxyGet(req, '/api/v1/population')
}
