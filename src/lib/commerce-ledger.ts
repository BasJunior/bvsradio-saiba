import { createHash } from "crypto";
import type { OrderItem } from "@/lib/orders";

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
};

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function resolveCommerceItems(items: OrderItem[]): CommerceItem[] {
  return items.map((item) => {
    const id = String(item.id);
    const key = slug(item.title);
    const quantity = Math.min(20, Math.max(1, Math.floor(Number(item.quantity) || 1)));
    let productType: CommerceItem["productType"] = "single";
    let unitAmount = 2;
    let sku = `track:${id}`;

    if (id === "100" || key === "lord-album") {
      productType = "album"; unitAmount = 19; sku = "album:lord";
    } else if (id === "101" || key === "album-16-bit") {
      productType = "album"; unitAmount = 14; sku = "album:16-bit";
    } else if (item.type === "service") {
      if (SERVICE_PRICES[key] === undefined) throw new Error("UNKNOWN_SERVICE");
      productType = "service"; unitAmount = SERVICE_PRICES[key]; sku = `service:${key}`;
    } else if (item.type === "beat") {
      productType = "beat"; unitAmount = 29; sku = `beat:${id}:standard`;
    } else if (item.type === "mix") {
      productType = "mix"; unitAmount = 4; sku = `mix:${id}`;
    }

    return {
      ...item, type: productType, price: unitAmount, quantity,
      sku, sourceId: id, productType, unitAmount, currency: "usd",
      taxClass: productType === "service" ? "service" : "digital",
      fulfillmentType: productType === "service" ? "service" : "download",
    };
  });
}

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("COMMERCE_LEDGER_UNAVAILABLE");
  return { url, key };
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
    p_items: items.map(({ sku, sourceId, title, productType, unitAmount, quantity, currency, taxClass, fulfillmentType }) => ({
      sku, sourceId, title, productType, unitAmount, quantity, currency, taxClass, fulfillmentType,
    })),
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

