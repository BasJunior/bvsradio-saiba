import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { getStripe, siteUrl } from "@/lib/stripe";
import {
  hasActiveStripeProducerSubscription,
  normalizeProducerInterval,
  normalizeProducerPlanId,
  producerBillingGuard,
  producerPremiumPriceUsd,
} from "@/lib/producer-billing";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  const guard = producerBillingGuard();
  if (!guard.ok) {
    return NextResponse.json(
      { error: "Producer Stripe-test checkout is not enabled on this beta environment." },
      { status: 503 },
    );
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "Stripe test billing is unavailable." }, { status: 503 });
  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id || !user.email) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const profileResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,is_producer&limit=1`,
    {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      cache: "no-store",
    },
  );
  const profiles = profileResponse.ok ? await profileResponse.json() as Array<{ role?: string; is_producer?: boolean }> : [];
  const profile = profiles[0];
  const producerCapable = Boolean(profile?.is_producer) || ["producer", "admin", "editor"].includes(String(profile?.role || ""));
  if (!producerCapable) {
    return NextResponse.json({ error: "Producer access is required before choosing a Producer plan." }, { status: 403 });
  }

  const activeProducerSubscription = await hasActiveStripeProducerSubscription(user.id);
  if (activeProducerSubscription === null) {
    return NextResponse.json(
      { error: "Producer subscription status could not be verified. Please try again." },
      { status: 503 },
    );
  }
  if (activeProducerSubscription) {
    return NextResponse.json(
      { error: "A paid Producer subscription is already active. Plan switching is not available in beta yet." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { planId?: string; interval?: string };
  const planId = normalizeProducerPlanId(body.planId);
  const interval = normalizeProducerInterval(body.interval);
  const amount = producerPremiumPriceUsd(planId, interval);
  const label = planId === "producer_pro" ? "BVS Producer Pro (Beta)" : "BVS Producer Plus (Beta)";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${siteUrl()}/producer/premium?checkout=stripe-success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/producer/premium?checkout=stripe-cancelled`,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(amount * 100),
        recurring: { interval: interval === "year" ? "year" : "month" },
        product_data: { name: label },
      },
    }],
    metadata: { kind: "producer_premium", user_id: user.id, plan_id: planId, interval },
    subscription_data: {
      metadata: { kind: "producer_premium", user_id: user.id, plan_id: planId, interval },
    },
  });

  return NextResponse.json({ ok: true, redirectUrl: session.url });
}
