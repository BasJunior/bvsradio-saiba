import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="bg-bg-primary text-text-primary">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-studio.jpg"
            alt="BVS Radio live studio in Zimbabwe"
            fill
            className="object-cover opacity-70"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-bg-primary" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="mb-6 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-sm backdrop-blur tracking-widest">
              LIVE FROM ZIMBABWE · 24/7
            </div>
          </div>

          <h1 className="text-6xl md:text-7xl font-semibold tracking-[-0.04em] mb-3">
            BVS Radio
          </h1>
          <p className="uppercase text-xs tracking-[3px] text-brand mb-4">Best Virtual Sound</p>
          <p className="text-2xl md:text-3xl text-text-secondary tracking-tight mb-4">
            Zimbabwe&apos;s Sound · Live · Culture · Community
          </p>
          <p className="max-w-xl mx-auto text-lg text-text-secondary mb-10">
            Experience music in true HiFi. Discover Zimbabwean artists, stream lossless, and get your tracks mastered by the best.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/radio"
              className="px-10 py-4 bg-brand hover:bg-brand-dark transition-all text-black font-semibold rounded-full text-lg inline-flex items-center justify-center gap-3 shadow-lg"
            >
              Start Listening
            </Link>
            <Link
              href="/catalogue"
              className="px-10 py-4 border border-white/40 hover:bg-white/10 transition-colors font-medium rounded-full text-lg"
            >
              Browse Music
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-text-secondary">
            <div>Harare · Bulawayo · Global</div>
            <div>HiFi • Lossless • Dolby Atmos</div>
          </div>
        </div>
      </section>

      {/* Quick Listen + Features */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl font-bold mb-6 tracking-tight">Your soundtrack to Zimbabwe, anywhere.</h2>
          <p className="text-text-secondary text-lg mb-8">
            Whether you&apos;re in Harare, London, or Johannesburg — tune into BVS Radio for the freshest 
            local talent, classic hits, and exclusive live sessions. Our DJs bring you the real stories 
            behind the music.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "24/7 Live Streaming", desc: "Never miss a beat" },
              { title: "Local & Diaspora Artists", desc: "Curated with love" },
              { title: "Community Shows", desc: "Talk, culture & events" },
              { title: "Upload Your Music", desc: "Get your tracks heard" },
            ].map((item, i) => (
              <div key={i} className="bg-bg-card/60 border border-white/10 rounded-xl p-5">
                <h4 className="font-semibold text-brand mb-1">{item.title}</h4>
                <p className="text-sm text-text-secondary">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative aspect-[16/10] rounded-3xl overflow-hidden border border-white/10">
          <Image
            src="/images/festival-crowd.jpg"
            alt="Zimbabwe music festival crowd"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6">
            <Link href="/radio" className="inline-block bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-brand transition-colors">
              Start Listening →
            </Link>
          </div>
        </div>
      </section>

      {/* Culture & Community */}
      <section className="bg-bg-secondary py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-5">
              <h2 className="text-4xl font-bold mb-6">Rooted in Zimbabwe.<br />Loved worldwide.</h2>
              <p className="text-text-secondary text-lg mb-6">
                BVS Radio celebrates our rich musical heritage while pushing the sound forward. 
                From mbira-infused electronic to amapiano, hip-hop, and gospel — we play the music that moves us.
              </p>
              <Link href="/about" className="text-brand hover:underline font-medium">Learn our story →</Link>
            </div>

            <div className="md:col-span-7 relative aspect-video rounded-2xl overflow-hidden">
              <Image 
                src="/images/musicians.jpg" 
                alt="Zimbabwean musicians collaborating" 
                fill 
                className="object-cover" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* HiFi Experience */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
        <div className="text-center mb-10">
          <div className="inline-block px-3 py-1 bg-brand/10 text-brand text-xs tracking-widest rounded-full mb-3">BEST VIRTUAL SOUND</div>
          <h2 className="text-4xl font-semibold tracking-tight">Music, exactly as the artist intended.</h2>
          <p className="text-text-secondary mt-3 max-w-md mx-auto">Stream in true HiFi lossless, up to 24-bit/192kHz. Feel every detail.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {[
            { label: "Lossless Audio", desc: "CD quality and beyond" },
            { label: "Dolby Atmos", desc: "Immersive spatial audio" },
            { label: "Mastered by Wolf Bridges", desc: "Signature BVS sound" },
          ].map((item, i) => (
            <div key={i} className="bg-bg-card/40 rounded-2xl p-8 border border-white/5">
              <div className="text-brand text-sm tracking-widest mb-2">HI-FI</div>
              <div className="text-xl font-semibold mb-2">{item.label}</div>
              <p className="text-sm text-text-secondary">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Curated Playlists - Tidal style */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">Curated for you</h2>
          <Link href="/catalogue" className="text-sm text-brand hover:underline">See all playlists</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[
            { title: "Harare Heat", desc: "The hottest Afrobeats right now", img: "/images/festival-crowd.jpg" },
            { title: "Zim Rising", desc: "New artists breaking through", img: "/images/musicians.jpg" },
            { title: "Wolf Bridges Selects", desc: "Engineer's favorite mixes", img: "/images/hero-studio.jpg" },
            { title: "Late Night Drive", desc: "Chill electronic and soul", img: "/images/female-host.jpg" },
            { title: "BVS Radio Live", desc: "Tracks from the airwaves", img: "/images/festival-crowd.jpg" },
          ].map((p, i) => (
            <Link key={i} href="/catalogue" className="group block">
              <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 border border-white/5">
                <Image src={p.img} alt={p.title} fill className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
              </div>
              <div>
                <div className="font-medium text-[15px]">{p.title}</div>
                <div className="text-xs text-text-secondary mt-0.5 line-clamp-1">{p.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Professional Services Teaser */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-white/10">
        <div className="flex flex-col md:flex-row gap-10 items-center">
          <div className="md:w-5/12">
            <h2 className="text-4xl font-semibold tracking-tight mb-4">Elevate your sound.</h2>
            <p className="text-text-secondary text-lg mb-6">
              Work directly with Wolf Bridges and the BVS team for mixing, mastering, vocal production and more. 
              Professional services used by the artists you hear on BVS Radio.
            </p>
            <Link 
              href="/shop" 
              className="inline-flex items-center px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark"
            >
              Explore Services
            </Link>
          </div>
          <div className="md:w-7/12 aspect-[16/9] rounded-2xl overflow-hidden border border-white/10">
            <Image 
              src="/images/musicians.jpg" 
              alt="Professional audio engineering at BVS" 
              fill 
              className="object-cover" 
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-white/10 py-16 text-center max-w-2xl mx-auto px-6">
        <h3 className="text-3xl font-semibold mb-4">Ready to join the movement?</h3>
        <p className="text-text-secondary mb-8">Create a free account to upload tracks, save shows, and get early access to drops.</p>
        <div className="flex justify-center gap-4">
          <Link href="/auth/signup" className="px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark">
            Join Free
          </Link>
          <Link href="/contact" className="px-8 py-3 border border-white/30 hover:bg-white/5 rounded-full">
            Contact Us
          </Link>
        </div>
      </section>

      {/* Small trust bar */}
      <div className="border-t border-white/10 py-5 text-center text-xs text-text-secondary tracking-widest">
        POWERED BY ZIMBABWEAN TALENT • HEARD WORLDWIDE
      </div>
    </div>
  );
}
