"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const THUMB_HEIGHT = 44;
const TRACK_PADDING = 4;
const VIEW_STORAGE_KEY = "bvs.library.view.v1";
type LibraryView = "list" | "grid";

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <path d="M5 6h14M5 12h14M5 18h14" />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="m8.5 8 3.5-3.5L15.5 8M8.5 16l3.5 3.5 3.5-3.5" />
      <path d="M12 5v14" />
    </svg>
  );
}

export default function AppScrollAssist() {
  const pathname = usePathname();
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
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
        const root = document.documentElement;
        const max = Math.max(0, root.scrollHeight - window.innerHeight);
        setScrollable(max > 180);
        setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
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

  const scrollFromPointer = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const travel = Math.max(1, rect.height - TRACK_PADDING * 2 - THUMB_HEIGHT);
    const raw = (clientY - rect.top - TRACK_PADDING - THUMB_HEIGHT / 2) / travel;
    const ratio = Math.min(1, Math.max(0, raw));
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: ratio * max, behavior: "auto" });
    setProgress(ratio);
  };

  const setLibraryView = (next: LibraryView) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* optional */ }
  };

  if (!scrollable && !isLibrary) return null;

  const thumbTop = TRACK_PADDING + progress * (144 - TRACK_PADDING * 2 - THUMB_HEIGHT);

  return (
    <div
      className="fixed right-[max(.35rem,env(safe-area-inset-right))] top-[38%] z-[48] flex items-start gap-1.5"
      data-bvs-scroll-assist
      aria-label="Page view and fast scroll controls"
    >
      {isLibrary ? (
        <button
          type="button"
          onClick={() => setLibraryView(view === "list" ? "grid" : "list")}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/[.1] bg-[#111114]/92 text-white/65 shadow-[0_12px_35px_rgba(0,0,0,.35)] backdrop-blur-xl transition hover:border-brand/30 hover:text-brand active:scale-95"
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
          className="relative h-36 w-10 touch-none rounded-2xl border border-white/[.08] bg-[#111114]/78 shadow-[0_12px_35px_rgba(0,0,0,.35)] backdrop-blur-xl"
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            scrollFromPointer(event.clientY);
          }}
          onPointerMove={(event) => {
            if (dragging.current) scrollFromPointer(event.clientY);
          }}
          onPointerUp={(event) => {
            dragging.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => { dragging.current = false; }}
          role="scrollbar"
          aria-controls="bvs-app-scroll-page"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Fast scroll"
          title="Drag to move through the page"
        >
          <span
            className="absolute left-1 right-1 grid h-11 place-items-center rounded-xl border border-brand/20 bg-brand/12 text-brand shadow-[0_8px_20px_rgba(0,0,0,.28)]"
            style={{ top: `${thumbTop}px` }}
            aria-hidden="true"
          >
            <DragIcon />
          </span>
        </div>
      ) : null}
    </div>
  );
}
