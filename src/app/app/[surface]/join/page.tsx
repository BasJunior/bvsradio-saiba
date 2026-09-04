import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppJoinPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as AppSurface;
  const next = `/app/${surface}/you`;
  const roles = [
    ["Listener", "Save music, follow creators and join the BVS scene."],
    ["Artist", "Release music and track your path through BVS."],
    ["Producer", "Publish beats, packs and professional work."],
    ["Writer / Show creator", "Build stories and programmes around the culture."],
  ];
  return <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Join BVS</p><h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">One account that grows with your place in music.</h1><p className="mt-4 max-w-2xl text-text-secondary">Listen without an account. Join when you want BVS to remember your path, follow people, enter member spaces or create your own work.</p><div className="mt-7 grid gap-3 sm:grid-cols-2">{roles.map(([title, copy]) => <div key={title} className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-text-secondary">{copy}</p></div>)}</div><div className="mt-7 rounded-[1.75rem] border border-brand/25 bg-brand/[.06] p-5"><h2 className="text-xl font-semibold">Join inside vNext</h2><p className="mt-2 text-sm text-text-secondary">Email signup now stays inside the app shell and preserves the app return path through confirmation. Native Apple/Google buttons are the later signing/capability binding step.</p><div className="mt-5 flex flex-wrap gap-2"><Link href={`/app/${surface}/join/email`} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 font-semibold text-black">Create free account</Link><Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5">Sign in</Link></div></div><p className="mt-5 text-xs text-text-secondary">BVS keeps listening free. Creator roles can be added to the same account later; paid tools do not buy editorial approval or guaranteed streams.</p></div>;
}
