"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type WorkspaceData = {
  profile: { role: string; display_name?: string; is_producer?: boolean };
  tracks?: Array<{ id: string; editorial_status?: string }>;
  releases?: Array<{ id: string; editorial_status?: string }>;
  distributionJobs?: Array<{ id: string; status?: string }>;
};

export default function CreatorStudioHome() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Account service is not configured.");
      return;
    }
    createClient().auth.getSession().then(async ({ data: sessionData }) => {
      const token = sessionData.session?.access_token;
      if (!token) {
        setError("Sign in with a creator account.");
        return;
      }
      const response = await fetch("/api/creator/workspace", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not open Studio.");
      setData(payload);
    }).catch((issue) => setError(issue instanceof Error ? issue.message : "Could not open Studio."));
  }, []);

  const activity = useMemo(() => {
    const tracks = data?.tracks || [];
    const releases = data?.releases || [];
    const jobs = data?.distributionJobs || [];
    const pending = [...tracks, ...releases].filter((item) =>
      ["submitted", "in_review", "changes_requested"].includes(item.editorial_status || ""),
    ).length;
    const distributing = jobs.filter((job) =>
      ["queued", "submitted", "processing", "delivering"].includes(job.status || ""),
    ).length;
    return { catalogue: tracks.length + releases.length, pending, distributing };
  }, [data]);

  if (error && !data) {
    return (
      <main className="mx-auto min-h-[65vh] max-w-2xl px-5 py-20 text-center sm:px-6">
        <p className="bvs-section-kicker">BVS Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Studio needs your creator account</h1>
        <p className="mt-4 text-text-secondary">{error}</p>
        <Link href="/auth/login?next=/creator/studio" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-6 py-3 font-semibold text-black">Sign in</Link>
      </main>
    );
  }

  if (!data) return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Opening Studio…</main>;

  const artist = ["artist", "admin"].includes(data.profile.role);
  const producer = Boolean(data.profile.is_producer) || data.profile.role === "admin";
  const writer = ["writer", "admin"].includes(data.profile.role);
  const showCreator = ["show_creator", "admin"].includes(data.profile.role);
  const displayName = data.profile.display_name || "creator";

  const actions = [
    artist && { href: "/upload", mark: "01", label: "Release music", copy: "Submit a single, EP or album for BVS editorial review and publishing.", cta: "Start a release" },
    producer && { href: "/creator/studio/manage#beat-pack-upload", mark: "02", label: "Sell a beat", copy: "Upload a beat or pack, follow review and manage your BeatStore catalogue.", cta: "Open beat tools" },
    { href: "/creator/marketplace", mark: "03", label: "Offer a service", copy: "Publish studio, mixing, mastering or creative services under your own provider profile.", cta: "Open Marketplace desk" },
  ].filter(Boolean) as Array<{ href: string; mark: string; label: string; copy: string; cta: string }>;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 px-5 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(212,175,55,.16),transparent_34%),linear-gradient(120deg,rgba(255,255,255,.04),transparent_40%)]" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bvs-chip bvs-chip-brand">BVS Studio</span>
            <span className="bvs-chip">Creator workspace</span>
          </div>
          <h1 className="mt-5 max-w-4xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">What are you trying to do, {displayName}?</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">Start with the job. BVS brings in rights, marketplace, distribution and money tools only when you need them.</p>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Create in BVS">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="bvs-surface bvs-surface-hover group flex min-h-48 flex-col justify-between rounded-[1.6rem] p-5 sm:min-h-52 sm:p-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="bvs-chip bvs-chip-brand">Create</span>
                <span className="font-serif text-3xl text-brand/45 transition group-hover:text-brand/70">{action.mark}</span>
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight group-hover:text-brand">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{action.copy}</p>
            </div>
            <span className="mt-5 text-sm font-semibold text-brand">{action.cta} →</span>
          </Link>
        ))}
      </section>

      <section className="bvs-surface mt-7 rounded-[1.75rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="bvs-section-kicker">Your work</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Manage when you need to</h2>
          </div>
          <Link href="/creator/studio/manage" className="text-sm font-semibold text-brand">Open full Studio →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StudioTile href="/creator/studio/manage#releases" label="Catalogue & status" detail={`${activity.catalogue} item${activity.catalogue === 1 ? "" : "s"}`} />
          <StudioTile href="/creator/studio/manage#money-desk" label="Money" detail="Wallet & settlement" />
          <StudioTile href="/creator/studio/manage#service-orders" label="Orders" detail="Client work" />
          <StudioTile href="/creator/marketplace" label="Profile & storefront" detail="Provider setup" />
        </div>
        {(activity.pending > 0 || activity.distributing > 0) && (
          <div className="mt-5 flex flex-wrap gap-2">
            {activity.pending > 0 && <span className="bvs-chip">{activity.pending} awaiting editorial</span>}
            {activity.distributing > 0 && <span className="bvs-chip bvs-chip-brand">{activity.distributing} distributing</span>}
          </div>
        )}
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2">
        <Link href={artist ? "/artist/premium" : producer ? "/producer/premium" : "/premium"} className="bvs-surface bvs-surface-hover rounded-[1.6rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">Premium</p>
          <h2 className="mt-2 text-xl font-semibold">Choose paid tools only when they fit the work.</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">Distribution and paid creator capabilities stay separate from editorial approval and radio rotation.</p>
          <p className="mt-5 text-sm font-semibold text-brand">Open Premium →</p>
        </Link>
        <div className="bvs-surface-quiet rounded-[1.6rem] p-5 sm:p-6">
          <p className="bvs-section-kicker">Advanced Studio</p>
          <h2 className="mt-2 text-xl font-semibold">Everything is still here.</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">The full beta workspace — release path, BeatStore, insights, marketplace, money, writing and shows — is preserved under Manage.</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Link href="/creator/studio/manage" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Open Manage</Link>
            {writer && <Link href="/creator/studio/manage#writer-work" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Writing</Link>}
            {showCreator && <Link href="/creator/studio/manage#show-work" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Shows</Link>}
          </div>
        </div>
      </section>
    </main>
  );
}

function StudioTile({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="bvs-surface-quiet group flex min-h-[5.5rem] flex-col justify-center rounded-[1.25rem] p-4 transition hover:border-brand/30">
      <p className="font-semibold group-hover:text-brand">{label}</p>
      <p className="mt-1 text-xs text-text-secondary">{detail}</p>
    </Link>
  );
}
