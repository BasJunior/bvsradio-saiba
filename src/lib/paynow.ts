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
