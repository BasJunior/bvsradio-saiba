import { NextResponse } from "next/server";
import { getStationTracks, type MobileSurface } from "@/lib/station-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live editorial rotation for the site player (no static layout bake-in). */
export async function GET(request: Request) {
  try {
    const requestedSurface = new URL(request.url).searchParams.get("surface");
    const surface: MobileSurface | undefined = requestedSurface === "ios" || requestedSurface === "android"
      ? requestedSurface
      : undefined;
    const tracks = await getStationTracks(surface);
    return NextResponse.json(
      {
        tracks,
        count: tracks.length,
        source: surface ? `mobile-${surface}` : tracks.some((t) => t.id) ? "editorial" : "fallback",
        surface: surface || "web",
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
