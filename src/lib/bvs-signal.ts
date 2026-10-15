
export type BvsSignalStatus = "published" | "selected" | "first_spin_scheduled" | "awaiting_first_spin" | "first_spin" | "in_rotation" | "rising" | "breakout";
export type BvsSignalInput = {
  firstSpinScheduledAt?: string | null; firstSpinPlayedAt?: string | null;
  breakoutAt?: string | null; selectedAt?: string | null;
  inRotation: boolean; catchCount: number; recentCatchCount?: number; previousCatchCount?: number; now?: number;
};
export type BvsSignalState = { status: BvsSignalStatus; label: string };
export function deriveBvsSignal(input: BvsSignalInput): BvsSignalState {
  const now = input.now ?? Date.now();
  const scheduled = Date.parse(input.firstSpinScheduledAt || "");
  const playedAt = Date.parse(input.firstSpinPlayedAt || "");
  const played = Number.isFinite(playedAt) && playedAt <= now;
  if (played && input.breakoutAt) return { status: "breakout", label: "BVS Breakout" };
  if (played && now - playedAt < 86_400_000) return { status: "first_spin", label: "First Spin" };
  if (!played && Number.isFinite(scheduled)) return scheduled > now
    ? { status: "first_spin_scheduled", label: "First Spin scheduled" }
    : { status: "awaiting_first_spin", label: "First Spin awaiting confirmation" };
  // Recent momentum, never a lifetime popularity threshold or editorial award.
  if (played && input.inRotation && (input.recentCatchCount ?? 0) >= 5 &&
      (input.recentCatchCount ?? 0) > (input.previousCatchCount ?? 0))
    return { status: "rising", label: "Gaining Signal" };
  if (input.inRotation) return { status: "in_rotation", label: "In Rotation" };
  if (played) return { status: "first_spin", label: "First Spin aired" };
  if (input.selectedAt) return { status: "selected", label: "Selected by BVS" };
  return { status: "published", label: "On BVS" };
}
export type BvsSignalSnapshot = {
  trackId: string; inRotation: boolean; rotationAddedAt: string | null; selectedAt: string | null;
  firstSpinScheduledAt: string | null; firstSpinPlayedAt: string | null;
  editorialReason: string | null; breakoutAt: string | null; revision: number;
  catchCount: number; recentCatchCount: number; previousCatchCount: number;
  caught: boolean; caughtAt: string | null; catchPosition: number | null;
};
export type BvsSignalPayload = BvsSignalSnapshot & BvsSignalState & { available: true };
export function presentBvsSignal(snapshot: BvsSignalSnapshot): BvsSignalPayload {
  return { ...snapshot, ...deriveBvsSignal(snapshot), available: true };
}
export function signalJourney(signal: BvsSignalSnapshot) {
  return [
    signal.selectedAt && { label: "Selected by BVS", at: signal.selectedAt },
    signal.firstSpinPlayedAt && { label: "First Spin aired", at: signal.firstSpinPlayedAt },
    signal.rotationAddedAt && { label: "Added to rotation", at: signal.rotationAddedAt },
    signal.breakoutAt && { label: "BVS Breakout", at: signal.breakoutAt },
  ].filter((item): item is { label: string; at: string } => Boolean(item))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
