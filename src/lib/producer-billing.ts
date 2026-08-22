import { entitlementsForPlan } from "./premium-catalog";

export type ProducerPaidPlanId = "producer_plus" | "producer_pro";
export type ProducerBillingInterval = "month" | "year";

export const PRODUCER_BILLING_POLICY_VERSION = "2026-08-08-v1";

export function normalizeProducerPlanId(raw?: string | null): ProducerPaidPlanId {
  return String(raw || "").toLowerCase() === "producer_pro" ||
    String(raw || "").toLowerCase() === "pro"
    ? "producer_pro"
    : "producer_plus";
}

export function normalizeProducerInterval(raw?: string | null): ProducerBillingInterval {
  return String(raw || "").toLowerCase() === "year" ? "year" : "month";
}

export function producerPremiumPriceUsd(
  planId: ProducerPaidPlanId,
  interval: ProducerBillingInterval,
): number {
  if (planId === "producer_pro") return interval === "year" ? 100 : 10;
  return interval === "year" ? 50 : 5;
}

export function producerPlanEntitlements(planId: string): Record<string, unknown> {
  const normalized = String(planId || "").toLowerCase();
  if (normalized === "creator_complete") return entitlementsForPlan("producer_pro");
  if (normalized === "producer_pro" || normalized === "pro") {
    return entitlementsForPlan("producer_pro");
  }
  if (normalized === "producer_plus" || normalized === "plus") {
    return entitlementsForPlan("producer_plus");
  }
  return entitlementsForPlan("producer_free");
}

export function producerBillingGuard(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  reason?: "flag_off" | "not_beta" | "stripe_not_test" | "missing_webhook" | "missing_backend";
} {
  if (env.BVS_ENABLE_BETA_PRODUCER_STRIPE !== "1") return { ok: false, reason: "flag_off" };
  if (
    String(env.BVS_ENV_LANE || "").toLowerCase() !== "staging" ||
    !String(env.NEXT_PUBLIC_SITE_URL || "").includes("bvsradio-beta.vercel.app")
  ) {
    return { ok: false, reason: "not_beta" };
  }
  if (!String(env.STRIPE_SECRET_KEY || "").startsWith("sk_test_")) {
    return { ok: false, reason: "stripe_not_test" };
  }
  if (!String(env.STRIPE_WEBHOOK_SECRET || "").startsWith("whsec_")) {
    return { ok: false, reason: "missing_webhook" };
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, reason: "missing_backend" };
  }
  return { ok: true };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

