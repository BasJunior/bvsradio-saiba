"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { measureBottomNav } from "@/lib/chrome-layout";

export default function AppBottomNav({ surface }: { surface: AppSurface }) {
  const pathname = usePathname();
  const { isCreator } = useAppSession();
  const base = `/app/${surface}`;
  const items = [
    { href: base, label: "Home", icon: "⌂", active: pathname === base },
    { href: `${base}/explore`, label: "Explore", icon: "⌕", active: pathname.startsWith(`${base}/explore`) },
    { href: `${base}/library`, label: "Library", icon: "♡", active: pathname.startsWith(`${base}/library`) || pathname.startsWith(`${base}/playlist`) },
    { href: `${base}/studio`, label: isCreator ? "Studio" : "Create", icon: "＋", active: pathname.startsWith(`${base}/studio`) },
    { href: `${base}/you`, label: "You", icon: "◉", active: pathname.startsWith(`${base}/you`) || pathname.startsWith(`${base}/join`) || pathname.startsWith(`${base}/account`) || pathname.startsWith(`${base}/notifications`) || pathname.startsWith(`${base}/support`) },
  ];

  return (
    <nav
      ref={measureBottomNav}
      data-bvs-bottom-nav
      data-bvs-app-nav
      className="fixed inset-x-0 bottom-0 z-[49] border-t border-white/10 bg-bg-primary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl"
      aria-label="BVS app primary navigation"
    >
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5 px-1 sm:px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors sm:text-[11px] ${item.active ? "text-brand" : "text-text-secondary hover:text-white"}`}
          >
            <span className={`grid h-7 w-10 place-items-center rounded-full text-xl leading-none ${item.active ? "bg-brand/15" : ""}`} aria-hidden="true">{item.icon}</span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
