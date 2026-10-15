import { NextResponse } from "next/server";
import { verifyPlayoutSignature, parsePlayoutStarted } from "@/lib/bvs-playout-proof";
import { signalRpc } from "@/lib/bvs-signal-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const secret = process.env.BVS_PLAYOUT_SIGNING_SECRET || "";
  const station = process.env.BVS_PLAYOUT_STATION_ID || "";
  if (secret.length < 32 || !station) return json({ error: "Verified playout is not connected." }, 503);
  // Bound the streamed body too: Content-Length can be missing or dishonest.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Event required." }, 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return json({ error: "Event too large." }, 413); }
      chunks.push(value);
    }
  } catch { return json({ error: "Invalid event." }, 400); }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!verifyPlayoutSignature(raw, request.headers.get("x-bvs-timestamp") || "", request.headers.get("x-bvs-signature") || "", secret))
    return json({ error: "Untrusted playout event." }, 401);
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return json({ error: "Invalid event." }, 400); }
  const event = parsePlayoutStarted(body, station);
  if (!event) return json({ error: "Invalid playout acknowledgement." }, 400);
  const result = await signalRpc<{ accepted: boolean }>("bvs_record_broadcast", {
    p_station_id: event.stationId, p_event_id: event.eventId,
    p_track_id: event.trackId, p_started_at: event.startedAt,
  });
  if (!result.ok) return json({ error: result.conflict ? "Event ID was already used for different playback." : "Proof could not be saved. Retry the same event ID." }, result.conflict ? 409 : 503);
  if (!result.data) return json({ error: "Track unavailable." }, 404);
  return json({ accepted: true }, 200);
}
