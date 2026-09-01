"use client";

import Link from "next/link";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

const roles = [
  ["Artist", "Release music, follow editorial review and track distribution."],
  ["Producer", "Publish beats, manage packs, licences and BeatStore work."],
  ["Writer", "Work on BVS stories and research briefs."],
  ["Show creator", "Develop programmes, episodes and live-show workflows."],
];

export default function AppStudioClient({ surface }: { surface: AppSurface }) {
  const { loading, signedIn, isCreator, access, premiumActive, premiumPlanLabel } = useAppSession();
  if (loading) return <div className="mx-auto max-w-5xl px-4 pt-8"><div className="h-48 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;

  if (!signedIn) return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">Create on BVS</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Start as a listener. Grow into a creator.</h1><p className="mt-4 max-w-2xl text-text-secondary">Your BVS identity can become an artist, producer, writer or show-creator workspace without creating another account.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><div className="mt-7 flex flex-wrap gap-2"><Link href={`/app/${surface}/join`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Join BVS</Link><Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/studio`)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5">Sign in</Link></div></div>
  );

  if (!isCreator) return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">Create on BVS</p><h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Your account is ready for the next role.</h1><p className="mt-4 max-w-2xl text-text-secondary">Listening remains available to every BVS account. Creator roles add publishing and business tools after the appropriate BVS workflow.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><Link href="/account" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Open role application</Link></div>
  );

  const work = [
    { href: "/creator/studio/manage#artist-upload", title: "Release music", copy: "Upload a single, EP or album and keep editorial status close." },
    { href: "/creator/studio/manage#beat-pack-upload", title: "BeatStore", copy: "Upload beats or packs and manage the producer catalogue." },
    { href: "/creator/studio/manage#insights", title: "Insights", copy: "See performance and editorial signals around your work." },
    { href: "/creator/studio/manage#money-desk", title: "Money", copy: "Review wallet and settlement visibility without mixing streams and payable money." },
    { href: "/creator/studio/manage#marketplace-desk", title: "Marketplace", copy: "Manage creator listings and professional services." },
    { href: "/creator/studio/manage#service-orders", title: "Orders", copy: "Track customer service work and delivery." },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Studio</p>
      <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">What needs you today?</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Mobile Studio is task-first: release, respond, sell, deliver and understand your money.</p></div>{premiumActive ? <span className="shrink-0 rounded-full border border-brand/35 bg-brand/10 px-4 py-2 text-xs font-semibold text-brand">Premium · {premiumPlanLabel || "Active"}</span> : null}</div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2">{work.map((item) => <Link key={item.href} href={item.href} className="rounded-[1.5rem] border border-white/10 bg-white/[.025] p-5 transition hover:-translate-y-0.5 hover:border-brand/35"><p className="text-xs uppercase tracking-[.14em] text-brand">Open workflow</p><h2 className="mt-2 text-xl font-semibold">{item.title}</h2><p className="mt-2 text-sm text-text-secondary">{item.copy}</p></Link>)}</div>
      <div className="mt-7 flex flex-wrap gap-2 text-xs text-text-secondary"><span className="rounded-full border border-white/10 px-3 py-1.5">Artist {access?.artist ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Producer {access?.producer ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Writer {access?.writer ? "✓" : ""}</span><span className="rounded-full border border-white/10 px-3 py-1.5">Shows {access?.showCreator ? "✓" : ""}</span></div>
    </div>
  );
}
