import Link from "next/link";
import { Suspense } from "react";
import PremiumInstantClient from "@/components/PremiumInstantClient";

export default function PremiumInstantPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <Link href="/artist/premium" className="inline-flex min-h-11 items-center text-sm text-brand">
        ← Artist Premium
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Artist distribution</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Premium Instant</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Pay only when one approved release is ready to go wider. Your BVS publishing and rotation path stays separate and does not require this fee.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-text-secondary">Opening checkout…</p>}>
          <PremiumInstantClient />
        </Suspense>
      </div>
    </main>
  );
}
