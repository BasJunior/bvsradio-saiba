"use client";

import Image from "next/image";
import Link from "next/link";
import { shouldBypassImageOptimizer } from "@/lib/image-optimization";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type CreatorPortrait = { id: string; name: string; image: string; href: string; detail: string; accent?: string };

export default function CreatorPortraitRail({ title, tone, items, allHref, allAction, allLabel = "See all", emptyMessage, headingLevel = 2, accent = "green", kicker = "The people behind the sound", kickerBelowTitle = false, autoScroll = false, children, layout = "rail", "data-home-accent": homeAccent }: {
  title: string;
  tone: "charcoal" | "ink";
  items: CreatorPortrait[];
  allHref: string;
  allAction?: () => void;
  allLabel?: string;
  emptyMessage?: string;
  headingLevel?: 1 | 2;
  accent?: "green" | "purple";
  kicker?: string;
  kickerBelowTitle?: boolean;
  autoScroll?: boolean;
  children?: ReactNode;
  layout?: "rail" | "grid";
  "data-home-accent"?: string;
}) {
  const id = useId();
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const railRef = useRef<HTMLDivElement>(null);
  const manualPauseUntil = useRef(0);
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


  // Opt-in only: the BeatStore rail moves gently, seamlessly and indefinitely.
  // The homepage rails retain their existing manual-only behaviour.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !autoScroll || layout !== "rail" || children || !items.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let pointerOver = false;
    let focused = false;
    let touching = false;
    let frame = 0;
    let last = 0;

    const onEnter = () => { pointerOver = true; };
    const onLeave = () => { pointerOver = false; };
    const onFocusIn = () => { focused = true; };
    const onFocusOut = (event: FocusEvent) => {
      if (!rail.contains(event.relatedTarget as Node | null)) focused = false;
    };
    const onTouchStart = () => { touching = true; };
    const onTouchEnd = () => {
      touching = false;
      manualPauseUntil.current = performance.now() + 3500;
    };
    const onManualScroll = () => { manualPauseUntil.current = performance.now() + 3500; };
    rail.addEventListener("pointerenter", onEnter);
    rail.addEventListener("pointerleave", onLeave);
    rail.addEventListener("focusin", onFocusIn);
    rail.addEventListener("focusout", onFocusOut);
    rail.addEventListener("touchstart", onTouchStart, { passive: true });
    rail.addEventListener("touchend", onTouchEnd, { passive: true });
    rail.addEventListener("wheel", onManualScroll, { passive: true });
    rail.addEventListener("pointerdown", onManualScroll);

    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 48) : 0;
      last = now;
      if (
        !reducedMotion.matches && !document.hidden &&
        !pointerOver && !focused && !touching &&
        now >= manualPauseUntil.current
      ) {
        const first = rail.children.item(0) as HTMLElement | null;
        const repeated = rail.children.item(items.length) as HTMLElement | null;
        if (first && repeated) {
          const cycleWidth = repeated.offsetLeft - first.offsetLeft;
          if (cycleWidth > 0) {
            rail.scrollLeft += dt * 0.018; // ~18 pixels per second.
            if (rail.scrollLeft >= cycleWidth) rail.scrollLeft -= cycleWidth;
          }
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      rail.removeEventListener("pointerenter", onEnter);
      rail.removeEventListener("pointerleave", onLeave);
      rail.removeEventListener("focusin", onFocusIn);
      rail.removeEventListener("focusout", onFocusOut);
      rail.removeEventListener("touchstart", onTouchStart);
      rail.removeEventListener("touchend", onTouchEnd);
      rail.removeEventListener("wheel", onManualScroll);
      rail.removeEventListener("pointerdown", onManualScroll);
    };
  }, [autoScroll, children, items.length, layout]);

  function move(direction: number) {
    const rail = railRef.current;
    if (!rail) return;
    if (autoScroll) manualPauseUntil.current = performance.now() + 4000;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * rail.clientWidth * .8, behavior: reduced ? "auto" : "smooth" });
  }

  if (!items.length && !emptyMessage) return null;
  return <section data-home-accent={homeAccent} className={`bvs-creator-band bvs-creator-band--${tone} ${accent === "purple" ? "bvs-creator-band--purple" : ""}`} aria-labelledby={`${id}-heading`}>
    <div className="bvs-creator-band-inner">
      <div className="bvs-creator-band-header">
        <div>{!kickerBelowTitle && <p className="bvs-creator-kicker">{kicker}</p>}<Heading id={`${id}-heading`} className={headingLevel === 1 ? "bvs-directory-title" : undefined}>{title}</Heading>{kickerBelowTitle && <p className="bvs-creator-kicker mt-3">{kicker}</p>}</div>
        {allAction ? <button type="button" className="bvs-creator-directory" onClick={allAction}>{allLabel} <span aria-hidden="true">↗</span></button> : <Link className="bvs-creator-directory" href={allHref}>{allLabel} <span aria-hidden="true">↗</span></Link>}
      </div>
      {items.length ? <>{layout === "rail" ? <div className="bvs-creator-scroll-guide">
        <p id={`${id}-hint`}>Swipe or scroll sideways <span aria-hidden="true">→</span></p>
        <div className="bvs-creator-scroll-controls">
          <button type="button" aria-label={`Scroll ${title.toLowerCase()} left`} aria-controls={`${id}-rail`} disabled={!edges.previous} onClick={() => move(-1)}>←</button>
          <button type="button" aria-label={`Scroll ${title.toLowerCase()} right`} aria-controls={`${id}-rail`} disabled={!edges.next} onClick={() => move(1)}>→</button>
        </div>
      </div> : null}
      <div ref={railRef} id={`${id}-rail`} className={`bvs-creator-portrait-rail${layout === "grid" ? " bvs-creator-portrait-grid" : ""}`} style={autoScroll && layout === "rail" ? { scrollSnapType: "none", scrollBehavior: "auto" } : undefined} role="region" aria-label={`${title} portraits`} aria-describedby={layout === "rail" ? `${id}-hint` : undefined} tabIndex={0}>
        {children || (autoScroll && layout === "rail" ? Array.from({ length: Math.max(3, Math.ceil(16 / items.length)) }, () => items).flat() : items).map((item, index) => <Link key={`${item.id}-${index}`} href={item.href} data-home-accent={item.accent} aria-hidden={autoScroll && index >= items.length ? true : undefined} tabIndex={autoScroll && index >= items.length ? -1 : undefined} className="bvs-creator-portrait">
          <div className="bvs-creator-photo"><Image src={item.image || "/assets/images/default-avatar.png"} alt="" fill loading="lazy" decoding="async" sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 240px" unoptimized={shouldBypassImageOptimizer(item.image)} className="object-cover" /></div>
          <div className="bvs-creator-caption"><h3>{item.name}</h3><p>{item.detail}</p></div>
        </Link>)}
      </div>
      </> : <p className="mt-6 text-sm text-text-secondary">{emptyMessage}</p>}
    </div>
  </section>;
}
