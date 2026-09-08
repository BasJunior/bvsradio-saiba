"use client";

import { useEffect, useState } from "react";

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

export default function AppLibraryViewToggle() {
  const [view, setView] = useState<LibraryView>("list");

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
    root.dataset.bvsLibraryView = view;
    return () => { delete root.dataset.bvsLibraryView; };
  }, [view]);

  const next = view === "list" ? "grid" : "list";
  return (
    <button
      type="button"
      onClick={() => {
        setView(next);
        try { window.localStorage.setItem(VIEW_STORAGE_KEY, next); } catch { /* optional */ }
      }}
      className="grid h-11 w-11 place-items-center rounded-full text-white/62 transition hover:bg-white/[.055] hover:text-brand active:scale-95"
      aria-label={view === "list" ? "Switch Library to grid view" : "Switch Library to list view"}
      aria-pressed={view === "grid"}
      title={view === "list" ? "Grid view" : "List view"}
      data-bvs-library-view-toggle
    >
      {view === "list" ? <GridIcon /> : <ListIcon />}
    </button>
  );
}
