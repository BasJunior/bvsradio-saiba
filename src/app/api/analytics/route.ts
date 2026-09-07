import { NextResponse } from "next/server"
import { analyticsEvents, type AnalyticsProperties } from "@/lib/analytics"

const allowed = new Set<string>(analyticsEvents)
const allowedSurfaces = new Set(["web", "ios", "android"])

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

function safeId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9-]{8,64}$/.test(value) ? value : null
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      event?: string
      properties?: unknown
      sessionId?: string
      visitorId?: string
      surface?: string
      path?: string
    }
    if (!body.event || !allowed.has(body.event)) return NextResponse.json({ error: "Unknown event" }, { status: 400 })
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return new NextResponse(null, { status: 204 })
    const surface = allowedSurfaces.has(String(body.surface || "")) ? String(body.surface) : "web"
    const properties = cleanProperties(body.properties)
    const visitor = safeId(body.visitorId)
    if (visitor) properties.visitor_id = visitor

    const response = await fetch(`${url}/rest/v1/analytics_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        event_name: body.event,
        session_id: safeId(body.sessionId),
        path: typeof body.path === "string" ? body.path.slice(0, 160) : null,
        properties,
        source: surface,
      }),
    })
    return new NextResponse(null, { status: response.ok ? 204 : 503 })
  } catch {
    return NextResponse.json({ error: "Invalid analytics payload" }, { status: 400 })
  }
}
