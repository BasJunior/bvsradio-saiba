"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const THUMB_HEIGHT = 28;
const TRACK_HEIGHT = 112;
const TRACK_PADDING = 3;
const SCROLL_THRESHOLD = 560;
const VIEW_STORAGE_KEY = "bvs.library.view.v1";
type LibraryView = "list" | "grid";

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <path d="M5 6h14M5 12h14M5 18h14" />
    </svg>
  );
}

function scrollElement() {
  return document.scrollingElement || document.documentElement;
}

function maxScrollDistance() {
  const root = scrollElement();
  return Math.max(0, root.scrollHeight - window.innerHeight);
}

export default function AppScrollAssist() {
  const pathname = usePathname();
  const trackRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const dragOffset = useRef(THUMB_HEIGHT / 2);
  const [dragging, setDragging] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [progress, setProgress] = useState(0);
  const [view, setView] = useState<LibraryView>("list");
  const isLibrary = /^\/app\/(ios|android)\/library(?:\/|$)/.test(pathname);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "list") setView(saved);
    } catch {
      // Local preference is optional.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isLibrary) root.dataset.bvsLibraryView = view;
    else delete root.dataset.bvsLibraryView;
    return () => { delete root.dataset.bvsLibraryView; };
  }, [isLibrary, view]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const max = maxScrollDistance();
        const top = scrollElement().scrollTop || window.scrollY || 0;
        setScrollable(max > SCROLL_THRESHOLD);
        setProgress(max > 0 ? Math.min(1, Math.max(0, top / max)) : 0);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    const delayed = window.setTimeout(update, 350);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [pathname]);

  const scrollFromPointer = (clientY: number, offset = dragOffset.current) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const travel = Math.max(1, rect.height - TRACK_PADDING * 2 - THUMB_HEIGHT);
    const raw = (clientY - rect.top - TRACK_PADDING - offset) / travel;
    const ratio = Math.min(1, Math.max(0, raw));
    const max = maxScrollDistance();
    window.scrollTo(0, ratio * max);
    setProgress(ratio);
  };

  const finishDrag = (pointerId?: number) => {
    const track = trackRef.current;
    if (track && typeof pointerId === "number" && track.hasPointerCapture(pointerId)) {
      track.releasePointerCapture(pointerId);
    }
    activePointer.current = null;
    dragOffset.current = THUMB_HEIGHT / 2;
    setDragging(false);
  };

  const setLibraryView = (next: LibraryView) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* optional */ }
  };

  if (!scrollable && !isLibrary) return null;

  const thumbTop = TRACK_PADDING + progress * (TRACK_HEIGHT - TRACK_PADDING * 2 - THUMB_HEIGHT);

  return (
    <div
      className="fixed right-[max(.12rem,env(safe-area-inset-right))] top-[41%] z-[48] flex items-start gap-1"
      data-bvs-scroll-assist
      aria-label="Page view and fast scroll controls"
    >
      {isLibrary ? (
        <button
          type="button"
          onClick={() => setLibraryView(view === "list" ? "grid" : "list")}
          className="grid h-8 w-8 place-items-center rounded-lg border border-white/[.08] bg-[#101013]/84 text-white/55 shadow-[0_8px_22px_rgba(0,0,0,.28)] backdrop-blur-xl transition hover:border-brand/30 hover:text-brand active:scale-95"
          aria-label={view === "list" ? "Switch Library to grid view" : "Switch Library to list view"}
          aria-pressed={view === "grid"}
          title={view === "list" ? "Grid view" : "List view"}
        >
          {view === "list" ? <GridIcon /> : <ListIcon />}
        </button>
      ) : null}

      {scrollable ? (
        <div
          ref={trackRef}
          className="relative h-28 w-6 touch-none select-none"
          onPointerDown={(event) => {
            const target = event.target instanceof Element ? event.target : null;
            const thumb = target?.closest("[data-bvs-scroll-thumb]") as HTMLElement | null;
            activePointer.current = event.pointerId;
            dragOffset.current = thumb
              ? Math.min(THUMB_HEIGHT, Math.max(0, event.clientY - thumb.getBoundingClientRect().top))
              : THUMB_HEIGHT / 2;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            if (!thumb) scrollFromPointer(event.clientY, THUMB_HEIGHT / 2);
          }}
          onPointerMove={(event) => {
            if (activePointer.current === event.pointerId) scrollFromPointer(event.clientY);
          }}
          onPointerUp={(event) => finishDrag(event.pointerId)}
          onPointerCancel={(event) => finishDrag(event.pointerId)}
          onLostPointerCapture={() => finishDrag()}
          role="scrollbar"
          aria-controls="bvs-app-scroll-page"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Fast scroll"
          title="Drag to move through the page"
        >
          <span className="pointer-events-none absolute bottom-1 left-1/2 top-1 w-[3px] -translate-x-1/2 rounded-full bg-white/[.11]" aria-hidden="true" />
          <span
            data-bvs-scroll-thumb
            className={`absolute left-1/2 h-7 w-2.5 -translate-x-1/2 rounded-full border border-brand/25 bg-brand/75 shadow-[0_4px_12px_rgba(0,0,0,.35)] transition-[width,opacity,background-color] duration-150 ${dragging ? "w-3 bg-brand opacity-100" : "opacity-75"}`}
            style={{ top: `${thumbTop}px` }}
            aria-hidden="true"
          />
        </div>
      ) : null}
    </div>
  );
}
