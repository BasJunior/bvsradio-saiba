"use client";

import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

export default function AppJoinCard({ surface }: { surface: AppSurface }) {
  const { user, loading, isCreator } = useAppSession();
  if (loading) return <div className="h-32 animate-pulse rounded-[1.75rem] border border-white/10 bg-white/[.025]" aria-hidden="true" />;
  if (user) {
    return (
      <section className="rounded-[1.75rem] border border-brand/20 bg-gradient-to-br from-brand/[.10] to-white/[.02] p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Your BVS</p>
        <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">Welcome back.</h2>
            <p className="mt-2 max-w-xl text-sm text-text-secondary">
              Your saves, follows and BVS identity travel with you. {isCreator ? "Your Studio is ready when you need to work." : "If you make music, this same account can grow into a creator workspace."}
            </p>
          </div>
          <Link href={`/app/${surface}/${isCreator ? "studio" : "library"}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-black">
            {isCreator ? "Open Studio" : "Open Library"}
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-[1.75rem] border border-brand/25 bg-gradient-to-br from-brand/[.12] via-white/[.035] to-transparent p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Join BVS when it matters</p>
      <h2 className="mt-2 text-2xl font-semibold">Listen first. Keep what you love.</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
        Save music, follow Zimbabwe’s creators, join live rooms and upload your own work when you’re ready. One BVS account grows with you.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/app/${surface}/join`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Join BVS</Link>
        <Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}`)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold hover:border-brand/40">Sign in</Link>
      </div>
    </section>
  );
}
