import Link from "next/link";
import PurchaseHandoffClient from "@/components/PurchaseHandoffClient";
import { resolveBeatPurchase, resolveTrackPurchase } from "@/lib/purchase-handoff-server";

export const dynamic = "force-dynamic";

type Query = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function BuyPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const trackId = one(query.track).trim();
  const beatId = one(query.beat).trim();
  const licenceId = one(query.licence).trim();

  const purchase = trackId
    ? await resolveTrackPurchase(trackId)
    : beatId && licenceId
      ? await resolveBeatPurchase(beatId, licenceId)
      : null;

  if (purchase) return <PurchaseHandoffClient purchase={purchase} />;

  return (
    <main className="mx-auto min-h-[60vh] max-w-xl px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS purchase</p>
      <h1 className="mt-3 text-3xl font-semibold">Purchase unavailable</h1>
      <p className="mt-4 text-text-secondary">
        This item is no longer available at that purchase link. Nothing has been added to your cart.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/catalogue" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Browse music</Link>
        <Link href="/marketplace" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Marketplace</Link>
        <Link href="/" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">BVS home</Link>
      </div>
    </main>
  );
}
