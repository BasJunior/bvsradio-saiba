import Link from "next/link";
import type { ReactNode } from "react";

export default function StudioManageLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-7">
        <div className="bvs-surface-quiet flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="bvs-chip bvs-chip-brand">Studio Manage</span>
            <span className="hidden text-xs text-text-secondary sm:inline">Full creator workspace</span>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/creator/studio" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Studio home</Link>
            <Link href="/premium" className="rounded-full border border-white/15 px-4 py-2 hover:border-brand">Premium</Link>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
