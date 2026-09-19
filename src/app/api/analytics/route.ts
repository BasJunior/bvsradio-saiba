import { NextResponse } from "next/server"
import { analyticsEvents, type AnalyticsProperties } from "@/lib/analytics"

const allowed = new Set<string>(analyticsEvents)
const meaningfulActivity = new Set([
  "player_start",
  "track_save",
  "beat_save",
  "creator_follow",
  "studio_open",
  "create_submission_complete",
  "release_submitted",
  "first_post",
  "checkout_complete",
  "payment_confirmed",
  "return_session",
  "activation_completed",
])

const milestoneColumns: Record<string, string> = {
  return_session: "first_return_at",
  player_start: "first_listen_at",
  first_listen: "first_listen_at",
  track_save: "first_save_at",
  beat_save: "first_save_at",
  first_save: "first_save_at",
  creator_follow: "first_follow_at",
  first_follow: "first_follow_at",
  first_post: "first_post_at",
  upload_complete: "first_submission_at",
  create_submission_complete: "first_submission_at",
  release_submitted: "first_submission_at",
  checkout_complete: "first_purchase_at",
  payment_confirmed: "first_purchase_at",
  activation_completed: "activated_at",
}

function cleanProperties(value: unknown): AnalyticsProperties {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).slice(0, 12).flatMap(([key, item]) => {
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) return []
    if (typeof item === "string") return [[key, item.slice(0, 120)]]
    if (typeof item === "number" && Number.isFinite(item)) return [[key, item]]
    if (typeof item === "boolean" || item === null) return [[key, item]]
    return []
  }))
}

async function authenticatedUserId(request: Request, expectedUserId: unknown, url: string, anon: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const expected = typeof expectedUserId === "string" ? expectedUserId.trim() : ""
  if (!token || !expected || !anon) return null
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null)
  if (!response?.ok) return null
  const user = await response.json().catch(() => ({})) as { id?: string }
  return user.id === expected ? expected : null
}

async function updateGrowthMember(url: string, key: string, userId: string, event: string) {
  const now = new Date().toISOString()
  const headers = {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: "return=minimal",
  }

  if (meaningfulActivity.has(event)) {
    await fetch(`${url}/rest/v1/growth_members?user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ last_active_at: now, updated_at: now }),
    }).catch(() => null)
  }

  const column = milestoneColumns[event]
  if (!column) return
  await fetch(
    `${url}/rest/v1/growth_members?user_id=eq.${encodeURIComponent(userId)}&${column}=is.null`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ [column]: now, last_active_at: now, updated_at: now }),
    },
  ).catch(() => null)
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      event?: string
      properties?: unknown
      sessionId?: string
      visitorId?: string
      path?: string
      userId?: string | null
    }
    if (!body.event || !allowed.has(body.event)) return NextResponse.json({ error: "Unknown event" }, { status: 400 })
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    if (!url || !key) return new NextResponse(null, { status: 204 })

    const properties = cleanProperties(body.properties)
    if (typeof body.visitorId === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(body.visitorId)) {
      properties.visitor_id = body.visitorId
    }
    const userId = await authenticatedUserId(request, body.userId, url, anon)

    const response = await fetch(`${url}/rest/v1/analytics_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        event_name: body.event,
        session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null,
        path: typeof body.path === "string" ? body.path.slice(0, 160) : null,
        properties,
        user_id: userId,
        source: "web",
      }),
    })

    if (response.ok && userId) {
      await updateGrowthMember(url, key, userId, body.event)
    }
    return new NextResponse(null, { status: response.ok ? 204 : 503 })
  } catch {
    return NextResponse.json({ error: "Invalid analytics payload" }, { status: 400 })
  }
}
