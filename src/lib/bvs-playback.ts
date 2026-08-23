import type { StationTrack } from "@/lib/station";

export type BvsPlaybackCommand =
  | { action: "play"; track: StationTrack; from?: string }
  | { action: "play-all"; tracks: StationTrack[]; from?: string }
  | { action: "play-next"; track: StationTrack; from?: string }
  | { action: "add"; track: StationTrack; from?: string };

export function dispatchBvsPlayback(command: BvsPlaybackCommand) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("bvs:queue", { detail: command }));
}

export function playOnBvs(track: StationTrack, opts?: { from?: string }) {
  dispatchBvsPlayback({ action: "play", track, from: opts?.from });
}

export function playAllOnBvs(tracks: StationTrack[], opts?: { from?: string }) {
  dispatchBvsPlayback({ action: "play-all", tracks, from: opts?.from });
}

export function playNextOnBvs(track: StationTrack, opts?: { from?: string }) {
  dispatchBvsPlayback({ action: "play-next", track, from: opts?.from });
}

export function addToBvsQueue(track: StationTrack, opts?: { from?: string }) {
  dispatchBvsPlayback({ action: "add", track, from: opts?.from });
}
