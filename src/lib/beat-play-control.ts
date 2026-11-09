/** BeatStore listings and player tracks may or may not carry the `beat-` prefix. */
export function sameBeatId(a: unknown, b: unknown) {
  const clean = (value: unknown) => String(value ?? "").replace(/^beat-/, "");
  return Boolean(clean(a)) && clean(a) === clean(b);
}

export type BeatPlayAction = "pause" | "resume" | "start";

/** What a press should do, decided from what the player is really doing. */
export function beatPlayAction(currentId: unknown, isPlaying: boolean, beatId: unknown): BeatPlayAction {
  if (!sameBeatId(currentId, beatId)) return "start";
  return isPlaying ? "pause" : "resume";
}
