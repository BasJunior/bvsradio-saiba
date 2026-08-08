import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { getStripe, siteUrl } from "@/lib/stripe";
import {
  artistPremiumPriceUsd,
  normalizeArtistPlanId,
  normalizeInterval,
  resolveCheckoutPlan,
  getArtistPremiumStatus,
} from "@/lib/premium-billing";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const stripe = getStripe();
  if (!stripe || !SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Stripe subscription billing is unavailable." }, { status: 503 });
  }
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id || !user.email) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { planId?: string; interval?: string };
  const interval = normalizeInterval(body.interval);
  const resolved = await resolveCheckoutPlan(normalizeArtistPlanId(body.planId));
  const planId = resolved.planId;
  const amount = artistPremiumPriceUsd(planId, interval);
  const label = planId === "artist_founding" ? "BVS Founding Artist Premium" : "BVS Standard Artist Premium";
  const current = await getArtistPremiumStatus(user.id);
  const paidThrough = current.premiumUntil ? Math.floor(new Date(current.premiumUntil).getTime() / 1000) : 0;
  const trialEnd = current.premiumActive && paidThrough > Math.floor(Date.now() / 1000) + 48 * 3600
    ? paidThrough
    : undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${siteUrl()}/artist/premium?checkout=stripe-success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/artist/premium?checkout=stripe-cancelled`,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(amount * 100),
        recurring: { interval: interval === "year" ? "year" : "month" },
        product_data: { name: label },
      },
    }],
    metadata: { kind: "artist_premium", user_id: user.id, plan_id: planId, interval },
    subscription_data: {
      metadata: { kind: "artist_premium", user_id: user.id, plan_id: planId, interval },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    redirectUrl: session.url,
    note: resolved.reason || null,
    trialEndsAt: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
  });
}
