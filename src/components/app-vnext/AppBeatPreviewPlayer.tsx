"use client";

import { useMemo } from "react";
import { useStationPlayer } from "@/components/StationPlayer";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function AppBeatPreviewPlayer({
  title,
  artist,
  preview,
  artwork,
  genre,
}: {
  title: string;
  artist: string;
  preview: string;
  artwork?: string;
  genre?: string;
}) {
  const player = useStationPlayer();
  const isCurrentPreview = player.current?.src === preview;
  const isPlaying = isCurrentPreview && player.isPlaying;
  const duration = isCurrentPreview ? player.duration : 0;
  const elapsed = isCurrentPreview ? player.elapsed : 0;
  const progress = duration > 0 ? Math.min(1, Math.max(0, elapsed / duration)) : 0;

  const previewTrack = useMemo(
    () => ({
      title,
      artist,
      src: preview,
      artwork,
      project: "BeatStore preview",
      genre,
    }),
    [artist, artwork, genre, preview, title],
  );

  const togglePreview = () => {
    if (isCurrentPreview) {
      player.toggle();
      return;
    }

    player.playNow(previewTrack, { from: "BeatStore preview", related: [] });
    player.setQueueOpen(false);
  };

  return (
    <div className="mt-3 rounded-2xl border border-white/[.08] bg-black/20 px-4 py-3" data-bvs-beat-preview-player>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePreview}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-base font-semibold text-black transition hover:bg-brand active:scale-95"
          aria-label={isPlaying ? `Pause ${title} preview` : `Play ${title} preview in BVS player`}
        >
          {isPlaying ? "Ⅱ" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/45">
            <span>{isCurrentPreview ? formatTime(elapsed) : "Preview"}</span>
            <span>{duration > 0 ? `-${formatTime(Math.max(0, duration - elapsed))}` : "BVS player"}</span>
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            disabled={!isCurrentPreview || duration <= 0}
            onChange={(event) => player.seek(Number(event.currentTarget.value) / 1000)}
            aria-label={`Seek ${title} preview`}
            className="h-1.5 w-full cursor-pointer accent-brand disabled:cursor-default disabled:opacity-35"
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-white/38">
        Plays through the persistent BVS player so another recording is paused automatically.
      </p>
    </div>
  );
}
