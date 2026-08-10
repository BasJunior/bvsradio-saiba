import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { cancelServicePremium } from "@/lib/service-premium-billing";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE)
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });

  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id)
    return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "immediate" ? "immediate" : "period_end";
  const result = await cancelServicePremium(user.id, mode);
  if (!result.ok)
    return NextResponse.json(
      { error: result.reason || "Could not cancel membership." },
      { status: 500 },
    );
  return NextResponse.json({
    ok: true,
    ...result,
    message:
      mode === "immediate"
        ? "Service membership ended immediately."
        : "Service membership will end at the paid-through date.",
  });
}
