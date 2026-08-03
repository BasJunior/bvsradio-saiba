/**
 * Pure helpers for Apple-compliance rights flows.
 * No secrets; safe for unit tests without DB.
 *
 * Lawyer-review: agreement text and policy thresholds are operational
 * placeholders describing product behaviour — not final legal advice.
 */

export const ACTIVE_RIGHTS_AGREEMENT_VERSION = "BVS-RIGHTS-ATTEST-2026-08-01" as const;

export const RIGHTS_AGREEMENT_SUMMARY =
  "Artist confirms master/composition control, featured contributors, samples/beats clearance, and grants BVS limited host/stream/catalogue/promote rights for this release.";

export type MaterialType =
  | "cover"
  | "remix"
  | "sample"
  | "leased_beat"
  | "third_party"
  | "other";

export type ClearanceRisk = "low" | "medium" | "high" | "critical";

export type ComplaintStatus =
  | "received"
  | "under_review"
  | "hold_applied"
  | "resolved_upheld"
  | "resolved_rejected"
  | "withdrawn"
  | "counter_notice_received";

export type AttestationFlags = {
  masterControl: boolean;
  compositionControl: boolean;
  featuredContributorsCleared: boolean;
  samplesBeatsCleared: boolean;
  grantHost: boolean;
  grantStream: boolean;
  grantCatalogue: boolean;
  grantPromote: boolean;
  accuracyConfirmed: boolean;
};

export type MaterialFlags = {
  containsCover: boolean;
  containsRemix: boolean;
  containsSamples: boolean;
  containsLeasedBeats: boolean;
  containsThirdParty: boolean;
};

export type ClearanceEvidenceInput = {
  materialType: MaterialType;
  riskLevel?: ClearanceRisk;
  title: string;
  description?: string;
  rightsHolderName?: string;
  licenceOrPermissionRef?: string;
  sourceUrl?: string;
  documentStoragePath?: string | null;
  documentFilename?: string | null;
  documentContentType?: string | null;
  documentByteSize?: number | null;
  documentSha256?: string | null;
  required?: boolean;
};

export const MATERIAL_TYPES: MaterialType[] = [
  "cover",
  "remix",
  "sample",
  "leased_beat",
  "third_party",
  "other",
];

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  "received",
  "under_review",
  "hold_applied",
  "resolved_upheld",
  "resolved_rejected",
  "withdrawn",
  "counter_notice_received",
];

/** Default repeat-infringer thresholds (configurable in copyright_policy_settings). */
export const DEFAULT_STRIKE_THRESHOLD = 3;
export const DEFAULT_ACCOUNT_RESTRICTION_THRESHOLD = 3;

export function allAttestationFlagsTrue(flags: AttestationFlags): boolean {
  return (
    flags.masterControl &&
    flags.compositionControl &&
    flags.featuredContributorsCleared &&
    flags.samplesBeatsCleared &&
    flags.grantHost &&
    flags.grantStream &&
    flags.grantCatalogue &&
    flags.grantPromote &&
    flags.accuracyConfirmed
  );
}

export function materialFlagsNeedClearance(flags: MaterialFlags): boolean {
  return (
    flags.containsCover ||
    flags.containsRemix ||
    flags.containsSamples ||
    flags.containsLeasedBeats ||
    flags.containsThirdParty
  );
}

export function requiredMaterialTypes(flags: MaterialFlags): MaterialType[] {
  const out: MaterialType[] = [];
  if (flags.containsCover) out.push("cover");
  if (flags.containsRemix) out.push("remix");
  if (flags.containsSamples) out.push("sample");
  if (flags.containsLeasedBeats) out.push("leased_beat");
  if (flags.containsThirdParty) out.push("third_party");
  return out;
}

export function clearanceItemSatisfies(
  item: {
    materialType: MaterialType;
    status: string;
    required?: boolean;
    documentStoragePath?: string | null;
    licenceOrPermissionRef?: string | null;
  },
): boolean {
  if (item.required === false) return true;
  if (!["submitted", "accepted", "waived_by_staff"].includes(item.status)) return false;
  if (item.status === "waived_by_staff") return true;
  const hasDoc = Boolean(item.documentStoragePath && String(item.documentStoragePath).trim());
  const hasRef = Boolean(item.licenceOrPermissionRef && String(item.licenceOrPermissionRef).trim());
  return hasDoc || hasRef;
}

export function clearanceBlockers(
  flags: MaterialFlags,
  items: Array<{
    materialType: MaterialType;
    status: string;
    required?: boolean;
    documentStoragePath?: string | null;
    licenceOrPermissionRef?: string | null;
  }>,
): string[] {
  const blockers: string[] = [];
  for (const type of requiredMaterialTypes(flags)) {
    const ok = items.some(
      (item) => item.materialType === type && clearanceItemSatisfies(item),
    );
    if (!ok) {
      const code =
        type === "cover"
          ? "CLEARANCE_COVER_EVIDENCE_REQUIRED"
          : type === "remix"
            ? "CLEARANCE_REMIX_EVIDENCE_REQUIRED"
            : type === "sample"
              ? "CLEARANCE_SAMPLE_EVIDENCE_REQUIRED"
              : type === "leased_beat"
                ? "CLEARANCE_LEASED_BEAT_EVIDENCE_REQUIRED"
                : "CLEARANCE_THIRD_PARTY_EVIDENCE_REQUIRED";
      blockers.push(code);
    }
  }
  return blockers;
}

