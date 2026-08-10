import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { getStripe, siteUrl } from "@/lib/stripe";
import {
  normalizeServiceBillingInterval,
  parseServicePremiumPlanId,
  servicePremiumLabel,
  servicePremiumPriceUsd,
} from "@/lib/service-premium-plans";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!token)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const stripe = getStripe();
  if (!stripe || !SUPABASE_URL || !SERVICE)
    return NextResponse.json(
      { error: "Stripe subscription billing is unavailable." },
      { status: 503 },
    );

  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id || !user.email)
    return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: string;
    interval?: string;
  };
  const planId = parseServicePremiumPlanId(body.planId);
  if (!planId)
    return NextResponse.json(
      { error: "Choose Service Pro or Studio." },
      { status: 400 },
    );
  const interval = normalizeServiceBillingInterval(body.interval);
  const amount = servicePremiumPriceUsd(planId, interval);
  const label = servicePremiumLabel(planId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${siteUrl()}/premium?family=service&checkout=stripe-success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/premium?family=service&checkout=stripe-cancelled`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amount * 100),
          recurring: { interval: interval === "year" ? "year" : "month" },
          product_data: { name: label },
        },
      },
    ],
    metadata: {
      kind: "service_premium",
      user_id: user.id,
      plan_id: planId,
      interval,
    },
    subscription_data: {
      metadata: {
        kind: "service_premium",
        user_id: user.id,
        plan_id: planId,
        interval,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    redirectUrl: session.url,
    planId,
    interval,
    amountUsd: amount,
  });
}
