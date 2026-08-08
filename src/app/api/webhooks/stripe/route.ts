import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { loadOrder, notifyCustomerOrderEmail, notifyOwnerNewOrder, updateOrder } from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import { creditPaidArtistDeposit, creditPaidArtistSales } from "@/lib/artist-credit";
import { recordVerifiedPayment } from "@/lib/commerce-ledger";

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
    const message = err instanceof Error ? err.message : "Invalid signature";
    await recordServerEvent("payment_error", { provider: "stripe", stage: "webhook_signature" });
    return NextResponse.json({ error: message }, { status: 400 });
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
        await recordServerEvent("payment_error", { provider: "stripe", stage: "reconciliation_failed" });
        return NextResponse.json({ error: "Payment could not be reconciled." }, { status: 409 });
      }
      if (!transition.transitioned) {
        return NextResponse.json({ received: true, duplicate: true });
      }
      await recordServerEvent("checkout_complete", { provider: "stripe", status: "paid" });
      await creditPaidArtistDeposit(reference, "stripe");
      await creditPaidArtistSales(reference, "stripe");
      const updated = await updateOrder(reference, {
        status: "paid",
        deliveryStatus: "paid_processing",
        stripeSessionId: session.id,
        stripePaymentIntent:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
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

  return NextResponse.json({ received: true });
}
