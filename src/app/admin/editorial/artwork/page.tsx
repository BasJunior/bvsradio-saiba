import Link from "next/link";
import EditorialArtworkQueue from "@/components/EditorialArtworkQueue";

export default function EditorialArtworkPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <Link href="/editorial" className="inline-flex min-h-11 items-center text-sm text-brand">← Editorial</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Editorial · Artwork requests</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Review replacement covers</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:text-base">
        Artist uploads stay private until approval. Approving a replacement updates the selected release, track, beat or pack; rejecting it leaves the current artwork unchanged.
      </p>
      <div className="mt-8"><EditorialArtworkQueue /></div>
    </main>
  );
}
