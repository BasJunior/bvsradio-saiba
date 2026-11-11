import { NextResponse } from "next/server";
import { songLabAccess, songLabUser } from "@/lib/song-lab-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const formats = new Map([
  ["audio/webm", "webm"], ["audio/mp4", "mp4"], ["audio/mpeg", "mp3"],
  ["audio/wav", "wav"], ["audio/x-wav", "wav"], ["audio/ogg", "ogg"],
]);

export async function POST(request: Request) {
  const user = await songLabUser(request);
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!await songLabAccess(user.id)) {
    return NextResponse.json({ error: "AI Song Lab requires Artist Premium access." }, { status: 403 });
  }
  const apiKey = process.env.BVS_SONG_LAB_OPENAI_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: "Transcription is not configured. Add BVS_SONG_LAB_OPENAI_KEY to your local environment.",
    }, { status: 503 });
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES + 65536) {
    return NextResponse.json({ error: "Recording is too large (12 MB maximum)." }, { status: 413 });
  }
  const submitted = await request.formData().catch(() => null);
  const audio = submitted?.get("audio");
  if (!(audio instanceof File) || !audio.size || audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "Choose a recorded take under 12 MB." }, { status: 400 });
  }
  const mime = audio.type.split(";")[0].toLowerCase();
  const extension = formats.get(mime);
  if (!extension) {
    return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });
  }
  const outbound = new FormData();
  outbound.append("model", "gpt-transcribe");
  outbound.append("file", new File([audio], "song-lab-take." + extension, { type: mime }));
  outbound.append("prompt", "Transcribe exactly what is said or rapped, preserving the original language. Do not invent missing lyrics.");
  try {
    const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: outbound,
      signal: AbortSignal.timeout(65000),
      cache: "no-store",
    });
    const result = await upstream.json().catch(() => ({})) as { text?: string };
    if (!upstream.ok || typeof result.text !== "string") {
      return NextResponse.json({ error: "Could not transcribe this recording. Try again." }, { status: 502 });
    }
    return NextResponse.json({ text: result.text.slice(0, 10000) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Transcription timed out or was unavailable." }, { status: 504 });
  }
}
