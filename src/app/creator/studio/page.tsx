"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type WorkspaceData = {
  profile: {
    role: string;
    display_name?: string;
    is_producer?: boolean;
  };
  tracks?: Array<{ id: string; editorial_status?: string }>;
  releases?: Array<{ id: string; editorial_status?: string }>;
  distributionJobs?: Array<{ id: string; status?: string }>;
};

const legacyStudioAnchors = new Set([
  "artist-access",
  "artist-upload",
  "release-path",
  "releases",
  "insights",
  "producer-access",
  "beat-pack-upload",
  "beat-single-upload",
  "beatstore",
  "business",
  "money-desk",
  "marketplace-desk",
  "service-orders",
  "premium-desk",
  "writer-work",
  "show-work",
  "broadcast",
]);

export default function CreatorStudioHome() {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && legacyStudioAnchors.has(hash)) {
      window.location.replace(`/creator/studio/manage#${hash}`);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Account service is not configured.");
      return;
    }
    void createClient()
      .auth.getSession()
      .then(async ({ data: sessionData }) => {
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
        if (!response.ok) {
          setError(payload.error || "Could not open Studio.");
          return;
        }
        setData(payload);
      })
      .catch(() => setError("Could not open Studio."));
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
      <main className="mx-auto min-h-[65vh] max-w-2xl px-6 py-20 text-center">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Studio</p>
        <h1 className="mt-3 text-3xl font-semibold">Studio needs your creator account</h1>
        <p className="mt-4 text-text-secondary">{error}</p>
        <Link href="/auth/login?next=/creator/studio" className="mt-6 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-black">
          Sign in
        </Link>
      </main>
    );
  }

  if (!data) {
    return <main className="min-h-[65vh] p-20 text-center text-text-secondary">Opening Studio…</main>;
  }

  const artist = ["artist", "admin"].includes(data.profile.role);
  const producer = Boolean(data.profile.is_producer) || data.profile.role === "admin";
  const writer = ["writer", "admin"].includes(data.profile.role);
  const showCreator = ["show_creator", "admin"].includes(data.profile.role);
  const displayName = data.profile.display_name || "creator";

  const createActions = [
    artist && {
      href: "/creator/studio/create/release",
      label: "Release music",
      copy: "Send a single, EP or album to BVS for rights checks, review and distribution.",
      cta: "Start a release",
    },
    producer && {
      href: "/creator/studio/create/beat",
      label: "Sell a beat",
      copy: "Upload the beat, choose a price and send it to BVS. We handle the BeatStore listing behind the scenes.",
      cta: "Post a beat",
    },
    {
      href: "/creator/studio/create/service",
      label: "Offer a service",
      copy: "List mixing, mastering, production, artwork or another music service without navigating the full marketplace desk.",
      cta: "Add a service",
    },
  ].filter(Boolean) as Array<{ href: string; label: string; copy: string; cta: string }>;

  return (
    <main className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Studio</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">What are you trying to do, {displayName}?</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Start with the job. BVS will bring in rights, marketplace, distribution and money tools only when they are needed.
      </p>

      <section className="mt-8 grid gap-3 md:grid-cols-3" aria-label="Create in BVS">
        {createActions.map((action, index) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex min-h-52 flex-col justify-between rounded-3xl border border-white/10 bg-white/[.025] p-6 transition hover:border-brand/45 hover:bg-brand/[.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <div>
              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-brand/30 bg-brand/10 px-2 text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <h2 className="mt-5 text-2xl font-semibold group-hover:text-brand">{action.label}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{action.copy}</p>
            </div>
            <span className="mt-6 text-sm font-semibold text-brand">{action.cta} →</span>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Your work</p>
            <h2 className="mt-2 text-xl font-semibold">Manage when you need to</h2>
          </div>
          <Link href="/creator/studio/manage" className="text-sm text-brand">Open full Studio →</Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ManageLink href="/creator/studio/manage#releases" label="Catalogue & status" detail={`${activity.catalogue} item${activity.catalogue === 1 ? "" : "s"}`} />
          <ManageLink href="/artists" label="Money" detail="Wallet & earnings" />
          <ManageLink href="/creator/studio/manage#service-orders" label="Orders" detail="Client work" />
          <ManageLink href="/creator/marketplace" label="Profile & storefront" detail="Advanced setup" />
        </div>
        {(activity.pending > 0 || activity.distributing > 0) && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-text-secondary">
            {activity.pending > 0 && <span className="rounded-full border border-white/10 px-3 py-1.5">{activity.pending} awaiting editorial action</span>}
            {activity.distributing > 0 && <span className="rounded-full border border-white/10 px-3 py-1.5">{activity.distributing} moving through distribution</span>}
          </div>
        )}
      </section>

      {(writer || showCreator) && (
        <section className="mt-6 flex flex-wrap gap-2 text-sm">
          {writer && <Link href="/creator/studio/manage#writer-work" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Writing tools</Link>}
          {showCreator && <Link href="/creator/studio/manage#show-work" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Show & broadcast tools</Link>}
        </section>
      )}
    </main>
  );
}

function ManageLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-white/10 p-4 transition hover:border-brand/35 hover:bg-white/[.025]">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-xs text-text-secondary">{detail}</p>
    </Link>
  );
}
