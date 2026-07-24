import { NextResponse } from "next/server";
import { getStationTracks } from "@/lib/station-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live editorial rotation for the site player (no static layout bake-in). */
export async function GET() {
  try {
    const tracks = await getStationTracks();
    return NextResponse.json(
      {
        tracks,
        count: tracks.length,
        source: tracks.some((t) => t.id) ? "editorial" : "fallback",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("station tracks", error);
    return NextResponse.json({ tracks: [], count: 0, source: "error" }, { status: 500 });
  }
}
