"use client";

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
 *
 * The href is pinned to the canonical production website so an App Store build
 * served from a beta/preview origin can never hand the buyer into beta checkout.
 */
export default function BuyTrackButton({
  track,
  variant = "full",
  className = "",
  onAfterAdd,
}: Props) {
  const [busy, setBusy] = useState(false);
  const price = sellablePrice(track);

  if (!track || price === null) return null;

  const trackId = String(track.id || "");
  const label =
    variant === "compact" ? `Buy · $${price.toFixed(price % 1 ? 2 : 0)}` : `Buy / Support · $${price.toFixed(2)}`;
  const purchasePath = `/buy/${encodeURIComponent(trackId)}`;
  const purchaseHref = `https://bvsradio.com${purchasePath}`;

  const prepareWebCart = () => {
    if (!trackId || busy) return;
    setBusy(true);
    upsertTrackCartLine({
      id: trackId,
      title: track.title,
      artist: track.artist,
      price,
      artwork: track.artwork,
      src: track.src,
    });
    trackEvent("checkout_started", {
      source: "player_buy_cta",
      track_id: trackId,
      price,
      variant,
    });
    onAfterAdd?.();
  };

  if (variant === "compact") {
    return (
      <a
        href={purchaseHref}
        onClick={(event) => {
          event.stopPropagation();
          prepareWebCart();
        }}
        className={`shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:bg-white/90 sm:text-xs ${className}`}
        aria-label={`Buy ${track.title} for $${price.toFixed(2)} on BVS web checkout`}
      >
        {busy ? "Opening…" : label}
      </a>
    );
  }

  return (
    <a
      href={purchaseHref}
      onClick={prepareWebCart}
      className={`block rounded-2xl border border-brand/50 bg-brand px-4 py-4 text-left text-black shadow-[0_0_0_1px_rgba(0,0,0,.2)] transition hover:brightness-110 ${className}`}
      aria-label={`Buy or support ${track.title} for $${price.toFixed(2)} on BVS web checkout`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-black/70">
        Support the artist
      </span>
      <span className="mt-1 block text-base font-semibold">
        {busy ? "Opening web checkout…" : label}
      </span>
      <span className="mt-1 block text-xs text-black/65">
        Keep streaming free — buy a personal download when you want to own it.
      </span>
    </a>
  );
}

export function trackIsBuyable(track?: StationTrack | null) {
  return sellablePrice(track) !== null;
}
