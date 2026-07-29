import { NextResponse } from "next/server";
import { getPaynow } from "@/lib/paynow";
import { loadOrder, notifyOwnerNewOrder, updateOrder } from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import { creditPaidArtistDeposit } from "@/lib/artist-credit";
import { sameMoney, verifyPaynowHash } from "@/lib/paynow-security";

/**
 * Paynow result URL — they POST status updates here.
 * Also supports GET poll-style checks via ?pollUrl=
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, string>;
    } else {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
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

    const order = await loadOrder(reference);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (order.status === "paid" || order.status === "fulfilled") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    let result: { status?: string; paid?: boolean; reference?: string; amount?: string | number };
    try {
      result = await paynow.pollTransaction(pollUrl) as typeof result;
    } catch {
      await recordServerEvent("payment_error", { provider: "paynow", stage: "trusted_poll_failed" });
      return NextResponse.json({ error: "Payment verification is pending." }, { status: 503 });
    }
    const trustedStatus = String(result.status || "").toLowerCase();
    const paid = trustedStatus === "paid" || trustedStatus === "awaiting delivery" || trustedStatus === "delivered" || result.paid === true;
    const referenceMatches = !result.reference || result.reference === reference;
    const amountMatches = sameMoney(result.amount, order.total);

    if (!paid || !referenceMatches || !amountMatches) {
      await recordServerEvent("payment_error", { provider: "paynow", stage: "reconciliation_failed" });
      return NextResponse.json({ error: "Payment could not be reconciled." }, { status: 409 });
    }

    if (paid) {
      await recordServerEvent("checkout_complete", { provider: "paynow", status: "paid" });
      await creditPaidArtistDeposit(reference, "paynow");
      const updated = await updateOrder(reference, {
        status: "paid",
        deliveryStatus: "paid_processing",
        paynowPollUrl: pollUrl || undefined,
      });
      if (updated) {
        await notifyOwnerNewOrder(updated);
      } else {
        await notifyOwnerNewOrder({ ...order, status: "paid" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "webhook error";
    await recordServerEvent("payment_error", { provider: "paynow", stage: "webhook" });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ service: "paynow-webhook", ok: true });
}
