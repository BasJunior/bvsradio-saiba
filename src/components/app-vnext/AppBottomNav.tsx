"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { AppNavIcon } from "@/components/app-vnext/AppNavIcons";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { useAppShellMeasurement } from "@/components/app/useAppShellMeasurement";

export default function AppBottomNav({ surface }: { surface: AppSurface }) {
  const pathname = usePathname();
  const { isCreator } = useAppSession();
  const navRef = useAppShellMeasurement<HTMLElement>("--bvs-app-bottom-nav-height-measured", true);
  const base = `/app/${surface}`;
  const items = [
    { href: base, id: "home" as const, label: "Home", active: pathname === base },
    { href: `${base}/explore`, id: "explore" as const, label: "Explore", active: pathname.startsWith(`${base}/explore`) },
    { href: `${base}/library`, id: "library" as const, label: "Library", active: pathname.startsWith(`${base}/library`) || pathname.startsWith(`${base}/playlist`) },
    { href: `${base}/studio`, id: "studio" as const, label: isCreator ? "Studio" : "Create", active: pathname.startsWith(`${base}/studio`) },
    { href: `${base}/you`, id: "you" as const, label: "You", active: pathname.startsWith(`${base}/you`) || pathname.startsWith(`${base}/join`) || pathname.startsWith(`${base}/account`) || pathname.startsWith(`${base}/notifications`) || pathname.startsWith(`${base}/support`) },
  ];

  return (
    <nav
      ref={navRef}
      data-bvs-bottom-nav
      data-bvs-app-nav
      className="bvs-app-bottom-nav fixed inset-x-0 bottom-0 z-[49] border-t border-white/10 bg-bg-primary/95 backdrop-blur-2xl"
      aria-label="BVS app primary navigation"
    >
      <div className="bvs-app-bottom-nav-inner mx-auto grid h-16 max-w-xl grid-cols-5">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition-colors sm:text-[11px] ${
              item.active ? "text-brand" : "text-text-secondary hover:text-white"
            }`}
          >
            <span className={`grid h-7 w-10 place-items-center rounded-full ${item.active ? "bg-brand/15" : ""}`}>
              <AppNavIcon id={item.id} active={item.active} />
            </span>
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
