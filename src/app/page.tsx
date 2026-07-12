import Link from "next/link";
import Image from "next/image";
import { featuredPosts, blogPosts } from "@/lib/blog";
import RadioPlayer from "@/components/RadioPlayer";

// Daily Updates
const dailyUpdates = [
  { title: "New Amapiano Mix Out Now", desc: "Fresh beats from South Africa's hottest producers", time: "2h ago" },
  { title: "Artist Spotlight: Makhadzi", desc: "The Limpopo queen drops a new single", time: "5h ago" },
  { title: "BVS Top 10 This Week", desc: "See which tracks are climbing the charts", time: "12h ago" },
  { title: "Zim Hip-Hop Cypher 2026", desc: "The biggest collaboration of the year is here", time: "1d ago" },
  { title: "Exclusive Interview: DJ Kuchi", desc: "Behind the decks with Zimbabwe's finest", time: "2d ago" },
];

// Deals
const deals = [
  { title: "50% Off Music Production Course", tag: "Limited Time" },
  { title: "Free 3-Month Streaming Subscription", tag: "New Users" },
  { title: "BVS Merch Bundle - Save 20%", tag: "Flash Sale Today" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/10 via-transparent to-bg-primary" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/5 via-transparent to-transparent" />
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <Image
            src="/assets/images/Bvsradio_logo.png"
            alt="BVS Radio"
            width={96}
            height={96}
            className="mx-auto mb-6 rounded-2xl shadow-2xl"
          />
          <h1 className="text-5xl md:text-7xl font-bold mb-4 bg-gradient-to-r from-brand via-brand-light to-brand bg-clip-text text-transparent">
            Zimbabwe&apos;s Sound
          </h1>
          <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
            Daily music updates, exclusive deals, live radio, and a community of artists and fans.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/radio"
              className="px-8 py-3 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all text-lg"
            >
              ▶ Listen Live
            </Link>
            <Link
              href="/auth/signup"
              className="px-8 py-3 border border-white/20 text-text-primary font-semibold rounded-full hover:bg-white/5 transition-all text-lg"
            >
              Join as Artist
            </Link>
            <Link
              href="/shop"
              className="px-8 py-3 border border-white/20 text-text-primary font-semibold rounded-full hover:bg-white/5 transition-all text-lg"
            >
              Shop Deals
            </Link>
          </div>
        </div>
      </section>

      {/* Daily Updates */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Daily Updates
          </h2>
          <div className="space-y-4">
            {dailyUpdates.map((update) => (
              <div
                key={update.title}
                className="flex items-start justify-between gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <div>
                  <h3 className="font-medium">{update.title}</h3>
                  <p className="text-sm text-text-secondary">{update.desc}</p>
                </div>
                <span className="text-xs text-text-secondary/60 shrink-0">{update.time}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          Built for <span className="text-brand">African Artists &amp; Listeners</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-bg-card/50 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-brand/30 transition-all">
            <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Upload &amp; Share</h3>
            <p className="text-text-secondary">Upload your tracks with artwork and metadata. Share with the world instantly.</p>
          </div>
          <div className="bg-bg-card/50 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-brand/30 transition-all">
            <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Artist Profiles</h3>
            <p className="text-text-secondary">Build your artist brand with a custom profile, bio, and full music catalogue.</p>
          </div>
          <div className="bg-bg-card/50 backdrop-blur rounded-2xl p-8 border border-white/10 hover:border-brand/30 transition-all">
            <div className="w-12 h-12 bg-brand/20 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
            </div>
            <h3 className="text-xl font-semibold mb-3">Get Discovered</h3>
            <p className="text-text-secondary">Featured tracks, weekly charts, and a growing community of music lovers.</p>
          </div>
        </div>
      </section>

      {/* Latest Blog Posts */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl md:text-3xl font-bold">Latest News &amp; Articles</h2>
          <Link href="/blog" className="text-sm text-brand hover:underline">View all →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {blogPosts.slice(0, 6).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="bg-bg-card/50 backdrop-blur rounded-xl border border-white/10 p-6 hover:border-brand/30 transition-all group"
            >
              <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
                <span>{post.date}</span>
                <span>•</span>
                <span>{post.readTime}</span>
              </div>
              <h3 className="font-semibold mb-2 group-hover:text-brand transition-colors">{post.title}</h3>
              <p className="text-sm text-text-secondary">{post.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Deals & Discounts */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="bg-gradient-to-r from-brand/10 to-accent/10 rounded-2xl border border-white/10 p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Deals &amp; Discounts</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {deals.map((deal) => (
              <div key={deal.title} className="bg-bg-primary/60 rounded-xl p-6 border border-white/5">
                <span className="text-xs font-semibold text-brand uppercase tracking-wider">{deal.tag}</span>
                <h3 className="font-semibold mt-2">{deal.title}</h3>
                <Link href="/shop" className="inline-block mt-3 text-sm text-brand hover:underline">
                  Shop now →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-6">
          Ready to share your music?
        </h2>
        <p className="text-text-secondary text-lg mb-8 max-w-xl mx-auto">
          Join Zimbabwe&apos;s fastest-growing music platform. Free to join.
        </p>
        <Link
          href="/auth/signup"
          className="px-10 py-4 bg-brand text-black font-semibold rounded-full hover:bg-brand-dark transition-all text-lg inline-block"
        >
          Create Your Account
        </Link>
      </section>
    </>
  );
}