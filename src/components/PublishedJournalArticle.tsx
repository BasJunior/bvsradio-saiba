import Image from "next/image";
import Link from "next/link";
import type { PublishedStory } from "@/lib/journal-server";
import { publicStoryCover } from "@/lib/journal-server";

export default function PublishedJournalArticle({ story }: { story: PublishedStory }) {
  const cover = publicStoryCover(story.cover_art_path);
  const blocks = story.body.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
      <Link href="/blog" className="text-sm text-brand hover:underline">← Back to Journal</Link>
      <header className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Journal · Original story</p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{story.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-text-secondary">{story.dek}</p>
        <div className="mt-5 flex flex-wrap gap-x-3 text-sm text-text-secondary">
          {story.authorUsername ? <Link href={`/writer/${encodeURIComponent(story.authorUsername)}`} className="font-medium text-brand hover:underline">{story.authorName}</Link> : <span>{story.authorName}</span>}
          <span>·</span>
          <time dateTime={story.published_at}>{new Date(story.published_at).toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}</time>
        </div>
      </header>
      {cover && <div className="relative mt-9 aspect-[16/9] overflow-hidden rounded-2xl border border-white/10 bg-white/5"><Image src={cover} alt={`Cover artwork for ${story.title}`} fill unoptimized className="object-cover" sizes="(max-width: 768px) 100vw, 768px" /></div>}
      <article className="mt-10 space-y-6 text-base leading-8 text-text-secondary">
        {blocks.map((block, index) => block.startsWith("## ") ?
          <h2 key={index} className="pt-5 text-2xl font-semibold leading-tight text-white">{block.slice(3)}</h2> :
          block.startsWith("### ") ?
            <h3 key={index} className="pt-3 text-xl font-semibold text-white">{block.slice(4)}</h3> :
            <p key={index} className="whitespace-pre-wrap">{block}</p>
        )}
      </article>
      <footer className="mt-16 border-t border-white/10 pt-6 text-sm">
        <Link href="/blog" className="text-brand hover:underline">← More stories from BVS</Link>
        <span className="mx-3 text-text-secondary">·</span>
        <Link href="/writer" className="text-brand hover:underline">Write for BVS</Link>
      </footer>
    </main>
  );
}
