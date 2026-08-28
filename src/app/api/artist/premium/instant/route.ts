import { NextResponse } from "next/server";
import { authUserId } from "@/lib/storage-upload";
import { getPaynow, humanizePaynowError, paynowAuthEmail, paynowEnabled } from "@/lib/paynow";
import { getStripe, siteUrl, stripeEnabled } from "@/lib/stripe";
import { saveOrderLocal, saveOrderToSupabase, updateOrder, type StoredOrder } from "@/lib/orders";
import {
  PREMIUM_INSTANT_PRICE_USD,
  assertPremiumInstantRelease,
  listPremiumInstantReleases,
  premiumInstantReference,
} from "@/lib/premium-instant";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

async function signedInUser(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !SERVICE) return null;
  return authUserId(SUPABASE_URL, SERVICE, token);
}

export async function GET(req: Request) {
  const user = await signedInUser(req);
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({
    priceUsd: PREMIUM_INSTANT_PRICE_USD,
    label: "US$5.99 per release",
    note: "One-time release fee. No monthly subscription.",
    releases: await listPremiumInstantReleases(user.id),
    stripeEnabled: stripeEnabled(),
    paynowEnabled: paynowEnabled(),
  });
}

export async function POST(req: Request) {
  const user = await signedInUser(req);
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    releaseId?: string;
    provider?: "stripe" | "paynow";
  };
  const releaseId = String(body.releaseId || "").trim();
  const provider = body.provider === "paynow" ? "paynow" : "stripe";
  if (!releaseId) return NextResponse.json({ error: "Choose an approved release." }, { status: 400 });

  const eligible = await assertPremiumInstantRelease(user.id, releaseId);
  if (!eligible.ok) return NextResponse.json({ error: eligible.reason }, { status: 409 });

  const reference = premiumInstantReference();
  const title = `Premium Instant — ${eligible.release.title}`;
  const order: StoredOrder = {
    reference,
    customerUserId: user.id,
    createdAt: new Date().toISOString(),
    customer: {
      name: user.email?.split("@")[0] || "Artist",
      email: user.email || "artist@users.bvsradio.com",
    },
    items: [
      {
        id: `premium-instant:${releaseId}`,
        title,
        type: "artist_premium_instant",
        price: PREMIUM_INSTANT_PRICE_USD,
        quantity: 1,
      },
    ],
    paymentMethod: provider,
    projectNotes: `artist_premium_instant:${releaseId}`,
    subtotal: PREMIUM_INSTANT_PRICE_USD,
    taxAmount: 0,
    taxRate: 0,
    taxMode: "none",
    total: PREMIUM_INSTANT_PRICE_USD,
    currency: "usd",
    status: "pending_payment",
    deliveryStatus: "awaiting_payment",
    source: "artist_premium_instant",
  };

  try {
    await saveOrderLocal(order);
    const saved = await saveOrderToSupabase(order);
    if (!saved.saved) throw new Error("remote save failed");
  } catch (error) {
    console.error("premium instant order save", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable. No payment was started." }, { status: 503 });
  }

  if (provider === "stripe") {
    const stripe = getStripe();
    if (!stripe) return NextResponse.json({ error: "Card checkout is unavailable." }, { status: 503 });
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email || undefined,
        client_reference_id: reference,
        success_url: `${siteUrl()}/artist/premium/instant?checkout=stripe-success&ref=${encodeURIComponent(reference)}`,
        cancel_url: `${siteUrl()}/artist/premium/instant?checkout=stripe-cancelled`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(PREMIUM_INSTANT_PRICE_USD * 100),
              product_data: {
                name: `BVS Premium Instant — ${eligible.release.title}`,
                description: "One-time distribution fee for this approved BVS release. No monthly subscription.",
              },
            },
          },
        ],
        metadata: {
          kind: "artist_premium_instant",
          user_id: user.id,
          release_id: releaseId,
          reference,
        },
      });
      await updateOrder(reference, { stripeSessionId: session.id });
      return NextResponse.json({
        ok: true,
        provider,
        reference,
        releaseId,
        amountUsd: PREMIUM_INSTANT_PRICE_USD,
        redirectUrl: session.url,
      });
    } catch (error) {
      console.error("premium instant stripe init", error);
      return NextResponse.json({ error: "Card checkout could not start." }, { status: 502 });
    }
  }

  const paynow = getPaynow();
  if (!paynow) return NextResponse.json({ error: "Paynow checkout is unavailable." }, { status: 503 });
  paynow.resultUrl = `${siteUrl()}/api/webhooks/paynow`;
  paynow.returnUrl = `${siteUrl()}/artist/premium/instant?checkout=paynow-return&ref=${encodeURIComponent(reference)}`;
  const payment = paynow.createPayment(reference, paynowAuthEmail(user.email || ""));
  payment.add(`BVS Premium Instant — ${eligible.release.title}`, PREMIUM_INSTANT_PRICE_USD);
  try {
    const response = await paynow.send(payment);
    const redirectUrl =
      response?.redirectUrl ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.browserurl ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.browserUrl;
    if (!response?.success || !redirectUrl) {
      return NextResponse.json({ error: humanizePaynowError(response?.error) }, { status: 502 });
    }
    await updateOrder(reference, { paynowPollUrl: response.pollUrl });
    return NextResponse.json({
      ok: true,
      provider,
      reference,
      releaseId,
      amountUsd: PREMIUM_INSTANT_PRICE_USD,
      redirectUrl: String(redirectUrl),
      pollUrl: response.pollUrl,
    });
  } catch (error) {
    console.error("premium instant paynow init", error);
    return NextResponse.json({ error: "Payment provider error. Try again shortly." }, { status: 502 });
  }
}
