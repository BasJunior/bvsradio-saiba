import Link from "next/link";
import StudioArtworkClient from "@/components/StudioArtworkClient";

export default function StudioArtworkPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <Link href="/creator/studio" className="inline-flex min-h-11 items-center text-sm text-brand">
        ← Studio
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Studio · Release artwork</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Upload a new cover</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Replace artwork without changing the release itself. BVS keeps the current cover live until editorial approves the new image.
      </p>
      <div className="mt-8">
        <StudioArtworkClient />
      </div>
    </main>
  );
}
