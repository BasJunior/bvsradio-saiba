import { NextResponse } from "next/server";
import {
  ecocashConfigPublic,
  ecocashEnabled,
  ecocashMode,
  initiateC2BPayment,
  lookupC2BTransaction,
  normalizeEcocashMsisdn,
  type EcocashCurrency,
} from "@/lib/ecocash";

/**
 * Sandbox helper for EcoCash C2B tests.
 *
 * POST body:
 * {
 *   "action": "pay" | "lookup" | "config",
 *   "msisdn": "0771234567",
 *   "amount": 1,
 *   "currency": "USD",
 *   "reason": "BVS sandbox test",
 *   "reference": "optional-unique-ref"
 * }
 *
 * Safety: refuses live mode unless ECOCASH_ALLOW_LIVE_VIA_SANDBOX_ROUTE=1
 * and requires ECOCASH_SANDBOX_SECRET header when set.
 */
export async function GET() {
  return NextResponse.json({
    service: "ecocash-sandbox",
    ...ecocashConfigPublic(),
    note: "POST with action pay|lookup|config. Get API key from https://developers.ecocash.co.zw",
  });
}

export async function POST(req: Request) {
  if (!ecocashEnabled()) {
    return NextResponse.json(
      {
        error: "EcoCash not configured. Set ECOCASH_API_KEY and ECOCASH_MODE=sandbox.",
        portal: "https://developers.ecocash.co.zw",
      },
      { status: 503 },
    );
  }

  if (ecocashMode() === "live" && process.env.ECOCASH_ALLOW_LIVE_VIA_SANDBOX_ROUTE !== "1") {
    return NextResponse.json(
      { error: "This route is for sandbox only. ECOCASH_MODE is live." },
      { status: 403 },
    );
  }

  const secret = process.env.ECOCASH_SANDBOX_SECRET;
  if (secret) {
    const header = req.headers.get("x-ecocash-sandbox-secret");
    if (header !== secret) {
      return NextResponse.json({ error: "Invalid sandbox secret" }, { status: 401 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action || "config");

  if (action === "config") {
    return NextResponse.json(ecocashConfigPublic());
  }

  const msisdnRaw = String(body.msisdn || body.mobileNumber || "");
  const msisdn = normalizeEcocashMsisdn(msisdnRaw);
  if (!msisdn) {
    return NextResponse.json(
      {
        error: "Invalid EcoCash number. Use 07xxxxxxxx or 2637xxxxxxxx",
        received: msisdnRaw,
      },
      { status: 400 },
    );
  }

  if (action === "lookup") {
    const reference = String(body.reference || body.sourceReference || "");
    if (!reference) {
      return NextResponse.json({ error: "reference is required for lookup" }, { status: 400 });
    }
    const result = await lookupC2BTransaction({
      sourceMobileNumber: msisdn,
      sourceReference: reference,
    });
    return NextResponse.json({ action: "lookup", msisdn, reference, result });
  }

  if (action === "pay") {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    const currency = (String(body.currency || "USD").toUpperCase() || "USD") as EcocashCurrency;
    const reason = String(body.reason || "BVS Radio sandbox test");
    const reference =
      String(body.reference || body.sourceReference || "").trim() ||
      `BVS-SBX-${Date.now()}`;

    const result = await initiateC2BPayment({
      customerMsisdn: msisdn,
      amount,
      reason,
      currency,
      sourceReference: reference,
    });

    return NextResponse.json({
      action: "pay",
      msisdn,
      amount,
      currency,
      reference,
      result,
    });
  }

  return NextResponse.json(
    { error: "Unknown action. Use pay | lookup | config" },
    { status: 400 },
  );
}
