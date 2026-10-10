"use client";

import { useState } from "react";
import { matchesDiscoveryQuery } from "@/lib/discovery-search";
import Image from "next/image";
import Link from "next/link";
import CreatorPortraitRail, { type CreatorPortrait } from "./CreatorPortraitRail";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";

type DirectoryItem = CreatorPortrait & { secondaryHref?: string; secondaryLabel?: string; description?: string };
export default function DiscoveryDirectory({ title, kicker, description, items, accent = "green", browseHref, browseLabel, emptyMessage }: {
  title: string; kicker: string; description: string; items: DirectoryItem[]; accent?: "green" | "purple";
  browseHref: string; browseLabel: string; emptyMessage: string;
}) {
  const [query, setQuery] = useState("");
  const visible = items.filter(item => matchesDiscoveryQuery(query, [item.name, decodeURIComponent(item.href), item.description]));
  return <main className="bvs-discovery-directory min-h-[70vh] pb-12">
    <div className="mx-auto max-w-7xl px-4 pt-8 sm:px-6"><Link href="/" className="inline-flex min-h-11 items-center text-sm text-text-secondary hover:text-white">Back to Home</Link><p className="mt-3 max-w-2xl text-base leading-7 text-text-secondary">{description}</p><p className="mt-3 text-sm text-text-secondary">{visible.length} {title.toLowerCase()} to explore</p><label className="mt-5 block max-w-lg text-sm">Search {title.toLowerCase()}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or handle" className="mt-2 block min-h-11 w-full border border-white/20 bg-black/30 px-3 text-white focus:border-brand" /></label></div>
    <CreatorPortraitRail title={title} headingLevel={1} kicker={kicker} tone="charcoal" accent={accent} allHref={browseHref} allLabel={browseLabel} items={visible} layout="grid" emptyMessage={query ? "No matches. Try another name or handle." : emptyMessage}>
      {visible.map(item => <article key={item.id} className="bvs-creator-portrait">
        <Link href={item.href} className="block" aria-label={`Open ${item.name}`}>
          <div className="bvs-creator-photo"><Image src={item.image || "/assets/images/default-avatar.png"} alt="" fill sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 240px" unoptimized={shouldBypassImageOptimizer(item.image)} className="object-cover" /></div>
          <div className="bvs-creator-caption"><h2 className="bvs-directory-name">{item.name}</h2><p>{item.detail}</p>{item.description ? <p className="line-clamp-3">{item.description}</p> : null}</div>
        </Link>
        {item.secondaryHref ? <Link href={item.secondaryHref} className="inline-flex min-h-11 items-center px-3 text-sm text-brand hover:underline">{item.secondaryLabel || "View catalogue"}</Link> : null}
      </article>)}
    </CreatorPortraitRail>
  </main>;
}
