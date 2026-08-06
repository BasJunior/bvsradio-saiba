/**
 * Producer BeatStore entitlements — live-for-sale limits + commission.
 * Growth-era defaults: Free 25 · Plus 150 · Pro unlimited.
 * Count only beats that are public + published (not drafts / in review).
 */

import { entitlementsForPlan } from "@/lib/premium-catalog";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export type ProducerBeatEntitlements = {
  planId: string;
  tier: string;
  /** null = unlimited / fair-use */
  beatLiveLimit: number | null;
  marketplaceCommissionBps: number;
  licenceTemplateLimit: number | null;
  liveCount: number;
  remaining: number | null;
  /** 0–1 usage of finite limit; 0 if unlimited */
  usageRatio: number;
  softWarn: boolean;
  canGoLive: boolean;
  source: "membership" | "profile" | "default_free";
};

function headers() {
  return {
    apikey: SERVICE,
    Authorization: `Bearer ${SERVICE}`,
    "Content-Type": "application/json",
  };
}

function asLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/** Resolve producer plan entitlements for a user (membership → profile → free default). */
export async function resolveProducerBeatEntitlements(
  userId: string,
): Promise<ProducerBeatEntitlements> {
  const free = entitlementsForPlan("producer_free");
  let planId = "producer_free";
  let source: ProducerBeatEntitlements["source"] = "default_free";
  let ents: Record<string, unknown> = { ...free };

  if (SUPABASE_URL && SERVICE && userId) {
    try {
      const mRes = await fetch(
        `${SUPABASE_URL}/rest/v1/bvs_memberships?user_id=eq.${encodeURIComponent(userId)}&status=in.(active,trialing,shell)&family=in.(producer,creator_bundle)&order=starts_at.desc&select=plan_id,family,entitlements,status&limit=5`,
        { headers: headers(), cache: "no-store" },
      );
      if (mRes.ok) {
        const rows = (await mRes.json()) as Array<{
          plan_id?: string;
          entitlements?: Record<string, unknown> | null;
        }>;
        const row = rows[0];
        if (row?.plan_id) {
          planId = String(row.plan_id);
          source = "membership";
          ents = {
            ...entitlementsForPlan(planId),
            ...(row.entitlements && typeof row.entitlements === "object" ? row.entitlements : {}),
          };
        }
      }

      if (source === "default_free") {
        const pRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=beatstore_tier,beat_live_limit,marketplace_commission_bps,premium_plan_id&limit=1`,
          { headers: headers(), cache: "no-store" },
        );
        if (pRes.ok) {
          const profiles = (await pRes.json()) as Array<Record<string, unknown>>;
          const profile = profiles[0];
          if (profile) {
            const tier = String(profile.beatstore_tier || "").toLowerCase();
            if (tier === "plus" || tier === "pro" || tier === "free") {
              planId = tier === "plus" ? "producer_plus" : tier === "pro" ? "producer_pro" : "producer_free";
              source = "profile";
              ents = { ...entitlementsForPlan(planId) };
            }
            if (profile.beat_live_limit != null) {
              ents.beat_live_limit = profile.beat_live_limit;
              source = "profile";
            }
            if (profile.marketplace_commission_bps != null) {
              ents.marketplace_commission_bps = profile.marketplace_commission_bps;
            }
          }
        }
      }
    } catch {
      /* keep free defaults */
    }
  }

  const beatLiveLimit = asLimit(ents.beat_live_limit);
  const marketplaceCommissionBps =
    Number(ents.marketplace_commission_bps) >= 0
      ? Math.floor(Number(ents.marketplace_commission_bps))
      : 1500;
  const licenceTemplateLimit = asLimit(ents.licence_template_limit);
  const tier = String(ents.beatstore_tier || "free");

  const liveCount = await countLiveBeats(userId);
  const remaining =
    beatLiveLimit == null ? null : Math.max(0, beatLiveLimit - liveCount);
  const usageRatio =
    beatLiveLimit == null || beatLiveLimit <= 0
      ? 0
      : Math.min(1, liveCount / beatLiveLimit);
  const softWarn = beatLiveLimit != null && usageRatio >= 0.8;
  const canGoLive = beatLiveLimit == null || liveCount < beatLiveLimit;

  return {
    planId,
    tier,
    beatLiveLimit,
    marketplaceCommissionBps,
    licenceTemplateLimit,
    liveCount,
    remaining,
    usageRatio,
    softWarn,
    canGoLive,
    source,
  };
}

/** Live-for-sale only: public + published. */
export async function countLiveBeats(userId: string): Promise<number> {
  if (!SUPABASE_URL || !SERVICE || !userId) return 0;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/beats?producer_user_id=eq.${encodeURIComponent(userId)}&is_public=eq.true&status=eq.published&select=id`,
      {
        headers: { ...headers(), Prefer: "count=exact" },
        cache: "no-store",
      },
    );
    if (!res.ok) return 0;
    const range = res.headers.get("content-range");
    if (range && range.includes("/")) {
      const total = Number(range.split("/")[1]);
      if (Number.isFinite(total)) return total;
    }
    const rows = (await res.json()) as unknown[];
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Soft go-live gate. Returns ok:false only when finite limit is full.
 * Existing live beats are never removed here.
 */
export async function assertCanPublishLiveBeat(input: {
  producerUserId: string;
  /** When re-publishing the same already-live beat, skip the +1 check. */
  beatId?: string;
  alreadyLive?: boolean;
}): Promise<
  | { ok: true; entitlements: ProducerBeatEntitlements }
  | { ok: false; error: string; entitlements: ProducerBeatEntitlements }
> {
  const entitlements = await resolveProducerBeatEntitlements(input.producerUserId);
  if (input.alreadyLive) {
    return { ok: true, entitlements };
  }
  if (entitlements.canGoLive) {
    return { ok: true, entitlements };
  }
  const limit = entitlements.beatLiveLimit;
  return {
    ok: false,
    entitlements,
    error:
      limit == null
        ? "Live beat limit reached."
        : `Live beat limit reached (${entitlements.liveCount}/${limit}). Archive or unpublish a beat, or upgrade Producer Plus/Pro on /premium.`,
  };
}
