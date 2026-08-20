import { NextResponse } from "next/server";
import { expireLapsedPrepaidPremium } from "@/lib/premium-billing";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.BVS_CRON_SECRET || process.env.CRON_SECRET || "";
  if (!secret) return process.env.BVS_ENV_LANE === "staging";
  const header = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const query = new URL(req.url).searchParams.get("secret") || "";
  return header === secret || query === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const result = await expireLapsedPrepaidPremium();
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  return GET(req);
}
