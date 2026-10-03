"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import StudioMoneySummary from "@/components/StudioMoneySummary";

const sectionLinks = [
  { id: "artist-access", label: "Artist", accent: "core" },
  { id: "releases", label: "Releases", accent: "core" },
  { id: "insights", label: "Insights", accent: "insights" },
  { id: "beatstore", label: "BeatStore", accent: "beats" },
  { id: "business", label: "Business", accent: "marketplace" },
  { id: "service-orders", label: "Orders", accent: "marketplace" },
  { id: "premium-desk", label: "Premium", accent: "money" },
  { id: "writer-work", label: "Writing", accent: "insights" },
  { id: "show-work", label: "Shows", accent: "shows" },
] as const;

type WorkspaceLink = {
  href: string;
  label: string;
  accent: "core" | "beats" | "marketplace" | "money";
  match?: string;
  startsWith?: string;
};

const creationLinks: WorkspaceLink[] = [
  { href: "/creator/studio/create/release", label: "New release", accent: "core" },
  { href: "/creator/studio/create/beat", label: "New beat", accent: "beats" },
  { href: "/creator/studio/create/service", label: "New service", accent: "marketplace" },
];
const workspaceLinks: WorkspaceLink[] = [
  { href: "/creator/studio", label: "Home", accent: "core", match: "/creator/studio" },
  { href: "/creator/studio/manage", label: "Catalogue", accent: "core", startsWith: "/creator/studio/manage" },
  { href: "/creator/studio/services", label: "Services", accent: "marketplace", startsWith: "/creator/studio/services" },
  { href: "/creator/studio/earnings", label: "Earnings", accent: "money", match: "/creator/studio/earnings" },
];

export default function StudioProductionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [token, setToken] = useState("");
  const [availableSections, setAvailableSections] = useState<string[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setToken(data.session?.access_token || "");
      })
      .catch(() => {
        if (active) setToken("");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const refreshSections = () => {
      const next = sectionLinks
        .filter((item) => document.getElementById(item.id))
        .map((item) => item.id);
      setAvailableSections((current) =>
        current.join("|") === next.join("|") ? current : next,
      );
    };

    refreshSections();
    const observer = new MutationObserver(refreshSections);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  const links = useMemo(
    () => sectionLinks.filter((item) => availableSections.includes(item.id)),
    [availableSections],
  );

  return (
    <>
      <div className="sticky top-16 z-40 border-b border-white/10 bg-bg-primary/90 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-primary/80">
        <div className="mx-auto max-w-6xl px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p data-studio-accent="core" className="bvs-studio-accent-label text-[10px] font-semibold uppercase tracking-[.22em]">Creator Studio</p>
              <p className="mt-0.5 truncate text-xs text-text-secondary">Create, manage, sell and get paid without hunting through the workspace.</p>
            </div>
            <Link href="/marketplace" data-studio-accent="marketplace" className="bvs-studio-accent-button hidden shrink-0 rounded-full border px-4 py-2 text-xs font-semibold sm:inline-flex">Public Marketplace</Link>
          </div>

          <nav aria-label="Creator Studio workspace" className="mt-3 flex flex-wrap items-center gap-2 pb-1">
            {workspaceLinks.map((item) => {
              const active = item.match ? pathname === item.match : item.startsWith ? pathname.startsWith(item.startsWith) : false;
              return (
                <div key={item.href} className="contents"><Link href={item.href} data-studio-accent={item.accent} aria-current={active ? "page" : undefined} className={`bvs-studio-accent-button shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold ${active ? "ring-1 ring-current/25" : ""}`}>
                  {item.label}
                </Link>
                {item.match === '/creator/studio' ? <details className="relative">
                  <summary data-studio-accent="core" aria-current={pathname.startsWith('/creator/studio/create/') ? 'page' : undefined} className="bvs-studio-accent-button cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold">Create</summary>
                  <div className="absolute left-0 top-full z-50 mt-2 min-w-48 rounded-2xl border border-white/15 bg-bg-primary p-2 shadow-xl">
                    {creationLinks.map(item => <Link key={item.href} href={item.href} data-studio-accent={item.accent} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')} className="block rounded-xl px-3 py-3 text-sm hover:bg-white/5">{item.label}</Link>)}
                  </div>
                </details> : null}</div>
              );
            })}
          </nav>

          {links.length > 0 ? (
            <details className="mt-2"><summary className="cursor-pointer py-1.5 text-xs text-text-secondary">On this page</summary>
              <nav aria-label="Current Studio page sections" className="mt-1 flex flex-wrap gap-1.5">
              {links.map((item) => (
                <a key={item.id} href={`#${item.id}`} data-studio-accent={item.accent} className="bvs-studio-accent-label shrink-0 rounded-full px-3 py-1.5 text-xs transition hover:bg-white/5">
                  {item.label}
                </a>
              ))}
              </nav></details>
          ) : null}
        </div>
      </div>

      {children}

      {token && pathname !== "/creator/studio/earnings" && (
        <section id="studio-wallet" className="mx-auto max-w-6xl scroll-mt-48 px-5 pb-16 sm:px-6" aria-labelledby="studio-wallet-heading">
          <div data-studio-accent="money" className="rounded-2xl border border-white/10 bg-white/[.015] p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="bvs-studio-accent-label text-xs font-semibold uppercase tracking-[.22em]">Creator business</p>
                <h2 id="studio-wallet-heading" className="mt-2 text-2xl font-semibold">Money at a glance</h2>
                <p className="mt-2 max-w-2xl text-sm text-text-secondary">A read-only view of your BVS seller wallet and settlement ledger.</p>
              </div>
              <Link href="/creator/studio/earnings" className="bvs-studio-accent-button rounded-full border px-4 py-2 text-sm font-semibold">Open full wallet →</Link>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4"><StudioMoneySummary token={token} /></div>
          </div>
        </section>
      )}
    </>
  );
}
