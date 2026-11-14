"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

// Only one product preview plays at a time across the page.
let activeAudio: HTMLAudioElement | null = null;

export default function ProductPreviewButton({
  productId,
  category,
  src,
  title,
  source,
  className = "",
}: {
  productId: string;
  category: string;
  src: string;
  title: string;
  source: "shelf" | "detail";
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracked = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      if (activeAudio === audio) activeAudio = null;
    };
  }, []);

  function toggle() {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(src);
      audio.preload = "none";
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("ended", () => setPlaying(false));
      audio.addEventListener("playing", () => setPlaying(true));
      audio.addEventListener("error", () => {
        setPlaying(false);
        setFailed(true);
      });
      audioRef.current = audio;
    }
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    setFailed(false);
    void audio.play().catch(() => setFailed(true));
    if (!tracked.current) {
      tracked.current = true;
      trackEvent("product_preview_play", { product_id: productId, category, source });
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={`${playing ? "Pause" : "Play"} preview of ${title}`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[.03] px-4 text-sm font-semibold ${className}`}
    >
      <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
      {failed ? "Preview unavailable" : playing ? "Pause preview" : "Play preview"}
    </button>
  );
}
