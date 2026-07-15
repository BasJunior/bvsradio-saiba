import type { AnalyticsEvent, AnalyticsProperties } from "@/lib/analytics"

export async function recordServerEvent(event: AnalyticsEvent, properties: AnalyticsProperties = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || url.includes("your-project")) return false
  try {
    const response = await fetch(`${url}/rest/v1/analytics_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ event_name: event, properties, source: "server" }),
    })
    return response.ok
  } catch {
    return false
  }
}
