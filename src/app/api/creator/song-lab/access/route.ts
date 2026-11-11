import { NextResponse } from "next/server";
import { songLabAccess, songLabDevPreviewEnabled, songLabUser } from "@/lib/song-lab-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await songLabUser(request);
  if (!user?.id) return NextResponse.json({ allowed: false, error: "Sign in required." }, { status: 401 });
  const allowed = await songLabAccess(user.id);
  return NextResponse.json({
    allowed,
    devPreview: allowed && songLabDevPreviewEnabled(),
    upgradeHref: "/premium",
  }, { headers: { "Cache-Control": "private, no-store" } });
}
