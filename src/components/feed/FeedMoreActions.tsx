"use client";

import { useEffect, useRef, useState } from "react";

/** Native disclosure semantics with outside-click and Escape dismissal. */
export default function FeedMoreActions({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node) && ref.current) ref.current.open = false;
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
  return <details ref={ref} onToggle={event => setOpen(event.currentTarget.open)} className="relative shrink-0">
    <summary aria-label={`More actions for ${title}`} className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full text-lg text-white/50 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">•••</summary>
    <div className="absolute right-0 top-12 z-30 grid w-52 gap-1 rounded-2xl border border-white/10 bg-[#141416] p-2 shadow-2xl" onClick={event => {
      if ((event.target as HTMLElement).closest("button,a") && ref.current) ref.current.open = false;
    }}>{children}</div>
  </details>;
}
