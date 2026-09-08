"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

export default function AppLibraryViewToggle() {
  const pathname = usePathname();
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

  if (!isLibrary) return null;

  const next = view === "list" ? "grid" : "list";
  return (
    <button
      type="button"
      onClick={() => {
        setView(next);
        try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* optional */ }
      }}
      className="fixed right-[max(.5rem,env(safe-area-inset-right))] top-[calc(var(--bvs-header-height,4rem)+.75rem)] z-[48] grid h-8 w-8 place-items-center rounded-lg border border-white/[.08] bg-[#101013]/84 text-white/55 shadow-[0_8px_22px_rgba(0,0,0,.28)] backdrop-blur-xl transition hover:border-brand/30 hover:text-brand active:scale-95"
      aria-label={view === "list" ? "Switch Library to grid view" : "Switch Library to list view"}
      aria-pressed={view === "grid"}
      title={view === "list" ? "Grid view" : "List view"}
      data-bvs-library-view-toggle
    >
      {view === "list" ? <GridIcon /> : <ListIcon />}
    </button>
  );
}
