"use client";

import { useEffect, useState } from "react";
import { upsertBeatLicenceCartLine, upsertTrackCartLine } from "@/lib/cart-client";
import type { PurchaseHandoff } from "@/lib/purchase-handoff-server";

export default function PurchaseHandoffClient({ purchase }: { purchase: PurchaseHandoff }) {
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      if (purchase.kind === "track") {
        upsertTrackCartLine({
          id: purchase.id,
          title: purchase.title,
          artist: purchase.artist,
          price: purchase.price,
          artwork: purchase.artwork,
          src: purchase.src,
        });
      } else {
        upsertBeatLicenceCartLine({
          beatId: purchase.beatId,
          licenceOptionId: purchase.licenceOptionId,
          title: purchase.title,
          producer: purchase.producer,
          licenceName: purchase.licenceName,
          price: purchase.price,
          artwork: purchase.artwork,
          src: purchase.src,
        });
      }
      window.location.replace("/checkout");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not prepare checkout.");
    }
  }, [purchase]);

  return (
    <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS purchase</p>
      <h1 className="mt-3 text-3xl font-semibold">{error ? "Checkout needs attention" : "Opening your checkout…"}</h1>
      <p className="mt-4 text-text-secondary">
        {error || "We’re carrying the exact item you selected into the secure BVS web checkout."}
      </p>
    </main>
  );
}
