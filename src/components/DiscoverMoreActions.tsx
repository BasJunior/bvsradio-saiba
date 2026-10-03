"use client";

import { useEffect, useRef, useState } from "react";

/** Inline actions keep nested playlist pickers and download status visible. */
export default function DiscoverMoreActions({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <details ref={ref} name="discover-card-actions" onToggle={event => setOpen(event.currentTarget.open)} className="bvs-discover-actions">
    <summary aria-label={`More actions for ${title}`} className="min-h-11 cursor-pointer list-none text-sm text-white/60 focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">••• <span className="text-xs">More</span></summary>
    <div className="bvs-discover-actions-content">{children}</div>
  </details>;
}
