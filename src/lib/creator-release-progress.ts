export type ReleaseWorkGroup = "action_required" | "in_progress" | "history";

export type ReleaseStageState =
  | "complete"
  | "in_progress"
  | "action_required"
  | "not_started"
  | "unavailable"
  | "stopped";

export type ReleaseStage = {
  id: "submission" | "editorial" | "bvs" | "stores";
  label: string;
  state: ReleaseStageState;
  detail: string;
};

export type CreatorReleaseProgress = {
  group: ReleaseWorkGroup;
  statusLabel: string;
  nextOwner: "You" | "BVS" | "Stores" | "Complete";
  nextStep: string;
  stages: ReleaseStage[];
};

export type CreatorReleaseInput = {
  editorialStatus?: string | null;
  editorialNotes?: string | null;
  isPublic?: boolean | null;
  inRotation?: boolean | null;
  distributionStatus?: string | null;
};

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase();

const EDITORIAL_ACTION = new Set([
  "changes_requested",
  "information_requested",
  "rejected",
  "action_required",
  "needs_action",
]);
const EDITORIAL_REVIEW = new Set(["submitted", "in_review", "pending", "under_review"]);
const EDITORIAL_APPROVED = new Set(["approved", "published", "live"]);
const DISTRIBUTION_ACTIVE = new Set([
  "eligible",
  "queued",
  "submitted",
  "processing",
  "delivering",
]);
// The persisted contract only proves store availability at live_on_dsp.
// Delivery/completion-like wording must not be treated as public store proof.
const DISTRIBUTION_LIVE = new Set(["live_on_dsp"]);

export function releaseWorkGroupLabel(group: ReleaseWorkGroup): string {
  if (group === "action_required") return "Action required";
  if (group === "in_progress") return "In progress";
  return "History";
}

export function isCreatorReleaseActionRequired(status?: string | null): boolean {
  const editorial = normalize(status);
  return editorial === "draft" || EDITORIAL_ACTION.has(editorial);
}

export function latestDistributionJob<T extends { updated_at?: string | null; created_at?: string | null }>(
  jobs: T[],
): T | undefined {
  return [...jobs].sort((a, b) => {
    const aTime = Date.parse(a.updated_at || a.created_at || "") || 0;
    const bTime = Date.parse(b.updated_at || b.created_at || "") || 0;
    return bTime - aTime;
  })[0];
}

