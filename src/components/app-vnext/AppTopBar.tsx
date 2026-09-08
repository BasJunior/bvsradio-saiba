"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { measureHeader } from "@/lib/chrome-layout";

function MarketplaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <path d="M4.5 9.5v10h15v-10" />
      <path d="M3.5 9.5 5.4 4h13.2l1.9 5.5" />
      <path d="M3.5 9.5c0 1.25 1 2.25 2.25 2.25S8 10.75 8 9.5c0 1.25 1 2.25 2.25 2.25s2.25-1 2.25-2.25c0 1.25 1 2.25 2.25 2.25S17 10.75 17 9.5c0 1.25 1 2.25 2.25 2.25s2.25-1 2.25-2.25" />
      <path d="M9.25 19.5v-4.75h5.5v4.75" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
      <circle cx="10.75" cy="10.75" r="6.25" />
      <path d="m15.5 15.5 4.25 4.25" />
    </svg>
  );
}

export default function AppTopBar({ surface }: { surface: AppSurface }) {
  const { user, avatarUrl, profileDisplayName, profileUsername, loading, refresh } = useAppSession();
  const pathname = usePathname();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const mountedPath = useRef(pathname);
  const home = `/app/${surface}`;
  const initial = (
    profileDisplayName ||
    profileUsername ||
    String(user?.user_metadata?.full_name || "") ||
    user?.email ||
    "B"
  ).trim().charAt(0).toUpperCase();

  useEffect(() => { setAvatarFailed(false); }, [avatarUrl]);
  useEffect(() => {
    if (mountedPath.current === pathname) return;
    mountedPath.current = pathname;
    if (user) void refresh();
  }, [pathname, refresh, user]);

  return (
    <header
      ref={measureHeader}
      data-bvs-header
      className="fixed inset-x-0 top-0 z-[60] border-b border-white/[.07] bg-[#09090b]/80 pt-[env(safe-area-inset-top)] backdrop-blur-2xl"
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

        <div className="flex items-center gap-1">
          <Link
            href={`/app/${surface}/marketplace`}
            className="grid h-11 w-11 place-items-center rounded-full text-white/62 transition hover:bg-white/[.055] hover:text-brand active:scale-95"
            aria-label="Marketplace"
            title="Marketplace"
          >
            <MarketplaceIcon />
          </Link>
          <Link
            href={`/app/${surface}/explore`}
            className="grid h-11 w-11 place-items-center rounded-full text-white/62 transition hover:bg-white/[.055] hover:text-white active:scale-95"
            aria-label="Search"
            title="Search"
          >
            <SearchIcon />
          </Link>
          {loading ? (
            <span className="ml-1 h-9 w-9 animate-pulse rounded-full bg-white/[.06]" aria-hidden="true" />
          ) : user ? (
            <Link
              href={`/app/${surface}/you`}
              className="relative ml-1 grid h-9 w-9 overflow-hidden rounded-full border border-brand/35 bg-brand text-sm font-bold text-black shadow-[0_0_28px_rgba(227,189,88,.18)] transition hover:scale-[1.03]"
              aria-label="Your profile"
            >
              {avatarUrl && !avatarFailed ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  fill
                  sizes="36px"
                  unoptimized
                  className="object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="grid h-full w-full place-items-center" aria-hidden="true">{initial || "B"}</span>
              )}
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
