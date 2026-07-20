import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts } from "@/lib/blog";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return { title: "Story not found | BVS Radio" };
  return {
    title: `${post.title} | BVS Journal`,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return notFound();

  const index = blogPosts.findIndex((p) => p.slug === slug);
  const prev = index > 0 ? blogPosts[index - 1] : null;
  const next = index >= 0 && index < blogPosts.length - 1 ? blogPosts[index + 1] : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/blog" className="text-sm text-brand hover:underline">
        ← Back to Journal
      </Link>

      <div className="mt-6">
        <div className="mb-2 text-xs tracking-widest text-text-secondary">
          {post.date} · {post.readTime}
        </div>
        <h1 className="mb-8 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        <p className="mb-10 text-lg text-text-secondary">{post.description}</p>
      </div>

      <article className="prose prose-invert max-w-none prose-p:text-text-secondary prose-headings:text-white prose-strong:text-white">
        {post.content.map((paragraph, i) => {
          if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
            return (
              <h2 key={i} className="mb-3 mt-10 text-xl font-semibold text-white">
                {paragraph.replace(/^\*\*|\*\*$/g, "")}
              </h2>
            );
          }
          return (
            <p key={i} className="mb-5 text-[15px] leading-relaxed text-text-secondary">
              {paragraph}
            </p>
          );
        })}
      </article>

      <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-4">
          <Link href="/blog" className="text-brand hover:underline">
            ← All stories
          </Link>
          {prev && (
            <Link href={`/blog/${prev.slug}`} className="text-text-secondary hover:text-brand">
              Previous
            </Link>
          )}
          {next && (
            <Link href={`/blog/${next.slug}`} className="text-text-secondary hover:text-brand">
              Next →
            </Link>
          )}
        </div>
        <Link href="/upload" className="text-brand hover:underline">
          Submit your music
        </Link>
      </div>
    </div>
  );
}
