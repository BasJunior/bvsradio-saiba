import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { shows } from "@/lib/station";

export const metadata: Metadata = { title: "Shows", description: "Explore the BVS Radio programme in development." };

export default function ShowsPage() {
  return <div className="mx-auto max-w-6xl px-6 py-14"><p className="text-xs uppercase tracking-[.2em] text-brand">BVS programmes</p><h1 className="mt-2 text-5xl font-semibold">Shows with a point of view.</h1><p className="mt-5 max-w-2xl text-lg text-text-secondary">These are the programme formats we are building around Zimbabwean music and culture. Dates marked as previews are not yet live broadcasts.</p><div className="mt-12 grid gap-6 md:grid-cols-2">{shows.map((show) => <Link key={show.slug} href={`/shows/${show.slug}`} className="group grid overflow-hidden rounded-2xl border border-white/10 bg-white/[.03] sm:grid-cols-[12rem_1fr]"><div className="relative min-h-48"><Image src={show.image} alt="" fill className="object-cover" /></div><div className="p-6"><span className="text-[10px] font-semibold uppercase tracking-widest text-brand">Programme preview</span><h2 className="mt-2 text-2xl font-semibold group-hover:text-brand">{show.title}</h2><p className="mt-2 text-sm text-text-secondary">{show.description}</p><p className="mt-5 text-xs text-text-secondary">{show.schedule}</p></div></Link>)}</div></div>;
}
