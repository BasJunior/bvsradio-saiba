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
    <header
      ref={measureHeader}
      data-bvs-header
      className="fixed inset-x-0 top-0 z-[60] border-b border-white/[.07] bg-[#09090b]/80 backdrop-blur-2xl"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={home} className="flex min-w-0 items-center gap-3" aria-label="BVS home">
          <Image
            src="/branding/bvs-logo.png"
            alt="BVS"
            width={1032}
            height={552}
            className="h-9 w-auto object-contain"
            priority
          />
          <span className="hidden h-5 w-px bg-white/10 sm:block" aria-hidden="true" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[.24em] text-white/45 sm:block">
            Best Virtual Sound
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/app/${surface}/marketplace`}
            className="grid h-10 w-10 place-items-center rounded-full text-base text-white/58 transition hover:bg-white/[.055] hover:text-white"
            aria-label="Marketplace"
          >
            ◇
          </Link>
          <Link
            href={`/app/${surface}/explore`}
            className="grid h-10 w-10 place-items-center rounded-full text-lg text-white/58 transition hover:bg-white/[.055] hover:text-white"
            aria-label="Search"
          >
            ⌕
          </Link>
          {loading ? (
            <span className="ml-1 h-9 w-9 animate-pulse rounded-full bg-white/[.06]" aria-hidden="true" />
          ) : user ? (
            <Link
              href={`/app/${surface}/you`}
              className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-black shadow-[0_0_28px_rgba(227,189,88,.18)] transition hover:scale-[1.03]"
              aria-label="Your profile"
            >
              {initial || "B"}
            </Link>
          ) : (
            <Link
              href={`/app/${surface}/join`}
              className="ml-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-brand"
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
