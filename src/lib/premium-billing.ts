import "server-only";
import { entitlementsForPlan } from "@/lib/premium-catalog";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

/** Founding cohort hard cap (financial plan). */
export const ARTIST_FOUNDING_SEAT_CAP = Number(process.env.BVS_FOUNDING_SEAT_CAP || 50);

export type ArtistPremiumPlanId = "artist_founding" | "artist_standard";
export type BillingInterval = "month" | "year";

export function normalizeArtistPlanId(raw?: string | null): ArtistPremiumPlanId {
  const v = String(raw || "").toLowerCase();
  if (v === "standard" || v === "artist_standard") return "artist_standard";
  return "artist_founding";
}

export function normalizeInterval(raw?: string | null): BillingInterval {
  return String(raw || "").toLowerCase() === "year" ? "year" : "month";
}

export function artistPremiumPriceUsd(planId: ArtistPremiumPlanId, interval: BillingInterval): number {
  if (planId === "artist_standard") return interval === "year" ? 120 : 12;
  return interval === "year" ? 90 : 9;
}

export function artistPremiumSku(planId: ArtistPremiumPlanId, interval: BillingInterval): string {
  return `premium:${planId}:${interval}`;
}

export function periodEndIso(interval: BillingInterval, from = new Date()): string {
  const d = new Date(from);
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export function premiumReference(): string {
  return `BVS-PREM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

async function restGet<T>(path: string): Promise<T | null> {
  if (!url || !service) return null;
  const res = await fetch(`${url}/rest/v1/${path}`, { headers, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function restPatch(path: string, body: unknown) {
  if (!url || !service) return { ok: false as const };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status };
}

async function restPost(path: string, body: unknown, prefer = "return=representation") {
  if (!url || !service) return { ok: false as const, data: null as unknown };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...headers, Prefer: prefer },
    body: JSON.stringify(body),
  });
  const data = res.ok ? await res.json().catch(() => null) : null;
  return { ok: res.ok, status: res.status, data };
}

export async function getFoundingSeatsUsed(): Promise<number> {
  const rows = await restGet<Array<{ value: number }>>(
    "bvs_membership_counters?key=eq.artist_founding_seats_used&select=value&limit=1",
  );
  if (rows?.[0]?.value != null) return Number(rows[0].value) || 0;
  // Fallback: count founding memberships
  const mem = await restGet<Array<{ id: string }>>(
    "bvs_memberships?founding_seat=eq.true&status=in.(active,trialing)&select=id",
  );
  return mem?.length || 0;
}

export async function foundingSeatsAvailable(): Promise<{ used: number; cap: number; available: boolean }> {
  const used = await getFoundingSeatsUsed();
  return { used, cap: ARTIST_FOUNDING_SEAT_CAP, available: used < ARTIST_FOUNDING_SEAT_CAP };
}

export async function resolveCheckoutPlan(
  requested: ArtistPremiumPlanId,
): Promise<{ planId: ArtistPremiumPlanId; founding: Awaited<ReturnType<typeof foundingSeatsAvailable>>; reason?: string }> {
  const founding = await foundingSeatsAvailable();
  if (requested === "artist_founding" && !founding.available) {
    return {
      planId: "artist_standard",
      founding,
      reason: `Founding seats full (${founding.used}/${founding.cap}). Offering Standard Artist Premium.`,
    };
  }
  return { planId: requested, founding };
}

export async function activatePaidArtistPremium(input: {
  userId: string;
  planId: ArtistPremiumPlanId;
  interval: BillingInterval;
  reference: string;
  amountUsd: number;
  provider?: string;
}): Promise<{ ok: boolean; reason?: string; endsAt?: string }> {
  if (!url || !service) return { ok: false, reason: "not_configured" };
  if (!input.userId) return { ok: false, reason: "missing_user" };

  const endsAt = periodEndIso(input.interval);
  const ents = entitlementsForPlan(input.planId);
  const foundingSeat = input.planId === "artist_founding";

  // Idempotent: already active on this provider_ref
  const existing = await restGet<Array<{ id: string; status: string }>>(
    `bvs_memberships?provider_ref=eq.${encodeURIComponent(input.reference)}&select=id,status&limit=1`,
  );
  if (existing?.[0]?.status === "active") {
    return { ok: true, reason: "idempotent", endsAt };
  }

  const profilePatch = await restPatch(`profiles?id=eq.${input.userId}`, {
    premium_active: true,
    premium_until: endsAt,
    distribution_enabled: true,
    premium_plan_id: input.planId,
    role: "artist",
  });
  if (!profilePatch.ok) return { ok: false, reason: "profile_patch_failed" };

  // Cancel other active artist memberships for this user (period replaced)
  await restPatch(
    `bvs_memberships?user_id=eq.${input.userId}&family=eq.artist&status=in.(active,trialing,shell)`,
    { status: "canceled", cancel_at: new Date().toISOString(), notes: `Superseded by ${input.reference}` },
  );

  const mem = await restPost("bvs_memberships", {
    user_id: input.userId,
    plan_id: input.planId,
    family: "artist",
    status: "active",
    billing_interval: input.interval,
    starts_at: new Date().toISOString(),
    ends_at: endsAt,
    founding_seat: foundingSeat,
    entitlements: ents,
    provider: input.provider || "paynow",
    provider_ref: input.reference,
    notes: `Paid Artist Premium ${input.planId} ${input.interval} · US$${input.amountUsd} · ${input.reference}`,
  });
  if (!mem.ok) {
    // Profile already on; membership row best-effort
    console.error("premium membership insert failed", mem.status);
  }

  if (foundingSeat) {
    const used = await getFoundingSeatsUsed();
    // Only bump if this payment is new founding (not already counted via membership)
    const countRows = await restGet<Array<{ value: number }>>(
      "bvs_membership_counters?key=eq.artist_founding_seats_used&select=value&limit=1",
    );
    if (countRows?.[0]) {
      await restPatch("bvs_membership_counters?key=eq.artist_founding_seats_used", {
        value: Math.max(used, Number(countRows[0].value) || 0) + (existing?.[0] ? 0 : 1),
        updated_at: new Date().toISOString(),
      });
    } else {
      await restPost(
        "bvs_membership_counters",
        { key: "artist_founding_seats_used", value: used + 1, updated_at: new Date().toISOString() },
        "resolution=merge-duplicates,return=minimal",
      );
    }
  }

  return { ok: true, endsAt };
}

export async function cancelArtistPremium(userId: string, mode: "period_end" | "immediate" = "period_end") {
  if (!url || !service) return { ok: false, reason: "not_configured" };

  const mems = await restGet<
    Array<{ id: string; ends_at: string | null; plan_id: string; status: string }>
  >(
    `bvs_memberships?user_id=eq.${userId}&family=eq.artist&status=in.(active,trialing,shell)&order=starts_at.desc&select=id,ends_at,plan_id,status`,
  );
  const active = mems?.[0];
  const now = new Date().toISOString();

  if (mode === "immediate") {
    await restPatch(`profiles?id=eq.${userId}`, {
      premium_active: false,
      premium_until: null,
      distribution_enabled: false,
      premium_plan_id: null,
    });
    if (active) {
      await restPatch(`bvs_memberships?id=eq.${active.id}`, {
        status: "canceled",
        cancel_at: now,
        ends_at: now,
        notes: "Canceled immediately by user",
      });
    }
    return { ok: true, mode, endsAt: now };
  }

  // period_end: keep access until ends_at
  const endsAt = active?.ends_at || now;
  if (active) {
    await restPatch(`bvs_memberships?id=eq.${active.id}`, {
      cancel_at: now,
      notes: "Cancel at period end requested",
    });
  }
  // Keep premium_active until ends_at; cron/ops can expire later. Soft-mark cancel on profile notes via plan id keep.
  return { ok: true, mode, endsAt, planId: active?.plan_id || null };
}

export async function getArtistPremiumStatus(userId: string) {
  const profileRows = await restGet<
    Array<{
      premium_active?: boolean;
      premium_until?: string | null;
      distribution_enabled?: boolean;
      premium_plan_id?: string | null;
    }>
  >(
    `profiles?id=eq.${userId}&select=premium_active,premium_until,distribution_enabled,premium_plan_id&limit=1`,
  );
  const profile = profileRows?.[0] || {};
  const mems = await restGet<
    Array<{
      id: string;
      plan_id: string;
      status: string;
      billing_interval: string | null;
      ends_at: string | null;
      cancel_at: string | null;
      founding_seat: boolean;
      provider: string | null;
      provider_ref: string | null;
    }>
  >(
    `bvs_memberships?user_id=eq.${userId}&family=eq.artist&status=in.(active,trialing,shell)&order=starts_at.desc&select=*&limit=3`,
  );
  const membership = mems?.[0] || null;
  const founding = await foundingSeatsAvailable();
  const until = membership?.ends_at || profile.premium_until || null;
  const stillValid = Boolean(profile.premium_active) && (!until || new Date(until).getTime() > Date.now());

  return {
    premiumActive: stillValid,
    premiumUntil: until,
    distributionEnabled: Boolean(profile.distribution_enabled) && stillValid,
    planId: membership?.plan_id || profile.premium_plan_id || null,
    billingInterval: membership?.billing_interval || null,
    cancelAt: membership?.cancel_at || null,
    membershipStatus: membership?.status || (stillValid ? "profile_flag" : "none"),
    provider: membership?.provider || null,
    providerRef: membership?.provider_ref || null,
    foundingSeat: Boolean(membership?.founding_seat),
    founding,
  };
}

/** Detect premium order line items from checkout items. */
export function parsePremiumOrderItem(items: Array<{ type?: string; id?: string | number; title?: string; price?: number; quantity?: number }>) {
  for (const item of items || []) {
    const type = String(item.type || "").toLowerCase();
    const id = String(item.id || "");
    if (type === "artist_premium" || id.startsWith("premium:") || id.startsWith("artist_premium")) {
      const sku = id.includes(":") ? id : String(item.title || "");
      let planId: ArtistPremiumPlanId = "artist_founding";
      let interval: BillingInterval = "month";
      if (sku.includes("standard")) planId = "artist_standard";
      if (sku.includes("year")) interval = "year";
      // parse premium:artist_founding:month
      const parts = id.split(":");
      if (parts[0] === "premium" && parts[1]) planId = normalizeArtistPlanId(parts[1]);
      if (parts[2]) interval = normalizeInterval(parts[2]);
      const amount = (Number(item.price) || 0) * (Number(item.quantity) || 1);
      return { planId, interval, amount };
    }
  }
  return null;
}
