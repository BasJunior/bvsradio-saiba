import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { getServicePremiumStatus } from "@/lib/service-premium-billing";
import { paynowEnabled } from "@/lib/paynow";
import { stripeEnabled } from "@/lib/stripe";
import { PREMIUM_CATALOG } from "@/lib/premium-catalog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(req: Request) {
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

  const status = await getServicePremiumStatus(user.id);
  const plans = PREMIUM_CATALOG.filter(
    (plan) => plan.id === "service_pro" || plan.id === "studio",
  );
  return NextResponse.json({
    ...status,
    plans,
    stripeEnabled: stripeEnabled(),
    paynowEnabled: paynowEnabled(),
  });
}
