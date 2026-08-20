import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { getPaynow, humanizePaynowError, paynowAuthEmail, paynowEnabled } from "@/lib/paynow";
import { siteUrl } from "@/lib/stripe";
import {
  normalizeServiceBillingInterval,
  parseServicePremiumPlanId,
  servicePremiumLabel,
  servicePremiumPriceUsd,
  servicePremiumReference,
  servicePremiumSku,
} from "@/lib/service-premium-plans";
import { saveOrderLocal, saveOrderToSupabase, type StoredOrder } from "@/lib/orders";

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
  if (!paynowEnabled())
    return NextResponse.json(
      { error: "Paynow is not configured yet." },
      { status: 503 },
    );

  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id)
    return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: string;
    interval?: string;
    email?: string;
  };
  const planId = parseServicePremiumPlanId(body.planId);
  if (!planId)
    return NextResponse.json(
      { error: "Choose Service Pro or Studio." },
      { status: 400 },
    );
  const interval = normalizeServiceBillingInterval(body.interval);
  const amount = servicePremiumPriceUsd(planId, interval);
  const sku = servicePremiumSku(planId, interval);
  const reference = servicePremiumReference();
  const label = servicePremiumLabel(planId);
  const email = (body.email || user.email || "creator@users.bvsradio.com").trim();

  const paynow = getPaynow();
  if (!paynow)
    return NextResponse.json({ error: "Paynow unavailable." }, { status: 503 });
  paynow.resultUrl = `${siteUrl()}/api/webhooks/paynow`;
  paynow.returnUrl = `${siteUrl()}/premium?family=service&checkout=return&ref=${encodeURIComponent(reference)}`;

  const payment = paynow.createPayment(reference, paynowAuthEmail(email));
  payment.add(`${label} (${interval})`, amount);

  let redirectUrl: string | undefined;
  let pollUrl: string | undefined;
  try {
    const response = await paynow.send(payment);
    const providerUrl =
      response?.redirectUrl ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.browserurl ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.browserUrl;
    if (!response?.success || !providerUrl)
      return NextResponse.json(
        { error: humanizePaynowError(response?.error) },
        { status: 502 },
      );
    redirectUrl = String(providerUrl);
    pollUrl = response.pollUrl;
  } catch (error) {
    console.error("paynow service premium exception", error);
    return NextResponse.json(
      { error: "Payment provider error. Try again shortly." },
      { status: 502 },
    );
  }

  const order: StoredOrder = {
    reference,
    customerUserId: user.id,
    createdAt: new Date().toISOString(),
    customer: {
      name: email.split("@")[0] || "Creator",
      email,
    },
    items: [
      {
        id: sku,
        title: label,
        type: "service_premium",
        price: amount,
        quantity: 1,
      },
    ],
    paymentMethod: "paynow",
    projectNotes: `service_premium:${planId}:${interval}`,
    subtotal: amount,
    taxAmount: 0,
    taxRate: 0,
    taxMode: "none",
    total: amount,
    currency: "usd",
    status: "pending_payment",
    deliveryStatus: "awaiting_payment",
    paynowPollUrl: pollUrl,
    source: "service_premium",
  };

  try {
    await saveOrderLocal(order);
    await saveOrderToSupabase(order);
  } catch (error) {
    console.error("service premium order save", error);
  }

  return NextResponse.json({
    ok: true,
    reference,
    planId,
    interval,
    amountUsd: amount,
    redirectUrl,
    pollUrl,
    message:
      "Complete payment on Paynow. Service membership activates automatically after paid confirmation.",
  });
}
