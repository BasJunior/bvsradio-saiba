"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CreatorNextMove } from "@/lib/creator-next-move";

export default function CreatorNextMovePrompt({
  move,
  storageKey,
}: {
  move: CreatorNextMove | null;
  storageKey: string;
}) {
  const [open, setOpen] = useState(false);
  const key = useMemo(
    () => (move ? `bvs:creator-next-move:${storageKey}:${move.id}` : ""),
    [move, storageKey],
  );

  useEffect(() => {
    if (!move || !key) {
      setOpen(false);
      return;
    }
    try {
      setOpen(window.localStorage.getItem(key) !== "dismissed");
    } catch {
      setOpen(true);
    }
  }, [key, move]);

  if (!move || !open) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(key, "dismissed");
    } catch {
      // Keep dismissal local to this render when storage is unavailable.
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-end bg-black/65 p-3 sm:place-items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${key}-title`}
        className="w-full max-w-lg rounded-[1.75rem] border border-brand/30 bg-bg-primary p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-brand">
              {move.eyebrow}
            </p>
            <h2 id={`${key}-title`} className="mt-2 text-2xl font-semibold">
              {move.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-text-secondary hover:border-brand hover:text-text-primary"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-text-secondary">{move.body}</p>

        <div className="mt-6 grid gap-2">
          {move.primaryAction && (
            <Link
              href={move.primaryAction.href}
              onClick={dismiss}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-5 py-3 text-center text-sm font-semibold text-black"
            >
              {move.primaryAction.label}
            </Link>
          )}
          {move.secondaryAction && (
            <Link
              href={move.secondaryAction.href}
              onClick={dismiss}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 px-5 py-3 text-center text-sm font-medium hover:border-brand"
            >
              {move.secondaryAction.label}
            </Link>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 rounded-full px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Not now
          </button>
        </div>

        <p className="mt-4 text-xs leading-5 text-text-secondary">
          Editorial approval and BVS rotation are separate from paid creator tools. Nothing is charged until you choose a paid option and complete checkout.
        </p>
      </section>
    </div>
  );
}
