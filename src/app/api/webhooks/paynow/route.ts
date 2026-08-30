import { NextResponse } from "next/server";
import { getPaynow } from "@/lib/paynow";
import {
  loadOrder,
  notifyCustomerOrderEmail,
  notifyOwnerNewOrder,
  saveOrderToSupabase,
  updateOrder,
  type StoredOrder,
} from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import {
  creditPaidArtistDeposit,
  creditPaidArtistSales,
} from "@/lib/artist-credit";
import { sameMoney, verifyPaynowHash } from "@/lib/paynow-security";
import { recordVerifiedPayment } from "@/lib/commerce-ledger";
import {
  activatePaidArtistPremium,
  artistPremiumPriceUsd,
  artistPremiumSku,
  normalizeArtistPlanId,
  normalizeInterval,
  parsePremiumOrderItem,
  type ArtistPremiumPlanId,
  type BillingInterval,
} from "@/lib/premium-billing";
import {
  grantPremiumInstant,
  parsePremiumInstantOrderItem,
} from "@/lib/premium-instant";
import { initializePaidCreatorServiceOrder } from "@/lib/creator-service-orders";

/**
 * Recover a missing Artist Premium order when Paynow confirms a BVS-PREM-* payment.
 * ZVSJQ (2026-08-18): paid EcoCash, no local/Supabase order → webhook 404, no activation.
 */
function recoverPremiumOrderFromPaynow(input: {
  reference: string;
  pollUrl: string;
  body: Record<string, string>;
  trustedAmount?: string | number;
}): StoredOrder | null {
  const reference = String(input.reference || "").trim();
  if (!/^BVS-PREM-/i.test(reference)) return null;

  const planRaw =
    input.body.planid ||
    input.body.planId ||
    input.body.PlanId ||
    input.body.additionalinfo ||
    "";
  const intervalRaw = input.body.interval || input.body.Interval || "month";
  const amountFromPoll = Number(input.trustedAmount);
  const amount =
    Number.isFinite(amountFromPoll) && amountFromPoll > 0 ? amountFromPoll : 0;

  // Prefer explicit plan hints; otherwise infer founding vs standard from paid amount.
  let planId: ArtistPremiumPlanId = normalizeArtistPlanId(String(planRaw || "artist_standard"));
  if (!planRaw) {
    if (amount === 9 || amount === 90) planId = "artist_founding";
    else planId = "artist_standard";
  }
  const interval: BillingInterval = normalizeInterval(String(intervalRaw));
  const resolvedAmount =
    amount > 0 ? amount : artistPremiumPriceUsd(planId, interval);
  const sku = artistPremiumSku(planId, interval);
  const email =
    String(input.body.email || input.body.Email || input.body.authemail || "").trim() ||
    "premium-recovery@users.bvsradio.com";
  const userId =
    String(
      input.body.customeruserid ||
        input.body.customerUserId ||
        input.body.userid ||
        input.body.userId ||
        "",
    ).trim() || undefined;
  const title =
    planId === "artist_founding"
      ? `BVS Founding Artist Premium (${interval})`
      : `BVS Artist Premium (${interval})`;

  return {
    reference,
    customerUserId: userId,
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
        price: resolvedAmount,
        quantity: 1,
      },
    ],
    paymentMethod: "paynow",
    projectNotes: `artist_premium:${planId}:${interval}:recovered_missing_order`,
    subtotal: resolvedAmount,
    taxAmount: 0,
    taxRate: 0,
    taxMode: "none",
    total: resolvedAmount,
    currency: "usd",
    status: "pending_payment",
    deliveryStatus: "awaiting_payment",
    paynowPollUrl: input.pollUrl,
    source: "artist_premium_recovery",
  };
}

