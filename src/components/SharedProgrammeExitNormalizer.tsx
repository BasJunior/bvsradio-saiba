"use client";

import { useEffect, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import type { StationTrack } from "@/lib/station";

function trackKey(track: StationTrack | undefined) {
  return track?.id || track?.src || "";
}

/**
 * Shared programmes can temporarily play station items that are not part of the
 * listener's local rotation. When shared mode is left without selecting another
 * recording (seek, shuffle, Previous-restart, etc.), StationPlayer clears the
 * shared flag first. This small root-level guard makes sure an orphaned shared
 * item cannot remain dressed as a normal station-rotation item afterwards.
 */
export default function SharedProgrammeExitNormalizer() {
  const player = useStationPlayer();
  const wasShared = useRef(false);
  const sharedTrackKey = useRef("");

  useEffect(() => {
    const currentKey = trackKey(player.current);

    if (player.sharedProgramme) {
      wasShared.current = true;
      sharedTrackKey.current = currentKey;
      return;
    }

    if (!wasShared.current) return;
    wasShared.current = false;

    const leftOnSameSharedItem = Boolean(currentKey && currentKey === sharedTrackKey.current);
    sharedTrackKey.current = "";
    if (!leftOnSameSharedItem || player.mode !== "station") return;

    const currentBelongsToRotation = player.tracks.some((track) => {
      if (trackKey(track) === currentKey) return true;
      return Boolean(track.src && player.current?.src && track.src === player.current.src);
    });
    if (currentBelongsToRotation) return;

    // Let the original leave action finish its state batch first. `next()` then
    // resolves against the listener's normal queue/rotation and preserves the
    // current play/pause intent instead of forcing playback on.
    queueMicrotask(() => player.next());
  }, [player.current, player.mode, player.next, player.sharedProgramme, player.tracks]);

  return null;
}
