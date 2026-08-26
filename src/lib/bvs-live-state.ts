export type LiveStatus =
  | "ready"
  | "rehearsal"
  | "armed"
  | "signal_detected"
  | "live"
  | "signal_lost"
  | "ending"
  | "ended"
  | "failed";

export type MediaTruth = {
  eventType: "publish" | "unpublish" | "heartbeat" | "reconcile";
  sessionId?: string | null;
  audioDetected?: boolean;
  videoDetected?: boolean;
  audioOnlyAllowed?: boolean;
  hlsAvailable?: boolean;
  publisher?: string | null;
};

export type TransitionResult = {
  nextStatus: LiveStatus;
  reason: string;
  publicLive: boolean;
};

export function mediaDerivedTransition(
  current: LiveStatus,
  truth: MediaTruth,
): TransitionResult {
  if (current === "ended" || current === "failed") {
    return { nextStatus: current, reason: "terminal_state", publicLive: false };
  }

  if (truth.eventType === "unpublish") {
    if (current === "live") {
      return {
        nextStatus: "signal_lost",
        reason: "publisher_disconnected_grace_window",
        publicLive: false,
      };
    }
    return { nextStatus: "ending", reason: "publisher_disconnected", publicLive: false };
  }

  if (current === "rehearsal") {
    return {
      nextStatus: "rehearsal",
      reason: "rehearsal_never_public_live",
      publicLive: false,
    };
  }

  const hasMedia = Boolean(truth.videoDetected || (truth.audioOnlyAllowed && truth.audioDetected));
  const canGoLive = Boolean(
    truth.eventType === "publish" &&
      truth.sessionId &&
      truth.publisher &&
      hasMedia &&
      truth.hlsAvailable,
  );

  if (canGoLive) {
    return { nextStatus: "live", reason: "authenticated_media_truth_ready", publicLive: true };
  }

  if (truth.eventType === "publish" || truth.eventType === "heartbeat") {
    return {
      nextStatus: "signal_detected",
      reason: truth.hlsAvailable ? "media_incomplete" : "hls_not_ready",
      publicLive: false,
    };
  }

  return { nextStatus: current, reason: "no_state_change", publicLive: current === "live" };
}

export function reconcileTransition(
  current: LiveStatus,
  hasPublisher: boolean,
  hasValidArmedBroadcast: boolean,
): TransitionResult {
  if (current === "ended" || current === "failed" || current === "rehearsal") {
    return { nextStatus: current, reason: "reconcile_noop", publicLive: false };
  }
  if (current === "live" && !hasPublisher) {
    return { nextStatus: "signal_lost", reason: "reconcile_missing_publisher", publicLive: false };
  }
  if (hasPublisher && !hasValidArmedBroadcast) {
    return { nextStatus: "failed", reason: "reconcile_orphan_publisher", publicLive: false };
  }
  return { nextStatus: current, reason: "reconcile_consistent", publicLive: current === "live" };
}
