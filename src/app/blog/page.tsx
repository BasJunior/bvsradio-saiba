import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts, featuredPosts } from "@/lib/blog";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Blog | BVS Radio",
  description: "Stories, insights and conversations from the heart of Zimbabwean music and radio culture.",
};

export default function BlogIndexPage() {
  const regularPosts = blogPosts.filter(post => !featuredPosts.some(fp => fp.slug === post.slug));

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-14">
        <div className="flex items-center gap-2 text-xs tracking-[2px] text-brand mb-2">STORIES &amp; INSIGHTS</div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">The BVS Journal</h1>
        <p className="max-w-lg text-xl text-text-secondary">
          Deep dives into Zimbabwean music, radio culture, artist stories, and the future of sound.
        </p>
      </div>

      {/* Featured */}
      <div className="mb-16">
        <div className="text-sm uppercase tracking-widest text-text-secondary mb-4">Featured</div>
        <div className="grid md:grid-cols-3 gap-6">
          {featuredPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block bg-bg-card/40 border border-white/10 rounded-2xl overflow-hidden hover:border-brand/50 transition-colors">
              <div className="aspect-video bg-gradient-to-br from-brand/10 to-black relative">
                <Image src="/images/hero-studio.jpg" alt={post.title} fill className="object-cover opacity-60 group-hover:opacity-80 transition" />
              </div>
              <div className="p-6">
                <div className="flex gap-2 text-xs text-text-secondary mb-3">
                  <span>{post.date}</span><span>•</span><span>{post.readTime}</span>
                </div>
                <h3 className="font-semibold text-xl leading-snug group-hover:text-brand transition-colors mb-2">{post.title}</h3>
                <p className="text-sm text-text-secondary line-clamp-3">{post.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* All Articles */}
      <div>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-semibold">All Articles</h2>
          <span className="text-sm text-text-secondary">{blogPosts.length} stories</span>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {regularPosts.map((post) => (
            <Link 
              key={post.slug} 
              href={`/blog/${post.slug}`} 
              className="group flex gap-5 p-5 rounded-2xl border border-white/10 hover:border-white/30 hover:bg-bg-card/30 transition-all"
            >
              <div className="flex-1">
                <div className="text-xs text-text-secondary mb-1.5">{post.date} • {post.readTime}</div>
                <h3 className="font-semibold text-lg leading-tight mb-2 group-hover:text-brand transition-colors">{post.title}</h3>
                <p className="text-sm text-text-secondary line-clamp-2">{post.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
