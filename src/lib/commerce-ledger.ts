import { createHash } from "crypto";
import type { OrderItem } from "@/lib/orders";
import { PRICE_BEAT_LICENCE } from "@/lib/catalogue-pricing";
import {
  getBeatLicenceTemplateOrDefault,
  licenceTermsVersionTag,
} from "@/lib/beat-licences";
import { resolveSellerMarketplacePolicy } from "@/lib/seller-marketplace-policy";

const SERVICE_PRICES: Record<string, number> = {
  "basic-mix": 89,
  "pro-mix": 149,
  "premium-mix": 199,
  "standard-master": 69,
  "premium-master": 99,
  "album-master": 299,
  "standard-bundle": 189,
  "premium-bundle": 249,
  "ultimate-bundle": 299,
  "vocal-comping-tuning": 65,
  "full-vocal-production": 129,
  "custom-bvs-service": 69,
};

type ServicePackageSnapshot = {
  code: string;
  name: string;
  description: string;
  priceUsd: number;
};

export type CommerceItem = OrderItem & {
  sku: string;
  sourceId: string;
  productType:
    | "single"
    | "mix"
    | "album"
    | "beat"
    | "creator_product"
    | "creator_service"
    | "service";
  unitAmount: number;
  currency: "usd";
  taxClass: "digital" | "service";
  fulfillmentType: "download" | "service";
  licenceOptionId?: string;
  licenceCode?: string;
  licenceTemplateVersion?: number;
  licenceTermsVersion?: string;
  licenceSummary?: string;
  licenceTerms?: string;
  servicePackageSnapshot?: ServicePackageSnapshot;
  sellerUserId?: string;
  sellerPlanId?: string;
  marketplaceCommissionBps?: number;
  marketplacePolicyVersion?: string;
};

const CURATED_SELLER_USERNAME: Record<string, string> = {
  "mix:3": "BasJunior",
};

