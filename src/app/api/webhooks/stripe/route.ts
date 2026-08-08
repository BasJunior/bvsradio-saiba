import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { loadOrder, notifyCustomerOrderEmail, notifyOwnerNewOrder, updateOrder } from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import { creditPaidArtistDeposit, creditPaidArtistSales } from "@/lib/artist-credit";
import { recordVerifiedPayment } from "@/lib/commerce-ledger";
import { resolveStripeProcessorFee } from "@/lib/stripe-processor-fee";
import { reverseMarketplaceSellerCredits } from "@/lib/marketplace-refunds";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
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
    console.warn("Stripe webhook signature rejected:", err instanceof Error ? err.message : err);
    await recordServerEvent("payment_error", { provider: "stripe", stage: "webhook_signature" });
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
      metadata?: { reference?: string };
    };

    const reference = session.client_reference_id || session.metadata?.reference || "";

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
        await recordServerEvent("payment_error", { provider: "stripe", stage: "reconciliation_failed" });
        return NextResponse.json({ error: "Payment could not be reconciled." }, { status: 409 });
      }
      if (!transition.transitioned) {
        return NextResponse.json({ received: true, duplicate: true });
      }

      await recordServerEvent("checkout_complete", { provider: "stripe", status: "paid" });
      await creditPaidArtistDeposit(reference, "stripe");

      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
      const processorFee = await resolveStripeProcessorFee(paymentIntentId, session.currency || "usd");
      const settlement = await creditPaidArtistSales(reference, "stripe", processorFee);
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
        const existing = await loadOrder(reference);
        if (existing) {
          const paid = { ...existing, status: "paid" as const };
          await notifyOwnerNewOrder(paid);
          await notifyCustomerOrderEmail(paid, "paid");
        }
      }
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as {
      amount?: number | null;
      amount_refunded?: number | null;
      currency?: string | null;
      payment_intent?: string | { id?: string } | null;
    };
    const paymentIntentId = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id || "";
    const originalAmount = Number(charge.amount || 0);
    const refundedAmount = Number(charge.amount_refunded || 0);
    const fraction = originalAmount > 0 ? Math.min(1, refundedAmount / originalAmount) : 1;

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
          reason: "reason" in reversal ? String(reversal.reason || "unknown") : "unknown",
        });
      }
    }
  }

  if (event.type === "charge.dispute.created") {
    const dispute = event.data.object as {
      amount?: number | null;
      currency?: string | null;
      charge?: string | { id?: string; amount?: number; payment_intent?: string | { id?: string } | null } | null;
    };
    let charge = dispute.charge;
    if (typeof charge === "string") {
      charge = await stripe.charges.retrieve(charge);
    }
    const paymentIntentId = typeof charge?.payment_intent === "string"
      ? charge.payment_intent
      : charge?.payment_intent?.id || "";
    const chargeAmount = Number(charge?.amount || 0);
    const disputeAmount = Number(dispute.amount || 0);
    const fraction = chargeAmount > 0 ? Math.min(1, disputeAmount / chargeAmount) : 1;

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
          reason: "reason" in reversal ? String(reversal.reason || "unknown") : "unknown",
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
