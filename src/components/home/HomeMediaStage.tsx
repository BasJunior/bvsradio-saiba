"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type HomeMediaStageAction = {
  href: string;
  label: string;
  accent?: "listen" | "discover" | "feed" | "beats" | "studio" | "marketplace" | "shows";
};

type HomeMediaStageProps = {
  eyebrow: string;
  title: string;
  description?: string;
  src?: string;
  encodedSources?: string[];
  poster?: string;
  actions?: HomeMediaStageAction[];
  live?: boolean;
};

function decodeBase64Video(encoded: string) {
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: "video/mp4" });
}

export default function HomeMediaStage({
  eyebrow,
  title,
  description,
  src,
  encodedSources = [],
  poster,
  actions = [],
  live = false,
}: HomeMediaStageProps) {
  const [videoSrc, setVideoSrc] = useState(encodedSources.length ? "" : (src || ""));
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!encodedSources.length) {
      setVideoSrc(src || "");
      return;
    }

    const controller = new AbortController();
    let objectUrl = "";

    Promise.all(
      encodedSources.map(async (source) => {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`Unable to load BVS media part: ${source}`);
        return response.text();
      }),
    )
      .then((parts) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(decodeBase64Video(parts.join("")));
        setLoadFailed(false);
        setVideoSrc(objectUrl);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setLoadFailed(true);
        setVideoSrc(src || "");
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [encodedSources, src]);

  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/35 shadow-[0_24px_80px_rgba(0,0,0,.32)]">
      <div className="relative aspect-video overflow-hidden bg-black">
        {videoSrc ? (
          <video
            key={videoSrc}
            className="h-full w-full object-cover"
            src={videoSrc}
            poster={poster}
            autoPlay
            muted
            loop={!live}
            playsInline
            controls
            preload="auto"
            aria-label={`${eyebrow}: ${title}`}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs font-semibold uppercase tracking-[.16em] text-white/45" aria-live="polite">
            Loading BVS video…
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-white backdrop-blur-md">
            {live ? "Live on BVS" : eyebrow}
          </span>
          {live ? (
            <span className="rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-white shadow-lg">
              Live
            </span>
          ) : null}
        </div>

        {loadFailed && !videoSrc ? (
          <p className="absolute inset-x-4 bottom-4 text-center text-xs text-white/60">Video unavailable. Please try again.</p>
        ) : null}
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand sm:text-xs">
            {live ? "Now playing" : eyebrow}
          </p>
          <h1 className="mt-1.5 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {actions.length ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                data-home-accent={action.accent}
                className="bvs-home-accent-button inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur-sm"
              >
                {action.label} →
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
