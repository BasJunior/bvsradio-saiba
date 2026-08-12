"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/", label: "Home", icon: "⌂", matches: (path: string) => path === "/" },
  { href: "/search", label: "Explore", icon: "⌕", matches: (path: string) => path === "/search" || path.startsWith("/music/") },
  { href: "/catalogue?type=beat#beatstore", label: "Beats", icon: "◫", matches: (path: string) => path.startsWith("/catalogue") },
  { href: "/library", label: "Library", icon: "♡", matches: (path: string) => path.startsWith("/library") },
];

export default function MobileFlowNav() {
  const pathname = usePathname();

  if (/^\/app\/(ios|android)(?:\/|$)/.test(pathname)) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[49] border-t border-white/10 bg-bg-primary/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden" aria-label="Primary">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-4 px-2">
        {destinations.map((item) => {
          const active = item.matches(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors ${active ? "text-brand" : "text-text-secondary hover:text-white"}`}
            >
              <span className={`grid h-7 w-10 place-items-center rounded-full text-xl leading-none ${active ? "bg-brand/15" : ""}`} aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
