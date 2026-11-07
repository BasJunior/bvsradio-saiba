/* eslint-disable @next/next/no-img-element -- covers come from signed media redirects */
import type { ReactNode } from "react";

/** Shared Library / Playlist visuals: cover mosaics, Liked cover and icons. */

export type LibIconName =
  | "heart"
  | "playlist"
  | "download"
  | "clock"
  | "people"
  | "plus"
  | "play"
  | "shuffle"
  | "more"
  | "chevron"
  | "share"
  | "lock"
  | "globe"
  | "edit"
  | "reorder"
  | "trash"
  | "queue"
  | "next"
  | "search"
  | "up"
  | "down"
  | "close"
  | "trending"
  | "sparkle"
  | "sliders"
  | "mic"
  | "waveform"
  | "chat"
  | "repost"
  | "upload"
  | "chart"
  | "wallet"
  | "briefcase"
  | "pen"
  | "radio"
  | "check";

const paths: Record<LibIconName, ReactNode> = {
  heart: <path d="M12 20.2s-7.6-4.6-8.9-9.6C2.2 7.2 4.4 4.5 7.4 4.5c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 3 0 5.2 2.7 4.3 6.1-1.3 5-8.9 9.6-8.9 9.6Z" />,
  playlist: <><path d="M4 6h11M4 11h11M4 16h6" /><path d="M18 8v8.2" /><circle cx="15.8" cy="16.6" r="2.2" /><path d="M18 8l3-1" /></>,
  download: <><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M5 19.5h14" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.2c2.3.1 4 1.6 4.5 4.3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" fill="currentColor" stroke="none" />,
  shuffle: <><path d="M3 7h3.2c1.6 0 3 .8 3.9 2.1l3.8 5.8c.9 1.3 2.3 2.1 3.9 2.1H21" /><path d="M3 17h3.2c1.6 0 3-.8 3.9-2.1M13.9 9.1c.9-1.3 2.3-2.1 3.9-2.1H21" /><path d="m18.5 4.5 2.5 2.5-2.5 2.5M18.5 14.5l2.5 2.5-2.5 2.5" /></>,
  more: <><circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  share: <><path d="M12 15V4" /><path d="m7.5 8.5 4.5-4.5 4.5 4.5" /><path d="M6 12.5v6.5h12v-6.5" /></>,
  lock: <><rect x="5.5" y="10.5" width="13" height="9" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  globe: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.2 2.4 3.2 5 3.2 8s-1 5.6-3.2 8c-2.2-2.4-3.2-5-3.2-8s1-5.6 3.2-8Z" /></>,
  edit: <><path d="M4.5 19.5h4l10-10-4-4-10 10v4Z" /><path d="m13 7 4 4" /></>,
  reorder: <><path d="M5 8h14M5 12h14M5 16h14" /></>,
  trash: <><path d="M5 7h14M9.5 7V4.8h5V7M7 7l.8 12.2h8.4L17 7" /></>,
  queue: <><path d="M4 6h12M4 11h12M4 16h7" /><path d="M15 14.2v5.6l4.8-2.8-4.8-2.8Z" fill="currentColor" stroke="none" /></>,
  next: <><path d="M4.5 6.2v11.6l8.8-5.8-8.8-5.8Z" fill="currentColor" stroke="none" /><path d="M17 5v14" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.2" /><path d="m15.5 15.5 4.2 4.2" /></>,
  up: <path d="m6 14.5 6-6 6 6" />,
  down: <path d="m6 9.5 6 6 6-6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  trending: <><path d="m3.5 16.5 6-6 4 4 7-7.5" /><path d="M15 7h5.5v5.5" /></>,
  sparkle: <><path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5Z" /><path d="M18.5 15.5c.3 1.9.9 2.5 2.8 2.8-1.9.3-2.5.9-2.8 2.8-.3-1.9-.9-2.5-2.8-2.8 1.9-.3 2.5-.9 2.8-2.8Z" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>,
  waveform: <path d="M4 10v4M8 6.5v11M12 4v16M16 8v8M20 10.5v3" />,
  chat: <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />,
  repost: <><path d="M4.5 10V8.5a2 2 0 0 1 2-2H18" /><path d="m15.5 4 2.5 2.5L15.5 9" /><path d="M19.5 14v1.5a2 2 0 0 1-2 2H6" /><path d="M8.5 20 6 17.5 8.5 15" /></>,
  upload: <><path d="M12 15.5V4.5" /><path d="m7.5 9 4.5-4.5L16.5 9" /><path d="M5 19.5h14" /></>,
  chart: <><path d="M4.5 19.5h15" /><path d="M7.5 16v-5M12 16V7M16.5 16v-8" /></>,
  wallet: <><rect x="3.5" y="6.5" width="17" height="12" rx="2" /><path d="M3.5 10h17" /><circle cx="16.5" cy="14.3" r="1" fill="currentColor" stroke="none" /></>,
  briefcase: <><rect x="3.5" y="7.5" width="17" height="11.5" rx="2" /><path d="M9 7.5V5.5h6v2M3.5 12.5h17" /></>,
  pen: <><path d="M14.5 5.5l4 4L9 19H5v-4l9.5-9.5Z" /><path d="M12.5 7.5l4 4" /></>,
  radio: <><rect x="3.5" y="8.5" width="17" height="11" rx="2" /><path d="M7 8.5 16.5 4" /><circle cx="15.5" cy="14" r="2.5" /><path d="M7 12.5h3M7 15.5h3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export function LibIcon({ name, size = 20, className }: { name: LibIconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}

/** Deterministic, on-brand gradient for playlists without artwork. */
function seedGradient(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const palettes = [
    ["#c4f343", "#2c3a12"],
    ["#a98bff", "#1d1640"],
    ["#5ec8ff", "#0f2a3a"],
    ["#ff8a5c", "#3a1a10"],
    ["#ff6fb5", "#3a1028"],
    ["#ffd25c", "#3a2e10"],
  ];
  const [a, b] = palettes[hash % palettes.length];
  return `linear-gradient(140deg, ${a} 0%, ${b} 78%)`;
}

/**
 * Apple Music-style cover: one image fills the square, two or more form a 2x2
 * mosaic, none falls back to a seeded gradient with a playlist glyph.
 */
export function CoverMosaic({
  images,
  seed,
  className = "",
  rounded = "rounded-xl",
  label,
}: {
  images: Array<string | null | undefined>;
  seed: string;
  className?: string;
  rounded?: string;
  label?: string;
}) {
  const art = images.filter((src): src is string => Boolean(src)).slice(0, 4);
  const tiles = art.length >= 2 ? [0, 1, 2, 3].map((index) => art[index % art.length]) : [];
  return (
    <span
      className={`relative block aspect-square overflow-hidden bg-white/[.04] shadow-[0_14px_34px_-16px_rgba(0,0,0,.9)] ${rounded} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {art.length === 1 ? (
        <img src={art[0]} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : art.length >= 2 ? (
        <span className="grid h-full w-full grid-cols-2 grid-rows-2">
          {tiles.map((src, index) => (
            <img key={`${src}-${index}`} src={src} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ))}
        </span>
      ) : (
        <span className="grid h-full w-full place-items-center text-black/70" style={{ background: seedGradient(seed) }}>
          <LibIcon name="playlist" size={34} className="opacity-80" />
        </span>
      )}
    </span>
  );
}

/** The pinned "Liked Music" cover, in the BVS lime-to-violet gradient. */
export function LikedCover({ className = "", rounded = "rounded-xl" }: { className?: string; rounded?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid aspect-square place-items-center text-white shadow-[0_14px_34px_-16px_rgba(0,0,0,.9)] ${rounded} ${className}`}
      style={{ background: "linear-gradient(140deg, #a98bff 0%, #5b3fd6 45%, #1c1240 100%)" }}
    >
      <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 drop-shadow-[0_6px_14px_rgba(0,0,0,.35)]" aria-hidden="true">
        <path d="M12 20.2s-7.6-4.6-8.9-9.6C2.2 7.2 4.4 4.5 7.4 4.5c1.9 0 3.4 1 4.6 2.6 1.2-1.6 2.7-2.6 4.6-2.6 3 0 5.2 2.7 4.3 6.1-1.3 5-8.9 9.6-8.9 9.6Z" fill="currentColor" />
      </svg>
    </span>
  );
}

export function formatTotalDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function formatTrackDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
