import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts, featuredPosts } from "@/lib/blog";
import { publishedJournalStories, publicStoryCover } from "@/lib/journal-server";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Blog | BVS Radio",
  description: "Stories, insights and conversations from studio music and radio culture, rooted in Zimbabwe and open to the world.",
};

export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const contributorStories = await publishedJournalStories();
  const regularPosts = blogPosts.filter(post => !featuredPosts.some(fp => fp.slug === post.slug));
  const discoverImages = [
    "/images/editorial/radio-studio-harare.webp",
    "/images/editorial/music-discovery-show.webp",
    "/images/editorial/audio-engineering-work.webp",
  ];
  const imageFor = (slug: string) => discoverImages[Math.abs([...slug].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % discoverImages.length];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero */}
      <div className="mb-14">
        <div className="flex items-center gap-2 text-xs tracking-[2px] text-brand mb-2">STORIES &amp; INSIGHTS</div>
        <h1 className="text-5xl font-bold tracking-tight mb-4">The BVS Journal</h1>
        <p className="max-w-lg text-xl text-text-secondary">
          Deep dives into studio music, radio culture, artist stories, and the future of sound, with Zimbabwe at the roots.
        </p>
        <Link href="/writer" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-brand/40 px-5 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10">Write for BVS · Apply here</Link>
      </div>

      {contributorStories.length > 0 && <section className="mb-16" aria-labelledby="contributor-stories-heading">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4"><h2 id="contributor-stories-heading" className="text-2xl font-semibold">Fresh from BVS contributors</h2><Link href="/writer" className="text-sm text-brand hover:underline">Write for BVS</Link></div>
        <div className="grid gap-6 md:grid-cols-3">{contributorStories.map(story => {
          const cover = publicStoryCover(story.cover_art_path);
          return <Link key={story.id} href={`/blog/${story.slug}`} className="group block overflow-hidden rounded-2xl border border-white/10 bg-bg-card/40 transition hover:border-brand/50">
            <div className="relative aspect-video bg-gradient-to-br from-brand/10 to-black">
              {cover ? <Image src={cover} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-opacity group-hover:opacity-85" /> : <Image src="/images/editorial/radio-studio-harare.webp" alt="" fill className="object-cover opacity-70" />}
            </div>
            <div className="p-5"><div className="mb-2 text-xs text-text-secondary">{story.authorName} · {new Date(story.published_at).toLocaleDateString()}</div><h3 className="text-xl font-semibold leading-snug group-hover:text-brand">{story.title}</h3><p className="mt-2 line-clamp-3 text-sm text-text-secondary">{story.dek}</p></div>
          </Link>;
        })}</div>
      </section>}

      {/* Featured */}
      <div className="mb-16">
        <div className="text-sm uppercase tracking-widest text-text-secondary mb-4">Featured</div>
        <div className="grid md:grid-cols-3 gap-6">
          {featuredPosts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group block bg-bg-card/40 border border-white/10 rounded-2xl overflow-hidden hover:border-brand/50 transition-colors">
              <div className="aspect-video bg-gradient-to-br from-brand/10 to-black relative">
                <Image src={imageFor(post.slug)} alt="BVS editorial scene" fill className="object-cover opacity-75 group-hover:opacity-95 transition" />
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
          <span className="text-sm text-text-secondary">{blogPosts.length + contributorStories.length} stories</span>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {regularPosts.map((post) => (
            <Link 
              key={post.slug} 
              href={`/blog/${post.slug}`} 
              className="group flex gap-5 p-5 rounded-2xl border border-white/10 hover:border-white/30 hover:bg-bg-card/30 transition-all"
            >
              <div className="relative h-24 w-28 flex-none overflow-hidden rounded-xl sm:h-28 sm:w-36">
                <Image src={imageFor(post.slug)} alt="" fill className="object-cover transition-transform group-hover:scale-[1.03]" />
              </div>
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
