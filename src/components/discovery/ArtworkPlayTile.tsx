"use client";

import Image from "next/image";

export default function ArtworkPlayTile({
  title,
  subtitle,
  image,
  playing = false,
  canPlay = false,
  commerceLabel,
  meta,
  onPlay,
  onCommerce,
  onOpen,
  layout = "grid",
}: {
  title: string;
  subtitle: string;
  image: string;
  playing?: boolean;
  canPlay?: boolean;
  commerceLabel?: string | null;
  meta?: string;
  onPlay?: () => void;
  onCommerce?: () => void;
  onOpen?: () => void;
  layout?: "grid" | "shelf";
}) {
  const remote = /^https?:\/\//i.test(image) || image.startsWith("/api/media/");
  return (
    <article
      className={`group min-w-0 ${layout === "shelf" ? "w-[min(72vw,12rem)] shrink-0 snap-start" : ""}`}
    >
      <div className="bvs-artwork-play relative aspect-square overflow-hidden bg-black/30">
        <Image
          src={image}
          alt={title}
          fill
          unoptimized={remote}
          sizes={layout === "shelf" ? "192px" : "(max-width: 768px) 50vw, 20vw"}
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        {canPlay && onPlay ? (
          <button
            type="button"
            onClick={onPlay}
            title="Play in site player"
            aria-label={playing ? `Pause ${title}` : `Play ${title}`}
            className="absolute inset-0 grid place-items-center bg-black/0 transition hover:bg-black/25"
          >
            <span className="bvs-artwork-play__control grid h-12 w-12 place-items-center rounded-full bg-brand text-lg font-semibold text-black shadow-[0_10px_28px_rgba(212,175,55,.35)]">
              {playing ? "❚❚" : "▶"}
            </span>
          </button>
        ) : onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="absolute inset-0"
            aria-label={`Open ${title}`}
          />
        ) : null}
      </div>
      <div className="mt-3 min-w-0">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full truncate text-left text-[15px] font-semibold leading-tight hover:text-brand"
        >
          {title}
        </button>
        <p className="mt-0.5 truncate text-sm text-text-secondary">{subtitle}</p>
        {meta ? (
          <p className="mt-0.5 truncate text-xs text-text-secondary">{meta}</p>
        ) : null}
        {commerceLabel && onCommerce ? (
          <button
            type="button"
            onClick={onCommerce}
            className="mt-2 text-sm font-semibold text-brand hover:underline"
          >
            {commerceLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}
