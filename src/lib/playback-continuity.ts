export type PreviousPlaybackDecision = "restart" | "history" | "unavailable";

/** Music-player previous semantics: restart after a few seconds, otherwise go back. */
export function previousPlaybackDecision(currentTime: number, historyLength: number): PreviousPlaybackDecision {
  if (Number.isFinite(currentTime) && currentTime > 3) return "restart";
  if (historyLength > 0) return "history";
  return "unavailable";
}

/** Resolve Previous before mutating a shared session so unavailable stays a true no-op. */
export function previousPlaybackPlan(currentTime: number, historyLength: number, inSharedProgramme: boolean) {
  const action = previousPlaybackDecision(currentTime, historyLength);
  return {
    action,
    leaveSharedProgramme: inSharedProgramme && action !== "unavailable",
  };
}

/** A failed shared programme gets a few quick reconnects, never an endless reload loop. */
export function sharedPlaybackRecoveryDelay(failureCount: number) {
  return [500, 1_500, 4_000][failureCount - 1] ?? null;
}
