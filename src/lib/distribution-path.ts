/**
 * Full artist path (public copy never names the private DSP aggregator):
 * Premium → submit → BVS editorial publish (+ optional rotation)
 * → distribution job → private partner hand-off → live on major platforms
 */

export const DISTRIBUTION_JOB_STATUSES = [
  "not_eligible",
  "eligible",
  "queued",
  "submitted",
  "live_on_dsp",
  "failed",
  "cancelled",
] as const;

export type DistributionJobStatus = (typeof DISTRIBUTION_JOB_STATUSES)[number];

/** Internal ops code only — never show on public marketing pages. */
export const PRIVATE_DSP_PARTNER_CODE = "private_dsp_partner";

/** Canonical internal distributor id for the Amuse pilot hand-off. */
export const PRIVATE_DSP_PARTNER_AMUSE = "amuse_pilot";
/** Accept either generic private partner or Amuse pilot code in editorial ops. */
export const PRIVATE_DSP_PARTNER_CODES = [
  PRIVATE_DSP_PARTNER_CODE,
  PRIVATE_DSP_PARTNER_AMUSE,
] as const;

export function isPrivateDspPartnerCode(value?: string | null): boolean {
  const v = String(value || "").trim().toLowerCase();
  return (PRIVATE_DSP_PARTNER_CODES as readonly string[]).includes(v);
}

/** Staff-only Amuse pilot checklist (never render on artist-facing surfaces). */
export const AMUSE_PILOT_HANDOFF_CHECKLIST = [
  "Confirm Artist Premium active + distribution_enabled on the creator profile",
  "Confirm BVS editorial approved + published the release (catalogue / optional rotation)",
  "Rights Passport / clearance evidence complete; no unresolved rights blocks",
  "ISRC (and UPC when multi-track) filled or matched from known catalogue",
  "Cover art, metadata, contributors, and territories ready for store delivery",
  "Queue job → deliver inside BVS-operated Amuse pilot account (do not market Amuse publicly)",
  "Mark submitted when partner accepts delivery; mark live_on_dsp when stores are live",
  "Paste Spotify / Apple / other store URLs + ISRCs back onto BVS tracks",
] as const;

export function partnerHandoffNotes(status: string): string {
  switch (status) {
    case "eligible":
      return [
        "BVS publish complete.",
        "Premium distribution eligible.",
        "Next: queue private DSP partner hand-off (internal: amuse_pilot).",
        "Artist-facing copy must not name the aggregator brand.",
      ].join(" ");
    case "queued":
      return [
        "Queued for private DSP partner hand-off after BVS publish.",
        "Ops: prepare Amuse pilot delivery under BVS label imprint (internal only).",
      ].join(" ");
    case "submitted":
      return [
        "Delivered to private DSP partner — awaiting store approval.",
        "Internal partner: amuse_pilot. Track partner dashboard until live.",
      ].join(" ");
    case "live_on_dsp":
      return [
        "Live on major platforms.",
        "Link ISRC / Spotify (and other store) URLs on BVS tracks.",
        "Internal partner: amuse_pilot.",
      ].join(" ");
    case "failed":
      return "Partner or store rejected — fix metadata / rights, then re-queue.";
    case "cancelled":
      return "Distribution cancelled — Premium off or ops cancelled hand-off.";
    case "not_eligible":
      return [
        "BVS publish path complete (catalogue / optional rotation).",
        "Multi-platform distribution locked: artist needs active Premium + distribution_enabled.",
      ].join(" ");
    default:
      return "Distribution status pending.";
  }
}


export type PathStepId =
  | "premium"
  | "submit"
  | "bvs_review"
  | "bvs_live"
  | "distro_queue"
  | "partner_review"
  | "dsp_live";

export type PathStepState = "done" | "current" | "upcoming" | "blocked" | "failed";

export type PathStep = {
  id: PathStepId;
  label: string;
  detail: string;
  state: PathStepState;
};

export function publicDistributionStatusLabel(status?: string | null): string {
  switch (status) {
    case "not_eligible":
      return "BVS only — Premium required for multi-platform";
    case "eligible":
      return "Ready for multi-platform queue";
    case "queued":
      return "Queued for multi-platform delivery";
    case "submitted":
      return "With distribution partner (under review)";
    case "live_on_dsp":
      return "Live on major platforms";
    case "failed":
      return "Distribution needs attention";
    case "cancelled":
      return "Distribution cancelled";
    default:
      return "Distribution status pending";
  }
}

export function editorialDistributionStatusLabel(status?: string | null): string {
  switch (status) {
    case "not_eligible":
      return "Not eligible (no Premium / distribution flag)";
    case "eligible":
      return "Eligible — queue private partner hand-off";
    case "queued":
      return "Queued — ops to deliver to private partner";
    case "submitted":
      return "Submitted to private partner — awaiting store approval";
    case "live_on_dsp":
      return "Live on DSPs (link ISRC / Spotify URLs)";
    case "failed":
      return "Failed — fix metadata / rights / partner reject";
    case "cancelled":
      return "Cancelled";
    default:
      return status || "unknown";
  }
}