/** Paynow result URL — they POST status updates here. */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};
    let rawPayload = "";
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, string>;
      rawPayload = JSON.stringify(body);
    } else {
      rawPayload = await req.text();
      body = Object.fromEntries(new URLSearchParams(rawPayload));
    }

    const integrationKey = process.env.PAYNOW_INTEGRATION_KEY || "";
    if (!verifyPaynowHash(body, integrationKey)) {
      await recordServerEvent("payment_error", { provider: "paynow", stage: "invalid_hash" });
      return NextResponse.json({ error: "Invalid payment notification." }, { status: 401 });
    }

    const reference = body.reference || body.Reference || body.merchantreference || "";
    const pollUrl = body.pollurl || body.pollUrl || body.PollUrl || "";
    const paynow = getPaynow();
    if (!reference || !pollUrl || !paynow) {
      return NextResponse.json({ error: "Incomplete payment notification." }, { status: 400 });
    }

    let order = await loadOrder(reference);
    let result: { status?: string; paid?: boolean; reference?: string; amount?: string | number };
    try {
      result = (await paynow.pollTransaction(pollUrl)) as typeof result;
    } catch {
      await recordServerEvent("payment_error", { provider: "paynow", stage: "trusted_poll_failed" });
      return NextResponse.json({ error: "Payment verification is pending." }, { status: 503 });
    }

    const trustedStatus = String(result.status || "").toLowerCase();
    const paid =
      trustedStatus === "paid" ||
      trustedStatus === "awaiting delivery" ||
      trustedStatus === "delivered" ||
      result.paid === true;
    const referenceMatches = !result.reference || result.reference === reference;

    // Missing BVS-PREM-* order + trusted paid poll → recover durable row (ZVSJQ class).
    if (!order && paid && referenceMatches && /^BVS-PREM-/i.test(reference)) {
      const recovered = recoverPremiumOrderFromPaynow({
        reference,
        pollUrl,
        body,
        trustedAmount: result.amount,
      });
      if (recovered) {
        try {
          const saved = await saveOrderToSupabase(recovered);
          if (saved.saved) {
            order = (await loadOrder(reference)) || recovered;
            await recordServerEvent("checkout_complete", {
              provider: "paynow",
              status: "premium_order_recovered",
              reference,
            });
          }
        } catch (recoverErr) {
          console.error("paynow premium order recovery failed", recoverErr);
        }
      }
    }

    if (!order) {
      const isPremiumRef = /^BVS-PREM-/i.test(reference) || /^BVS-INST-/i.test(reference);
      await recordServerEvent("payment_error", {
        provider: "paynow",
        stage: "order_not_found",
        reference,
        premiumRef: isPremiumRef,
      });
      // Do not 404 Premium refs — Paynow treats 404 as terminal (ZVSJQ drop).
      if (isPremiumRef) {
        return NextResponse.json(
          { error: "Premium order not stored yet. Retry." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const amountMatches = sameMoney(result.amount, order.total);
    if (!paid || !referenceMatches || !amountMatches) {
      await recordServerEvent("payment_error", { provider: "paynow", stage: "reconciliation_failed" });
      return NextResponse.json({ error: "Payment could not be reconciled." }, { status: 409 });
    }

    const premiumLine = parsePremiumOrderItem(order.items || []);
    const instantLine = parsePremiumInstantOrderItem(order.items || []);
    const specialPremiumOrder = Boolean(premiumLine || instantLine);
    const eventId = body.hash || body.Hash || `${reference}:${trustedStatus}`;
    let transition: { accepted: boolean; transitioned?: boolean; duplicate?: boolean } = {
      accepted: true,
      transitioned: true,
    };
    try {
      transition = await recordVerifiedPayment({
        provider: "paynow",
        eventId,
        reference,
        eventType: "payment.result",
        status: trustedStatus,
        amount: Number(result.amount),
        currency: "usd",
        providerReference: result.reference || reference,
        rawPayload,
      });
    } catch (ledgerErr) {
      if (!specialPremiumOrder) {
        console.error("paynow ledger", ledgerErr);
        await recordServerEvent("payment_error", { provider: "paynow", stage: "ledger_exception" });
        return NextResponse.json({ error: "Payment could not be reconciled." }, { status: 409 });
      }
      console.warn("paynow ledger skipped for premium product", reference);
    }
    if (!transition.accepted && !specialPremiumOrder) {
      await recordServerEvent("payment_error", {
        provider: "paynow",
        stage: "ledger_reconciliation_failed",
      });
      return NextResponse.json({ error: "Payment could not be reconciled." }, { status: 409 });
    }
    if (!transition.transitioned && transition.accepted && !specialPremiumOrder) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await recordServerEvent("checkout_complete", { provider: "paynow", status: "paid" });

    if (!specialPremiumOrder) {
      await creditPaidArtistDeposit(reference, "paynow");
      await creditPaidArtistSales(reference, "paynow");
      await initializePaidCreatorServiceOrder(reference);
    }

    if (premiumLine && order.customerUserId) {
      const activation = await activatePaidArtistPremium({
        userId: order.customerUserId,
        planId: premiumLine.planId,
        interval: premiumLine.interval,
        reference,
        amountUsd: premiumLine.amount || Number(order.total) || 0,
        provider: "paynow",
      });
      if (!activation.ok) {
        console.error("premium activate failed", activation.reason, reference);
        await recordServerEvent("payment_error", {
          provider: "paynow",
          stage: "premium_activate_failed",
        });
      } else {
        await recordServerEvent("checkout_complete", {
          provider: "paynow",
          status: "premium_activated",
          planId: premiumLine.planId,
          interval: premiumLine.interval,
        });
        await recordServerEvent("subscription_started", {
          provider: "paynow",
          planId: premiumLine.planId,
          interval: premiumLine.interval,
        });
      }
    } else if (premiumLine && !order.customerUserId) {
      // Recovered shell without user id — paid, but ops must link buyer + re-run activate.
      console.error("premium paid without customerUserId", reference);
      await recordServerEvent("payment_error", {
        provider: "paynow",
        stage: "premium_missing_user",
        reference,
      });
    }

    if (instantLine && order.customerUserId) {
      const activation = await grantPremiumInstant({
        userId: order.customerUserId,
        releaseId: instantLine.releaseId,
        reference,
        amountUsd: instantLine.amount || Number(order.total) || 0,
        provider: "paynow",
      });
      if (!activation.ok) {
        console.error("premium instant grant failed", activation.reason, reference);
        await recordServerEvent("payment_error", {
          provider: "paynow",
          stage: "premium_instant_grant_failed",
        });
        return NextResponse.json({ error: "Premium Instant activation failed." }, { status: 500 });
      }
      await recordServerEvent("checkout_complete", {
        provider: "paynow",
        status: "premium_instant_eligible",
        releaseId: instantLine.releaseId,
      });
    }

    const deliveryStatus = instantLine
      ? "distribution_eligible"
      : premiumLine
        ? order.customerUserId
          ? "premium_active"
          : "premium_paid_needs_user_link"
        : "paid_processing";
    const updated = await updateOrder(reference, {
      status: "paid",
      deliveryStatus,
      paynowPollUrl: pollUrl || undefined,
    });
    const paidOrder = updated || {
      ...order,
      status: "paid" as const,
      deliveryStatus,
    };

    // Always notify on paid Premium — Stripe path was silent historically; fix both.
    try {
      await notifyOwnerNewOrder(paidOrder);
    } catch (notifyErr) {
      console.error("paynow owner notify failed", notifyErr);
    }
    try {
      await notifyCustomerOrderEmail(paidOrder, "paid");
    } catch (notifyErr) {
      console.error("paynow customer receipt failed", notifyErr);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Paynow webhook failed:", error instanceof Error ? error.message : error);
    await recordServerEvent("payment_error", { provider: "paynow", stage: "webhook" });
    return NextResponse.json({ error: "Payment notification could not be processed." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ service: "paynow-webhook", ok: true });
}
