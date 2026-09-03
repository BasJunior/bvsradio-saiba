"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { measureBottomNav } from "@/lib/chrome-layout";

function MobileFlowNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const beatCatalogue =
    pathname.startsWith("/catalogue") &&
    (searchParams.get("type") === "beat" || Boolean(searchParams.get("pack")));

  const destinations = [
    {
      href: "/radio",
      label: "Listen",
      icon: "◉",
      active: pathname === "/radio" || pathname.startsWith("/shows/"),
    },
    {
      href: "/search",
      label: "Discover",
      icon: "⌕",
      active:
        pathname === "/search" ||
        pathname.startsWith("/album/") ||
        pathname.startsWith("/artist/") ||
        (pathname.startsWith("/music/") && !pathname.startsWith("/music/producers")) ||
        (pathname.startsWith("/catalogue") && !beatCatalogue),
    },
    {
      href: "/catalogue?type=beat#beatstore",
      label: "Beats",
      icon: "◇",
      active: beatCatalogue || pathname.startsWith("/music/producers"),
    },
    {
      href: "/library",
      label: "Library",
      icon: "♡",
      active: pathname.startsWith("/library"),
    },
  ];

  if (/^\/app\/(ios|android)(?:\/|$)/.test(pathname)) return null;

  return (
    <nav
      ref={measureBottomNav}
      data-bvs-bottom-nav
      className="fixed inset-x-0 bottom-0 z-[49] border-t border-white/10 bg-bg-primary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-2">
        {destinations.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${item.active ? "text-brand" : "text-text-secondary hover:text-white"}`}
          >
            <span
              className={`grid h-7 w-10 place-items-center rounded-full text-xl leading-none ${item.active ? "bg-brand/15" : ""}`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function MobileFlowNav() {
  return (
    <Suspense fallback={null}>
      <MobileFlowNavContent />
    </Suspense>
  );
}
