import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publishedWriterProfile, publicStoryCover } from "@/lib/journal-server";

type Props = { params: Promise<{ username: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await publishedWriterProfile(username);
  return { title: profile ? `${profile.name} | BVS Writer` : "Writer not found | BVS Radio",
    description: profile?.bio || "BVS Journal contributors and their stories." };
}
export default async function WriterProfile({ params }: Props) {
  const { username } = await params;
  const profile = await publishedWriterProfile(username);
  if (!profile) return notFound();
  return <main className="mx-auto max-w-5xl px-5 py-12 sm:px-6">
    <Link href="/blog" className="text-sm text-brand hover:underline">← BVS Journal</Link>
    <header className="mt-8 rounded-3xl border border-white/10 bg-white/[.03] p-7 sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Contributor</p>
      <h1 className="mt-3 text-4xl font-semibold">{profile.name}</h1>
      <p className="mt-5 max-w-3xl whitespace-pre-wrap leading-7 text-text-secondary">{profile.bio}</p>
      {profile.beats.length > 0 && <p className="mt-4 text-sm text-text-secondary">Covers: {profile.beats.join(" · ")}</p>}
    </header>
    <div className="mt-10 flex items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Published stories</h2><span className="text-sm text-text-secondary">{profile.articles.length}</span></div>
    <div className="mt-5 grid gap-5 sm:grid-cols-2">
      {profile.articles.map(story => {
        const cover = publicStoryCover(story.cover_art_path);
        return <Link key={story.id} href={`/blog/${story.slug}`} className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] transition hover:border-brand/50">
          {cover && <div className="relative aspect-video"><Image src={cover} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" /></div>}
          <div className="p-5"><p className="text-xs text-text-secondary">{new Date(story.published_at).toLocaleDateString()}</p><h3 className="mt-2 text-xl font-semibold group-hover:text-brand">{story.title}</h3><p className="mt-2 text-sm leading-6 text-text-secondary">{story.dek}</p></div>
        </Link>;
      })}
      {!profile.articles.length && <p className="text-sm text-text-secondary">No published articles yet.</p>}
    </div>
  </main>;
}
