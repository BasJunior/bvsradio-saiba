import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  loadOrder,
  notifyCustomerOrderEmail,
  notifyOwnerNewOrder,
  updateOrder,
} from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import {
  creditPaidArtistDeposit,
  creditPaidArtistSales,
} from "@/lib/artist-credit";
import { recordVerifiedPayment } from "@/lib/commerce-ledger";
import {
  activatePaidArtistPremium,
  deactivateStripeArtistPremium,
  normalizeArtistPlanId,
  normalizeInterval,
} from "@/lib/premium-billing";
import { resolveStripeProcessorFee } from "@/lib/stripe-processor-fee";
import { reverseMarketplaceSellerCredits } from "@/lib/marketplace-refunds";
import { initializePaidCreatorServiceOrder } from "@/lib/creator-service-orders";
import {
  activatePaidProducerPremium,
  deactivateStripeProducerPremium,
  normalizeProducerInterval,
  normalizeProducerPlanId,
  producerBillingGuard,
} from "@/lib/producer-billing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.warn(
      "Stripe webhook signature rejected:",
      err instanceof Error ? err.message : err,
    );
    await recordServerEvent("payment_error", {
      provider: "stripe",
      stage: "webhook_signature",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      id: string;
      client_reference_id?: string | null;
      payment_intent?: string | null;
      amount_total?: number | null;
      currency?: string | null;
      payment_status?: string | null;
      mode?: string | null;
      subscription?: string | null;
      metadata?: {
        reference?: string;
        kind?: string;
        user_id?: string;
        plan_id?: string;
        interval?: string;
      };
    };

    if (
      session.mode === "subscription" &&
      session.metadata?.kind === "producer_premium" &&
      session.metadata.user_id &&
      typeof session.subscription === "string" &&
      (session.payment_status === "paid" || session.payment_status === "no_payment_required")
    ) {
      if (!producerBillingGuard().ok) {
        return NextResponse.json({ error: "Producer beta billing is disabled." }, { status: 503 });
      }
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const periodEnd = subscription.items.data[0]?.current_period_end;
      const result = await activatePaidProducerPremium({
        userId: session.metadata.user_id,
        planId: normalizeProducerPlanId(session.metadata.plan_id),
        interval: normalizeProducerInterval(session.metadata.interval),
        reference: subscription.id,
        amountUsd: Number(session.amount_total || 0) / 100,
        endsAt: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
      });
      if (!result.ok) return NextResponse.json({ error: "Producer plan activation failed." }, { status: 500 });
      return NextResponse.json({ received: true });
    }

    if (
      session.mode === "subscription" &&
      session.metadata?.kind === "artist_premium" &&
      session.metadata.user_id &&
      typeof session.subscription === "string" &&
      (session.payment_status === "paid" ||
        session.payment_status === "no_payment_required")
    ) {
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription,
      );
      const periodEnd = subscription.items.data[0]?.current_period_end;
      const result = await activatePaidArtistPremium({
        userId: session.metadata.user_id,
        planId: normalizeArtistPlanId(session.metadata.plan_id),
        interval: normalizeInterval(session.metadata.interval),
        reference: subscription.id,
        amountUsd: Number(session.amount_total || 0) / 100,
        provider: "stripe",
        endsAt: periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : undefined,
      });
      if (!result.ok)
        return NextResponse.json(
          { error: "Premium activation failed." },
          { status: 500 },
        );
      return NextResponse.json({ received: true });
    }

    const reference =
      session.client_reference_id || session.metadata?.reference || "";

    if (reference && session.payment_status === "paid") {
      const transition = await recordVerifiedPayment({
        provider: "stripe",
        eventId: event.id,
        reference,
        eventType: event.type,
        status: session.payment_status,
        amount: Number(session.amount_total || 0) / 100,
        currency: session.currency || "",
        providerReference: reference,
        rawPayload: body,
      });
      if (!transition.accepted) {
        await recordServerEvent("payment_error", {
          provider: "stripe",
          stage: "reconciliation_failed",
        });
        return NextResponse.json(
          { error: "Payment could not be reconciled." },
          { status: 409 },
        );
      }
      if (!transition.transitioned) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      await recordServerEvent("checkout_complete", {
        provider: "stripe",
        status: "paid",
      });
      await creditPaidArtistDeposit(reference, "stripe");

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null;
      const processorFee = await resolveStripeProcessorFee(
        paymentIntentId,
        session.currency || "usd",
      );
      const settlement = await creditPaidArtistSales(
        reference,
        "stripe",
        processorFee,
      );
      await initializePaidCreatorServiceOrder(reference);
      if (settlement.pending) {
        await recordServerEvent("payment_error", {
          provider: "stripe",
          stage: "processor_fee_pending",
          reference,
        });
      }
      const updated = await updateOrder(reference, {
        status: "paid",
        deliveryStatus: "paid_processing",
        stripeSessionId: session.id,
        stripePaymentIntent: paymentIntentId || undefined,
      });

      if (updated) {
        const paid = { ...updated, status: "paid" as const };
        await notifyOwnerNewOrder(paid);
        await notifyCustomerOrderEmail(paid, "paid");
      } else {
        // Order may only exist remotely if filesystem missed write
        const existing = await loadOrder(reference);
        if (existing) {
          const paid = { ...existing, status: "paid" as const };
          await notifyOwnerNewOrder(paid);
          await notifyCustomerOrderEmail(paid, "paid");
        }
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    if (
      subscription.metadata?.kind === "producer_premium" &&
      subscription.metadata.user_id &&
      producerBillingGuard().ok
    ) {
      const periodEnd = subscription.items.data[0]?.current_period_end;
      if (["active", "trialing", "past_due"].includes(subscription.status) && periodEnd) {
        const result = await activatePaidProducerPremium({
          userId: subscription.metadata.user_id,
          planId: normalizeProducerPlanId(subscription.metadata.plan_id),
          interval: normalizeProducerInterval(subscription.metadata.interval),
          reference: subscription.id,
          amountUsd: 0,
          endsAt: new Date(periodEnd * 1000).toISOString(),
        });
        if (!result.ok) return NextResponse.json({ error: "Producer plan synchronization failed." }, { status: 500 });
      }
    }
    if (
      subscription.metadata?.kind === "artist_premium" &&
      subscription.metadata.user_id
    ) {
      const periodEnd = subscription.items.data[0]?.current_period_end;
      if (
        ["active", "trialing", "past_due"].includes(subscription.status) &&
        periodEnd
      ) {
        const result = await activatePaidArtistPremium({
          userId: subscription.metadata.user_id,
          planId: normalizeArtistPlanId(subscription.metadata.plan_id),
          interval: normalizeInterval(subscription.metadata.interval),
          reference: subscription.id,
          amountUsd: 0,
          provider: "stripe",
          endsAt: new Date(periodEnd * 1000).toISOString(),
        });
        if (!result.ok)
          return NextResponse.json(
            { error: "Premium synchronization failed." },
            { status: 500 },
          );
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    if (
      subscription.metadata?.kind === "producer_premium" &&
      subscription.metadata.user_id
    ) {
      const result = await deactivateStripeProducerPremium(subscription.id, subscription.metadata.user_id);
      if (!result.ok) return NextResponse.json({ error: "Producer plan deactivation failed." }, { status: 500 });
    }
    if (
      subscription.metadata?.kind === "artist_premium" &&
      subscription.metadata.user_id
    ) {
      const result = await deactivateStripeArtistPremium(
        subscription.id,
        subscription.metadata.user_id,
      );
      if (!result.ok)
        return NextResponse.json(
          { error: "Premium deactivation failed." },
          { status: 500 },
        );
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as {
      amount?: number | null;
      amount_refunded?: number | null;
      currency?: string | null;
      payment_intent?: string | { id?: string } | null;
    };
    const paymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id || "";
    const originalAmount = Number(charge.amount || 0);
    const refundedAmount = Number(charge.amount_refunded || 0);
    const fraction =
      originalAmount > 0 ? Math.min(1, refundedAmount / originalAmount) : 1;

    if (paymentIntentId && refundedAmount > 0) {
      const reversal = await reverseMarketplaceSellerCredits({
        paymentIntentId,
        providerEventId: event.id,
        reason: "refund",
        fraction,
        providerAmount: refundedAmount / 100,
        providerCurrency: charge.currency || null,
      });
      const duplicate = "duplicate" in reversal && reversal.duplicate === true;
      if (!reversal.reversed && !duplicate) {
        await recordServerEvent("payment_error", {
          provider: "stripe",
          stage: "refund_wallet_reversal",
          reason:
            "reason" in reversal
              ? String(reversal.reason || "unknown")
              : "unknown",
        });
      }
    }
  }

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as {
      amount?: number | null;
      currency?: string | null;
      charge?:
        | string
        | {
            id?: string;
            amount?: number;
            payment_intent?: string | { id?: string } | null;
          }
        | null;
    };
    let charge = dispute.charge;
    if (typeof charge === "string") {
      charge = await stripe.charges.retrieve(charge);
    }
    const paymentIntentId =
      typeof charge?.payment_intent === "string"
        ? charge.payment_intent
        : charge?.payment_intent?.id || "";
    const chargeAmount = Number(charge?.amount || 0);
    const disputeAmount = Number(dispute.amount || 0);
    const fraction =
      chargeAmount > 0 ? Math.min(1, disputeAmount / chargeAmount) : 1;

    if (paymentIntentId && disputeAmount > 0) {
      const reversal = await reverseMarketplaceSellerCredits({
        paymentIntentId,
        providerEventId: event.id,
        reason: "chargeback",
        fraction,
        providerAmount: disputeAmount / 100,
        providerCurrency: dispute.currency || null,
      });
      const duplicate = "duplicate" in reversal && reversal.duplicate === true;
      if (!reversal.reversed && !duplicate) {
        await recordServerEvent("payment_error", {
          provider: "stripe",
          stage: "chargeback_wallet_reversal",
          reason:
            "reason" in reversal
              ? String(reversal.reason || "unknown")
              : "unknown",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
