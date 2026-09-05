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
    { href: `${base}/explore`, label: "Discover", icon: "⌕", active: pathname.startsWith(`${base}/explore`) },
    { href: `${base}/library`, label: "Library", icon: "♡", active: pathname.startsWith(`${base}/library`) || pathname.startsWith(`${base}/playlist`) },
    { href: `${base}/studio`, label: isCreator ? "Studio" : "Create", icon: "＋", active: pathname.startsWith(`${base}/studio`) },
    { href: `${base}/you`, label: "You", icon: "◉", active: pathname.startsWith(`${base}/you`) || pathname.startsWith(`${base}/join`) || pathname.startsWith(`${base}/account`) || pathname.startsWith(`${base}/notifications`) || pathname.startsWith(`${base}/support`) },
  ];

  return (
    <nav
      ref={measureBottomNav}
      data-bvs-bottom-nav
      data-bvs-app-nav
      className="fixed inset-x-0 bottom-0 z-[49] px-2 pb-[max(env(safe-area-inset-bottom),.35rem)] sm:px-3"
      aria-label="Primary navigation"
    >
      <div className="mx-auto grid h-[4.25rem] max-w-xl grid-cols-5 rounded-[1.35rem] border border-white/[.08] bg-[#101013]/88 px-1 shadow-[0_18px_60px_rgba(0,0,0,.45)] backdrop-blur-2xl sm:px-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-all sm:text-[11px] ${item.active ? "text-white" : "text-white/46 hover:text-white/82"}`}
          >
            <span
              className={`grid h-7 w-10 place-items-center rounded-full text-xl leading-none transition-all ${item.active ? "bg-brand/14 text-brand shadow-[0_0_22px_rgba(227,189,88,.12)]" : ""}`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="truncate">{item.label}</span>
            {item.active ? <span className="absolute bottom-1 h-0.5 w-4 rounded-full bg-brand" aria-hidden="true" /> : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
