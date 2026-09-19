"use client";

import Link from "next/link";
import type { CreatorNextMove } from "@/lib/creator-next-move";

function toneClass(tone: CreatorNextMove["tone"]) {
  if (tone === "success") return "border-emerald-400/25 bg-emerald-500/[.06]";
  if (tone === "warning") return "border-amber-300/30 bg-amber-300/[.06]";
  if (tone === "brand") return "border-brand/30 bg-brand/[.06]";
  return "border-white/10 bg-white/[.025]";
}

export default function CreatorNextMoveCard({
  move,
  className = "",
}: {
  move: CreatorNextMove | null;
  className?: string;
}) {
  if (!move) return null;

  return (
    <div className={`rounded-2xl border p-4 ${toneClass(move.tone)} ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-brand">
        {move.eyebrow}
      </p>
      <h4 className="mt-1 text-base font-semibold text-text-primary">{move.title}</h4>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{move.body}</p>
      {(move.primaryAction || move.secondaryAction) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {move.primaryAction && (
            <Link
              href={move.primaryAction.href}
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black"
            >
              {move.primaryAction.label}
            </Link>
          )}
          {move.secondaryAction && (
            <Link
              href={move.secondaryAction.href}
              className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-4 py-2 text-sm hover:border-brand"
            >
              {move.secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
