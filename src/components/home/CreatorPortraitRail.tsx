"use client";

import Image from "next/image";
import Link from "next/link";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type CreatorPortrait = { id: string; name: string; image: string; href: string; detail: string; accent?: string };

export default function CreatorPortraitRail({ title, tone, items, allHref, allAction, allLabel = "See all", emptyMessage, accent = "green", kicker = "The people behind the sound", children, "data-home-accent": homeAccent }: {
  title: string;
  tone: "charcoal" | "ink";
  items: CreatorPortrait[];
  allHref: string;
  allAction?: () => void;
  allLabel?: string;
  emptyMessage?: string;
  accent?: "green" | "purple";
  kicker?: string;
  children?: ReactNode;
  "data-home-accent"?: string;
}) {
  const id = useId();
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => setEdges({ previous: rail.scrollLeft > 4, next: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 4 });
    update();
    rail.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(rail);
    return () => { rail.removeEventListener("scroll", update); observer?.disconnect(); };
  }, [items.length]);

  function move(direction: number) {
    const rail = railRef.current;
    if (!rail) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * rail.clientWidth * .8, behavior: reduced ? "auto" : "smooth" });
  }

  if (!items.length && !emptyMessage) return null;
  return <section data-home-accent={homeAccent} className={`bvs-creator-band bvs-creator-band--${tone} ${accent === "purple" ? "bvs-creator-band--purple" : ""}`} aria-labelledby={`${id}-heading`}>
    <div className="bvs-creator-band-inner">
      <div className="bvs-creator-band-header">
        <div><p className="bvs-creator-kicker">{kicker}</p><h2 id={`${id}-heading`}>{title}</h2></div>
        {allAction ? <button type="button" className="bvs-creator-directory" onClick={allAction}>{allLabel} <span aria-hidden="true">↗</span></button> : <Link className="bvs-creator-directory" href={allHref}>{allLabel} <span aria-hidden="true">↗</span></Link>}
      </div>
      {items.length ? <><div className="bvs-creator-scroll-guide">
        <p id={`${id}-hint`}>Swipe or scroll sideways <span aria-hidden="true">→</span></p>
        <div className="bvs-creator-scroll-controls">
          <button type="button" aria-label={`Scroll ${title.toLowerCase()} left`} aria-controls={`${id}-rail`} disabled={!edges.previous} onClick={() => move(-1)}>←</button>
          <button type="button" aria-label={`Scroll ${title.toLowerCase()} right`} aria-controls={`${id}-rail`} disabled={!edges.next} onClick={() => move(1)}>→</button>
        </div>
      </div>
      <div ref={railRef} id={`${id}-rail`} className="bvs-creator-portrait-rail" role="region" aria-label={`${title} portraits`} aria-describedby={`${id}-hint`} tabIndex={0}>
        {children || items.map(item => <Link key={item.id} href={item.href} data-home-accent={item.accent} className="bvs-creator-portrait">
          <div className="bvs-creator-photo"><Image src={item.image || "/assets/images/default-avatar.png"} alt="" fill loading="lazy" decoding="async" sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 240px" unoptimized={shouldBypassImageOptimizer(item.image)} className="object-cover" /></div>
          <div className="bvs-creator-caption"><h3>{item.name}</h3><p>{item.detail}</p></div>
        </Link>)}
      </div>
      </> : <p className="mt-6 text-sm text-text-secondary">{emptyMessage}</p>}
    </div>
  </section>;
}
