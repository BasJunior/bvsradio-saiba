import { NextResponse } from "next/server";
import { getPaynow } from "@/lib/paynow";
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
import { sameMoney, verifyPaynowHash } from "@/lib/paynow-security";
import { recordVerifiedPayment } from "@/lib/commerce-ledger";
import {
  activatePaidArtistPremium,
  parsePremiumOrderItem,
} from "@/lib/premium-billing";
import { activatePaidServicePremium } from "@/lib/service-premium-billing";
import { parseServicePremiumOrderItem } from "@/lib/service-premium-plans";
import { initializePaidCreatorServiceOrder } from "@/lib/creator-service-orders";

/**
 * Paynow result URL — they POST status updates here.
 * Also supports GET poll-style checks via ?pollUrl=
 */
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
      await recordServerEvent("payment_error", {
        provider: "paynow",
        stage: "invalid_hash",
      });
      return NextResponse.json(
        { error: "Invalid payment notification." },
        { status: 401 },
      );
    }

    const reference =
      body.reference || body.Reference || body.merchantreference || "";
    const pollUrl = body.pollurl || body.pollUrl || body.PollUrl || "";
    const paynow = getPaynow();
    if (!reference || !pollUrl || !paynow) {
      return NextResponse.json(
        { error: "Incomplete payment notification." },
        { status: 400 },
      );
    }

    const order = await loadOrder(reference);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    let result: {
      status?: string;
      paid?: boolean;
      reference?: string;
      amount?: string | number;
    };
    try {
      result = (await paynow.pollTransaction(pollUrl)) as typeof result;
    } catch {
      await recordServerEvent("payment_error", {
        provider: "paynow",
        stage: "trusted_poll_failed",
      });
      return NextResponse.json(
        { error: "Payment verification is pending." },
        { status: 503 },
      );
    }
    const trustedStatus = String(result.status || "").toLowerCase();
    const paid =
      trustedStatus === "paid" ||
      trustedStatus === "awaiting delivery" ||
      trustedStatus === "delivered" ||
      result.paid === true;
    const referenceMatches =
      !result.reference || result.reference === reference;
    const amountMatches = sameMoney(result.amount, order.total);

    if (!paid || !referenceMatches || !amountMatches) {
      await recordServerEvent("payment_error", {
        provider: "paynow",
        stage: "reconciliation_failed",
      });
      return NextResponse.json(
        { error: "Payment could not be reconciled." },
        { status: 409 },
      );
    }

    if (paid) {
      const eventId = body.hash || body.Hash || `${reference}:${trustedStatus}`;
      const premiumLine = parsePremiumOrderItem(order.items || []);
      const servicePremiumLine = parseServicePremiumOrderItem(order.items || []);
      const isMembershipOrder = Boolean(premiumLine || servicePremiumLine);
      let transition: {
        accepted: boolean;
        transitioned?: boolean;
        duplicate?: boolean;
      } = {
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
        // Prepaid membership orders may not have a commerce snapshot.
        if (!isMembershipOrder) {
          console.error("paynow ledger", ledgerErr);
          await recordServerEvent("payment_error", {
            provider: "paynow",
            stage: "ledger_exception",
          });
          return NextResponse.json(
            { error: "Payment could not be reconciled." },
            { status: 409 },
          );
        }
        console.warn("paynow ledger skipped for membership", reference);
      }
      if (!transition.accepted && !isMembershipOrder) {
        await recordServerEvent("payment_error", {
          provider: "paynow",
          stage: "ledger_reconciliation_failed",
        });
        return NextResponse.json(
          { error: "Payment could not be reconciled." },
          { status: 409 },
        );
      }
      if (!transition.transitioned && transition.accepted && !isMembershipOrder) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      await recordServerEvent("checkout_complete", {
        provider: "paynow",
        status: "paid",
      });

      if (!isMembershipOrder) {
        await creditPaidArtistDeposit(reference, "paynow");
        await creditPaidArtistSales(reference, "paynow");
        await initializePaidCreatorServiceOrder(reference);
      }

      if (premiumLine && order.customerUserId) {
        const act = await activatePaidArtistPremium({
          userId: order.customerUserId,
          planId: premiumLine.planId,
          interval: premiumLine.interval,
          reference,
          amountUsd: premiumLine.amount || Number(order.total) || 0,
          provider: "paynow",
        });
        if (!act.ok) {
          console.error("premium activate failed", act.reason, reference);
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
        }
      }

      if (servicePremiumLine && order.customerUserId) {
        const act = await activatePaidServicePremium({
          userId: order.customerUserId,
          planId: servicePremiumLine.planId,
          interval: servicePremiumLine.interval,
          reference,
          amountUsd: servicePremiumLine.amount || Number(order.total) || 0,
          provider: "paynow",
        });
        if (!act.ok) {
          console.error("service premium activate failed", act.reason, reference);
          await recordServerEvent("payment_error", {
            provider: "paynow",
            stage: "service_premium_activate_failed",
          });
        } else {
          await recordServerEvent("checkout_complete", {
            provider: "paynow",
            status: "service_premium_activated",
            planId: servicePremiumLine.planId,
            interval: servicePremiumLine.interval,
          });
        }
      }

      const membershipActive = Boolean(premiumLine || servicePremiumLine);
      const updated = await updateOrder(reference, {
        status: "paid",
        deliveryStatus: membershipActive ? "premium_active" : "paid_processing",
        paynowPollUrl: pollUrl || undefined,
      });
      const paidOrder = updated || {
        ...order,
        status: "paid" as const,
        deliveryStatus: membershipActive ? "premium_active" : "paid_processing",
      };
      await notifyOwnerNewOrder(paidOrder);
      await notifyCustomerOrderEmail(paidOrder, "paid");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Paynow webhook failed:", e instanceof Error ? e.message : e);
    await recordServerEvent("payment_error", {
      provider: "paynow",
      stage: "webhook",
    });
    return NextResponse.json(
      { error: "Payment notification could not be processed." },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ service: "paynow-webhook", ok: true });
}
