"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppSurface } from "@/lib/app-surface";
type Member = { profile: { id: string; displayName: string; username: string | null; avatarUrl: string | null }; bio: string; creatorHref: string | null; activity: { id: string; body: string; createdAt: string; href: string; kind: string }[] };
export default function FeedMemberProfile({ id, surface }: { id: string; surface: AppSurface | null }) {
  const session = useAppSession();
  const [result, setResult] = useState<{ owner: string; data?: Member; error?: string } | null>(null);
  const owner = `${session.user?.id || "guest"}:${id}:${surface || "web"}`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/app/participation/members/${encodeURIComponent(id)}${surface ? `?surface=${surface}` : ""}`, { headers: session.token ? { Authorization: `Bearer ${session.token}` } : {}, cache: "no-store", signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!controller.signal.aborted) setResult({ owner, ...(response.ok ? { data } : { error: data.error || "Profile unavailable." }) }); })
      .catch(() => { if (!controller.signal.aborted) setResult({ owner, error: "Could not load this profile." }); });
    return () => controller.abort();
  }, [id, surface, session.token, owner]);
  const data = result?.owner === owner ? result.data : undefined;
  const feedHref = `${surface ? `/app/${surface}` : ""}/feed`;
  return <main className="bvs-app-page bvs-app-feed mx-auto max-w-3xl px-4 pb-32 pt-4 sm:px-6" data-app-accent="feed">
    <Link href={feedHref} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-white/60 hover:text-white"><span aria-hidden="true">‹</span> Feed</Link>
    {!data ? <p role="status" className="mt-6 text-white/55">{result?.owner === owner && result.error ? result.error : "Loading profile…"}</p> : <>
      <section className="mt-3 flex items-center gap-4">
        {data.profile.avatarUrl ? <Image src={data.profile.avatarUrl} alt="" width={88} height={88} unoptimized className="h-[88px] w-[88px] shrink-0 object-cover" /> : <span aria-hidden="true" className="grid h-[88px] w-[88px] shrink-0 place-items-center bg-[#c1a7ff]/20 text-3xl font-bold text-[#c1a7ff]">{data.profile.displayName.slice(0, 1).toUpperCase()}</span>}
        <div className="min-w-0">
          <p className="bvs-app-eyebrow">BVS member</p>
          <h1 className="mt-1 truncate text-[2rem] font-bold leading-none tracking-tight">{data.profile.displayName}</h1>
          {data.profile.username ? <p className="mt-1 text-sm text-white/50">@{data.profile.username}</p> : null}
        </div>
      </section>
      {data.bio ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/65">{data.bio}</p> : null}
      {data.creatorHref ? <Link href={data.creatorHref} className="bvs-app-pill bvs-app-pill--accent mt-4">View their music →</Link> : null}
      <section className="bvs-app-shelf" aria-labelledby="member-activity-heading">
        <h2 id="member-activity-heading" className="bvs-app-shelf-title">Recent posts and replies</h2>
        <div className="mt-2">{data.activity.map(item => <Link key={item.id} href={item.href} className="bvs-app-row block py-3"><span className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/40">{item.kind}</span><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-white/75">{item.body}</p></Link>)}</div>
        {!data.activity.length ? <p className="mt-2 text-sm text-white/45">Nothing posted yet.</p> : null}
      </section>
    </>}
  </main>;
}
