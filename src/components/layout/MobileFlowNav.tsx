"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
import { useAppShellMeasurement } from "@/components/app/useAppShellMeasurement";
import { matchPrimaryDestination, primaryAppDestinations } from "@/lib/app-surface";

function Icon({ id, active }: { id: "home" | "explore" | "beats" | "library"; active: boolean }) {
  const stroke = active ? "currentColor" : "currentColor";
  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />
      </svg>
    );
  }
  if (id === "explore") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path strokeLinecap="round" d="m16 16 4 4" />
      </svg>
    );
  }
  if (id === "beats") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" d="M8 18V8m4 10V5m4 13v-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={active ? "currentColor" : "none"} stroke={stroke} strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path strokeLinecap="round" d="M4 16.5h2.5l2-5 3 8 2.5-12 2.5 9H20" />
    </svg>
  );
}

export default function MobileFlowNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { surface, appChrome } = useAppSurface();
  const navRef = useAppShellMeasurement<HTMLElement>("--bvs-app-bottom-nav-height-measured", appChrome);
  const destinations = primaryAppDestinations(appChrome ? surface : null);
  const search = searchParams.toString();
  const feedHref = appChrome && surface ? `/app/${surface}/feed` : "/feed";
  const feedActive = pathname === "/feed" || Boolean(surface && pathname.startsWith(`/app/${surface}/feed`));

  return (
    <nav ref={navRef} className="bvs-app-bottom-nav fixed inset-x-0 bottom-0 z-[49] border-t border-white/10 bg-bg-primary/95 backdrop-blur-2xl md:hidden" aria-label="Primary">
      <div className="bvs-app-bottom-nav-inner mx-auto grid h-16 max-w-lg grid-cols-5">
        {destinations.flatMap((item, index) => {
          const active = matchPrimaryDestination(item.id, pathname, search);
          const primary = (
            <Link
              key={item.id}
              href={item.href}
              replace
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${active ? "text-brand" : "text-text-secondary hover:text-white"}`}
            >
              <span className={`grid h-7 w-10 place-items-center rounded-full ${active ? "bg-brand/15" : ""}`}>
                <Icon id={item.id} active={active} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
          if (index !== 0) return [primary];
          return [
            primary,
            <Link
              key="feed"
              href={feedHref}
              aria-current={feedActive ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${feedActive ? "text-brand" : "text-text-secondary hover:text-white"}`}
            >
              <span className={`grid h-7 w-10 place-items-center rounded-full ${feedActive ? "bg-brand/15" : ""}`}><FeedIcon /></span>
              <span>Feed</span>
            </Link>,
          ];
        })}
      </div>
    </nav>
  );
}
