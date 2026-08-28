import Link from "next/link";
import QuickBeatCreate from "@/components/QuickBeatCreate";
import StudioCreateAnalytics from "@/components/StudioCreateAnalytics";

export default function CreateBeatPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <StudioCreateAnalytics intent="beat" />
      <Link href="/creator/studio" className="inline-flex min-h-11 items-center text-sm text-brand">
        ← Studio
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Create · Beat</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Sell a beat</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Upload it, set the starting price and confirm your rights. BVS handles the BeatStore record and editorial workflow behind the scenes.
      </p>
      <div className="mt-8">
        <QuickBeatCreate />
      </div>
    </main>
  );
}
