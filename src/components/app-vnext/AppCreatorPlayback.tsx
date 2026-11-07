"use client";

import { useCallback, useRef, useState } from "react";
import { useStationPlayer } from "@/components/StationPlayer";
import type { StationTrack } from "@/lib/station";

type Surface = "ios" | "android";

type AppCreatorPlaybackProps = {
  creatorId: string;
  creatorName: string;
  surface?: Surface;
  startTrackId?: string;
  compact?: boolean;
};

function shuffled<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export default function AppCreatorPlayback({
  creatorId,
  creatorName,
  surface,
  startTrackId,
  compact = false,
}: AppCreatorPlaybackProps) {
  const player = useStationPlayer();
  const cache = useRef<StationTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadTracks = useCallback(async () => {
    if (cache.current) return cache.current;
    const query = surface ? `?surface=${surface}` : "";
    const response = await fetch(`/api/app/creator/${encodeURIComponent(creatorId)}/tracks${query}`, { cache: "no-store" }).catch(() => null);
    const payload = response ? await response.json().catch(() => ({})) as { tracks?: StationTrack[]; error?: string } : {};
    if (!response?.ok) throw new Error(payload.error || "Couldn’t load this creator’s music. Try again.");
    const tracks = (payload.tracks || []).filter((track) => Boolean(track.src));
    cache.current = tracks;
    return tracks;
  }, [creatorId, surface]);

  const play = useCallback(async (shuffle = false) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      let tracks = await loadTracks();
      if (!tracks.length) throw new Error("No songs from this creator are ready to play yet.");
      if (startTrackId && !shuffle && !tracks.some((track) => track.id === startTrackId)) {
        throw new Error("This track isn’t available to play in the app yet.");
      }
      if (shuffle) tracks = shuffled(tracks);
      const startIndex = shuffle || !startTrackId ? 0 : tracks.findIndex((track) => track.id === startTrackId);
      player.playAll(tracks, { from: `${creatorName} · BVS`, startIndex });
      player.setQueueOpen(false);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Couldn’t load this creator’s music. Try again.");
    } finally {
      setLoading(false);
    }
  }, [creatorName, loadTracks, loading, player, startTrackId]);

  if (compact) {
    return (
      <div className="inline-flex flex-col items-start">
        <button
          type="button"
          onClick={() => void play(false)}
          disabled={loading}
          className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5 disabled:opacity-50"
          aria-label={`Play ${creatorName}${startTrackId ? " track" : ""} on BVS`}
        >
          {loading ? "Loading…" : <><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" fill="currentColor" /></svg>Play</>}
        </button>
        {error ? <span role="status" className="mt-1 max-w-48 text-[10px] leading-4 text-[#ff9a92]">{error}</span> : null}
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void play(false)}
          disabled={loading}
          className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5 disabled:opacity-55"
        >
          {loading ? "Loading…" : <><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" fill="currentColor" /></svg>Play</>}
        </button>
        <button
          type="button"
          onClick={() => void play(true)}
          disabled={loading}
          className="bvs-app-pill min-h-11 px-4 disabled:opacity-55"
        >
          Shuffle
        </button>
      </div>
      {error ? <p role="status" className="mt-2 max-w-sm text-xs leading-5 text-[#ff9a92]">{error}</p> : null}
    </div>
  );
}
