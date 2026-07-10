import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/blog";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = blogPosts.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand transition-colors mb-8"
      >
        ← Back to Blog
      </Link>

      <article className="bg-bg-card/50 backdrop-blur rounded-2xl border border-white/10 p-8 md:p-12">
        <div className="flex items-center gap-3 text-sm text-text-secondary mb-4">
          <span>{post.date}</span>
          <span>•</span>
          <span>{post.readTime}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-6">{post.title}</h1>

        <div className="space-y-6 text-text-secondary leading-relaxed">
          {post.content.map((paragraph, i) => {
            if (paragraph.startsWith("**") && paragraph.endsWith("**")) {
              return (
                <h2 key={i} className="text-2xl font-semibold text-text-primary mt-10 mb-4">
                  {paragraph.replace(/\*\*/g, "")}
                </h2>
              );
            }
            return <p key={i}>{paragraph}</p>;
          })}
        </div>
      </article>

      <div className="mt-8">
        <Link
          href="/blog"
          className="text-brand hover:underline text-sm"
        >
          ← Back to all articles
        </Link>
      </div>
    </div>
  );
}