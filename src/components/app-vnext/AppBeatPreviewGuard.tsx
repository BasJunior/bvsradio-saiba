"use client";

import { useEffect } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { GUEST_BEAT_PREVIEW_SECONDS } from "@/components/app-vnext/AppBeatPreviewPlayer";
import { useStationPlayer, useStationPlayerProgress } from "@/components/StationPlayer";

function isBeatStorePreview(project?: string) {
  return project === "BeatStore preview" || project === "BeatStore member preview";
}

export default function AppBeatPreviewGuard() {
  const { signedIn, loading } = useAppSession();
  const player = useStationPlayer();
  const progress = useStationPlayerProgress();

  useEffect(() => {
    if (loading || signedIn || !isBeatStorePreview(player.current?.project)) return;
    if (!Number.isFinite(progress.duration) || progress.duration <= GUEST_BEAT_PREVIEW_SECONDS) return;
    if (progress.elapsed < GUEST_BEAT_PREVIEW_SECONDS - 0.15) return;

    if (progress.elapsed > GUEST_BEAT_PREVIEW_SECONDS + 0.15) {
      player.seek(GUEST_BEAT_PREVIEW_SECONDS / progress.duration);
    }
    if (player.isPlaying) player.toggle();
  }, [loading, player, player.current?.project, progress.duration, progress.elapsed, player.isPlaying, signedIn]);

  return null;
}
