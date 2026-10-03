"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export type CreatorPortrait = { id: string; name: string; image: string; href: string; detail: string };

export default function CreatorPortraitRail({ title, tone, items, allHref }: {
  title: string;
  tone: "ink";
  items: CreatorPortrait[];
  allHref: string;
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

  if (!items.length) return null;
  return <section className={`bvs-creator-band bvs-creator-band--${tone}`} aria-labelledby={`${id}-heading`}>
    <div className="bvs-creator-band-inner">
      <div className="bvs-creator-band-header">
        <div><p className="bvs-creator-kicker">The people behind the sound</p><h2 id={`${id}-heading`}>{title}</h2></div>
        <Link className="bvs-creator-directory" href={allHref}>See all <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="bvs-creator-scroll-guide">
        <p id={`${id}-hint`}>Swipe or scroll sideways <span aria-hidden="true">→</span></p>
        <div className="bvs-creator-scroll-controls">
          <button type="button" aria-label={`Scroll ${title.toLowerCase()} left`} aria-controls={`${id}-rail`} disabled={!edges.previous} onClick={() => move(-1)}>←</button>
          <button type="button" aria-label={`Scroll ${title.toLowerCase()} right`} aria-controls={`${id}-rail`} disabled={!edges.next} onClick={() => move(1)}>→</button>
        </div>
      </div>
      <div ref={railRef} id={`${id}-rail`} className="bvs-creator-portrait-rail" role="region" aria-label={`${title} portraits`} aria-describedby={`${id}-hint`} tabIndex={0}>
        {items.map(item => <Link key={item.id} href={item.href} className="bvs-creator-portrait">
          <div className="bvs-creator-photo"><Image src={item.image || "/assets/images/default-avatar.png"} alt="" fill sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 240px" unoptimized={/^https?:\/\//i.test(item.image)} className="object-cover" /></div>
          <div className="bvs-creator-caption"><h3>{item.name}</h3><p>{item.detail}</p></div>
        </Link>)}
      </div>
    </div>
  </section>;
}
