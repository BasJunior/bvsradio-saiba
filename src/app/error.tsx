"use client";

import Link from "next/link";

export default function RouteError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section data-bvs-route-error className="mx-auto flex min-h-[55dvh] max-w-xl items-center px-4 py-16">
      <div role="alert" className="w-full rounded-3xl border border-white/10 bg-white/[.035] p-6 shadow-2xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS recovery</p>
        <h1 className="mt-3 text-3xl font-semibold">This screen didn’t load.</h1>
        <p className="mt-3 text-sm text-text-secondary">
          Your player and session are still here. Try this screen again, or return home and keep listening.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={retry} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">
            Try again
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-text-primary hover:border-brand/50">
            Back to BVS
          </Link>
        </div>
      </div>
    </section>
  );
}
