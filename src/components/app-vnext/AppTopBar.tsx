"use client";

import Image from "next/image";
import Link from "next/link";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { measureHeader } from "@/lib/chrome-layout";

export default function AppTopBar({ surface }: { surface: AppSurface }) {
  const { user, loading } = useAppSession();
  const home = `/app/${surface}`;
  const initial = (user?.user_metadata?.full_name || user?.email || "B").trim().charAt(0).toUpperCase();

  return (
    <header ref={measureHeader} data-bvs-header className="fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-bg-primary/95 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={home} className="flex min-w-0 items-center gap-2.5" aria-label="BVS app home">
          <Image
            src="/branding/bvs-logo.png"
            alt="BVS Radio"
            width={1032}
            height={552}
            className="h-10 w-auto rounded-md object-contain"
            priority
          />
          <span className="hidden rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-brand sm:inline-flex">
            vNext
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/app/${surface}/explore`}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 text-lg text-text-secondary hover:border-brand/35 hover:text-brand"
            aria-label="Search and explore"
          >
            ⌕
          </Link>
          {loading ? (
            <span className="h-10 w-16 animate-pulse rounded-full bg-white/5" aria-hidden="true" />
          ) : user ? (
            <Link
              href={`/app/${surface}/you`}
              className="grid h-10 w-10 place-items-center rounded-full bg-brand font-semibold text-black"
              aria-label="Open your BVS profile"
            >
              {initial || "B"}
            </Link>
          ) : (
            <Link
              href={`/app/${surface}/join`}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-brand-dark"
            >
              Join BVS
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
