export type StreamQualificationState = {
  playInstanceId: string;
  trackId: string;
  listenedSeconds: number;
  lastWallMs: number;
  lastMediaSeconds: number;
  qualified: boolean;
};

export const QUALIFIED_STREAM_SECONDS = 30;
const MAX_REASONABLE_TICK_SECONDS = 5;

export function createQualificationState(
  trackId: string,
  mediaSeconds = 0,
  wallMs = performance.now(),
): StreamQualificationState {
  return {
    playInstanceId: crypto.randomUUID(),
    trackId,
    listenedSeconds: 0,
    lastWallMs: wallMs,
    lastMediaSeconds: mediaSeconds,
    qualified: false,
  };
}

/**
 * Count only bounded overlap between real media progress and wall-clock progress.
 * Large gaps are treated as seeks, buffering recovery or suspended timers.
 */
export function accumulateListening(
  state: StreamQualificationState,
  mediaSeconds: number,
  wallMs = performance.now(),
) {
  if (state.qualified) return state;

  const wallDelta = Math.max(0, (wallMs - state.lastWallMs) / 1000);
  const mediaDelta = Math.max(0, mediaSeconds - state.lastMediaSeconds);

  state.lastWallMs = wallMs;
  state.lastMediaSeconds = mediaSeconds;

  if (
    wallDelta > MAX_REASONABLE_TICK_SECONDS ||
    mediaDelta > MAX_REASONABLE_TICK_SECONDS
  ) {
    return state;
  }

  if (wallDelta <= 0 || mediaDelta <= 0) return state;

  state.listenedSeconds += Math.min(wallDelta, mediaDelta);
  if (state.listenedSeconds >= QUALIFIED_STREAM_SECONDS) {
    state.qualified = true;
  }

  return state;
}
