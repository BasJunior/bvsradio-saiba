import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Services | BVS Radio — Professional Audio Engineering",
  description: "BVS Radio Services — Online mixing, mastering, and production by top engineers including Wolf Bridges. Upload your tracks and get industry-standard results.",
};

const engineers = [
  {
    name: "Wolf Bridges",
    title: "Lead Mixing & Mastering Engineer",
    image: "/images/female-host.jpg",
    bio: "With credits on Spotify for artists across Africa and beyond, Wolf Bridges brings a signature warm, dynamic sound to every project. Specializing in Afrobeats, Hip-Hop, and live-recorded genres, he has mixed and mastered tracks that have amassed millions of streams. His work bridges traditional Zimbabwean sounds with modern production.",
    spotifyCredits: "Mixing & Mastering credits on tracks by BVS artists and international acts. Featured on Spotify playlists like 'Afrobeats Hits' and 'African Heat'.",
    specialties: ["Mixing", "Mastering", "Vocal Production", "Stem Work"],
    turnaround: "24-72 hours",
    testimonials: [
      "Wolf's masters always hit different — the clarity and punch are unmatched. — BVS Artist",
      "He understands the vision and elevates it without losing the soul of the track."
    ]
  },
  {
    name: "BVS Engineering Team",
    title: "In-House Engineers",
    image: "/images/musicians.jpg",
    bio: "Our team of experienced engineers at BVS Studios deliver consistent, high-quality results tailored to Zimbabwean and African music.",
    specialties: ["Mixing", "Mastering", "Custom Production"],
    turnaround: "48 hours standard",
  }
];

const services = [
  {
    title: "Mixing",
    engineer: "Wolf Bridges",
    price: "From $89",
    tiers: [
      { name: "Basic Mix", price: "$89", desc: "Clean mix, 1 revision, 72hr turnaround" },
      { name: "Pro Mix", price: "$149", desc: "Detailed mix + stems, 2 revisions, 48hr" },
      { name: "Premium Mix", price: "$199", desc: "Full production mix, unlimited revisions, priority" }
    ],
    desc: "Professional mixing that brings your track to life. Reference tracks welcome."
  },
  {
    title: "Mastering",
    engineer: "Wolf Bridges",
    price: "From $39",
    tiers: [
      { name: "Standard Master", price: "$69", desc: "Streaming optimized, 1 revision, 24hr" },
      { name: "Premium Master", price: "$99", desc: "High-end + stems, 2 revisions, 12hr priority" },
      { name: "Album Master", price: "$299", desc: "Up to 14 tracks, consistent loudness across project" }
    ],
    desc: "Industry-standard mastering for Spotify, Apple Music and all platforms."
  },
  {
    title: "Mix + Master Bundle",
    engineer: "Wolf Bridges",
    price: "From $189",
    tiers: [
      { name: "Standard Bundle", price: "$189", desc: "Pro mix + standard master" },
      { name: "Premium Bundle", price: "$249", desc: "Premium mix + premium master + stems" }
    ],
    desc: "Complete post-production package. The full Metropolis-style experience."
  },
  {
    title: "Vocal Production",
    engineer: "Wolf Bridges",
    price: "From $65",
    tiers: [
      { name: "Vocal Comping & Tuning", price: "$65", desc: "Full comp + pitch correction. 1 revision." },
      { name: "Full Vocal Production", price: "$129", desc: "Layering, harmonies, ad-libs, effects. 2 revisions." }
    ],
    desc: "Bring your vocals to professional level."
  }
];

const processSteps = [
  { step: "1", title: "Order", desc: "Choose your service and engineer (Wolf Bridges or team)." },
  { step: "2", title: "Upload", desc: "Upload your tracks and share your vision via the form." },
  { step: "3", title: "In The Studio", desc: "Wolf Bridges or our engineers work their magic with feedback loops." },
  { step: "4", title: "Files Ready", desc: "Download your mastered/mixed files. Ready for BVS Radio or release." },
];