export function buildCreatorReleaseProgress(input: CreatorReleaseInput): CreatorReleaseProgress {
  const editorial = normalize(input.editorialStatus);
  const distribution = normalize(input.distributionStatus);
  const bvsLive = input.isPublic === true;
  const creatorAction = EDITORIAL_ACTION.has(editorial) || editorial === "draft";
  const approved = EDITORIAL_APPROVED.has(editorial);
  const submitted = EDITORIAL_REVIEW.has(editorial) || approved || EDITORIAL_ACTION.has(editorial) || bvsLive;
  const editorialUnknown = Boolean(editorial) && editorial !== "draft" && !approved && !creatorAction && !EDITORIAL_REVIEW.has(editorial);
  const reviewActive = EDITORIAL_REVIEW.has(editorial);
  const distributionActive = DISTRIBUTION_ACTIVE.has(distribution);
  const distributionLive = DISTRIBUTION_LIVE.has(distribution);
  const distributionFailed = distribution === "failed";
  const distributionKnown = !distribution || distributionActive || distributionLive || ["failed", "not_eligible", "cancelled"].includes(distribution);

  let group: ReleaseWorkGroup = "history";
  let statusLabel = bvsLive ? "Live on BVS" : "Release history";
  let nextOwner: CreatorReleaseProgress["nextOwner"] = "Complete";
  let nextStep = bvsLive
    ? "No action is required. BVS playback is live; wider store delivery appears separately when it starts."
    : "No further step is scheduled.";

  if (creatorAction) {
    group = "action_required";
    nextOwner = "You";
    if (editorial === "draft") {
      statusLabel = "Draft — not submitted";
      nextStep = "This existing release cannot be edited or submitted from this screen. Contact BVS so editorial can confirm the supported next step before you start another release.";
    } else {
      statusLabel = "Editorial update required";
      nextStep = input.editorialNotes
        ? "Read the editorial note, then contact BVS about this existing release. Editing and resubmission are not available here."
        : "Contact BVS about this existing release so editorial can confirm the correction. Editing and resubmission are not available here.";
    }
  } else if (distributionFailed) {
    group = "in_progress";
    statusLabel = bvsLive ? "BVS live · store delivery needs attention" : "Store delivery needs attention";
    nextOwner = "BVS";
    nextStep = "BVS must confirm the delivery issue and share a specific correction before anything is required from you.";
  } else if (editorialUnknown) {
    group = "in_progress";
    statusLabel = bvsLive
      ? `Live on BVS · editorial status ${editorial.replaceAll("_", " ")}`
      : `BVS status · ${editorial.replaceAll("_", " ")}`;
    nextOwner = "BVS";
    nextStep = "This status is not mapped to a creator action. BVS must clarify it before the editorial path can be considered complete.";
  } else if (!editorial) {
    group = "in_progress";
    statusLabel = bvsLive ? "Live on BVS · editorial status pending" : "Status pending";
    nextOwner = "BVS";
    nextStep = "BVS has not posted an editorial status yet. Refresh later or contact support if this persists.";
  } else if (reviewActive) {
    group = "in_progress";
    statusLabel = editorial === "in_review"
      ? "In editorial review"
      : "Submitted — waiting for review";
    nextOwner = "BVS";
    nextStep = "Nothing is required from you right now. BVS editorial is reviewing the submission.";
  } else if (approved && !bvsLive) {
    group = "in_progress";
    statusLabel = "Approved — awaiting BVS publication";
    nextOwner = "BVS";
    nextStep = "Nothing is required from you right now. BVS publication is the next confirmed step.";
  } else if (bvsLive && distributionActive) {
    group = "in_progress";
    statusLabel = distribution === "eligible"
      ? "BVS live · ready for store queue"
      : distribution === "submitted"
        ? "BVS live · with distribution partner"
        : "BVS live · store delivery in progress";
    nextOwner = distribution === "submitted" ? "Stores" : "BVS";
    nextStep = distribution === "eligible"
      ? "Nothing is required from you right now. BVS must place this release in the delivery queue."
      : distribution === "submitted"
        ? "Nothing is required from you right now. The partner and stores are reviewing delivery."
        : "Nothing is required from you right now. BVS is moving the release through store delivery.";
  } else if (bvsLive && distributionLive) {
    statusLabel = "Live on BVS and major platforms";
    nextStep = "Delivery is confirmed. Keep store links and release details current.";
  } else if (bvsLive && distribution === "not_eligible") {
    statusLabel = "Live on BVS · wider delivery unavailable";
    nextStep = "No action is required for BVS playback. Wider store delivery is not active for this release.";
  } else if (bvsLive && distribution === "cancelled") {
    statusLabel = "Live on BVS · store delivery stopped";
    nextStep = "BVS playback remains live. Store delivery is not moving for this release.";
  } else if (bvsLive && !distributionKnown) {
    group = "in_progress";
    statusLabel = `BVS live · store status ${distribution.replaceAll("_", " ")}`;
    nextOwner = "BVS";
    nextStep = "This store status is not mapped to a creator action. BVS must clarify the delivery state.";
  }

  const submissionStage: ReleaseStage = {
    id: "submission",
    label: "Submission",
    state: editorial === "draft" ? "action_required" : submitted ? "complete" : "in_progress",
    detail: editorial === "draft"
      ? "Draft saved; not sent to editorial"
      : submitted
        ? "Received by BVS"
        : editorialUnknown
          ? `Unmapped status: ${editorial.replaceAll("_", " ")}`
          : "Status pending",
  };

  const editorialStage: ReleaseStage = {
    id: "editorial",
    label: "Editorial",
    state: creatorAction && editorial !== "draft"
      ? "action_required"
      : approved
        ? "complete"
        : reviewActive || editorialUnknown || (!editorial && bvsLive)
          ? "in_progress"
          : "not_started",
    detail: creatorAction && editorial !== "draft"
      ? "Your update is required"
      : approved
        ? "Approved"
        : editorialUnknown
          ? `BVS status: ${editorial.replaceAll("_", " ")}`
          : !editorial && bvsLive
            ? "Status pending"
            : reviewActive
              ? "BVS review in progress"
              : "Starts after submission",
  };

  const bvsStage: ReleaseStage = {
    id: "bvs",
    label: "BVS playback",
    state: bvsLive ? "complete" : approved ? "in_progress" : "not_started",
    detail: bvsLive
      ? input.inRotation
        ? "Live and in rotation"
        : "Live in the BVS catalogue"
      : approved
        ? "BVS publication pending"
        : "Not live",
  };

  let storesStage: ReleaseStage = {
    id: "stores",
    label: "Wider stores",
    state: "not_started",
    detail: bvsLive ? "Not started" : "Separate after BVS publication",
  };
  if (distributionLive) {
    storesStage = { ...storesStage, state: "complete", detail: "Delivery confirmed live" };
  } else if (distributionFailed) {
    storesStage = { ...storesStage, state: "in_progress", detail: "Delivery issue · awaiting BVS guidance" };
  } else if (distributionActive) {
    storesStage = {
      ...storesStage,
      state: "in_progress",
      detail: distribution === "eligible" ? "Waiting for BVS queue" : distribution === "submitted" ? "Partner / store review" : "Delivery in progress",
    };
  } else if (distribution === "not_eligible") {
    storesStage = { ...storesStage, state: "unavailable", detail: "Not active for this release" };
  } else if (distribution === "cancelled") {
    storesStage = { ...storesStage, state: "stopped", detail: "Delivery stopped" };
  } else if (distribution && !distributionKnown) {
    storesStage = { ...storesStage, state: "in_progress", detail: `Status: ${distribution.replaceAll("_", " ")}` };
  }

  return {
    group,
    statusLabel,
    nextOwner,
    nextStep,
    stages: [submissionStage, editorialStage, bvsStage, storesStage],
  };
}
