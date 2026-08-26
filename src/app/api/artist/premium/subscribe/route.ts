import { NextResponse } from "next/server";
import { authUserId, serviceHeaders } from "@/lib/storage-upload";
import { getPaynow, humanizePaynowError, paynowAuthEmail, paynowEnabled } from "@/lib/paynow";
import { siteUrl } from "@/lib/stripe";
import {
  artistPremiumPriceUsd,
  artistPremiumSku,
  normalizeArtistPlanId,
  normalizeInterval,
  premiumReference,
  resolveCheckoutPlan,
  type BillingInterval,
} from "@/lib/premium-billing";
import { saveOrderLocal, saveOrderToSupabase, updateOrder, type StoredOrder } from "@/lib/orders";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Start Paynow checkout for Artist Premium (prepaid month/year).
 * Body: { planId?: 'instant'|'founding'|'standard'|'artist_instant'|..., interval?: 'month'|'year', email?: string }
 */
export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }
  if (!paynowEnabled()) {
    return NextResponse.json(
      { error: "Paynow is not configured yet. Premium billing will open when Paynow credentials are live." },
      { status: 503 },
    );
  }

  const user = await authUserId(SUPABASE_URL, SERVICE, token);
  if (!user?.id) return NextResponse.json({ error: "Session expired." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    planId?: string;
    interval?: string;
    email?: string;
  };

  const requested = normalizeArtistPlanId(body.planId);
  const interval: BillingInterval = normalizeInterval(body.interval);
  const resolved = await resolveCheckoutPlan(requested);
  const planId = resolved.planId;
  const amount = artistPremiumPriceUsd(planId, interval);
  const sku = artistPremiumSku(planId, interval);
  const reference = premiumReference();

  // Profile email
  let email = (body.email || user.email || "").trim();
  if (!email) {
    const pr = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=display_name,username`,
      { headers: serviceHeaders(SERVICE), cache: "no-store" },
    );
    const rows = pr.ok ? await pr.json() : [];
    email = `${rows[0]?.username || "artist"}@users.bvsradio.com`;
  }

  const paynow = getPaynow();
  if (!paynow) {
    return NextResponse.json({ error: "Paynow unavailable." }, { status: 503 });
  }

  const title =
    planId === "artist_instant"
      ? `BVS Premium Instant (${interval})`
      : planId === "artist_founding"
        ? `BVS Founding Artist Premium (${interval})`
        : `BVS Premium (${interval})`;

  const order: StoredOrder = {
    reference,
    customerUserId: user.id,
    createdAt: new Date().toISOString(),
    customer: {
      name: email.split("@")[0] || "Artist",
      email,
    },
    items: [
      {
        id: sku,
        title,
        type: "artist_premium",
        price: amount,
        quantity: 1,
      },
    ],
    paymentMethod: "paynow",
    projectNotes: `artist_premium:${planId}:${interval}`,
    subtotal: amount,
    taxAmount: 0,
    taxRate: 0,
    taxMode: "none",
    total: amount,
    currency: "usd",
    status: "pending_payment",
    deliveryStatus: "awaiting_payment",
    source: "artist_premium",
  };

  // Fail closed (ZVSJQ): save the durable order BEFORE creating a Paynow payment.
  // saveOrderToSupabase returns {saved} and does not throw on HTTP failure.
  try {
    await saveOrderLocal(order);
  } catch (e) {
    console.warn("premium order local save skipped", e);
  }

  let supabaseSave: { saved: boolean; reason?: string } = { saved: false };
  try {
    supabaseSave = await saveOrderToSupabase(order);
  } catch (e) {
    console.error("premium order supabase save exception", e);
    return NextResponse.json(
      {
        error:
          "Could not start Premium checkout because the order could not be saved. No payment was taken. Please try again in a moment.",
        code: "premium_order_save_failed",
        reference,
      },
      { status: 500 },
    );
  }
  if (!supabaseSave.saved) {
    console.error("premium order supabase save rejected", supabaseSave.reason, reference);
    return NextResponse.json(
      {
        error:
          "Could not start Premium checkout because the order could not be saved. No payment was taken. Please try again in a moment.",
        code: "premium_order_save_failed",
        reference,
        reason: supabaseSave.reason || "not_saved",
      },
      { status: 500 },
    );
  }

  paynow.resultUrl = `${siteUrl()}/api/webhooks/paynow`;
  paynow.returnUrl = `${siteUrl()}/artist/premium?checkout=return&ref=${encodeURIComponent(reference)}`;

  // Test-mode integrations reject non-merchant authemail — use paynowAuthEmail().
  const payment = paynow.createPayment(reference, paynowAuthEmail(email));
  payment.add(title, amount);

  let redirectUrl: string | undefined;
  let pollUrl: string | undefined;
  try {
    const response = await paynow.send(payment);
    const url =
      response?.redirectUrl ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.browserurl ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (response as any)?.browserUrl;
    if (!response?.success || !url) {
      console.error("paynow premium init failed", response?.error, reference);
      return NextResponse.json(
        { error: humanizePaynowError(response?.error) },
        { status: 502 },
      );
    }
    redirectUrl = String(url);
    pollUrl = response.pollUrl;
  } catch (e) {
    console.error("paynow premium exception", e);
    return NextResponse.json({ error: "Payment provider error. Try again shortly." }, { status: 502 });
  }

  // Best-effort: stamp poll URL on the durable order so webhook reconciliation is easier.
  if (pollUrl) {
    try {
      await updateOrder(reference, { paynowPollUrl: pollUrl });
    } catch (e) {
      console.warn("premium order pollUrl stamp skipped", e);
    }
  }

  return NextResponse.json({
    ok: true,
    reference,
    planId,
    interval,
    amountUsd: amount,
    founding: resolved.founding,
    note: resolved.reason || null,
    redirectUrl,
    pollUrl,
    returnUrl: paynow.returnUrl,
    message:
      "Complete payment on Paynow. Access activates automatically after paid confirmation (prepaid period — not auto-renew yet).",
  });
}