async function restGet<T>(path: string): Promise<T | null> {
  if (!url || !service) return null;
  const response = await fetch(`${url}/rest/v1/${path}`, { headers, cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function restPatch(path: string, body: unknown) {
  if (!url || !service) return false;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

async function restPost(path: string, body: unknown) {
  if (!url || !service) return false;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return response.ok;
}

export function hasActiveStripeProducerMembership(rows?: Array<{ id?: string }> | null): boolean {
  return Boolean(rows?.some((row) => row.id));
}

export async function hasActiveStripeProducerSubscription(userId: string): Promise<boolean | null> {
  if (!url || !service || !userId) return null;
  const rows = await restGet<Array<{ id: string }>>(
    `bvs_memberships?user_id=eq.${encodeURIComponent(userId)}&family=eq.producer&provider=eq.stripe&status=in.(active,trialing,shell)&select=id&limit=1`,
  );
  if (rows === null) return null;
  return hasActiveStripeProducerMembership(rows);
}

function periodEndIso(interval: ProducerBillingInterval, from = new Date()) {
  const end = new Date(from);
  if (interval === "year") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end.toISOString();
}

async function applyProducerProfile(userId: string, planId: string) {
  const entitlements = producerPlanEntitlements(planId);
  return restPatch(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    is_producer: true,
    beatstore_tier: entitlements.beatstore_tier,
    beat_live_limit: entitlements.beat_live_limit,
    marketplace_commission_bps: entitlements.marketplace_commission_bps,
  });
}

export async function activatePaidProducerPremium(input: {
  userId: string;
  planId: ProducerPaidPlanId;
  interval: ProducerBillingInterval;
  reference: string;
  amountUsd: number;
  endsAt?: string;
}): Promise<{ ok: boolean; reason?: string; endsAt?: string }> {
  if (!url || !service) return { ok: false, reason: "not_configured" };
  if (!input.userId || !input.reference) return { ok: false, reason: "missing_identity" };

  const planId = normalizeProducerPlanId(input.planId);
  const interval = normalizeProducerInterval(input.interval);
  const endsAt = input.endsAt || periodEndIso(interval);
  const now = new Date().toISOString();
  const existing = await restGet<Array<{ id: string; status: string }>>(
    `bvs_memberships?provider=eq.stripe&provider_ref=eq.${encodeURIComponent(input.reference)}&user_id=eq.${encodeURIComponent(input.userId)}&select=id,status&limit=1`,
  );

  if (existing?.[0]) {
    const membershipOk = await restPatch(`bvs_memberships?id=eq.${existing[0].id}`, {
      plan_id: planId,
      status: "active",
      billing_interval: interval,
      ends_at: endsAt,
      cancel_at: null,
      entitlements: producerPlanEntitlements(planId),
      updated_at: now,
    });
    const profileOk = await applyProducerProfile(input.userId, planId);
    return { ok: membershipOk && profileOk, reason: "synchronized", endsAt };
  }

  await restPatch(
    `bvs_memberships?user_id=eq.${encodeURIComponent(input.userId)}&family=eq.producer&status=in.(active,trialing,shell)`,
    { status: "canceled", cancel_at: now, ends_at: now, notes: `Superseded by ${input.reference}` },
  );

  const profileOk = await applyProducerProfile(input.userId, planId);
  if (!profileOk) return { ok: false, reason: "profile_patch_failed" };

  const membershipOk = await restPost("bvs_memberships", {
    user_id: input.userId,
    plan_id: planId,
    family: "producer",
    status: "active",
    billing_interval: interval,
    starts_at: now,
    ends_at: endsAt,
    founding_seat: false,
    entitlements: producerPlanEntitlements(planId),
    provider: "stripe",
    provider_ref: input.reference,
    notes: `Beta Stripe-test Producer Premium ${planId} ${interval} · US$${input.amountUsd} · ${PRODUCER_BILLING_POLICY_VERSION}`,
  });
  return { ok: membershipOk, endsAt };
}

export async function deactivateStripeProducerPremium(subscriptionId: string, userId: string) {
  if (!url || !service) return { ok: false, reason: "not_configured" };
  const rows = await restGet<Array<{ id: string }>>(
    `bvs_memberships?provider=eq.stripe&provider_ref=eq.${encodeURIComponent(subscriptionId)}&user_id=eq.${encodeURIComponent(userId)}&family=eq.producer&select=id&limit=1`,
  );
  if (rows?.[0]) {
    const now = new Date().toISOString();
    await restPatch(`bvs_memberships?id=eq.${rows[0].id}`, {
      status: "canceled",
      cancel_at: now,
      ends_at: now,
      updated_at: now,
    });
  }

  const remaining = await restGet<Array<{ plan_id: string; entitlements?: Record<string, unknown> }>>(
    `bvs_memberships?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing,shell)&family=in.(producer,creator_bundle)&order=starts_at.desc&select=plan_id,entitlements&limit=1`,
  );
  const fallback = remaining?.[0];
  if (fallback?.plan_id) {
    const entitlements = {
      ...producerPlanEntitlements(fallback.plan_id),
      ...(fallback.entitlements || {}),
    };
    const ok = await restPatch(`profiles?id=eq.${encodeURIComponent(userId)}`, {
      beatstore_tier: entitlements.beatstore_tier || "free",
      beat_live_limit: entitlements.beat_live_limit ?? null,
      marketplace_commission_bps: entitlements.marketplace_commission_bps ?? 1500,
    });
    return { ok, reason: "fallback_membership" };
  }

  const ok = await restPatch(`profiles?id=eq.${encodeURIComponent(userId)}`, {
    beatstore_tier: "free",
    beat_live_limit: 25,
    marketplace_commission_bps: 1500,
  });
  return { ok, reason: rows?.[0] ? "producer_free" : "not_linked" };
}
