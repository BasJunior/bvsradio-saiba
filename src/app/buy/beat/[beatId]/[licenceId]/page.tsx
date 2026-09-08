"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { upsertBeatLicenceCartLine } from "@/lib/cart-client";

type PurchaseLicence = {
  id?: string;
  licence_name?: string;
  licence_code?: string;
  price_usd?: number | string | null;
  is_active?: boolean;
  is_sold_out?: boolean;
};

type PurchaseBeat = {
  id: string;
  title: string;
  producer?: string;
  artworkUrl?: string;
  previewUrl?: string;
  licences?: PurchaseLicence[];
};

export default function BeatLicencePurchaseHandoffPage() {
  const params = useParams<{ beatId: string; licenceId: string }>();
  const beatId = decodeURIComponent(String(params?.beatId || ""));
  const licenceId = decodeURIComponent(String(params?.licenceId || ""));
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const handoff = async () => {
      if (!beatId || !licenceId) {
        setError("This beat licence could not be identified.");
        return;
      }
      try {
        const response = await fetch("/api/beats", { cache: "no-store" });
        const payload = await response.json().catch(() => ({})) as { beats?: PurchaseBeat[] };
        const beat = Array.isArray(payload.beats)
          ? payload.beats.find((item) => String(item.id) === beatId)
          : undefined;
        const licence = beat?.licences?.find((item) => String(item.id || "") === licenceId);
        const price = Number(licence?.price_usd);
        if (
          !response.ok ||
          !beat ||
          !licence ||
          licence.is_active === false ||
          licence.is_sold_out === true ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          throw new Error("This licence is not currently available for purchase.");
        }

        upsertBeatLicenceCartLine({
          beatId: beat.id,
          licenceOptionId: licenceId,
          title: beat.title,
          producer: beat.producer,
          licenceName: licence.licence_name || licence.licence_code?.replaceAll("_", " ") || "Beat licence",
          price,
          artwork: beat.artworkUrl,
          src: beat.previewUrl,
        });
        if (alive) window.location.replace("/checkout");
      } catch (caught) {
        if (alive) setError(caught instanceof Error ? caught.message : "Could not open checkout for this beat licence.");
      }
    };
    void handoff();
    return () => { alive = false; };
  }, [beatId, licenceId]);

  return (
    <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS BeatStore</p>
      <h1 className="mt-3 text-3xl font-semibold">{error ? "Licence unavailable" : "Opening your licence checkout…"}</h1>
      <p className="mt-4 text-text-secondary">
        {error || "We’re carrying the exact beat and licence tier you chose into the secure BVS web checkout."}
      </p>
      {error ? (
        <div className="mt-7 flex justify-center gap-3">
          <Link href={`/beat/${encodeURIComponent(beatId)}`} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Back to beat</Link>
          <Link href="/catalogue?type=beat#beatstore" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Browse BeatStore</Link>
        </div>
      ) : null}
    </main>
  );
}
