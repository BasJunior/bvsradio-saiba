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
    if (!response?.ok) throw new Error(payload.error || "Creator playback is unavailable.");
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
      if (!tracks.length) throw new Error("No BVS-playable tracks are available for this creator yet.");
      if (startTrackId && !shuffle && !tracks.some((track) => track.id === startTrackId)) {
        throw new Error("This track is not cleared for playback on this BVS surface.");
      }
      if (shuffle) tracks = shuffled(tracks);
      const startIndex = shuffle || !startTrackId ? 0 : tracks.findIndex((track) => track.id === startTrackId);
      player.playAll(tracks, { from: `${creatorName} · BVS`, startIndex });
      player.setQueueOpen(false);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Creator playback is unavailable.");
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
          className="min-h-9 rounded-full border border-brand/30 bg-brand/[.08] px-3 text-xs font-semibold text-brand transition hover:bg-brand/15 disabled:opacity-50"
          aria-label={`Play ${creatorName}${startTrackId ? " track" : ""} on BVS`}
        >
          {loading ? "Loading…" : "▶ Play"}
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
          className="min-h-11 rounded-full bg-brand px-5 text-sm font-bold text-black shadow-[0_8px_28px_rgba(227,189,88,.16)] transition hover:brightness-105 disabled:opacity-55"
        >
          {loading ? "Loading…" : "▶ Play"}
        </button>
        <button
          type="button"
          onClick={() => void play(true)}
          disabled={loading}
          className="min-h-11 rounded-full border border-white/15 px-4 text-sm font-semibold text-white/72 transition hover:border-brand/35 hover:text-brand disabled:opacity-55"
        >
          Shuffle
        </button>
      </div>
      {error ? <p role="status" className="mt-2 max-w-sm text-xs leading-5 text-[#ff9a92]">{error}</p> : null}
    </div>
  );
}
