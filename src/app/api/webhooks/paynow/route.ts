import { NextResponse } from "next/server";
import { getPaynow } from "@/lib/paynow";
import { loadOrder, notifyOwnerNewOrder, updateOrder } from "@/lib/orders";
import { recordServerEvent } from "@/lib/analytics-server";
import { creditPaidArtistDeposit } from "@/lib/artist-credit";

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

    const reference = body.reference || body.Reference || body.merchantreference || "";
    const pollUrl = body.pollurl || body.pollUrl || body.PollUrl || "";
    const status = (body.status || body.Status || "").toLowerCase();

    const paynow = getPaynow();
    let paid = status === "paid" || status === "awaiting delivery" || status === "delivered";

    if (paynow && pollUrl) {
      try {
        const polled = await paynow.pollTransaction(pollUrl);
        const result = polled as { status?: string; paid?: boolean };
        const st = String(result.status || "").toLowerCase();
        paid = paid || st === "paid" || Boolean(result.paid);
      } catch {
        /* use body status */
      }
    }

    if (reference && paid) {
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
        const existing = await loadOrder(reference);
        if (existing) await notifyOwnerNewOrder({ ...existing, status: "paid" });
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