export default function ServicesPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero - Metropolis style */}
      <section className="mb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="uppercase text-xs tracking-[3px] text-brand mb-2">HiFi Services • BVS Radio</p>
          <h1 className="text-5xl font-semibold tracking-[-0.03em] mb-4">Professional Online Mixing &amp; Mastering</h1>
          <p className="text-xl text-text-secondary mb-8">
            Direct access to leading engineers. Upload your tracks from anywhere and receive true HiFi masters exactly as the artist intended.
            Featuring Wolf Bridges and the BVS team.
          </p>
          <div className="text-xs text-brand/80">All masters delivered in lossless quality, ready for BVS Radio and streaming platforms.</div>
          <div className="flex gap-4 justify-center">
            <Link href="#engineers" className="px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark">Meet the Engineers</Link>
            <Link href="#services" className="px-8 py-3 border border-white/30 rounded-full hover:bg-white/5">Browse Services</Link>
          </div>
        </div>
      </section>

      {/* Featured Engineer - Wolf Bridges */}
      <section id="engineers" className="mb-20">
        <h2 className="text-3xl font-bold mb-8">Our Engineers</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {engineers.map((eng, i) => (
            <div key={i} className="bg-bg-card/40 border border-white/5 rounded-3xl overflow-hidden">
              <div className="relative h-64">
                <Image src={eng.image} alt={eng.name} fill className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6">
                  <h3 className="text-3xl font-bold">{eng.name}</h3>
                  <p className="text-brand">{eng.title}</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-text-secondary leading-relaxed">{eng.bio}</p>
                
                {eng.spotifyCredits && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-brand mb-1">Spotify Credits</p>
                    <p className="text-sm">{eng.spotifyCredits}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs uppercase tracking-widest text-brand mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {eng.specialties.map((s, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 bg-white/5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-text-secondary"><strong>Turnaround:</strong> {eng.turnaround}</p>

                {eng.testimonials && (
                  <div className="pt-4 border-t border-white/10 text-sm italic text-text-secondary">
                    {eng.testimonials.map((t, idx) => <p key={idx} className="mb-2">“{t}”</p>)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services - Metropolis style */}
      <section id="services" className="mb-20">
        <h2 className="text-3xl font-bold mb-2">Services</h2>
        <p className="text-text-secondary mb-8 max-w-2xl">Bespoke mixing and mastering by Wolf Bridges and the BVS team. All services include commercial rights and direct communication.</p>

        <div className="grid md:grid-cols-2 gap-6">
          {services.map((service, index) => (
            <div key={index} className="bg-bg-card/40 border border-white/5 rounded-3xl p-8">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-semibold">{service.title}</h3>
                  <p className="text-brand text-sm">by {service.engineer}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-secondary">Starting at</div>
                  <div className="text-2xl font-bold text-brand">{service.price}</div>
                </div>
              </div>

              <p className="text-text-secondary mb-6">{service.desc}</p>

              <div className="space-y-3 mb-6">
                {service.tiers.map((tier, tIdx) => (
                  <div key={tIdx} className="flex justify-between items-center border border-white/10 rounded-xl p-4 hover:border-brand/30">
                    <div>
                      <div className="font-medium">{tier.name}</div>
                      <div className="text-sm text-text-secondary">{tier.desc}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-brand">{tier.price}</div>
                      <Link
                        href={`/checkout?item=${encodeURIComponent(tier.name)}&price=${tier.price.replace('$', '')}`}
                        className="text-xs text-brand hover:underline"
                      >
                        Order
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* The Process - exact style from Metropolis */}
      <section className="mb-20">
        <h2 className="text-3xl font-bold mb-8">The Process</h2>
        <div className="grid md:grid-cols-4 gap-6">
          {processSteps.map((step, i) => (
            <div key={i} className="bg-bg-card/50 border border-white/10 rounded-2xl p-6">
              <div className="text-4xl font-bold text-brand/30 mb-4">{step.step}</div>
              <h4 className="font-semibold text-lg mb-2">{step.title}</h4>
              <p className="text-sm text-text-secondary">{step.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-text-secondary mt-6">Upload your stems or mixes. Communicate directly with Wolf Bridges. Receive broadcast-ready files ready for BVS Radio or release.</p>
      </section>

      {/* Upload / Order Section */}
      <section id="upload" className="bg-bg-card/30 border border-white/10 rounded-2xl p-8 md:p-12 mb-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Start Your Project</h2>
          <p className="text-text-secondary mb-8">Ready to work with Wolf Bridges or the BVS team? Upload your tracks below or browse our music first.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/upload" className="inline-block px-8 py-4 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark text-lg">Upload Tracks</Link>
            <Link href="/checkout?item=Custom%20BVS%20Service&price=69" className="inline-block px-8 py-4 border border-white/25 font-semibold rounded-full hover:bg-white/5 text-lg">Start Checkout</Link>
          </div>
          
          <div className="text-xs text-text-secondary mt-4">
            Or <Link href="/radio" className="text-brand hover:underline">listen to tracks already mastered by our engineers</Link>
          </div>
        </div>
      </section>

      {/* Tie to BVS Music + Direct Downloads */}
      <section className="text-center mb-12">
        <p className="text-sm text-text-secondary mb-2">Listen to BVS artists in Radio, then purchase singles, beats or full releases directly from the catalogue.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/catalogue" className="inline-flex items-center justify-center gap-2 text-brand hover:underline">Browse &amp; Buy Music</Link>
          <Link href="/checkout" className="inline-flex items-center justify-center gap-2 text-brand hover:underline">Open Checkout</Link>
        </div>
        <p className="text-xs text-text-secondary mt-4">Services by Wolf Bridges are also available for your own tracks.</p>
      </section>
    </div>
  );
}
