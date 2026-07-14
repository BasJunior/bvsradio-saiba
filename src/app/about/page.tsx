import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About BVS Radio",
  description: "Learn about BVS Radio — Zimbabwe's premier online radio station celebrating sound, culture, and community.",
};

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-bold tracking-tight mb-4">About BVS Radio</h1>
        <p className="text-xl text-text-secondary max-w-2xl mx-auto">
          BVS Radio — <span className="text-brand">Best Virtual Sound</span>. Zimbabwe&apos;s premier online radio station broadcasting the sounds, stories, and spirit of our nation to the world.
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
          <p className="text-brand text-sm tracking-[3px] mb-2">EST. 2022 • HARARE</p>
          <h2 className="text-4xl font-bold leading-tight">The voice of a new generation.</h2>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-x-16 gap-y-12 max-w-5xl mx-auto">
        <div>
          <h2 className="text-3xl font-semibold mb-4">Our Story</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed">
            <p>
              BVS Radio was born from a simple belief: Zimbabwe has some of the most powerful music 
              and stories on the planet, and the world deserves to hear them.
            </p>
            <p>
              What started as a small online stream from a bedroom studio in Harare has grown into 
              a 24/7 platform connecting listeners across continents — from the townships of Bulawayo 
              to the diaspora in the UK, USA, and South Africa.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-semibold mb-4">Our Mission</h2>
          <div className="space-y-4 text-text-secondary leading-relaxed">
            <p>
              We exist to amplify Zimbabwean voices. We platform both established legends and 
              emerging artists, blend traditional sounds with contemporary genres, and create 
              space for honest conversations about our culture, challenges, and celebrations.
            </p>
            <p>
              More than a radio station, we are a community hub for discovery, connection, and pride.
            </p>
          </div>
        </div>
      </div>

      {/* What We Offer */}
      <div className="mt-20">
        <h2 className="text-3xl font-semibold mb-8 text-center">What Makes BVS Different</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Authentic Curation", desc: "Every playlist and show is crafted by people who live and breathe Zimbabwean music and culture." },
            { title: "Live & Local", desc: "Real DJs. Real conversations. Real connection — no automation, just heart." },
            { title: "Artist First", desc: "We give local creators a platform to upload, promote, and monetize their work directly." },
            { title: "Global Reach", desc: "Streaming to Zimbabweans and Africa lovers across 40+ countries." },
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
