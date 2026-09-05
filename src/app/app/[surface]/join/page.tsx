import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppJoinPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as AppSurface;
  const next = `/app/${surface}/you`;
  const roles = [
    ["Listener", "Save music, follow creators, build playlists and keep your Library in sync."],
    ["Artist", "Release music, follow review and understand what happens after you submit."],
    ["Producer", "Publish beats, build packs and manage your producer catalogue."],
    ["Writer / Show creator", "Create stories, shows and episodes through the same BVS identity."],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Join BVS</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">One account for every side of music.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/44 sm:text-base">Listen without an account. Join when you want your music, follows, playlists, creator access and activity to stay connected.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {roles.map(([title, copy]) => (
          <div key={title} className="rounded-[1.4rem] border border-white/[.07] bg-white/[.025] p-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/38">{copy}</p>
          </div>
        ))}
      </div>

      <section className="relative mt-8 overflow-hidden rounded-[1.8rem] border border-brand/16 bg-gradient-to-br from-brand/[.065] via-white/[.02] to-transparent p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-brand/[.08] blur-3xl" />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Start free</p>
          <h2 className="mt-2 text-3xl font-semibold">Create your BVS identity.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Choose what you want to do first. You can grow the same account into more creator access later.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href={`/app/${surface}/join/email`} className="inline-flex min-h-11 items-center rounded-full bg-white px-5 font-semibold text-black transition hover:bg-brand">Create account</Link>
            <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/[.1] px-5 text-white/64 transition hover:border-white/20 hover:text-white">Sign in</Link>
          </div>
        </div>
      </section>

      <p className="mt-6 text-xs leading-5 text-white/30">Listening stays free. Creator access and paid tools remain separate from editorial approval or guaranteed audience results.</p>
    </div>
  );
}
