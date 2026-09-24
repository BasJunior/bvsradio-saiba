"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function NavIcon({ name }: { name: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "listen" ? <><circle cx="12" cy="12" r="4" /><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 2.8a10 10 0 0 1 7 0M8.5 21.2a10 10 0 0 0 7 0" /></> : null}
      {name === "discover" ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></> : null}
      {name === "beats" ? <><path d="M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4" /></> : null}
      {name === "library" ? <><path d="M4 4v16M8 4v16M13 4l6-1 3 16-6 1z" /></> : null}
    </svg>
  );
}

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
      icon: "listen",
      active: pathname === "/radio" || pathname.startsWith("/shows/"),
    },
    {
      href: "/search",
      label: "Discover",
      icon: "discover",
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
      icon: "beats",
      active: beatCatalogue || pathname.startsWith("/music/producers"),
    },
    {
      href: "/library",
      label: "Library",
      icon: "library",
      active: pathname.startsWith("/library"),
    },
  ];

  if (/^\/app\/(ios|android)(?:\/|$)/.test(pathname)) return null;

  return (
    <nav
      className="bvs-mobile-nav fixed inset-x-0 z-[49] md:hidden"
      aria-label="Primary"
    >
      <div className="bvs-glass-subtle bvs-nav-bar">
        {destinations.some((item) => item.active) ? (
          <span className="bvs-glass-focus bvs-nav-lens" aria-hidden="true" style={{ transform: `translateX(${destinations.findIndex((item) => item.active) * 100}%)` }} />
        ) : null}
        {destinations.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className="bvs-nav-item"
          >
            <NavIcon name={item.icon} />
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
