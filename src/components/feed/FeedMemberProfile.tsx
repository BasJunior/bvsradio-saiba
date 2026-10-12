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
  return <main className="mx-auto max-w-3xl px-4 pb-32 pt-8">
    <Link href={`${surface ? `/app/${surface}` : ""}/feed`} className="inline-flex min-h-11 items-center text-sm text-white/55">← Feed</Link>
    {!data ? <p role="status" className="mt-6 text-white/55">{result?.owner === owner && result.error ? result.error : "Loading member…"}</p> : <>
      <section className="mt-5 border border-white/10 bg-[#111] p-6">
        <div className="flex items-center gap-4">{data.profile.avatarUrl ? <Image src={data.profile.avatarUrl} alt="" width={80} height={80} unoptimized className="h-20 w-20 object-cover" /> : <span aria-hidden="true" className="grid h-20 w-20 place-items-center bg-white/10 text-3xl">{data.profile.displayName.slice(0,1).toUpperCase()}</span>}
          <div><p className="text-xs text-brand">BVS member</p><h1 className="mt-1 text-3xl font-semibold">{data.profile.displayName}</h1>{data.profile.username ? <p className="mt-1 text-sm text-white/45">@{data.profile.username}</p> : null}</div></div>
        {data.bio ? <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-white/65">{data.bio}</p> : null}
        {data.creatorHref ? <Link href={data.creatorHref} className="mt-5 inline-flex min-h-11 items-center border border-brand/30 px-4 text-sm font-semibold text-brand">View creator page →</Link> : null}
      </section>
      <h2 className="mt-8 text-xl font-semibold">Recent public activity</h2>
      <div className="mt-4 space-y-3">{data.activity.map(item => <Link key={item.id} href={item.href} className="block border border-white/10 p-4 hover:border-brand/30"><span className="text-xs text-white/40">{item.kind}</span><p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{item.body}</p></Link>)}</div>
      {!data.activity.length ? <p className="mt-4 text-sm text-white/45">No public discussion activity yet.</p> : null}
    </>}
  </main>;
}
