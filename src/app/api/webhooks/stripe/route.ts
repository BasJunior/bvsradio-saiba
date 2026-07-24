import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { loadOrder, notifyOwnerNewOrder, updateOrder } from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import { creditPaidArtistDeposit } from "@/lib/artist-credit";

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
      metadata?: { reference?: string };
    };

    const reference =
      session.client_reference_id || session.metadata?.reference || "";

    if (reference) {
      await recordServerEvent("checkout_complete", { provider: "stripe", status: "paid" });
      await creditPaidArtistDeposit(reference, "stripe");
      const updated = await updateOrder(reference, {
        status: "paid",
        deliveryStatus: "paid_processing",
        stripeSessionId: session.id,
        stripePaymentIntent:
          typeof session.payment_intent === "string" ? session.payment_intent : undefined,
      });

      if (updated) {
        await notifyOwnerNewOrder({
          ...updated,
          status: "paid",
        });
      } else {
        // Order may only exist remotely if filesystem missed write
        const existing = await loadOrder(reference);
        if (existing) {
          await notifyOwnerNewOrder({ ...existing, status: "paid" });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
