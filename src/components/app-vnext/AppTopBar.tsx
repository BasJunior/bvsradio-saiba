"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppShellMeasurement } from "@/components/app/useAppShellMeasurement";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="m16 16 4 4" />
    </svg>
  );
}

function MarketplaceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 9.5 6 5.5h12L19.5 9.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5h14v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-9Z" />
      <path strokeLinecap="round" d="M9 13.5v3M15 13.5v3" />
    </svg>
  );
}

export default function AppTopBar({ surface }: { surface: AppSurface }) {
  const { user, loading } = useAppSession();
  const pathname = usePathname();
  const router = useRouter();
  const headerRef = useAppShellMeasurement<HTMLElement>("--bvs-app-header-height-measured", true);
  const home = `/app/${surface}`;
  const primary = [home, `${home}/explore`, `${home}/library`, `${home}/studio`, `${home}/you`];
  const showBack = !primary.includes(pathname);
  const initial = (user?.user_metadata?.full_name || user?.email || "B").trim().charAt(0).toUpperCase();

  return (
    <header ref={headerRef} data-bvs-header className="bvs-app-header fixed inset-x-0 top-0 z-[60] border-b border-white/10 bg-bg-primary/95 backdrop-blur-2xl">
      <div className="bvs-app-header-inner mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          {showBack ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-2xl text-brand transition hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label="Back to previous screen"
            >
              ‹
            </button>
          ) : null}
          <Link href={home} className="flex min-w-0 items-center gap-2.5" aria-label="BVS Radio home">
            <Image
              src="/branding/bvs-logo.png"
              alt=""
              width={1032}
              height={552}
              className="h-10 w-auto rounded-md object-contain"
              priority
            />
          </Link>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/app/${surface}/marketplace`}
            className="grid h-11 w-11 place-items-center rounded-full text-text-secondary hover:bg-white/5 hover:text-brand"
            aria-label="Open BVS Marketplace"
          >
            <MarketplaceIcon />
          </Link>
          <Link
            href={`/app/${surface}/explore`}
            className="grid h-11 w-11 place-items-center rounded-full text-text-secondary hover:bg-white/5 hover:text-brand"
            aria-label="Search and explore"
          >
            <SearchIcon />
          </Link>
          {loading ? (
            <span className="h-10 w-10 animate-pulse rounded-full bg-white/5" aria-hidden="true" />
          ) : user ? (
            <Link
              href={`/app/${surface}/you`}
              className="grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-semibold text-black"
              aria-label="Open your BVS profile"
            >
              {initial || "B"}
            </Link>
          ) : (
            <Link
              href={`/app/${surface}/join`}
              className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black hover:bg-brand-dark"
            >
              Join
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
