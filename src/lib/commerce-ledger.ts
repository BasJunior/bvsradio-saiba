import { createHash } from "crypto";
import type { OrderItem } from "@/lib/orders";
import { PRICE_BEAT_LICENCE } from "@/lib/catalogue-pricing";
import {
  getBeatLicenceTemplateOrDefault,
  licenceTermsVersionTag,
} from "@/lib/beat-licences";

const SERVICE_PRICES: Record<string, number> = {
  "basic-mix": 89, "pro-mix": 149, "premium-mix": 199,
  "standard-master": 69, "premium-master": 99, "album-master": 299,
  "standard-bundle": 189, "premium-bundle": 249, "ultimate-bundle": 299,
  "vocal-comping-tuning": 65, "full-vocal-production": 129,
  "custom-bvs-service": 69,
};

export type CommerceItem = OrderItem & {
  sku: string;
  sourceId: string;
  productType: "single" | "mix" | "album" | "beat" | "service";
  unitAmount: number;
  currency: "usd";
  taxClass: "digital" | "service";
  fulfillmentType: "download" | "service";
  licenceOptionId?: string;
  /** Beat licence tier code, e.g. standard_lease */
  licenceCode?: string;
  /** Numeric template version accepted at purchase */
  licenceTemplateVersion?: number;
  /** e.g. standard_lease-v1 */
  licenceTermsVersion?: string;
  licenceSummary?: string;
  licenceTerms?: string;
};

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("COMMERCE_LEDGER_UNAVAILABLE");
  return { url, key };
}

type BeatLicenceRow = {
  id: string;
  beat_id: string;
  licence_code: string;
  price_usd: number | string | null;
  is_active?: boolean | null;
  terms_version?: string | null;
  terms_summary?: string | null;
};

async function fetchBeatLicenceOption(
  beatId: string,
  licenceOptionId?: string,
): Promise<BeatLicenceRow | null> {
  let url: string;
  let key: string;
  try {
    ({ url, key } = config());
  } catch {
    return null;
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  const select = "id,beat_id,licence_code,price_usd,is_active,terms_version,terms_summary";

  if (licenceOptionId) {
    const byId = await fetch(
      `${url}/rest/v1/beat_licence_options?id=eq.${encodeURIComponent(licenceOptionId)}&select=${select}&limit=1`,
      { headers, cache: "no-store" },
    );
    if (byId.ok) {
      const rows = (await byId.json()) as BeatLicenceRow[];
      const row = rows?.[0];
      if (row && String(row.beat_id) === String(beatId) && row.is_active !== false) {
        return row;
      }
    }
  }

  // Prefer active standard_lease for this beat
  const standard = await fetch(
    `${url}/rest/v1/beat_licence_options?beat_id=eq.${encodeURIComponent(beatId)}&licence_code=eq.standard_lease&is_active=eq.true&select=${select}&order=price_usd.asc&limit=1`,
    { headers, cache: "no-store" },
  );
  if (standard.ok) {
    const rows = (await standard.json()) as BeatLicenceRow[];
    if (rows?.[0]) return rows[0];
  }

  // Any active option
  const anyActive = await fetch(
    `${url}/rest/v1/beat_licence_options?beat_id=eq.${encodeURIComponent(beatId)}&is_active=eq.true&select=${select}&order=price_usd.asc&limit=1`,
    { headers, cache: "no-store" },
  );
  if (anyActive.ok) {
    const rows = (await anyActive.json()) as BeatLicenceRow[];
    if (rows?.[0]) return rows[0];
  }

  return null;
}

function parsePriceUsd(value: number | string | null | undefined): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Resolve authoritative unit prices for checkout.
 * Beat lines load `beat_licence_options` (standard_lease) from Supabase; fallback $29 only if missing.
 */
export async function resolveCommerceItems(items: OrderItem[]): Promise<CommerceItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const id = String(item.id);
      const key = slug(item.title);
      const quantity = Math.min(20, Math.max(1, Math.floor(Number(item.quantity) || 1)));
      let productType: CommerceItem["productType"] = "single";
      let unitAmount = 2;
      let sku = `track:${id}`;
      let licenceOptionId: string | undefined =
        typeof item.licence_option_id === "string" && item.licence_option_id.trim()
          ? item.licence_option_id.trim()
          : undefined;

      let licenceCode: string | undefined;
      let licenceTemplateVersion: number | undefined;
      let licenceTermsVersion: string | undefined;
      let licenceSummary: string | undefined;
      let licenceTerms: string | undefined;

      if (id === "100" || key === "lord-album") {
        productType = "album";
        unitAmount = 19;
        sku = "album:lord";
      } else if (id === "101" || key === "album-16-bit") {
        productType = "album";
        unitAmount = 14;
        sku = "album:16-bit";
      } else if (item.type === "service") {
        if (SERVICE_PRICES[key] === undefined) throw new Error("UNKNOWN_SERVICE");
        productType = "service";
        unitAmount = SERVICE_PRICES[key];
        sku = `service:${key}`;
      } else if (item.type === "beat") {
        productType = "beat";
        const licence = await fetchBeatLicenceOption(id, licenceOptionId);
        const priced = parsePriceUsd(licence?.price_usd ?? null);
        unitAmount = priced != null ? priced : PRICE_BEAT_LICENCE;
        licenceOptionId = licence?.id || licenceOptionId;
        const code = licence?.licence_code || "standard_lease";
        licenceCode = code;
        const template = getBeatLicenceTemplateOrDefault(code);
        licenceTemplateVersion = template.version;
        licenceTermsVersion =
          (typeof licence?.terms_version === "string" && licence.terms_version.trim()) ||
          licenceTermsVersionTag(template);
        licenceSummary =
          (typeof licence?.terms_summary === "string" && licence.terms_summary.trim()) ||
          template.summary;
        licenceTerms = template.terms;
        sku = `beat:${id}:${code}${licenceOptionId ? `:${licenceOptionId}` : ""}:v${template.version}`;
      } else if (item.type === "mix") {
        productType = "mix";
        unitAmount = 4;
        sku = `mix:${id}`;
      }

      return {
        ...item,
        type: productType,
        price: unitAmount,
        quantity,
        licence_option_id: licenceOptionId,
        licenceOptionId,
        licenceCode,
        licenceTemplateVersion,
        licenceTermsVersion,
        licenceSummary,
        licenceTerms,
        sku,
        sourceId: id,
        productType,
        unitAmount,
        currency: "usd" as const,
        taxClass: productType === "service" ? ("service" as const) : ("digital" as const),
        fulfillmentType: productType === "service" ? ("service" as const) : ("download" as const),
      };
    }),
  );
}

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`COMMERCE_LEDGER_FAILED:${response.status}`);
  return response.json() as Promise<T>;
}

