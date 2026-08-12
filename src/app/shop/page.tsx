import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { officialBvsServices } from "@/lib/official-services";

export const metadata: Metadata = {
  title: "BVS Studio Services — Official BVS | BVS Radio",
  description: "Official BVS Studio Services for online mixing, mastering and vocal production, separate from independent Creator Marketplace listings.",
};

const engineers = [
  {
    name: "BVS Audio Services",
    title: "Mixing, mastering and vocal production",
    image: "/images/hero-studio.jpg",
    bio: "Send BVS your track, references and release plans. We confirm the engineer, scope, delivery format and schedule before work begins, so the order matches what your project actually needs.",
    specialties: ["Mixing", "Mastering", "Vocal Production", "Stem Work"],
    turnaround: "Confirmed after file review",
  }
];

const processSteps = [
  { step: "1", title: "Choose", desc: "Select a starting package or ask BVS for a custom scope." },
  { step: "2", title: "Send files", desc: "Upload your stems or mix and include references and release plans." },
  { step: "3", title: "Confirm", desc: "BVS confirms file quality, assigned engineer, timeline and deliverables." },
  { step: "4", title: "Review", desc: "Receive files, request the included revisions and approve delivery." },
];

export default function ServicesPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero - Metropolis style */}
      <section className="mb-16 text-center">
        <div className="max-w-3xl mx-auto">
          <p className="uppercase text-xs tracking-[3px] text-brand mb-2">Official BVS provider • Creator Marketplace</p>
          <h1 className="text-5xl font-semibold tracking-[-0.03em] mb-4">BVS Studio Services</h1>
          <p className="text-xl text-text-secondary mb-8">
            Send your project from anywhere. BVS will review the files and confirm the engineer, scope, turnaround and final deliverables before production starts.
          </p>
          <div className="text-xs text-brand/80">Final formats and platform requirements are agreed for each order.</div>
          <div className="flex gap-4 justify-center">
            <Link href="/marketplace" className="px-8 py-3 border border-brand/50 text-brand rounded-full hover:bg-white/5">Creator Marketplace</Link>
            <Link href="#engineers" className="px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark">How assignment works</Link>
            <Link href="#services" className="px-8 py-3 border border-white/30 rounded-full hover:bg-white/5">Browse Services</Link>
          </div>
        </div>
      </section>

      {/* Featured Engineer - Wolf Bridges */}
      <section id="engineers" className="mb-20">
        <h2 className="text-3xl font-bold mb-2">How projects are assigned</h2>
        <p className="mb-8 max-w-2xl text-text-secondary">Public engineer profiles and verified credits will be added as the roster is confirmed. Until then, we do not publish placeholder biographies or testimonials.</p>
        <div className="grid gap-8">
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
                
                <div>
                  <p className="text-xs uppercase tracking-widest text-brand mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {eng.specialties.map((s, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 bg-white/5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>

                <p className="text-sm text-text-secondary"><strong>Turnaround:</strong> {eng.turnaround}</p>

              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Services - Metropolis style */}
      <section id="services" className="mb-20">
        <h2 className="text-3xl font-bold mb-2">Services</h2>
        <p className="text-text-secondary mb-8 max-w-2xl">Transparent starting packages for your own recordings. Your music rights remain yours; the service fee covers the agreed production work and deliverables.</p>

        <div className="grid md:grid-cols-2 gap-6">
          {officialBvsServices.map((service) => (
            <div key={service.id} className="bg-bg-card/40 border border-white/5 rounded-3xl p-8">
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
                        className="mt-2 inline-block rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-black hover:bg-brand-dark"
                      >
                        Buy now
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
        <p className="text-center text-sm text-text-secondary mt-6">Turnaround begins after usable files, payment and the project scope are confirmed. Radio submission is a separate editorial review and is not guaranteed by buying a service.</p>
      </section>

      {/* Upload / Order Section */}
      <section id="upload" className="bg-bg-card/30 border border-white/10 rounded-2xl p-8 md:p-12 mb-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Start Your Project</h2>
          <p className="text-text-secondary mb-8">Choose a package when the scope is clear, or contact BVS first for complex sessions, albums and custom delivery needs.</p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/contact" className="inline-block px-8 py-4 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark text-lg">Request a project review</Link>
            <Link href="/checkout?item=Custom%20BVS%20Service&price=69" className="inline-block px-8 py-4 border border-white/25 font-semibold rounded-full hover:bg-white/5 text-lg">Start Checkout</Link>
          </div>
          
          <div className="text-xs text-text-secondary mt-4">
            Questions about stems or formats? <Link href="/contact" className="text-brand hover:underline">Ask before ordering</Link>.
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
        <p className="text-xs text-text-secondary mt-4">Beat licences and engineering services are separate products with different rights and deliverables.</p>
      </section>
    </div>
  );
}
