import { NextResponse } from "next/server";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { presentProgramme } from "@/lib/station-programme";
import { PROGRAMME_ID, hostSessionAt } from "@/lib/station-host.mjs";
import { stationRpc } from "@/lib/station-host-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await stationRpc<Parameters<typeof presentProgramme>[0] & { roster?: Array<Record<string, unknown>> }>("bvs_station_public_now", { p_programme_id: PROGRAMME_ID });
  const data = result.ok ? result.data : null;
  const session = hostSessionAt(data?.serverNow || new Date(), data?.roster);
  const programme = presentProgramme(data ? {
    ...data,
    host: { sessionName: session.name, hostName: session.hostName, voiceId: session.voiceId },
  } : null);
  if (programme.item?.kind === "music") {
    programme.item.src = mediaUrlForStoredValue(programme.item.src) || "";
    if (!programme.item.src) {
      programme.onAir = false;
      programme.item = null;
    }
  }
  return NextResponse.json(programme, { headers: { "Cache-Control": "no-store" } });
}
