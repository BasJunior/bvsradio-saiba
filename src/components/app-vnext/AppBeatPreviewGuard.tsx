"use client";

import { useEffect } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { GUEST_BEAT_PREVIEW_SECONDS } from "@/components/app-vnext/AppBeatPreviewPlayer";
import { useStationPlayer } from "@/components/StationPlayer";

function isBeatStorePreview(project?: string) {
  return project === "BeatStore preview" || project === "BeatStore member preview";
}

export default function AppBeatPreviewGuard() {
  const { signedIn, loading } = useAppSession();
  const player = useStationPlayer();

  useEffect(() => {
    if (loading || signedIn || !isBeatStorePreview(player.current?.project)) return;
    if (!Number.isFinite(player.duration) || player.duration <= GUEST_BEAT_PREVIEW_SECONDS) return;
    if (player.elapsed < GUEST_BEAT_PREVIEW_SECONDS - 0.15) return;

    if (player.elapsed > GUEST_BEAT_PREVIEW_SECONDS + 0.15) {
      player.seek(GUEST_BEAT_PREVIEW_SECONDS / player.duration);
    }
    if (player.isPlaying) player.toggle();
  }, [loading, player, player.current?.project, player.duration, player.elapsed, player.isPlaying, signedIn]);

  return null;
}
