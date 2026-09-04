"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import type { StationTrack } from "@/lib/station";

type Props = {
  track?: StationTrack | null;
  /** compact chip on mini player; stage = now-playing visual (cover → video) */
  variant?: "compact" | "stage";
  className?: string;
  /** Cover art URL for stage when not watching */
  coverArt?: string | null;
};

/**
 * Optional music-video surface for a rotation track.
 *
 * Product rules (Abias):
 * - Only if an approved video is available
 * - User must select Watch — never auto-open on track change
 * - Station audio remains the rotation clock; when the song ends,
 *   next song in rotation continues as normal (parent onEnded → advance)
 * - Watch state resets on track change
 * - Video defaults muted so BVS audio is not replaced unless user unmutes
 */
export default function MusicVideoWatch({
  track,
  variant = "compact",
  className = "",
  coverArt,
}: Props) {
  const [watching, setWatching] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrl = track?.musicVideoUrl;
  const poster = track?.musicVideoPoster || coverArt || track?.artwork;
  const trackId = track?.id || track?.src || "";

  useEffect(() => {
    setWatching(false);
    const el = videoRef.current;
    if (el) {
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch {
        /* ignore */
      }
    }
  }, [trackId]);

  if (!videoUrl || !track) {
    if (variant !== "stage") return null;
    // stage without video: parent should render cover; still safe
    return null;
  }

  const openWatch = () => {
    setWatching(true);
    trackEvent("player_start", {
      track_id: track.musicVideoId || trackId,
      source: "music_video_watch",
      title: track.title || "",
    });
  };

  const closeWatch = () => {
    setWatching(false);
    try {
      videoRef.current?.pause();
    } catch {
      /* ignore */
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (watching) closeWatch();
          else openWatch();
        }}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold sm:text-xs ${
          watching
            ? "border-white/20 bg-black/50 text-white hover:bg-black/70"
            : "border-brand/40 bg-brand/15 text-brand hover:bg-brand/25"
        } ${className}`}
        aria-label={watching ? "Close music video" : `Watch music video for ${track.title}`}
      >
        {watching ? "Close video" : "Watch"}
      </button>
    );
  }

  // stage — replaces cover when watching; shows cover + Watch CTA otherwise
  if (watching) {
    return (
      <div className={`relative mx-auto w-full ${className}`}>
        <div className="relative mx-auto aspect-video w-full max-h-[min(48vh,24rem)] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black shadow-[0_35px_100px_rgba(0,0,0,.55)] sm:max-h-none sm:rounded-[2rem]">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- artist MV; captions later */}
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            poster={poster || undefined}
            className="h-full w-full object-contain bg-black"
            controls
            playsInline
            muted
            autoPlay
          />
          <button
            type="button"
            onClick={closeWatch}
            className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur"
          >
            Back to cover
          </button>
          <p className="absolute bottom-3 left-3 right-3 rounded-full bg-black/55 px-3 py-1.5 text-center text-[10px] text-white/80 backdrop-blur">
            Optional Watch · BVS audio keeps time · next rotation song continues when this track ends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative mx-auto aspect-square w-full max-h-[min(42vh,18rem)] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5 shadow-[0_35px_100px_rgba(0,0,0,.55)] sm:max-h-none sm:rounded-[2rem]">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={`Artwork for ${track.title}`}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-brand/25 via-white/5 to-black text-4xl font-semibold tracking-[.2em] text-brand">
            BVS
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={openWatch}
        className="w-full rounded-2xl border border-brand/40 bg-brand/10 px-4 py-4 text-left transition hover:border-brand hover:bg-brand/15"
      >
        <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Music video available</span>
        <span className="mt-1 block text-base font-semibold text-white">Watch · {track.title}</span>
        <span className="mt-1 block text-xs text-white/55">
          Optional. Audio rotation stays on — when this song ends, the next track plays as normal.
        </span>
      </button>
    </div>
  );
}
