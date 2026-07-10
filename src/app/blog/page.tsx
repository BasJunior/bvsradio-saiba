import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Articles about radio, music, streaming, and the audio industry",
};

export default function BlogIndexPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">BVS Radio Blog</h1>
        <p className="text-text-secondary text-lg">
          Articles about radio, music streaming, DJ culture, and the audio industry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="bg-bg-card/50 backdrop-blur rounded-xl border border-white/10 p-6 hover:border-brand/30 hover:bg-bg-card/70 transition-all group"
          >
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
              <span>{post.date}</span>
              <span>•</span>
              <span>{post.readTime}</span>
            </div>
            <h2 className="text-lg font-semibold mb-2 group-hover:text-brand transition-colors">
              {post.title}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              {post.description}
            </p>
            <span className="inline-block text-sm text-brand mt-3 group-hover:underline">
              Read more →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}