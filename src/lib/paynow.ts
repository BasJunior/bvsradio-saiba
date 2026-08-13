import { siteUrl } from "@/lib/stripe";

// paynow package is CJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Paynow } = require("paynow") as {
  Paynow: new (id: string, key: string) => {
    resultUrl: string;
    returnUrl: string;
    createPayment: (ref: string, email?: string) => {
      add: (name: string, price: number) => void;
    };
    send: (payment: unknown) => Promise<{
      success: boolean;
      redirectUrl?: string;
      pollUrl?: string;
      error?: string;
    }>;
    sendMobile: (
      payment: unknown,
      phone: string,
      method: string,
    ) => Promise<{
      success: boolean;
      pollUrl?: string;
      instructions?: string;
      error?: string;
    }>;
    pollTransaction: (pollUrl: string) => Promise<unknown>;
  };
};

export function paynowEnabled() {
  return Boolean(
    process.env.PAYNOW_INTEGRATION_ID &&
      process.env.PAYNOW_INTEGRATION_KEY &&
      process.env.PAYNOW_INTEGRATION_ID.length > 2,
  );
}

export function getPaynow() {
  if (!paynowEnabled()) return null;
  const paynow = new Paynow(
    process.env.PAYNOW_INTEGRATION_ID as string,
    process.env.PAYNOW_INTEGRATION_KEY as string,
  );
  const base = siteUrl();
  paynow.resultUrl = `${base}/api/webhooks/paynow`;
  paynow.returnUrl = `${base}/checkout/success`;
  return paynow;
}

/**
 * Auth email sent to Paynow with initiate.
 *
 * Paynow **test** integrations reject any authemail that is not the merchant
 * registration email. Empty authemail is accepted and still returns browserurl.
 * Production integrations accept the payer email.
 *
 * Override with PAYNOW_AUTH_EMAIL (merchant email) when you must pin one address.
 * Set PAYNOW_USE_CUSTOMER_EMAIL=1 only on a live (non-test) integration.
 */
export function paynowAuthEmail(customerEmail?: string | null): string {
  const pinned = (process.env.PAYNOW_AUTH_EMAIL || "").trim();
  if (pinned) return pinned;
  const useCustomer = process.env.PAYNOW_USE_CUSTOMER_EMAIL === "1";
  if (useCustomer && customerEmail && customerEmail.includes("@")) {
    return customerEmail.trim();
  }
  // Safe default for test mode + avoids silent initiate failures.
  return "";
}

export function humanizePaynowError(raw?: string | null): string {
  const msg = (raw || "").trim();
  if (!msg) {
    return "Paynow could not start checkout. Try again or contact BVS.";
  }
  if (/test mode/i.test(msg) && /authemail|email/i.test(msg)) {
    return "Paynow is still in test mode and rejected this checkout email. BVS will open Paynow without a locked email, or switch the integration to live.";
  }
  if (/integration/i.test(msg) && /invalid|not found|disabled/i.test(msg)) {
    return "Paynow merchant credentials are invalid or disabled. Check PAYNOW_INTEGRATION_ID / KEY.";
  }
  // Keep provider detail short for operators; customers get a stable line.
  return "Paynow could not start checkout. Please try again in a moment.";
}

/** Normalize ZW / international phones for Paynow EcoCash */
export function normalizeZwPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  // already 2637…
  if (digits.startsWith("263") && digits.length >= 12) return digits;
  // 07xxxxxxxx
  if (digits.startsWith("07") && digits.length === 10) return `263${digits.slice(1)}`;
  // 7xxxxxxxx
  if (digits.startsWith("7") && digits.length === 9) return `263${digits}`;
  // German / other — Paynow EcoCash needs ZW numbers; return null for non-ZW
  return null;
}
