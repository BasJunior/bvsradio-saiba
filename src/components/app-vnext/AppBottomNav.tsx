"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { measureBottomNav } from "@/lib/chrome-layout";

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
  const searchParams = useSearchParams();
  const { isCreator } = useAppSession();
  const base = `/app/${surface}`;
  const roleDestination = isCreator
    ? { href: `${base}/studio`, label: "Studio", icon: "create" as const, active: pathname.startsWith(`${base}/studio`) }
    : { href: `${base}/explore?kind=beats`, label: "Beats", icon: "beats" as const, active: (pathname === `${base}/explore` && searchParams.get("kind") === "beats") || pathname.startsWith(`${base}/beat/`) };
  const items: Array<{ href: string; label: string; icon: NavIconName; active: boolean }> = [
    { href: base, label: "Home", icon: "home", active: pathname === base },
    { href: `${base}/explore`, label: "Discover", icon: "discover", active: pathname.startsWith(`${base}/explore`) && (isCreator || searchParams.get("kind") !== "beats") },
    { href: `${base}/library`, label: "Library", icon: "library", active: pathname.startsWith(`${base}/library`) || pathname.startsWith(`${base}/playlist`) },
    roleDestination,
    { href: `${base}/feed`, label: "Feed", icon: "feed", active: pathname.startsWith(`${base}/feed`) },
  ];

  return (
    <nav
      ref={measureBottomNav}
      data-bvs-bottom-nav
      data-bvs-app-nav
      data-bvs-role-tab={isCreator ? "studio" : "beats"}
      className="bvs-app-bottom-nav fixed inset-x-0 bottom-0 z-[49] border-t border-white/[.06] bg-[#08080a]/96 pt-1 shadow-[0_-18px_50px_rgba(0,0,0,.32)] backdrop-blur-2xl"
      aria-label="Primary navigation"
    >
      <div className="bvs-app-bottom-nav-inner mx-auto grid h-[4.45rem] max-w-xl grid-cols-5 px-1 sm:px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all sm:text-[11px] ${item.active ? "text-white" : "text-white/46 hover:text-white/82"}`}
          >
            <span
              className={`grid h-8 w-11 place-items-center rounded-full leading-none transition-all ${item.active ? "bg-brand/14 text-brand shadow-[0_0_22px_rgba(227,189,88,.12)]" : ""}`}
            >
              <NavIcon name={item.icon} />
            </span>
            <span className="truncate">{item.label}</span>
            {item.active ? <span className="absolute bottom-0 h-0.5 w-5 rounded-full bg-brand" aria-hidden="true" /> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
