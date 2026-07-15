import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import RadioPlayer from "@/components/RadioPlayer";
import { RecentListening } from "@/components/RecentListening";
import { schedule as fallbackSchedule } from "@/lib/station";
import { getPublicProgrammes } from "@/lib/station-content";

export const metadata: Metadata = {
  title: "Listen | BVS Radio",
  description: "Listen to the BVS continuous music rotation and explore the programme in development.",
};

export default async function RadioPage() {
  const shows = await getPublicProgrammes();
  const schedule = shows.some(show => show.status === 'active') ? shows.map(show => { const [day, time = 'Time TBA'] = show.schedule.split(' · '); return { day, time, title: show.title, note: show.status === 'active' ? `Presented by ${show.host}` : 'Scheduled programme' }; }) : fallbackSchedule;
  return <div className="mx-auto max-w-6xl px-6 py-12">
    <section className="grid items-center gap-10 lg:grid-cols-2">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.22em] text-brand">Listen now</p>
        <h1 className="text-5xl font-semibold tracking-tight">Zimbabwean sound, always within reach.</h1>
        <p className="mt-5 max-w-xl text-lg text-text-secondary">BVS currently runs an automated continuous rotation from our preserved music library. Hosted live programming is being prepared and will be clearly marked when it launches.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">Automated rotation</span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">CAT / Harare</span>
        </div>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10"><Image src="/images/editorial/radio-studio-harare.webp" alt="BVS radio studio overlooking Harare" fill priority className="object-cover" /></div>
    </section>

    <section className="mx-auto my-14 max-w-2xl" aria-labelledby="now-playing"><h2 id="now-playing" className="sr-only">Now playing</h2><RadioPlayer /></section>

    <section className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
      <div>
        <div className="mb-5 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Programme preview</p><h2 className="mt-1 text-3xl font-semibold">What BVS is building</h2></div><Link href="/shows" className="text-sm text-brand hover:underline">All shows →</Link></div>
        <div className="space-y-3">{schedule.map((slot) => <div key={`${slot.day}-${slot.title}`} className="grid gap-2 rounded-xl border border-white/10 bg-white/[.03] p-4 sm:grid-cols-[8rem_7rem_1fr]"><span className="text-sm text-text-secondary">{slot.day}</span><span className="text-sm font-medium">{slot.time}</span><div><p className="font-medium">{slot.title}</p><p className="mt-1 text-xs text-text-secondary">{slot.note}</p></div></div>)}</div>
      </div>
      <RecentListening />
    </section>

    <section className="mt-16">
      <div className="mb-6 flex items-end justify-between"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Shows</p><h2 className="mt-1 text-3xl font-semibold">Made for the scene</h2></div><Link href="/upload" className="text-sm text-brand hover:underline">Submit music →</Link></div>
      <div className="grid gap-5 md:grid-cols-3">{shows.map((show) => <Link key={show.slug} href={`/shows/${show.slug}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-bg-card/40"><div className="relative aspect-[16/10]"><Image src={show.image} alt="" fill className="object-cover transition duration-500 group-hover:scale-105" /></div><div className="p-5"><span className="text-[10px] font-semibold uppercase tracking-widest text-brand">In development</span><h3 className="mt-2 text-xl font-semibold group-hover:text-brand">{show.title}</h3><p className="mt-2 text-sm text-text-secondary">{show.tagline}</p></div></Link>)}</div>
    </section>
  </div>;
}
