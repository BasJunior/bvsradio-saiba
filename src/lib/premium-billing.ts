import "server-only";
import {
  entitlementsForPlan,
  FOUNDING_WINDOW_ENDS_AT_ISO,
  FOUNDING_WINDOW_LABEL,
  isFoundingWindowOpen,
} from "@/lib/premium-catalog";
import { getStripe } from "@/lib/stripe";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

/** Founding cohort hard cap (financial plan). */
export const ARTIST_FOUNDING_SEAT_CAP = Number(process.env.BVS_FOUNDING_SEAT_CAP || 50);

export type ArtistPremiumPlanId = "artist_instant" | "artist_founding" | "artist_standard";
export type BillingInterval = "month" | "year";

export function normalizeArtistPlanId(raw?: string | null): ArtistPremiumPlanId {
  const v = String(raw || "").toLowerCase();
  if (v === "instant" || v === "starter" || v === "artist_instant") return "artist_instant";
  if (v === "standard" || v === "artist_standard") return "artist_standard";
  return "artist_founding";
}

export function normalizeInterval(raw?: string | null): BillingInterval {
  return String(raw || "").toLowerCase() === "year" ? "year" : "month";
}

export function artistPremiumPriceUsd(planId: ArtistPremiumPlanId, interval: BillingInterval): number {
  if (planId === "artist_instant") return interval === "year" ? 60 : 5.99;
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

export type FoundingEligibility = {
  eligible: boolean;
  reason: string;
  label: string;
  endsAt: string;
  used: number;
  cap: number;
  /** @deprecated Prefer `eligible` — kept for older desk UI. */
  available: boolean;
};

/**
 * Canonical Founding Artist gate: calendar window AND seat cap.
 * Public copy and checkout must both use this (or the pure date helpers in premium-catalog).
 */
export async function foundingEligibility(at: Date = new Date()): Promise<FoundingEligibility> {
  const used = await getFoundingSeatsUsed();
  const cap = ARTIST_FOUNDING_SEAT_CAP;
  const endsAt = FOUNDING_WINDOW_ENDS_AT_ISO;
  const label = FOUNDING_WINDOW_LABEL;
  const windowOpen = isFoundingWindowOpen(at);
  const seatsOpen = used < cap;

  if (!windowOpen) {
    return {
      eligible: false,
      available: false,
      reason: `Founding window ended ${label}.`,
      label,
      endsAt,
      used,
      cap,
    };
  }
  if (!seatsOpen) {
    return {
      eligible: false,
      available: false,
      reason: `Founding seats full (${used}/${cap}).`,
      label,
      endsAt,
      used,
      cap,
    };
  }
  return {
    eligible: true,
    available: true,
    reason: `Founding available until ${label} · ${used}/${cap} seats used.`,
    label,
    endsAt,
    used,
    cap,
  };
}

/** @deprecated Use foundingEligibility() */
export async function foundingSeatsAvailable(): Promise<FoundingEligibility> {
  return foundingEligibility();
}

export async function resolveCheckoutPlan(
  requested: ArtistPremiumPlanId,
): Promise<{ planId: ArtistPremiumPlanId; founding: FoundingEligibility; reason?: string }> {
  const founding = await foundingEligibility();
  if (requested === "artist_founding" && !founding.eligible) {
    return {
      planId: "artist_standard",
      founding,
      reason: `${founding.reason} Offering full Premium.`,
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
  endsAt?: string;
}): Promise<{ ok: boolean; reason?: string; endsAt?: string }> {
  if (!url || !service) return { ok: false, reason: "not_configured" };
  if (!input.userId) return { ok: false, reason: "missing_user" };

  const endsAt = input.endsAt || periodEndIso(input.interval);
  const ents = entitlementsForPlan(input.planId);
  const foundingSeat = input.planId === "artist_founding";

  // Idempotent: already active on this provider_ref
  const existing = await restGet<Array<{ id: string; status: string }>>(
    `bvs_memberships?provider_ref=eq.${encodeURIComponent(input.reference)}&select=id,status&limit=1`,
  );
  if (existing?.[0]?.status === "active") {
    await restPatch(`bvs_memberships?id=eq.${existing[0].id}`, { ends_at: endsAt, updated_at: new Date().toISOString() });
    await restPatch(`profiles?id=eq.${input.userId}`, {
      premium_active: true,
      premium_until: endsAt,
      distribution_enabled: true,
      premium_plan_id: input.planId,
    });
    // Best-effort: unlock multi-platform queue for already-published BVS releases.
    await syncPremiumDistributionJobsForArtist(input.userId).catch(() => undefined);
    return { ok: true, reason: "idempotent", endsAt };
  }

  if (existing?.[0] && existing[0].status !== "active") {
    await restPatch(`bvs_memberships?id=eq.${existing[0].id}`, {
      status: "active",
      ends_at: endsAt,
      cancel_at: null,
      updated_at: new Date().toISOString(),
    });
    await restPatch(`profiles?id=eq.${input.userId}`, {
      premium_active: true,
      premium_until: endsAt,
      distribution_enabled: true,
      premium_plan_id: input.planId,
    });
    await syncPremiumDistributionJobsForArtist(input.userId).catch(() => undefined);
    return { ok: true, reason: "reactivated", endsAt };
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

  // Premium ON → flip published BVS releases into multi-platform eligible (Amuse pilot path).
  await syncPremiumDistributionJobsForArtist(input.userId).catch(() => undefined);

  return { ok: true, endsAt };
}

/**
 * When Artist Premium activates, published BVS releases become multi-platform eligible.
 * Internal partner code is amuse_pilot; public UI never names Amuse.
 * Does not downgrade jobs already past eligible (queued/submitted/live).
 */
export async function syncPremiumDistributionJobsForArtist(userId: string): Promise<{
  ok: boolean;
  created: number;
  upgraded: number;
}> {
  if (!url || !service || !userId) return { ok: false, created: 0, upgraded: 0 };
  const {
    PRIVATE_DSP_PARTNER_AMUSE,
    partnerHandoffNotes,
  } = await import("@/lib/distribution-path");

  const { releasePackagingReady } = await import("@/lib/distribution-readiness");
  const published = await restGet<
    Array<{ id: string; editorial_status?: string; is_public?: boolean }>
  >(
    `releases?user_id=eq.${encodeURIComponent(userId)}&is_public=eq.true&editorial_status=eq.approved&select=id,editorial_status,is_public&limit=200`,
  );
  if (published === null) return { ok: false, created: 0, upgraded: 0 };
  const releases = published;
  if (!releases.length) return { ok: true, created: 0, upgraded: 0 };

  const existing = await restGet<
    Array<{ id: string; release_id: string; status?: string }>
  >(
    `distribution_jobs?artist_user_id=eq.${encodeURIComponent(userId)}&select=id,release_id,status&limit=200`,
  );
  if (existing === null) return { ok: false, created: 0, upgraded: 0 };
  const byRelease = new Map(existing.map((row) => [row.release_id, row]));
  const terminalOrProgress = new Set(["queued", "submitted", "live_on_dsp", "failed", "cancelled"]);
  const now = new Date().toISOString();
  let created = 0;
  let upgraded = 0;

  for (const release of releases) {
    const pack = await releasePackagingReady(release.id);
    const status = pack.ready ? "eligible" : "not_eligible";
    const notes = pack.ready
      ? partnerHandoffNotes("eligible")
      : `${partnerHandoffNotes("not_eligible")} ${pack.detail}`;
    const job = byRelease.get(release.id);
    if (!job) {
      const post = await restPost("distribution_jobs", {
        release_id: release.id,
        artist_user_id: userId,
        status,
        distributor: pack.ready ? PRIVATE_DSP_PARTNER_AMUSE : null,
        notes,
      });
      if (post.ok) created += 1;
      continue;
    }
    if (terminalOrProgress.has(String(job.status || ""))) continue;
    const patch = await restPatch(`distribution_jobs?id=eq.${job.id}`, {
      status,
      distributor: pack.ready ? PRIVATE_DSP_PARTNER_AMUSE : null,
      notes,
      updated_at: now,
    });
    if (patch.ok) upgraded += 1;
  }

  return { ok: true, created, upgraded };
}

export async function deactivateStripeArtistPremium(subscriptionId: string, userId: string) {
  const memberships = await restGet<Array<{ id: string; status: string }>>(
    `bvs_memberships?provider=eq.stripe&provider_ref=eq.${encodeURIComponent(subscriptionId)}&user_id=eq.${userId}&select=id,status&limit=1`,
  );
  const membership = memberships?.[0];
  if (!membership) return { ok: true, reason: "not_linked" };
  const now = new Date().toISOString();
  const membershipPatch = await restPatch(`bvs_memberships?id=eq.${membership.id}`, {
    status: "canceled",
    cancel_at: now,
    ends_at: now,
    updated_at: now,
  });
  const profilePatch = await restPatch(`profiles?id=eq.${userId}`, {
    premium_active: false,
    premium_until: null,
    distribution_enabled: false,
    premium_plan_id: null,
  });
  return { ok: membershipPatch.ok && profilePatch.ok };
}

export type DistributionJobSummary = {
  id: string;
  release_id: string | null;
  status: string;
  notes?: string | null;
};

const LIVE_DSP_STATUS = "live_on_dsp";
/** Non-live jobs that should stop progressing when Premium ends immediately. */
const CANCELABLE_DISTRO_STATUSES = new Set([
  "eligible",
  "not_eligible",
  "queued",
  "submitted",
  "pending",
  "draft",
  "failed",
]);

export async function listArtistDistributionJobs(userId: string): Promise<DistributionJobSummary[]> {
  const rows = await restGet<
    Array<{ id: string; release_id: string | null; status: string; notes?: string | null }>
  >(
    `distribution_jobs?artist_user_id=eq.${userId}&select=id,release_id,status,notes&order=updated_at.desc&limit=200`,
  );
  return rows || [];
}

export function premiumCancelConsequences(jobs: DistributionJobSummary[]) {
  const byStatus: Record<string, number> = {};
  for (const j of jobs) {
    const s = String(j.status || "unknown");
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  const liveCount = jobs.filter((j) => j.status === LIVE_DSP_STATUS).length;
  const cancelable = jobs.filter((j) => CANCELABLE_DISTRO_STATUSES.has(String(j.status))).length;
  return {
    totalJobs: jobs.length,
    byStatus,
    period_end: {
      distribution: "Access and distribution_enabled stay on until paid-through date. No jobs are canceled now.",
      liveOnDsp: liveCount
        ? `${liveCount} live_on_dsp job(s) remain live; partner ops handle post-period removals separately.`
        : "No live_on_dsp jobs.",
      queuedOrSubmitted: "Queued/submitted jobs keep processing while the period is still active.",
    },
    immediate: {
      distribution: "premium_active and distribution_enabled turn off immediately.",
      nonLiveJobs: cancelable
        ? `${cancelable} non-live job(s) will be set to cancelled and will not be submitted/advanced.`
        : "No non-live jobs to cancel.",
      liveOnDsp: liveCount
        ? `${liveCount} live_on_dsp job(s) stay live_on_dsp with a cancellation note — takedown is a separate partner workflow.`
        : "No live_on_dsp jobs.",
    },
  };
}

async function auditDistributionCancel(
  userId: string,
  details: Record<string, unknown>,
) {
  await restPost("editorial_audit_log", {
    actor_id: userId,
    action: "artist_premium_cancel_distribution",
    entity_type: "profile",
    entity_id: userId,
    details,
  });
}

async function applyImmediateDistributionLifecycle(userId: string, jobs: DistributionJobSummary[]) {
  const now = new Date().toISOString();
  const canceledIds: string[] = [];
  const liveNotedIds: string[] = [];

  for (const job of jobs) {
    const status = String(job.status || "");
    if (status === LIVE_DSP_STATUS) {
      const note =
        `${job.notes ? `${job.notes} · ` : ""}Artist Premium canceled immediately ${now}; live listing retained pending partner takedown policy.`;
      const patch = await restPatch(`distribution_jobs?id=eq.${job.id}`, {
        notes: note.slice(0, 2000),
        updated_at: now,
      });
      if (patch.ok) liveNotedIds.push(job.id);
      continue;
    }
    if (status === "cancelled" || status === "canceled") continue;
    if (!CANCELABLE_DISTRO_STATUSES.has(status) && status !== "") {
      // Unknown statuses: still cancel non-live work so nothing keeps advancing.
    }
    if (status === LIVE_DSP_STATUS) continue;
    const note =
      `${job.notes ? `${job.notes} · ` : ""}Canceled ${now} because Artist Premium ended immediately.`;
    const patch = await restPatch(`distribution_jobs?id=eq.${job.id}`, {
      status: "cancelled",
      notes: note.slice(0, 2000),
      updated_at: now,
    });
    if (patch.ok) canceledIds.push(job.id);
  }

  await auditDistributionCancel(userId, {
    mode: "immediate",
    canceledJobIds: canceledIds,
    liveNotedJobIds: liveNotedIds,
    at: now,
  });

  return { canceledIds, liveNotedIds };
}

export async function cancelArtistPremium(
  userId: string,
  mode: "period_end" | "immediate" = "period_end",
) {
  if (!url || !service) return { ok: false as const, reason: "not_configured" };

  const mems = await restGet<
    Array<{ id: string; ends_at: string | null; plan_id: string; status: string; provider: string | null; provider_ref: string | null }>
  >(
    `bvs_memberships?user_id=eq.${userId}&family=eq.artist&status=in.(active,trialing,shell)&order=starts_at.desc&select=id,ends_at,plan_id,status,provider,provider_ref`,
  );
  const active = mems?.[0];
  const now = new Date().toISOString();
  const jobs = await listArtistDistributionJobs(userId);

  if (active?.provider === "stripe" && active.provider_ref) {
    const stripe = getStripe();
    if (!stripe) return { ok: false as const, reason: "stripe_not_configured" };
    try {
      if (mode === "immediate") await stripe.subscriptions.cancel(active.provider_ref);
      else await stripe.subscriptions.update(active.provider_ref, { cancel_at_period_end: true });
    } catch (error) {
      console.error("stripe premium cancellation failed", error);
      return { ok: false as const, reason: "stripe_cancel_failed" };
    }
  }

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
    const distro = await applyImmediateDistributionLifecycle(userId, jobs);
    return {
      ok: true as const,
      mode,
      endsAt: now,
      distribution: distro,
      consequences: premiumCancelConsequences(jobs),
    };
  }

  // period_end: keep access until ends_at — do not touch distribution jobs yet
  const endsAt = active?.ends_at || now;
  if (active) {
    await restPatch(`bvs_memberships?id=eq.${active.id}`, {
      cancel_at: now,
      notes: "Cancel at period end requested",
    });
  }
  await auditDistributionCancel(userId, {
    mode: "period_end",
    endsAt,
    jobCount: jobs.length,
    byStatus: premiumCancelConsequences(jobs).byStatus,
    at: now,
    note: "period_end cancel — distribution jobs unchanged until paid-through",
  });
  return {
    ok: true as const,
    mode,
    endsAt,
    planId: active?.plan_id || null,
    consequences: premiumCancelConsequences(jobs),
  };
}

/**
 * Turn off prepaid Artist Premium when paid-through date has passed.
 * Stripe auto-renew is left to Stripe webhooks. Live store jobs are not cancelled here.
 */
export async function expireLapsedPrepaidPremium(userId?: string): Promise<{
  expired: number;
  ids: string[];
}> {
  if (!url || !service) return { expired: 0, ids: [] };
  const now = new Date().toISOString();
  const filter = userId
    ? `user_id=eq.${encodeURIComponent(userId)}&family=eq.artist&status=in.(active,trialing)&or=(provider.is.null,provider.eq.paynow)&ends_at=lt.${now}`
    : `family=eq.artist&status=in.(active,trialing)&or=(provider.is.null,provider.eq.paynow)&ends_at=lt.${now}`;
  const rows = await restGet<
    Array<{ id: string; user_id: string; provider?: string | null; ends_at?: string | null }>
  >(`bvs_memberships?${filter}&select=id,user_id,provider,ends_at&limit=80`);
  const ids: string[] = [];
  for (const row of rows || []) {
    await restPatch(`bvs_memberships?id=eq.${row.id}`, {
      status: "expired",
      updated_at: now,
      notes: `Prepaid period ended ${row.ends_at || now}`,
    });
    await restPatch(`profiles?id=eq.${row.user_id}`, {
      premium_active: false,
      distribution_enabled: false,
      updated_at: now,
    });
    const jobs = await listArtistDistributionJobs(row.user_id);
    await applyImmediateDistributionLifecycle(row.user_id, jobs);
    ids.push(row.id);
  }
  // Also clear stale profile flags when membership row already ended.
  if (userId) {
    const profileRows = await restGet<Array<{ premium_active?: boolean; premium_until?: string | null }>>(
      `profiles?id=eq.${userId}&select=premium_active,premium_until&limit=1`,
    );
    const profile = profileRows?.[0];
    const until = profile?.premium_until;
    if (profile?.premium_active && until && new Date(until).getTime() < Date.now()) {
      await restPatch(`profiles?id=eq.${userId}`, {
        premium_active: false,
        distribution_enabled: false,
        updated_at: now,
      });
    }
  }
  return { expired: ids.length, ids };
}

export async function getArtistPremiumStatus(userId: string) {
  await expireLapsedPrepaidPremium(userId).catch(() => undefined);
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
  const founding = await foundingEligibility();
  const until = membership?.ends_at || profile.premium_until || null;
  const stillValid = Boolean(profile.premium_active) && (!until || new Date(until).getTime() > Date.now());
  const provider = membership?.provider || null;
  const billingModel = provider === "stripe" ? "auto_renew" : stillValid ? "prepaid" : "none";
  const msLeft = until ? new Date(until).getTime() - Date.now() : 0;
  const daysRemaining = stillValid && until ? Math.max(0, Math.ceil(msLeft / 86400000)) : null;

  return {
    premiumActive: stillValid,
    premiumUntil: until,
    distributionEnabled: Boolean(profile.distribution_enabled) && stillValid,
    planId: membership?.plan_id || profile.premium_plan_id || null,
    billingInterval: membership?.billing_interval || null,
    cancelAt: membership?.cancel_at || null,
    membershipStatus: membership?.status || (stillValid ? "profile_flag" : "none"),
    provider,
    providerRef: membership?.provider_ref || null,
    foundingSeat: Boolean(membership?.founding_seat),
    founding,
    billingModel,
    daysRemaining,
    canResubscribe: !stillValid || (billingModel === "prepaid" && daysRemaining !== null && daysRemaining <= 7),
  };
}

/** Detect premium order line items from checkout items. */
export function parsePremiumOrderItem(items: Array<{ type?: string; id?: string | number; title?: string; price?: number; quantity?: number }>) {
  for (const item of items || []) {
    const type = String(item.type || "").toLowerCase();
    const id = String(item.id || "");
    if (type === "artist_premium" || id.startsWith("premium:") || id.startsWith("artist_premium")) {
      const sku = id.includes(":") ? id : String(item.title || "");
      let planId: ArtistPremiumPlanId = "artist_instant";
      let interval: BillingInterval = "month";
      if (sku.includes("instant") || sku.includes("starter")) planId = "artist_instant";
      if (sku.includes("founding")) planId = "artist_founding";
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
