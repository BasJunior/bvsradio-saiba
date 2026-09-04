"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { upsertTrackCartLine } from "@/lib/cart-client";
import type { StationTrack } from "@/lib/station";

function sellablePrice(track: StationTrack | null | undefined): number | null {
  if (!track?.id) return null;
  if (!track.isDownloadable) return null;
  const price = Number(track.downloadPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  return price;
}

type Props = {
  track?: StationTrack | null;
  /** compact = mini player chip; full = now-playing card */
  variant?: "compact" | "full";
  className?: string;
  onAfterAdd?: () => void;
};

/**
 * Primary sales CTA from the listening surface.
 * Free stream stays free; Buy adds a personal download and opens checkout.
 */
export default function BuyTrackButton({
  track,
  variant = "full",
  className = "",
  onAfterAdd,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const price = sellablePrice(track);

  if (!track || price === null) return null;

  const label =
    variant === "compact" ? `Buy · $${price.toFixed(price % 1 ? 2 : 0)}` : `Buy / Support · $${price.toFixed(2)}`;

  const onBuy = () => {
    if (!track.id || busy) return;
    setBusy(true);
    try {
      upsertTrackCartLine({
        id: track.id,
        title: track.title,
        artist: track.artist,
        price,
        artwork: track.artwork,
        src: track.src,
      });
      trackEvent("checkout_started", {
        source: "player_buy_cta",
        track_id: track.id,
        price,
        variant,
      });
      onAfterAdd?.();
      router.push("/checkout");
    } finally {
      setBusy(false);
    }
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onBuy();
        }}
        disabled={busy}
        className={`shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-white/90 disabled:opacity-50 sm:text-xs ${className}`}
        aria-label={`Buy ${track.title} for $${price.toFixed(2)}`}
      >
        {busy ? "…" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={busy}
      className={`rounded-2xl border border-brand/50 bg-brand px-4 py-4 text-left text-black shadow-[0_0_0_1px_rgba(0,0,0,.2)] transition hover:brightness-110 disabled:opacity-50 ${className}`}
      aria-label={`Buy or support ${track.title} for $${price.toFixed(2)}`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/70">
        Support the artist
      </span>
      <span className="mt-1 block text-base font-semibold">
        {busy ? "Opening checkout…" : label}
      </span>
      <span className="mt-1 block text-xs text-black/65">
        Keep streaming free — buy a personal download when you want to own it.
      </span>
    </button>
  );
}

export function trackIsBuyable(track?: StationTrack | null) {
  return sellablePrice(track) !== null;
}
