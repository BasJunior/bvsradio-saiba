import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sources = new Set(["station", "ondemand"]);

async function optionalUserId() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

function serviceHeaders(prefer?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_BVS_QUALIFIED_STREAMS !== "1") {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = await request.json() as {
      playInstanceId?: unknown;
      trackId?: unknown;
      listenedSeconds?: unknown;
      source?: unknown;
    };

    const playInstanceId = String(body.playInstanceId || "");
    const trackId = String(body.trackId || "");
    const source = String(body.source || "");
    const listenedSeconds = Number(body.listenedSeconds);

    if (
      !uuidPattern.test(playInstanceId) ||
      !uuidPattern.test(trackId) ||
      !sources.has(source) ||
      !Number.isFinite(listenedSeconds) ||
      listenedSeconds < 30 ||
      listenedSeconds > 300
    ) {
      return NextResponse.json({ error: "Invalid stream event." }, { status: 400 });
    }

    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!url || !key) return new NextResponse(null, { status: 204 });

    // Only accept public, editorially approved catalogue tracks. Financial
    // eligibility remains a separate server-side settlement decision.
    const trackResponse = await fetch(
      `${url}/rest/v1/tracks?id=eq.${trackId}&is_public=eq.true&editorial_status=eq.approved&select=id&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    if (!trackResponse.ok) return new NextResponse(null, { status: 503 });
    const tracks = await trackResponse.json() as Array<{ id: string }>;
    if (!tracks.length) return new NextResponse(null, { status: 204 });

    const response = await fetch(
      `${url}/rest/v1/stream_qualifications?on_conflict=play_instance_id`,
      {
        method: "POST",
        headers: serviceHeaders("resolution=ignore-duplicates,return=minimal"),
        body: JSON.stringify({
          play_instance_id: playInstanceId,
          track_id: trackId,
          user_id: await optionalUserId(),
          source,
          listened_seconds: Math.floor(listenedSeconds),
          status: "pending",
        }),
      },
    );

    return new NextResponse(null, { status: response.ok ? 204 : 503 });
  } catch {
    return NextResponse.json({ error: "Invalid stream event." }, { status: 400 });
  }
}
