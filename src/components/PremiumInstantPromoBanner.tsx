"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";

const STORAGE_KEY = "bvs_premium_instant_banner_dismissed_v1";

/** Paths where the promo would just compete with the real Premium UI. */
function shouldHideOnPath(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/premium" || pathname.startsWith("/premium/")) return true;
  if (pathname.startsWith("/artist/premium")) return true;
  if (pathname.startsWith("/creator/studio")) return true;
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

/**
 * Skinny gold/yellow site strip advertising Premium Instant (US$5.99 / release).
 * Dismissible; low visual weight so it doesn't fight Home / player chrome.
 */
export default function PremiumInstantPromoBanner() {
  const pathname = usePathname();
  const { appChrome } = useAppSurface();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (appChrome) {
      setVisible(false);
      return;
    }
    if (shouldHideOnPath(pathname)) {
      setVisible(false);
      return;
    }
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      // private mode / blocked storage — still show
    }
    setVisible(true);
  }, [pathname, appChrome]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div
      className="sticky top-16 z-40 border-b border-black/10 bg-[#F5D76E] text-black shadow-[0_1px_0_rgba(0,0,0,0.06)]"
      role="region"
      aria-label="Premium Instant available"
    >
      <div className="mx-auto flex h-8 max-w-7xl items-center gap-2 px-3 sm:h-9 sm:px-4">
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-none tracking-wide sm:text-xs">
          <span className="mr-1.5 inline-block rounded-sm bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
            New
          </span>
          Premium Instant available — US$5.99 per approved release
          <span className="hidden text-black/70 sm:inline"> · no monthly subscription</span>
        </p>
        <Link
          href="/premium"
          className="shrink-0 rounded-full bg-black px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#F5D76E] hover:bg-black/85 sm:px-3 sm:text-[11px]"
        >
          View
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-black/70 hover:bg-black/10 hover:text-black"
          aria-label="Dismiss Premium Instant banner"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>
      </div>
    </div>
  );
}
