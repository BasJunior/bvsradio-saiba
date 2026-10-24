import { payoutConversationRoute } from '@/lib/payout-conversations'
export const maxDuration = 30
export const GET = (request: Request) => payoutConversationRoute(request, true)
export const POST = (request: Request) => payoutConversationRoute(request, true)
export const PATCH = (request: Request) => payoutConversationRoute(request, true)
