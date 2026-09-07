import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS = new Set([
  "app_open",
  "app_resume",
  "app_background",
  "deep_link_open",
  "push_open",
  "network_change",
  "offline_download_start",
  "offline_download_success",
  "offline_download_failure",
  "offline_download_remove",
  "offline_download_renew",
  "offline_playback_start",
  "offline_playback_failure",
]);
const SURFACES = new Set(["ios", "android"]);
const META_KEYS = new Set(["connected", "connectionType", "route", "reason", "state"]);

function cleanMeta(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string | boolean | number> = {};
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!META_KEYS.has(key)) continue;
    if (typeof raw === "boolean") out[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
    else if (typeof raw === "string") out[key] = raw.slice(0, 160);
  }
  return out;
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4096) return NextResponse.json({ error: "Telemetry payload too large." }, { status: 413 });

  const body = await request.json().catch(() => null) as { event?: unknown; surface?: unknown; meta?: unknown } | null;
  const event = typeof body?.event === "string" ? body.event : "";
  const surface = typeof body?.surface === "string" ? body.surface : "";
  if (!EVENTS.has(event) || !SURFACES.has(surface)) {
    return NextResponse.json({ error: "Invalid app telemetry event." }, { status: 400 });
  }

  console.info("bvs_app_event", {
    event,
    surface,
    meta: cleanMeta(body?.meta),
    at: new Date().toISOString(),
  });

  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
