"use client";

/**
 * Small bridges into the BVS iOS shell (AppDelegate message handlers).
 * Every call is a no-op on the web and on builds without the handler, so
 * shared components can call them unconditionally.
 */

type HapticStyle = "light" | "medium" | "rigid" | "selection" | "success";

type Handler = { postMessage: (payload: unknown) => void };
type BridgeWindow = Window & {
  webkit?: { messageHandlers?: Record<string, Handler | undefined> };
};

type AirPlayAudio = HTMLAudioElement & { webkitShowPlaybackTargetPicker?: () => void };

function handler(name: string): Handler | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as BridgeWindow).webkit?.messageHandlers?.[name];
}

export function haptic(style: HapticStyle = "light") {
  try {
    handler("bvsHaptics")?.postMessage({ style });
  } catch {
    // Feedback is decorative; never let it interrupt playback.
  }
}

function playerAudio(): AirPlayAudio | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<AirPlayAudio>("audio[data-bvs-station-audio], audio");
}

/** True when this device can show the system audio output picker. */
export function canPickAudioRoute() {
  if (handler("bvsRoutePicker")) return true;
  return typeof playerAudio()?.webkitShowPlaybackTargetPicker === "function";
}

/** Opens AirPlay / Bluetooth output selection (native shell first, then Safari). */
export function pickAudioRoute() {
  const native = handler("bvsRoutePicker");
  if (native) {
    native.postMessage({});
    return true;
  }
  const audio = playerAudio();
  if (typeof audio?.webkitShowPlaybackTargetPicker === "function") {
    audio.webkitShowPlaybackTargetPicker();
    return true;
  }
  return false;
}
