import { NextResponse } from "next/server";
import { mediaUrlForStoredValue } from "@/lib/media-url";
import { presentProgramme } from "@/lib/station-programme";
import { PROGRAMME_ID } from "@/lib/station-host.mjs";
import { stationRpc } from "@/lib/station-host-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await stationRpc<Parameters<typeof presentProgramme>[0]>("bvs_station_public_now", { p_programme_id: PROGRAMME_ID });
  const programme = presentProgramme(result.ok ? result.data : null);
  if (programme.item?.kind === "music") {
    programme.item.src = mediaUrlForStoredValue(programme.item.src) || "";
    if (!programme.item.src) {
      programme.onAir = false;
      programme.item = null;
    }
  }
  return NextResponse.json(programme, { headers: { "Cache-Control": "no-store" } });
}
