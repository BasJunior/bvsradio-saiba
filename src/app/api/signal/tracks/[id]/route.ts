import { NextResponse } from "next/server";
import { catchPublicTrack, getPublicTrackSignal } from "@/lib/bvs-signal-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearerToken(request: Request) {
  return (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getPublicTrackSignal(id, bearerToken(request));
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { source?: string };
  const result = await catchPublicTrack(request, id, String(body.source || "unknown"));
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization" } });
}
