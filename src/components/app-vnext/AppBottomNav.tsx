"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { measureBottomNav } from "@/lib/chrome-layout";

/** Per-tab scroll positions, so returning to a tab lands where the listener left it. */
const tabScroll = new Map<string, number>();

type NavIconName = "home" | "discover" | "library" | "feed" | "create" | "beats";

function NavIcon({ name }: { name: NavIconName }) {
  if (name === "home") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="m3.5 10 8.5-7 8.5 7v10H14v-6h-4v6H3.5z" /></svg>;
  }
  if (name === "discover") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><circle cx="10.75" cy="10.75" r="6.25" /><path d="m15.5 15.5 4.25 4.25" /></svg>;
  }
  if (name === "library") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true"><path d="M12 20.25s-7.5-4.5-7.5-10.1A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 7.5 3.15c0 5.6-7.5 10.1-7.5 10.1Z" /></svg>;
  }
  if (name === "feed") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6" aria-hidden="true"><path d="M4 16.5h2.5l2-5 3 8 2.5-12 2.5 9H20" /></svg>;
  }
  if (name === "create") {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6" aria-hidden="true"><path d="M12 4v16M4 12h16" /></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-6 w-6" aria-hidden="true"><path d="M7 17V8m5 12V4m5 13V8" /></svg>;
}

export default function AppBottomNav({ surface }: { surface: AppSurface }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isCreator } = useAppSession();
  const [pending, startTransition] = useTransition();
  const [requestedTab, setRequestedTab] = useState("");
  const [prefetchTabs, setPrefetchTabs] = useState(false);

  // Warm the tabs once the app has settled, unless the listener chose data saver.
  useEffect(() => {
    const decide = () => {
      const saver =
        document.documentElement.dataset.bvsDataEffective === "saver" ||
        Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
      setPrefetchTabs(!saver);
    };
    const timer = window.setTimeout(decide, 1500);
    return () => window.clearTimeout(timer);
  }, []);
  const base = `/app/${surface}`;
  const isIos = surface === "ios";
  const search = searchParams.toString();
  const currentRoute = `${pathname}${search ? `?${search}` : ""}`;
  const pendingTabRestore = useRef<string | null>(null);

  // Restore the scroll position when a tab-bar switch lands on a tab visited before.
  useEffect(() => {
    if (pendingTabRestore.current !== currentRoute) return;
    pendingTabRestore.current = null;
    const top = tabScroll.get(currentRoute);
    if (!top) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top, left: 0 }));
    return () => window.cancelAnimationFrame(frame);
  }, [currentRoute]);

  const isBeatsRoute = searchParams.get("kind") === "beats" || (isIos && searchParams.get("mode") === "beats");
  const roleDestination = isCreator
    ? { href: `${base}/studio`, label: "Studio", icon: "create" as const, active: pathname.startsWith(`${base}/studio`) }
    : { href: `${base}/explore?kind=beats${isIos ? "&mode=beats" : ""}`, label: "Beats", icon: "beats" as const, active: (pathname === `${base}/explore` && isBeatsRoute) || pathname.startsWith(`${base}/beat/`) };
  const items: Array<{ href: string; label: string; icon: NavIconName; active: boolean }> = [
    { href: base, label: "Home", icon: "home", active: pathname === base },
    { href: `${base}/feed`, label: "Feed", icon: "feed", active: pathname.startsWith(`${base}/feed`) },
    { href: `${base}/explore`, label: "Discover", icon: "discover", active: pathname.startsWith(`${base}/explore`) && (isCreator || !isBeatsRoute) },
    { href: `${base}/library`, label: "Library", icon: "library", active: pathname.startsWith(`${base}/library`) || pathname.startsWith(`${base}/playlist`) },
    roleDestination,
  ];

  return (
    <nav
      ref={measureBottomNav}
      data-bvs-bottom-nav
      data-bvs-app-nav
      data-bvs-role-tab={isCreator ? "studio" : "beats"}
      className={isIos
        ? "bvs-app-bottom-nav fixed inset-x-0 bottom-0 z-[49] border-t border-white/[.12] bg-[#0d0e10]/98 pt-1 shadow-[0_-12px_32px_rgba(0,0,0,.26)] backdrop-blur-2xl"
        : "bvs-app-bottom-nav fixed inset-x-0 bottom-0 z-[49] border-t border-white/[.06] bg-[#08080a]/96 pt-1 shadow-[0_-18px_50px_rgba(0,0,0,.32)] backdrop-blur-2xl"}
      aria-label="Primary navigation"
      aria-busy={isIos && pending}
    >
      <div className="bvs-app-bottom-nav-inner mx-auto grid h-[4.45rem] max-w-xl grid-cols-5 px-1 sm:px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            // Fully prefetch the five tabs so switching feels instant (Next 16
            // otherwise prefetches only the loading shell of dynamic routes).
            prefetch={prefetchTabs ? true : null}
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) return;
              event.preventDefault();
              if (item.href === currentRoute) {
                window.scrollTo({ top: 0, left: 0 });
                tabScroll.delete(currentRoute);
                return;
              }
              tabScroll.set(currentRoute, window.scrollY);
              pendingTabRestore.current = item.href;
              if (isIos) {
                setRequestedTab(item.label);
                startTransition(() => router.push(item.href));
              } else router.push(item.href);
            }}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex min-h-11 min-w-0 touch-manipulation flex-col items-center justify-center gap-1 ${isIos ? "rounded-sm font-semibold" : "rounded-xl font-medium"} text-[10px] transition-[color,transform] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:text-[11px] ${isIos
              ? (item.active ? (item.icon === "beats" ? "text-[#c1a7ff]" : "text-white") : "text-white/58 hover:text-white/90")
              : (item.active ? "text-white" : "text-white/46 hover:text-white/82")}`}
          >
            <span
              className={`grid h-8 w-11 place-items-center leading-none ${isIos ? "rounded-[.3rem] transition-colors" : "rounded-full transition-all"} ${item.active
                ? (isIos ? (item.icon === "beats" ? "bg-[#c1a7ff]/15 text-[#c1a7ff]" : "bg-brand/12 text-brand") : "bg-brand/14 text-brand shadow-[0_0_22px_rgba(227,189,88,.12)]")
                : ""}`}
            >
              {isIos && pending && requestedTab === item.label
                ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
                : <NavIcon name={item.icon} />}
            </span>
            <span className="truncate">{item.label}</span>
            {item.active ? <span className={`absolute bottom-0 h-0.5 ${isIos ? "w-8" : "w-5"} ${isIos && item.icon === "beats" ? "bg-[#c1a7ff]" : "bg-brand"} ${isIos ? "" : "rounded-full"}`} aria-hidden="true" /> : null}
          </Link>
        ))}
      </div>
      {isIos ? <span role="status" className="sr-only">{pending ? `Opening ${requestedTab}` : ""}</span> : null}
    </nav>
  );
}
