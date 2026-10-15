import { NextResponse } from "next/server";
import { can, editorialIdentity } from "@/lib/editorial-server";
import { UUID } from "@/lib/creator-promotion-server";
import { durationAcceptable, stationAudioKey } from "@/lib/station-host.mjs";
import { readStationAudio, stationRpc, stationSegment, writeStationAudio } from "@/lib/station-host-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });

async function identityFor(request: Request) {
  const identity = await editorialIdentity(request);
  if (!identity) return null;
  return can(identity, "schedule_programmes") || can(identity, "manage_rotation") ? identity : null;
}

function extensionFor(file: File) {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "audio/mpeg" || name.endsWith(".mp3")) return "mp3";
  if (type === "audio/wav" || type === "audio/x-wav" || name.endsWith(".wav")) return "wav";
  if (type === "audio/mp4" || type === "audio/x-m4a" || name.endsWith(".m4a")) return "m4a";
  return "";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await identityFor(request)) return json({ error: "Programme access required." }, 403);
  const { id } = await context.params;
  if (!UUID.test(id)) return json({ error: "Unknown segment." }, 404);
  const segment = await stationSegment(id);
  if (!segment?.audio_key) return json({ error: "No preview audio yet." }, 404);
  const audio = await readStationAudio(segment.audio_key);
  if (!audio) return json({ error: "Preview audio is not on this server." }, 404);
  return new NextResponse(Buffer.from(audio.body), {
    headers: { "Content-Type": audio.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await identityFor(request)) return json({ error: "Programme access required." }, 403);
  const { id } = await context.params;
  if (!UUID.test(id)) return json({ error: "Unknown segment." }, 404);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const duration = Number(form?.get("durationSeconds"));
  if (!(file instanceof File) || file.size < 1 || file.size > 12 * 1024 * 1024) return json({ error: "Audio must be an MP3, WAV, or M4A up to 12 MB." }, 400);
  const extension = extensionFor(file);
  const segment = await stationSegment(id);
  if (!segment) return json({ error: "Unknown segment." }, 404);
  if (!extension || !durationAcceptable(segment.kind, duration)) return json({ error: "Use a supported audio file and a duration inside the allowed range." }, 400);
  if (segment.status === "approved" || segment.status === "disabled" || segment.status === "rejected") return json({ error: "Edit the script before replacing approved audio." }, 409);
  const audioKey = stationAudioKey(id, extension);
  if (!audioKey) return json({ error: "Invalid audio name." }, 400);
  try {
    await writeStationAudio(audioKey, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
  } catch {
    return json({ error: "Audio could not be stored." }, 503);
  }
  const attached = await stationRpc("bvs_station_attach_audio", {
    p_id: id, p_audio_key: audioKey, p_duration: duration, p_revision: Number(segment.revision) || 0,
  });
  if (!attached.ok) return json({ error: attached.conflict ? "Another editor changed this segment. Refresh and try again." : "Audio was stored but not attached." }, attached.conflict ? 409 : 503);
  return json({ ok: true });
}
