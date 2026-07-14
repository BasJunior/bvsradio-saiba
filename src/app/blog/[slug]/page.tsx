import { blogPosts } from "@/lib/blog";
import Link from "next/link";
import { notFound } from "next/navigation";

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = blogPosts.find((p) => p.slug === params.slug);
  if (!post) return notFound();

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link href="/blog" className="text-sm text-brand hover:underline">← Back to Journal</Link>

      <div className="mt-6">
        <div className="text-xs tracking-widest text-text-secondary mb-2">{post.date} • {post.readTime}</div>
        <h1 className="text-5xl font-bold tracking-tight leading-none mb-8">{post.title}</h1>
      </div>

      <article className="prose prose-invert max-w-none prose-p:text-text-secondary prose-headings:text-white prose-strong:text-white">
        {post.content.map((paragraph, i) => (
          <p key={i} className="mb-5 text-[15px] leading-relaxed">{paragraph}</p>
        ))}
      </article>

      <div className="mt-16 pt-8 border-t border-white/10 flex justify-between text-sm">
        <Link href="/blog" className="text-brand hover:underline">← All stories</Link>
        <Link href="/upload" className="text-brand hover:underline">Submit your music</Link>
      </div>
    </div>
  );
}
