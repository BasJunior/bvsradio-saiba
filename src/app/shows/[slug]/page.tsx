import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { shows } from "@/lib/station";
import { getPublicProgramme } from "@/lib/station-content";

export function generateStaticParams() { return shows.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const show = await getPublicProgramme((await params).slug); return show ? { title: show.title, description: show.description } : {}; }

export default async function ShowPage({ params }: { params: Promise<{ slug: string }> }) {
  const show = await getPublicProgramme((await params).slug); if (!show) notFound();
  return <div className="mx-auto max-w-5xl px-6 py-14"><Link href="/shows" className="text-sm text-brand hover:underline">← All shows</Link><section className="mt-8 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]"><div><span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">Programme preview</span><h1 className="mt-5 text-5xl font-semibold">{show.title}</h1><p className="mt-3 text-xl text-brand">{show.tagline}</p><p className="mt-6 text-lg text-text-secondary">{show.description}</p><dl className="mt-8 grid gap-5 rounded-2xl border border-white/10 bg-white/[.03] p-6 sm:grid-cols-2"><div><dt className="text-xs uppercase tracking-wider text-text-secondary">Presented by</dt><dd className="mt-1 font-medium">{show.host}</dd></div><div><dt className="text-xs uppercase tracking-wider text-text-secondary">Planned slot</dt><dd className="mt-1 font-medium">{show.schedule}</dd></div></dl><div className="mt-8 rounded-xl border border-white/10 p-5"><h2 className="font-semibold">Episodes will appear here</h2><p className="mt-2 text-sm text-text-secondary">We will publish real recordings, guest details and track information after production begins—no filler episodes or invented play counts.</p></div></div><div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10"><Image src={show.image} alt={`${show.title} programme artwork`} fill priority className="object-cover" /></div></section></div>;
}
