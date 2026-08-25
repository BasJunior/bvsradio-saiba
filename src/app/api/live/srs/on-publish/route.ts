import { handleSrsHook } from '@/lib/bvs-live-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleSrsHook(request, 'on_publish')
}
