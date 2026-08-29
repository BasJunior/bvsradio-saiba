import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About BVS Radio",
  description: "Learn about BVS Radio — an international online radio and creative platform rooted in Zimbabwe for listeners, artists, and producers.",
};

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">About BVS Radio</h1>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-brand">Built by Artists, Made for Artists</p>
        <p className="text-xl text-text-secondary max-w-2xl mx-auto">
          BVS Radio — <span className="text-brand">Best Virtual Sound</span>. A digital radio and media platform helping independent creators share their sound, grow their audience and build real opportunities.
        </p>
      </div>

      {/* Hero Image + Intro */}
      <div className="relative rounded-3xl overflow-hidden mb-16 aspect-[16/9]">
        <Image 
          src="/images/female-host.jpg" 
          alt="BVS Radio host in the studio" 
          fill 
          className="object-cover" 
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        <div className="absolute bottom-0 left-0 p-10 max-w-lg">
          <p className="text-brand text-sm tracking-[3px] mb-2">EST. 2022 • ZIMBABWE ROOTS • GLOBAL REACH</p>
          <h2 className="text-4xl font-bold leading-tight">Built by artists, made for artists.</h2>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-x-16 gap-y-12 max-w-5xl mx-auto">
        <div>
          <h2 className="text-3xl font-semibold mb-4">Our Story</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed">
            <p>
              BVS Radio was born from a simple belief: Zimbabwe has some of the most powerful music
              and stories on the planet, and those roots can help carry studio sound worldwide.
            </p>
            <p>
              What started as an independent online stream is growing into a home for radio, releases,
              BeatStore libraries, artist services and discovery. The platform is shaped from artist
              experience first: clear submissions, fair credits and real routes from a song idea to an audience.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-semibold mb-4">Our Mission</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed">
            <p>
              We exist to amplify independent artists and emerging sound, with Zimbabwe at the roots. BVS connects listeners,
              producers and performers through radio, catalogue discovery, BeatStore access, interviews
              and practical audio services.
            </p>
            <p>
              More than a radio station, we are a working-artist hub for discovery, connection and opportunity.
            </p>
          </div>
        </div>
      </div>

      {/* What We Offer */}
      <div className="mt-20">
        <h2 className="text-3xl font-semibold mb-8 text-center">What Makes BVS Different</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Editorial rotation", desc: "A live continuous stream of approved releases and curated tracks — always ready to play." },
            { title: "Artist first", desc: "Clear submit, review, credits, BeatStore and service paths built from real creator workflows." },
            { title: "Catalogue & commerce", desc: "Discover music, lease beats, and book mix/master work without mixing up what is free to hear and what is for sale." },
            { title: "Zimbabwe roots", desc: "Born from Zimbabwean creator experience, built for listeners and artists across Africa and the diaspora." },
          ].map((item, index) => (
            <div key={index} className="bg-bg-card/50 border border-white/10 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-3 text-brand">{item.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 text-center border-t border-white/10 pt-12">
        <p className="text-text-secondary">
          Want to be part of the story?{" "}
          <Link href="/contact" className="text-brand hover:underline">Get in touch</Link> or{" "}
          <Link href="/upload" className="text-brand hover:underline">upload your music</Link>.
        </p>
      </div>
    </div>
  );
}
