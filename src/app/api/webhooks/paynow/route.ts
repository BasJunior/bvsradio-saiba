import { NextResponse } from "next/server";
import { getPaynow } from "@/lib/paynow";
import { loadOrderLocal, notifyOwnerNewOrder, updateOrderLocal } from "@/lib/orders";

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const st = String((polled as any).status || "").toLowerCase();
        paid = paid || st === "paid" || Boolean((polled as any).paid);
      } catch {
        /* use body status */
      }
    }

    if (reference && paid) {
      const updated = await updateOrderLocal(reference, {
        status: "paid",
        deliveryStatus: "paid_processing",
        paynowPollUrl: pollUrl || undefined,
      });
      if (updated) {
        await notifyOwnerNewOrder(updated);
      } else {
        const existing = await loadOrderLocal(reference);
        if (existing) await notifyOwnerNewOrder({ ...existing, status: "paid" });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "webhook error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ service: "paynow-webhook", ok: true });
}
