import "server-only";

import { entitlementsForPlan } from "@/lib/premium-catalog";
import {
  servicePremiumPeriodEndIso,
  type ServiceBillingInterval,
  type ServicePremiumPlanId,
} from "@/lib/service-premium-plans";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

async function restGet<T>(path: string): Promise<T | null> {
  if (!url || !service) return null;
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function restPatch(path: string, body: unknown) {
  if (!url || !service) return { ok: false as const };
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status };
}

async function restPost(path: string, body: unknown) {
  if (!url || !service) return { ok: false as const };
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  return { ok: response.ok, status: response.status };
}

export async function activatePaidServicePremium(input: {
  userId: string;
  planId: ServicePremiumPlanId;
  interval: ServiceBillingInterval;
  reference: string;
  amountUsd: number;
  provider: "stripe" | "paynow";
  endsAt?: string;
}) {
  if (!url || !service) return { ok: false as const, reason: "not_configured" };
  if (!input.userId) return { ok: false as const, reason: "missing_user" };

  const endsAt = input.endsAt || servicePremiumPeriodEndIso(input.interval);
  const entitlements = entitlementsForPlan(input.planId);
  const existing = await restGet<Array<{ id: string; status: string }>>(
    `bvs_memberships?provider=eq.${input.provider}&provider_ref=eq.${encodeURIComponent(input.reference)}&user_id=eq.${input.userId}&select=id,status&limit=1`,
  );

  if (existing?.[0]) {
    const patch = await restPatch(`bvs_memberships?id=eq.${existing[0].id}`, {
      plan_id: input.planId,
      family: "service",
      status: "active",
      billing_interval: input.interval,
      ends_at: endsAt,
      cancel_at: null,
      entitlements,
      notes: `Paid service membership ${input.planId} ${input.interval} · US$${input.amountUsd}`,
      updated_at: new Date().toISOString(),
    });
    return patch.ok
      ? { ok: true as const, reason: "synchronized", endsAt }
      : { ok: false as const, reason: "membership_patch_failed" };
  }

  await restPatch(
    `bvs_memberships?user_id=eq.${input.userId}&family=eq.service&status=in.(active,trialing,shell)`,
    {
      status: "canceled",
      cancel_at: new Date().toISOString(),
      notes: `Superseded by ${input.reference}`,
      updated_at: new Date().toISOString(),
    },
  );

  const created = await restPost("bvs_memberships", {
    user_id: input.userId,
    plan_id: input.planId,
    family: "service",
    status: "active",
    billing_interval: input.interval,
    starts_at: new Date().toISOString(),
    ends_at: endsAt,
    founding_seat: false,
    entitlements,
    provider: input.provider,
    provider_ref: input.reference,
    notes: `Paid service membership ${input.planId} ${input.interval} · US$${input.amountUsd}`,
  });
  if (!created.ok)
    return { ok: false as const, reason: "membership_insert_failed" };
  return { ok: true as const, endsAt };
}

export async function deactivateStripeServicePremium(
  subscriptionId: string,
  userId: string,
) {
  const rows = await restGet<Array<{ id: string }>>(
    `bvs_memberships?provider=eq.stripe&provider_ref=eq.${encodeURIComponent(subscriptionId)}&user_id=eq.${userId}&family=eq.service&select=id&limit=1`,
  );
  const membership = rows?.[0];
  if (!membership) return { ok: true as const, reason: "not_linked" };
  const now = new Date().toISOString();
  const patch = await restPatch(`bvs_memberships?id=eq.${membership.id}`, {
    status: "canceled",
    cancel_at: now,
    ends_at: now,
    updated_at: now,
  });
  return patch.ok
    ? { ok: true as const }
    : { ok: false as const, reason: "membership_patch_failed" };
}

export async function getServicePremiumStatus(userId: string) {
  const rows = await restGet<
    Array<{
      id: string;
      plan_id: string;
      status: string;
      billing_interval: string | null;
      ends_at: string | null;
      cancel_at: string | null;
      provider: string | null;
      provider_ref: string | null;
      entitlements: Record<string, unknown> | null;
    }>
  >(
    `bvs_memberships?user_id=eq.${userId}&family=eq.service&status=in.(active,trialing,shell)&order=starts_at.desc&select=*&limit=3`,
  );
  const membership = rows?.[0] || null;
  const valid =
    Boolean(membership) &&
    (!membership?.ends_at || new Date(membership.ends_at).getTime() > Date.now());
  return {
    active: valid,
    planId: valid ? membership?.plan_id || null : null,
    billingInterval: membership?.billing_interval || null,
    endsAt: membership?.ends_at || null,
    cancelAt: membership?.cancel_at || null,
    provider: membership?.provider || null,
    providerRef: membership?.provider_ref || null,
    entitlements: membership?.entitlements || {},
  };
}