async function resolveSellerUserId(
  productType: CommerceItem["productType"],
  sourceId: string,
  sku: string,
) {
  let url: string;
  let key: string;
  try {
    ({ url, key } = config());
  } catch {
    return undefined;
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const existingProduct = await fetch(
    `${url}/rest/v1/commerce_products?sku=eq.${encodeURIComponent(sku)}&seller_user_id=not.is.null&select=seller_user_id&limit=1`,
    { headers, cache: "no-store" },
  );
  if (existingProduct.ok) {
    const seller = (
      (await existingProduct.json()) as Array<{ seller_user_id?: string }>
    )[0]?.seller_user_id;
    if (seller) return seller;
  }

  const curatedUsername = CURATED_SELLER_USERNAME[sku];
  if (curatedUsername) {
    const response = await fetch(
      `${url}/rest/v1/profiles?username=ilike.${encodeURIComponent(curatedUsername)}&select=id&limit=1`,
      { headers, cache: "no-store" },
    );
    if (response.ok)
      return ((await response.json()) as Array<{ id: string }>)[0]?.id;
  }
  const table =
    productType === "beat"
      ? "beats"
      : productType === "single" || productType === "mix"
        ? "tracks"
        : null;
  const ownerColumn = productType === "beat" ? "producer_user_id" : "user_id";
  if (!table || !/^[0-9a-f-]{36}$/i.test(sourceId)) return undefined;
  const response = await fetch(
    `${url}/rest/v1/${table}?id=eq.${encodeURIComponent(sourceId)}&select=${ownerColumn}&limit=1`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) return undefined;
  return ((await response.json()) as Array<Record<string, string>>)[0]?.[
    ownerColumn
  ];
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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

type CreatorProductRow = {
  id: string;
  seller_user_id: string;
  title: string;
  price_usd: number | string;
  licence_summary?: string | null;
  licence_terms?: string | null;
  listing_type?: "digital_product" | "service";
  packages?: Array<Record<string, unknown>> | null;
};

async function fetchCreatorListing(
  id: string,
  listingType: "digital_product" | "service",
): Promise<CreatorProductRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  let url: string;
  let key: string;
  try {
    ({ url, key } = config());
  } catch {
    return null;
  }
  const response = await fetch(
    `${url}/rest/v1/creator_marketplace_listings?id=eq.${encodeURIComponent(id)}&listing_type=eq.${listingType}&status=eq.published&select=id,seller_user_id,title,price_usd,licence_summary,licence_terms,listing_type,packages&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );
  if (!response.ok) return null;
  return ((await response.json()) as CreatorProductRow[])[0] || null;
}

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

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const select =
    "id,beat_id,licence_code,price_usd,is_active,terms_version,terms_summary";

  if (licenceOptionId) {
    const byId = await fetch(
      `${url}/rest/v1/beat_licence_options?id=eq.${encodeURIComponent(licenceOptionId)}&select=${select}&limit=1`,
      { headers, cache: "no-store" },
    );
    if (byId.ok) {
      const rows = (await byId.json()) as BeatLicenceRow[];
      const row = rows?.[0];
      if (
        row &&
        String(row.beat_id) === String(beatId) &&
        row.is_active !== false
      )
        return row;
    }
  }

  const standard = await fetch(
    `${url}/rest/v1/beat_licence_options?beat_id=eq.${encodeURIComponent(beatId)}&licence_code=eq.standard_lease&is_active=eq.true&select=${select}&order=price_usd.asc&limit=1`,
    { headers, cache: "no-store" },
  );
  if (standard.ok) {
    const rows = (await standard.json()) as BeatLicenceRow[];
    if (rows?.[0]) return rows[0];
  }

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

function parsePriceUsd(
  value: number | string | null | undefined,
): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function resolveServicePackage(
  product: CreatorProductRow,
  requestedCode?: string,
): ServicePackageSnapshot | null {
  const packages = Array.isArray(product.packages) ? product.packages : [];
  if (!packages.length) {
    const price = parsePriceUsd(product.price_usd);
    if (price == null || price < 1) return null;
    return {
      code: "standard-1",
      name: "Standard",
      description: "",
      priceUsd: price,
    };
  }
  const normalized = packages.map((row, index) => {
    const name = String(row.name || `Package ${index + 1}`).trim();
    const code = String(row.code || `${slug(name) || "package"}-${index + 1}`).trim();
    const priceUsd = parsePriceUsd(row.priceUsd as number | string | null | undefined);
    return {
      code,
      name,
      description: String(row.description || "").trim().slice(0, 500),
      priceUsd,
    };
  });
  const selected = requestedCode
    ? normalized.find((row) => row.code === requestedCode)
    : normalized[0];
  if (!selected || selected.priceUsd == null || selected.priceUsd < 1) return null;
  return { ...selected, priceUsd: selected.priceUsd };
}

/** Resolve authoritative products, seller ownership and economic policy at checkout time. */
export async function resolveCommerceItems(
  items: OrderItem[],
): Promise<CommerceItem[]> {
  return Promise.all(
    items.map(async (item) => {
      const id = String(item.id);
      const key = slug(item.title);
      const quantity = Math.min(
        20,
        Math.max(1, Math.floor(Number(item.quantity) || 1)),
      );
      let productType: CommerceItem["productType"] = "single";
      let unitAmount = 2;
      let sku = `track:${id}`;
      let licenceOptionId: string | undefined =
        typeof item.licence_option_id === "string" &&
        item.licence_option_id.trim()
          ? item.licence_option_id.trim()
          : undefined;

      let licenceCode: string | undefined;
      let licenceTemplateVersion: number | undefined;
      let licenceTermsVersion: string | undefined;
      let licenceSummary: string | undefined;
      let licenceTerms: string | undefined;
      let servicePackageSnapshot: ServicePackageSnapshot | undefined;
      let authoritativeTitle = item.title;
      let authoritativeSellerUserId: string | undefined;

      if (item.type === "creator_product" || item.type === "creator_service") {
        const isService = item.type === "creator_service";
        const product = await fetchCreatorListing(
          id,
          isService ? "service" : "digital_product",
        );
        if (!product) throw new Error("UNKNOWN_CREATOR_PRODUCT");
        productType = isService ? "creator_service" : "creator_product";
        if (isService) {
          const selectedPackage = resolveServicePackage(
            product,
            item.service_package_code,
          );
          if (!selectedPackage) throw new Error("UNKNOWN_CREATOR_SERVICE_PACKAGE");
          servicePackageSnapshot = selectedPackage;
          unitAmount = selectedPackage.priceUsd;
          sku = `creator-service:${product.id}:${selectedPackage.code}`;
          authoritativeTitle = `${product.title} — ${selectedPackage.name}`;
        } else {
          const priced = parsePriceUsd(product.price_usd);
          if (priced == null || priced < 1)
            throw new Error("INVALID_CREATOR_PRODUCT_PRICE");
          unitAmount = priced;
          sku = `creator-product:${product.id}`;
          authoritativeTitle = product.title;
        }
        authoritativeSellerUserId = product.seller_user_id;
        licenceSummary =
          product.licence_summary?.trim() ||
          (isService
            ? "Creator service package"
            : "Licensed digital creator product");
        licenceTerms = product.licence_terms?.trim() || licenceSummary;
      } else if (id === "100" || key === "lord-album") {
        productType = "album";
        unitAmount = 19;
        sku = "album:lord";
      } else if (id === "101" || key === "album-16-bit") {
        productType = "album";
        unitAmount = 14;
        sku = "album:16-bit";
      } else if (item.type === "service") {
        if (SERVICE_PRICES[key] === undefined)
          throw new Error("UNKNOWN_SERVICE");
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
          (typeof licence?.terms_version === "string" &&
            licence.terms_version.trim()) ||
          licenceTermsVersionTag(template);
        licenceSummary =
          (typeof licence?.terms_summary === "string" &&
            licence.terms_summary.trim()) ||
          template.summary;
        licenceTerms = template.terms;
        sku = `beat:${id}:${code}${licenceOptionId ? `:${licenceOptionId}` : ""}:v${template.version}`;
      } else if (item.type === "mix") {
        productType = "mix";
        unitAmount = 4;
        sku = `mix:${id}`;
      }

      const sellerUserId =
        authoritativeSellerUserId ||
        (await resolveSellerUserId(productType, id, sku));
      const sellerPolicy = sellerUserId
        ? await resolveSellerMarketplacePolicy(
            sellerUserId,
            productType,
            unitAmount,
          )
        : undefined;

      return {
        ...item,
        title: authoritativeTitle,
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
        servicePackageSnapshot,
        sellerUserId,
        sellerPlanId: sellerPolicy?.planId,
        marketplaceCommissionBps: sellerPolicy?.commissionBps,
        marketplacePolicyVersion: sellerPolicy?.policyVersion,
        sku,
        sourceId: id,
        productType,
        unitAmount,
        currency: "usd" as const,
        taxClass:
          productType === "service" || productType === "creator_service"
            ? ("service" as const)
            : ("digital" as const),
        fulfillmentType:
          productType === "service" || productType === "creator_service"
            ? ("service" as const)
            : ("download" as const),
      };
    }),
  );
}

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`COMMERCE_LEDGER_FAILED:${response.status}`);
  return response.json() as Promise<T>;
}

export async function recordOrderSnapshot(
  reference: string,
  items: CommerceItem[],
) {
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
        servicePackageSnapshot,
        sellerUserId,
        sellerPlanId,
        marketplaceCommissionBps,
        marketplacePolicyVersion,
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
        licenceOptionId: licenceOptionId ?? null,
        licenceCode: licenceCode ?? null,
        licenceTemplateVersion: licenceTemplateVersion ?? null,
        licenceTermsVersion: licenceTermsVersion ?? null,
        licenceSummary: licenceSummary ?? null,
        licenceTerms: licenceTerms ?? null,
        servicePackageSnapshot: servicePackageSnapshot ?? null,
        sellerUserId: sellerUserId ?? null,
        sellerPlanId: sellerPlanId ?? null,
        marketplaceCommissionBps: marketplaceCommissionBps ?? null,
        marketplacePolicyVersion: marketplacePolicyVersion ?? null,
      }),
    ),
  });
}

export type PaymentTransition = {
  accepted: boolean;
  duplicate?: boolean;
  transitioned?: boolean;
  reconciled?: boolean;
  error?: string;
  eventId?: string;
};

export async function recordVerifiedPayment(input: {
  provider: "stripe" | "paynow";
  eventId: string;
  reference: string;
  eventType: string;
  status: string;
  amount: number;
  currency: string;
  providerReference: string;
  rawPayload: string;
}) {
  return rpc<PaymentTransition>("record_verified_payment_event", {
    p_provider: input.provider,
    p_provider_event_id: input.eventId,
    p_order_reference: input.reference,
    p_event_type: input.eventType,
    p_provider_status: input.status,
    p_amount: input.amount,
    p_currency: input.currency.toLowerCase(),
    p_provider_reference: input.providerReference,
    p_payload_sha256: createHash("sha256")
      .update(input.rawPayload)
      .digest("hex"),
  });
}