export async function recordOrderSnapshot(reference: string, items: CommerceItem[]) {
  return rpc<number>("record_commerce_order_snapshot", {
    p_order_reference: reference,
    p_items: items.map(
      ({
        sku,
        sourceId,
        title,
        productType,
        unitAmount,
        quantity,
        currency,
        taxClass,
        fulfillmentType,
        licenceOptionId,
        licenceCode,
        licenceTemplateVersion,
        licenceTermsVersion,
        licenceSummary,
        licenceTerms,
      }) => ({
        sku,
        sourceId,
        title,
        productType,
        unitAmount,
        quantity,
        currency,
        taxClass,
        fulfillmentType,
        // Snapshot accepted licence terms so later template edits do not rewrite history
        licenceOptionId: licenceOptionId ?? null,
        licenceCode: licenceCode ?? null,
        licenceTemplateVersion: licenceTemplateVersion ?? null,
        licenceTermsVersion: licenceTermsVersion ?? null,
        licenceSummary: licenceSummary ?? null,
        licenceTerms: licenceTerms ?? null,
      }),
    ),
  });
}

export type PaymentTransition = {
  accepted: boolean; duplicate?: boolean; transitioned?: boolean;
  reconciled?: boolean; error?: string; eventId?: string;
};

export async function recordVerifiedPayment(input: {
  provider: "stripe" | "paynow"; eventId: string; reference: string;
  eventType: string; status: string; amount: number; currency: string;
  providerReference: string; rawPayload: string;
}) {
  return rpc<PaymentTransition>("record_verified_payment_event", {
    p_provider: input.provider, p_provider_event_id: input.eventId,
    p_order_reference: input.reference, p_event_type: input.eventType,
    p_provider_status: input.status, p_amount: input.amount,
    p_currency: input.currency.toLowerCase(), p_provider_reference: input.providerReference,
    p_payload_sha256: createHash("sha256").update(input.rawPayload).digest("hex"),
  });
}
