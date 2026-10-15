import { NextResponse } from "next/server";
import { UUID } from "@/lib/creator-promotion-server";
import { readStationAudio, stationRpc } from "@/lib/station-host-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const result = await stationRpc<{ audioKey?: string } | null>("bvs_station_voice_public", { p_id: id });
  const audioKey = result.ok ? result.data?.audioKey : "";
  if (!audioKey) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  const audio = await readStationAudio(audioKey);
  if (!audio) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new NextResponse(Buffer.from(audio.body), {
    headers: {
      "Content-Type": audio.contentType,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
