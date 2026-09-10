"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { upsertTrackCartLine } from "@/lib/cart-client";

type PurchaseTrack = {
  id: string;
  title: string;
  artist?: string;
  artwork?: string;
  src?: string;
  isDownloadable?: boolean;
  downloadPrice?: number | null;
};

export default function TrackPurchaseHandoffPage() {
  const params = useParams<{ trackId: string }>();
  const trackId = decodeURIComponent(String(params?.trackId || ""));
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const handoff = async () => {
      if (!trackId) {
        setError("This track could not be identified.");
        return;
      }
      try {
        const response = await fetch("/api/station/tracks", { cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as { tracks?: PurchaseTrack[] };
        const track = Array.isArray(payload.tracks)
          ? payload.tracks.find((item) => String(item.id) === trackId)
          : undefined;
        const price = Number(track?.downloadPrice);
        if (!response.ok || !track || !track.isDownloadable || !Number.isFinite(price) || price <= 0) {
          throw new Error("This recording is not currently available for purchase.");
        }
        upsertTrackCartLine({
          id: track.id,
          title: track.title,
          artist: track.artist,
          price,
          artwork: track.artwork,
          src: track.src,
        });
        if (alive) window.location.replace("/checkout");
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not open checkout for this recording.");
      }
    };
    void handoff();
    return () => { alive = false; };
  }, [trackId]);

  return (
    <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS purchase</p>
      <h1 className="mt-3 text-3xl font-semibold">{error ? "Purchase unavailable" : "Opening your track checkout…"}</h1>
      <p className="mt-4 text-text-secondary">
        {error || "We’re carrying the exact recording you chose into the secure BVS web checkout."}
      </p>
      {error ? (
        <div className="mt-7 flex justify-center gap-3">
          <Link href="/catalogue" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Browse music</Link>
          <Link href="/" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">BVS home</Link>
        </div>
      ) : null}
    </main>
  );
}
