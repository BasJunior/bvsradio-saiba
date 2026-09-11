"use client";

import { useEffect, useRef } from "react";

type EditorialReviewAudioProps = {
  src: string;
  title?: string;
  className?: string;
};

/**
 * Staff review player: play the submission in full, then stop.
 * Does not hand off into the public station rotation.
 */
export default function EditorialReviewAudio({ src, title, className }: EditorialReviewAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const instanceId = useRef(`editorial-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    const pauseIfOtherOwner = (event: Event) => {
      const detail = (event as CustomEvent<{ owner?: string; source?: string }>).detail;
      if (!detail?.owner) return;
      if (detail.owner === "editorial" && detail.source === instanceId.current) return;
      audioRef.current?.pause();
    };
    window.addEventListener("bvs:audio-claim", pauseIfOtherOwner);
    return () => window.removeEventListener("bvs:audio-claim", pauseIfOtherOwner);
  }, []);

  const claim = () => {
    window.dispatchEvent(
      new CustomEvent("bvs:audio-claim", {
        detail: { owner: "editorial", source: instanceId.current },
      }),
    );
  };

  return (
    <audio
      ref={audioRef}
      controls
      preload="none"
      src={src}
      className={className}
      aria-label={title ? `Review ${title}` : "Review audio"}
      onPlay={claim}
      onEnded={() => {
        const el = audioRef.current;
        if (el) el.currentTime = 0;
      }}
    />
  );
}
