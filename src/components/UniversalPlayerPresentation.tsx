"use client";

import { useEffect, useMemo, useRef } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import type { BvsPlaybackCommand } from "@/lib/bvs-playback";

function trackIdentity(id?: string, src?: string) {
  return id || src || "";
}

/**
 * One presentation rule for the whole beta surface:
 * - deliberate play / play-all commands enter Now Playing World;
 * - queue-only and transport actions stay in the current surface;
 * - choosing a different item from an already-open queue also enters Now Playing.
 *
 * StationPlayer remains the only playback source of truth. This component only
 * owns how an explicit playback choice is presented to the user.
 */
export default function UniversalPlayerPresentation() {
  const player = useStationPlayer();
  const currentIdentity = useMemo(
    () => trackIdentity(player.current?.id, player.current?.src),
    [player.current?.id, player.current?.src],
  );
  const previousIdentity = useRef(currentIdentity);

  useEffect(() => {
    const present = () => {
      player.setQueueOpen(false);
      player.openNowPlaying();
    };

    const onPlaybackCommand = (event: Event) => {
      const command = (event as CustomEvent<BvsPlaybackCommand>).detail;
      if (!command || (command.action !== "play" && command.action !== "play-all")) return;

      // StationPlayer also consumes this event. Present on the next microtask so
      // its queue/current-track state is committed first, then suppress the old
      // queue-sheet behavior and reveal the immersive player.
      queueMicrotask(present);
    };

    window.addEventListener("bvs:queue", onPlaybackCommand);
    return () => window.removeEventListener("bvs:queue", onPlaybackCommand);
  }, [player.openNowPlaying, player.setQueueOpen]);

  useEffect(() => {
    const previous = previousIdentity.current;
    previousIdentity.current = currentIdentity;

    // Queue-sheet jumps/history selections are StationPlayer-internal and do
    // not emit a new bvs:queue command. A changed current track while that
    // sheet is open is therefore another explicit "play this now" decision.
    if (!previous || !currentIdentity || previous === currentIdentity) return;
    if (!player.queueOpen || !player.isPlaying) return;

    player.setQueueOpen(false);
    player.openNowPlaying();
  }, [currentIdentity, player.isPlaying, player.openNowPlaying, player.queueOpen, player.setQueueOpen]);

  return null;
}
