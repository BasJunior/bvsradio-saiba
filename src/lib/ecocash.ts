/**
 * EcoCash Instant Payments (C2B) client — sandbox + live.
 *
 * Official portal: https://developers.ecocash.co.zw
 * Sandbox base:   https://developers.ecocash.co.zw/api/ecocash_pay
 *
 * Credentials come only from env (never commit real keys):
 *   ECOCASH_API_KEY
 *   ECOCASH_MODE=sandbox|live   (default: sandbox)
 */

export type EcocashMode = "sandbox" | "live";

export type EcocashCurrency = "USD" | "ZWL" | "ZiG";

const BASE = "https://developers.ecocash.co.zw/api/ecocash_pay";

const PATHS = {
  payment: {
    sandbox: `${BASE}/api/v2/payment/instant/c2b/sandbox`,
    live: `${BASE}/api/v2/payment/instant/c2b/live`,
  },
  lookup: {
    sandbox: `${BASE}/api/v1/transaction/c2b/status/sandbox`,
    live: `${BASE}/api/v1/transaction/c2b/status/live`,
  },
  refund: {
    sandbox: `${BASE}/api/v2/refund/instant/c2b/sandbox`,
    live: `${BASE}/api/v2/refund/instant/c2b/live`,
  },
} as const;

export type EcocashPaymentRequest = {
  /** Customer EcoCash number, e.g. 263771234567 */
  customerMsisdn: string;
  amount: number;
  reason: string;
  currency: EcocashCurrency;
  /** Your unique merchant reference */
  sourceReference: string;
};

export type EcocashLookupRequest = {
  sourceMobileNumber: string;
  sourceReference: string;
};

export type EcocashRefundRequest = {
  originalEcocashTransactionReference: string;
  refundCorrelator: string;
  sourceMobileNumber: string;
  amount: number;
  clientName: string;
  currency: EcocashCurrency;
  reasonForRefund: string;
};

export type EcocashResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

export function ecocashMode(): EcocashMode {
  const m = (process.env.ECOCASH_MODE || "sandbox").toLowerCase();
  return m === "live" ? "live" : "sandbox";
}

export function ecocashEnabled() {
  return Boolean(process.env.ECOCASH_API_KEY && process.env.ECOCASH_API_KEY.length > 8);
}

export function normalizeEcocashMsisdn(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("263") && digits.length >= 12) return digits;
  if (digits.startsWith("07") && digits.length === 10) return `263${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `263${digits}`;
  return null;
}

async function ecocashFetch<T>(
  url: string,
  body: unknown,
): Promise<EcocashResult<T>> {
  const apiKey = process.env.ECOCASH_API_KEY;
  if (!apiKey) {
    return { ok: false, status: 0, error: "ECOCASH_API_KEY is not set" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
    });

    let data: unknown = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (res.ok) {
      return { ok: true, status: res.status, data: data as T };
    }

    const message =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : typeof data === "string"
          ? data
          : `EcoCash API error (${res.status})`;

    return { ok: false, status: res.status, error: message, details: data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error calling EcoCash",
    };
  }
}

export function initiateC2BPayment(req: EcocashPaymentRequest) {
  const mode = ecocashMode();
  return ecocashFetch<unknown>(PATHS.payment[mode], req);
}

export function lookupC2BTransaction(req: EcocashLookupRequest) {
  const mode = ecocashMode();
  return ecocashFetch<unknown>(PATHS.lookup[mode], req);
}

export function refundC2BPayment(req: EcocashRefundRequest) {
  const mode = ecocashMode();
  return ecocashFetch<unknown>(PATHS.refund[mode], req);
}

export function ecocashConfigPublic() {
  return {
    enabled: ecocashEnabled(),
    mode: ecocashMode(),
    baseUrl: BASE,
    endpoints: {
      payment: PATHS.payment[ecocashMode()],
      lookup: PATHS.lookup[ecocashMode()],
      refund: PATHS.refund[ecocashMode()],
    },
  };
}
