import "server-only";
import { restGet, restPatch, restPost } from "@/lib/releases-server";
import { PRIVATE_DSP_PARTNER_CODE } from "@/lib/distribution-path";

export const PREMIUM_INSTANT_PRICE_USD = 5.99;

export type PremiumInstantRelease = {
  id: string;
  title: string;
  releaseType: string;
  editorialStatus: string;
  isPublic: boolean;
  distributionStatus: string | null;
  canPurchase: boolean;
  reason: string;
};

type ReleaseRow = {
  id: string;
  user_id: string;
  title: string;
  release_type?: string | null;
  editorial_status?: string | null;
  is_public?: boolean | null;
};

type DistributionJobRow = {
  id: string;
  release_id: string | null;
  artist_user_id?: string | null;
  status?: string | null;
  distributor?: string | null;
  notes?: string | null;
};

const PROGRESS_STATUSES = new Set(["eligible", "queued", "submitted", "processing", "delivering", "live_on_dsp"]);

function releaseApproved(row: ReleaseRow) {
  return row.is_public === true && ["approved", "published"].includes(String(row.editorial_status || "").toLowerCase());
}

export function premiumInstantReference() {
  return `BVS-INST-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

export async function listPremiumInstantReleases(userId: string): Promise<PremiumInstantRelease[]> {
  const [releases, jobs] = await Promise.all([
    restGet<ReleaseRow[]>(
      `releases?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,title,release_type,editorial_status,is_public&order=created_at.desc&limit=100`,
    ),
    restGet<DistributionJobRow[]>(
      `distribution_jobs?artist_user_id=eq.${encodeURIComponent(userId)}&release_id=not.is.null&select=id,release_id,status,distributor,notes&order=updated_at.desc&limit=200`,
    ),
  ]);
  const jobByRelease = new Map<string, DistributionJobRow>();
  for (const job of jobs || []) {
    if (job.release_id && !jobByRelease.has(job.release_id)) jobByRelease.set(job.release_id, job);
  }

  return (releases || []).map((release) => {
    const job = jobByRelease.get(release.id);
    const status = String(job?.status || "").toLowerCase() || null;
    const approved = releaseApproved(release);
    const alreadyMoving = Boolean(status && PROGRESS_STATUSES.has(status));
    return {
      id: release.id,
      title: release.title,
      releaseType: String(release.release_type || "release"),
      editorialStatus: String(release.editorial_status || "draft"),
      isPublic: release.is_public === true,
      distributionStatus: status,
      canPurchase: approved && !alreadyMoving,
      reason: !approved
        ? "BVS editorial must approve and publish this release first."
        : alreadyMoving
          ? `Distribution is already ${status?.replaceAll("_", " ")}.`
          : "Ready for Premium Instant.",
    };
  });
}

export async function assertPremiumInstantRelease(userId: string, releaseId: string) {
  const rows = await restGet<ReleaseRow[]>(
    `releases?id=eq.${encodeURIComponent(releaseId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,title,release_type,editorial_status,is_public&limit=1`,
  );
  const release = rows?.[0];
  if (!release) return { ok: false as const, reason: "Release not found." };
  if (!releaseApproved(release)) {
    return { ok: false as const, reason: "Premium Instant is available after BVS editorial approves and publishes the release." };
  }
  const jobs = await restGet<DistributionJobRow[]>(
    `distribution_jobs?release_id=eq.${encodeURIComponent(releaseId)}&artist_user_id=eq.${encodeURIComponent(userId)}&select=id,release_id,status,distributor,notes&order=updated_at.desc&limit=1`,
  );
  const job = jobs?.[0] || null;
  const status = String(job?.status || "").toLowerCase();
  if (status && PROGRESS_STATUSES.has(status)) {
    return { ok: false as const, reason: `This release is already ${status.replaceAll("_", " ")} for distribution.` };
  }
  return { ok: true as const, release, job };
}

export async function grantPremiumInstant(input: {
  userId: string;
  releaseId: string;
  reference: string;
  provider: "stripe" | "paynow";
  amountUsd: number;
}) {
  if (Math.abs(Number(input.amountUsd) - PREMIUM_INSTANT_PRICE_USD) > 0.009) {
    return { ok: false as const, reason: "amount_mismatch" };
  }

  const rows = await restGet<ReleaseRow[]>(
    `releases?id=eq.${encodeURIComponent(input.releaseId)}&user_id=eq.${encodeURIComponent(input.userId)}&select=id,user_id,title,release_type,editorial_status,is_public&limit=1`,
  );
  const release = rows?.[0];
  if (!release || !releaseApproved(release)) {
    return { ok: false as const, reason: "release_not_approved" };
  }

  const jobs = await restGet<DistributionJobRow[]>(
    `distribution_jobs?release_id=eq.${encodeURIComponent(input.releaseId)}&artist_user_id=eq.${encodeURIComponent(input.userId)}&select=id,release_id,status,distributor,notes&order=updated_at.desc&limit=1`,
  );
  const job = jobs?.[0] || null;
  const status = String(job?.status || "").toLowerCase();
  const now = new Date().toISOString();
  const marker = `PREMIUM_INSTANT:${input.reference}`;
  if (job?.notes?.includes(marker)) {
    return { ok: true as const, idempotent: true, jobId: job.id, status: job.status || "eligible" };
  }
  if (["queued", "submitted", "processing", "delivering", "live_on_dsp"].includes(status)) {
    return { ok: true as const, idempotent: true, jobId: job?.id || null, status };
  }

  const note = `${job?.notes ? `${job.notes} · ` : ""}${marker} · ${input.provider} · US$${PREMIUM_INSTANT_PRICE_USD.toFixed(2)} paid ${now}. One-time distribution entitlement for this release only.`.slice(0, 2000);
  let jobId = job?.id || null;
  if (job) {
    const patched = await restPatch<Array<{ id: string }>>(`distribution_jobs?id=eq.${job.id}`, {
      status: "eligible",
      distributor: PRIVATE_DSP_PARTNER_CODE,
      notes: note,
      updated_at: now,
    });
    if (!patched.ok) return { ok: false as const, reason: "distribution_job_update_failed" };
  } else {
    const inserted = await restPost<Array<{ id: string }>>("distribution_jobs", {
      release_id: input.releaseId,
      artist_user_id: input.userId,
      status: "eligible",
      distributor: PRIVATE_DSP_PARTNER_CODE,
      notes: note,
    });
    if (!inserted.ok) return { ok: false as const, reason: "distribution_job_create_failed" };
    jobId = Array.isArray(inserted.data) ? inserted.data[0]?.id || null : null;
  }

  await restPost("editorial_audit_log", {
    actor_id: input.userId,
    action: "premium_instant_distribution_entitlement",
    entity_type: "release",
    entity_id: input.releaseId,
    details: {
      reference: input.reference,
      provider: input.provider,
      amount_usd: PREMIUM_INSTANT_PRICE_USD,
      distribution_job_id: jobId,
      at: now,
    },
  }, "return=minimal");

  return { ok: true as const, jobId, status: "eligible" };
}

export function parsePremiumInstantOrderItem(
  items: Array<{ type?: string; id?: string | number; title?: string; price?: number; quantity?: number }>,
) {
  for (const item of items || []) {
    const type = String(item.type || "").toLowerCase();
    const id = String(item.id || "");
    if (type !== "artist_premium_instant" && !id.startsWith("premium-instant:")) continue;
    const releaseId = id.startsWith("premium-instant:") ? id.slice("premium-instant:".length) : "";
    if (!releaseId) return null;
    return {
      releaseId,
      amount: (Number(item.price) || 0) * (Number(item.quantity) || 1),
    };
  }
  return null;
}