export function validateComplaintInput(input: {
  claimantName?: string;
  claimantEmail?: string;
  workTitle?: string;
  statement?: string;
  allegedlyInfringingUrls?: string[];
  goodFaithDeclaration?: boolean;
  accuracyDeclaration?: boolean;
  authorityDeclaration?: boolean;
  signatureName?: string;
}): { ok: true } | { ok: false; error: string } {
  const name = String(input.claimantName || "").trim();
  const email = String(input.claimantEmail || "").trim().toLowerCase();
  const work = String(input.workTitle || "").trim();
  const statement = String(input.statement || "").trim();
  const signature = String(input.signatureName || "").trim();
  const urls = Array.isArray(input.allegedlyInfringingUrls)
    ? input.allegedlyInfringingUrls.map((u) => String(u).trim()).filter(Boolean)
    : [];

  if (name.length < 2 || name.length > 160) {
    return { ok: false, error: "Please enter your full name." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return { ok: false, error: "Please enter a valid contact email." };
  }
  if (work.length < 2 || work.length > 240) {
    return { ok: false, error: "Please describe the copyrighted work." };
  }
  if (statement.length < 20 || statement.length > 8000) {
    return { ok: false, error: "Please provide a clear statement (at least 20 characters)." };
  }
  if (urls.length < 1) {
    return { ok: false, error: "List at least one URL where the material appears on BVS." };
  }
  if (urls.length > 20) {
    return { ok: false, error: "Too many URLs. List up to 20 locations." };
  }
  for (const u of urls) {
    if (u.length > 1000 || !/^https?:\/\//i.test(u)) {
      return { ok: false, error: "Each location must be a full http(s) URL." };
    }
  }
  if (!input.goodFaithDeclaration || !input.accuracyDeclaration || !input.authorityDeclaration) {
    return {
      ok: false,
      error: "You must confirm the good-faith, accuracy, and authority declarations.",
    };
  }
  if (signature.length < 2 || signature.length > 160) {
    return { ok: false, error: "Please sign with your full name." };
  }
  return { ok: true };
}

export function generateDocketNumber(now = new Date(), randomPart?: string): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const suffix =
    randomPart ||
    Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BVS-CR-${y}${m}${d}-${suffix.slice(0, 8)}`;
}

export function shouldRestrictAccount(
  activeStrikes: number,
  threshold = DEFAULT_ACCOUNT_RESTRICTION_THRESHOLD,
): boolean {
  return activeStrikes >= threshold;
}

export function isStaffComplaintTransition(
  from: ComplaintStatus,
  to: ComplaintStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<ComplaintStatus, ComplaintStatus[]> = {
    received: ["under_review", "hold_applied", "resolved_upheld", "resolved_rejected", "withdrawn"],
    under_review: ["hold_applied", "resolved_upheld", "resolved_rejected", "withdrawn", "counter_notice_received"],
    hold_applied: ["under_review", "resolved_upheld", "resolved_rejected", "counter_notice_received", "withdrawn"],
    counter_notice_received: ["under_review", "hold_applied", "resolved_upheld", "resolved_rejected", "withdrawn"],
    resolved_upheld: ["under_review"], // rare reopen
    resolved_rejected: ["under_review"],
    withdrawn: [],
  };
  return (allowed[from] || []).includes(to);
}

export function customerSafeComplaintError(internal?: string): string {
  // Never leak staff notes, emails of other parties, or stack traces to public form.
  void internal;
  return "We could not accept this complaint right now. Please try again later or email rights@bvsradio.com.";
}

export function buildAttestationSnapshot(input: {
  releaseId: string;
  userId: string;
  agreementVersion: string;
  release: Record<string, unknown>;
  contributors: unknown[];
  trackIds: string[];
  releaseTrackIds: string[];
  materialFlags: MaterialFlags;
  flags: AttestationFlags;
}): Record<string, unknown> {
  return {
    schema: "bvs.release_rights_attestation.v1",
    capturedAt: new Date().toISOString(),
    agreementVersion: input.agreementVersion,
    releaseId: input.releaseId,
    userId: input.userId,
    release: {
      id: input.release.id,
      title: input.release.title,
      artist_name: input.release.artist_name,
      copyright_year: input.release.copyright_year,
      master_owner_name: input.release.master_owner_name,
      composition_owner_names: input.release.composition_owner_names,
      territories: input.release.territories,
      release_type: input.release.release_type,
      editorial_status: input.release.editorial_status,
    },
    contributors: input.contributors,
    trackIds: input.trackIds,
    releaseTrackIds: input.releaseTrackIds,
    materialFlags: input.materialFlags,
    declarations: input.flags,
  };
}

export function sanitizeClientText(value: unknown, max: number): string {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

export function parseUrlList(raw: unknown, max = 20): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((u) => sanitizeClientText(u, 1000)).filter(Boolean))].slice(0, max);
  }
  if (typeof raw === "string") {
    return [
      ...new Set(
        raw
          .split(/[\n,]+/)
          .map((u) => sanitizeClientText(u, 1000))
          .filter(Boolean),
      ),
    ].slice(0, max);
  }
  return [];
}
