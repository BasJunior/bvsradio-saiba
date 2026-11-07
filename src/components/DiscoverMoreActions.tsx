"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Inline actions keep nested playlist pickers and download status visible.
 * With `sheet`, the actions open as a bottom sheet rendered at the document
 * root, so cards inside sideways-scrolling shelves never clip the menu.
 */
export default function DiscoverMoreActions({ title, children, sheet = false }: { title: string; children: React.ReactNode; sheet?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sheetRef.current?.contains(target)) return;
      if (ref.current && !ref.current.contains(target)) ref.current.open = false;
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
  const close = () => { if (ref.current) ref.current.open = false; };
  return <details ref={ref} name="discover-card-actions" onToggle={event => setOpen(event.currentTarget.open)} className="bvs-discover-actions">
    <summary aria-label={`More actions for ${title}`} className="min-h-11 cursor-pointer list-none text-sm text-white/60 focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">••• <span className="text-xs">More</span></summary>
    {sheet ? (open && typeof document !== "undefined" ? createPortal(
      <div className="bvs-action-sheet" role="presentation">
        <button type="button" aria-label="Close actions" className="bvs-action-sheet-backdrop" onClick={close} />
        <div ref={sheetRef} role="dialog" aria-modal="true" aria-label={`Actions for ${title}`} className="bvs-action-sheet-panel">
          <p className="bvs-action-sheet-title">{title}</p>
          <div className="bvs-discover-actions-content">{children}</div>
          <button type="button" onClick={close} className="bvs-action-sheet-cancel">Cancel</button>
        </div>
      </div>,
      document.body,
    ) : null) : <div className="bvs-discover-actions-content">{children}</div>}
  </details>;
}
