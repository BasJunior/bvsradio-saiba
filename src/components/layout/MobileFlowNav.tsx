"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";
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

export default function MobileFlowNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { surface, appChrome } = useAppSurface();
  const destinations = primaryAppDestinations(appChrome ? surface : null);
  const search = searchParams.toString();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[49] border-t border-white/10 bg-bg-primary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden" aria-label="Primary">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-2">
        {destinations.map((item) => {
          const active = matchPrimaryDestination(item.id, pathname, search);
          return (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${active ? "text-brand" : "text-text-secondary hover:text-white"}`}
            >
              <span className={`grid h-7 w-10 place-items-center rounded-full ${active ? "bg-brand/15" : ""}`}>
                <Icon id={item.id} active={active} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
