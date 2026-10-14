export const BVS_SIGNAL_RISING_CATCHES = 25;

export type BvsSignalStatus =
  | "selected"
  | "first_spin_scheduled"
  | "first_spin"
  | "in_rotation"
  | "rising"
  | "breakout";

export type BvsSignalInput = {
  firstSpinScheduledAt?: string | null;
  firstSpinPlayedAt?: string | null;
  breakoutAt?: string | null;
  inRotation: boolean;
  catchCount: number;
  now?: number;
};

export type BvsSignalState = {
  status: BvsSignalStatus;
  label: string;
};

export function deriveBvsSignal(input: BvsSignalInput): BvsSignalState {
  const now = input.now ?? Date.now();
  const scheduledMs = input.firstSpinScheduledAt ? Date.parse(input.firstSpinScheduledAt) : Number.NaN;
  const playedMs = input.firstSpinPlayedAt ? Date.parse(input.firstSpinPlayedAt) : Number.NaN;
  const hasScheduledSpin = Number.isFinite(scheduledMs);
  const hasPlayedSpin = Number.isFinite(playedMs);

  if (input.breakoutAt) return { status: "breakout", label: "BVS Breakout" };
  if (hasPlayedSpin && playedMs <= now && now - playedMs < 24 * 60 * 60 * 1000) {
    return { status: "first_spin", label: "First Spin" };
  }
  if (!hasPlayedSpin && hasScheduledSpin && scheduledMs > now) {
    return { status: "first_spin_scheduled", label: "First Spin scheduled" };
  }
  if (input.inRotation && input.catchCount >= BVS_SIGNAL_RISING_CATCHES) {
    return { status: "rising", label: "Gaining Signal" };
  }
  if (input.inRotation) return { status: "in_rotation", label: "In Rotation" };
  return { status: "selected", label: "Selected by BVS" };
}
