"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { readFlowTrail, type FlowTrailItem } from "@/lib/flow-session";
import { objectKindLabel } from "@/lib/bvs-object";

export default function AppSceneTrail() {
  const pathname = usePathname();
  const [items, setItems] = useState<FlowTrailItem[]>([]);

  useEffect(() => {
    const sync = () => {
      const trail = readFlowTrail().filter((item) => item.route.split("?")[0] !== pathname);
      setItems(trail.slice(-5).reverse());
    };
    sync();
    window.addEventListener("bvs:flow-trail-change", sync);
    return () => window.removeEventListener("bvs:flow-trail-change", sync);
  }, [pathname]);

  if (items.length < 2) return null;

  return (
    <nav aria-label="Recently opened on BVS" className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Your path</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1" data-flow-scroll-key="scene-trail">
        {items.map((item) => (
          <Link
            key={`${item.kind}:${item.id}:${item.openedAt}`}
            href={item.route}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[.04] py-1.5 pl-1.5 pr-3"
          >
            <span className="relative h-7 w-7 overflow-hidden rounded-full bg-white/10">
              {item.artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.artwork} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-[8px] text-brand">BVS</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] uppercase tracking-wider text-text-secondary">{objectKindLabel(item.kind)}</span>
              <span className="block max-w-[8rem] truncate text-xs font-medium">{item.title}</span>
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
