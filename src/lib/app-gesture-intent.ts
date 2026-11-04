/** Short axis-locked gestures supplement visible app controls. */
export type AppSwipeIntent = "left" | "right" | "up" | null;
export function resolveAppSwipeIntent(dx: number, dy: number, elapsedMs: number, horizontalMinimum = 88): AppSwipeIntent {
  if (![dx, dy, elapsedMs, horizontalMinimum].every(Number.isFinite) || elapsedMs < 0 || elapsedMs > 800) return null;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax >= horizontalMinimum && ax > ay * 1.4) return dx < 0 ? "left" : "right";
  if (dy <= -56 && ay > ax * 1.2) return "up";
  return null;
}