export function distributionJobNotes(input: {
  distroOk: boolean;
  publish: boolean;
}): string {
  if (!input.publish) {
    return "Not published on BVS yet.";
  }
  if (!input.distroOk) {
    return [
      "BVS publish path complete (catalogue / optional rotation).",
      "Multi-platform distribution locked: artist needs active Premium + distribution_enabled.",
    ].join(" ");
  }
  return [
    "BVS publish complete.",
    "Premium distribution eligible.",
    "Next: queue private DSP partner hand-off (internal code: private_dsp_partner).",
    "Artist-facing copy must not name the aggregator brand.",
  ].join(" ");
}

export function buildArtistPathSteps(input: {
  premiumActive: boolean;
  distributionEnabled: boolean;
  hasSubmission: boolean;
  bvsStatus?: string | null;
  isPublic?: boolean;
  inRotation?: boolean;
  distroStatus?: string | null;
}): PathStep[] {
  const premiumOn = Boolean(input.premiumActive && input.distributionEnabled);
  const submitted = Boolean(input.hasSubmission);
  const reviewing =
    submitted &&
    ["submitted", "in_review"].includes(String(input.bvsStatus || "").toLowerCase());
  const approved = String(input.bvsStatus || "").toLowerCase() === "approved";
  const rejected = String(input.bvsStatus || "").toLowerCase() === "rejected";
  const onBvs = Boolean(input.isPublic && approved);
  const distro = String(input.distroStatus || "");

  const premium: PathStep = {
    id: "premium",
    label: "Artist Premium",
    detail: premiumOn
      ? "Active — multi-platform path unlocked"
      : "Required for multi-platform delivery (BVS listen still free after publish)",
    state: premiumOn ? "done" : "blocked",
  };

  const submit: PathStep = {
    id: "submit",
    label: "Submit release",
    detail: submitted ? "Release received" : "Upload single / EP / album with rights confirmed",
    state: submitted ? "done" : premiumOn || true ? "current" : "upcoming",
  };

  let bvsReview: PathStep = {
    id: "bvs_review",
    label: "BVS editorial",
    detail: "Human review before catalogue / rotation",
    state: "upcoming",
  };
  if (rejected) {
    bvsReview = {
      ...bvsReview,
      detail: "Rejected — check editor notes and resubmit",
      state: "failed",
    };
  } else if (approved) {
    bvsReview = { ...bvsReview, detail: "Approved", state: "done" };
  } else if (reviewing || submitted) {
    bvsReview = {
      ...bvsReview,
      detail: reviewing ? "In review" : "Waiting for review",
      state: "current",
    };
  }

  const bvsLive: PathStep = {
    id: "bvs_live",
    label: "Live on BVS Radio",
    detail: onBvs
      ? input.inRotation
        ? "Published + in continuous rotation"
        : "Published on BVS catalogue"
      : "After approve + publish",
    state: onBvs ? "done" : approved ? "current" : "upcoming",
  };

  let distroQueue: PathStep = {
    id: "distro_queue",
    label: "Multi-platform queue",
    detail: "Premium releases enter the distribution queue after BVS publish",
    state: "upcoming",
  };
  let partner: PathStep = {
    id: "partner_review",
    label: "Partner / store review",
    detail: "Private distribution partner delivers to major platforms",
    state: "upcoming",
  };
  let dspLive: PathStep = {
    id: "dsp_live",
    label: "Live on major platforms",
    detail: "Spotify, Apple Music, Boomplay, and other destinations",
    state: "upcoming",
  };

  if (!onBvs) {
    // keep upcoming
  } else if (!premiumOn || distro === "not_eligible") {
    distroQueue = {
      ...distroQueue,
      detail: "BVS-only for this release — activate Premium for multi-platform",
      state: "blocked",
    };
  } else if (distro === "eligible" || distro === "queued") {
    distroQueue = {
      ...distroQueue,
      detail:
        distro === "queued"
          ? "Queued for private partner delivery"
          : "Eligible — waiting to be queued",
      state: distro === "queued" ? "done" : "current",
    };
    if (distro === "queued") partner = { ...partner, state: "current" };
  } else if (distro === "submitted") {
    distroQueue = { ...distroQueue, detail: "Handed off", state: "done" };
    partner = {
      ...partner,
      detail: "Submitted — awaiting partner / store approval",
      state: "current",
    };
  } else if (distro === "live_on_dsp") {
    distroQueue = { ...distroQueue, state: "done", detail: "Handed off" };
    partner = { ...partner, state: "done", detail: "Partner approved" };
    dspLive = {
      ...dspLive,
      state: "done",
      detail: "Live on major platforms — open Spotify links when ISRC matched",
    };
  } else if (distro === "failed") {
    distroQueue = { ...distroQueue, state: "done", detail: "Handed off" };
    partner = {
      ...partner,
      state: "failed",
      detail: "Partner or store rejected — editorial will share next steps",
    };
  } else if (distro === "cancelled") {
    distroQueue = {
      ...distroQueue,
      state: "failed",
      detail: "Distribution cancelled",
    };
  } else if (premiumOn && onBvs) {
    distroQueue = {
      ...distroQueue,
      detail: "Creating distribution job…",
      state: "current",
    };
  }

  // Fix submit "current" when already past
  if (submitted) {
    submit.state = "done";
  } else {
    submit.state = "current";
  }

  return [premium, submit, bvsReview, bvsLive, distroQueue, partner, dspLive];
}
