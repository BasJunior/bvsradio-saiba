"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import StudioMoneySummary from "@/components/StudioMoneySummary";

const sectionLinks = [
  { id: "artist-access", label: "Artist" },
  { id: "releases", label: "Releases" },
  { id: "insights", label: "Insights" },
  { id: "beatstore", label: "BeatStore" },
  { id: "business", label: "Business" },
  { id: "marketplace-desk", label: "Marketplace" },
  { id: "service-orders", label: "Orders" },
  { id: "premium-desk", label: "Premium" },
  { id: "writer-work", label: "Writing" },
  { id: "show-work", label: "Shows" },
] as const;

const workspaceLinks = [
  { href: "/creator/studio", label: "Home", match: "/creator/studio" },
  { href: "/creator/studio/create/release", label: "Release", startsWith: "/creator/studio/create/release" },
  { href: "/creator/studio/create/beat", label: "Beat", startsWith: "/creator/studio/create/beat" },
  { href: "/creator/studio/create/service", label: "Service", startsWith: "/creator/studio/create/service" },
  { href: "/creator/studio/manage", label: "Manage", startsWith: "/creator/studio/manage" },
  { href: "/creator/studio/artwork", label: "Artwork", startsWith: "/creator/studio/artwork" },
  { href: "/creator/marketplace", label: "Storefront" },
  { href: "/artists", label: "Money" },
] as const;

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
              <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Creator Studio</p>
              <p className="mt-0.5 truncate text-xs text-text-secondary">Create, manage, sell and get paid without hunting through the workspace.</p>
            </div>
            <Link href="/marketplace" className="hidden shrink-0 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold hover:border-brand sm:inline-flex">Public Marketplace</Link>
          </div>

          <nav aria-label="Creator Studio workspace" className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {workspaceLinks.map((item) => {
              const active = item.match ? pathname === item.match : item.startsWith ? pathname.startsWith(item.startsWith) : false;
              return (
                <Link key={item.href} href={item.href} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition ${active ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
                  {item.label}
                </Link>
              );
            })}
            {token ? <a href="#studio-wallet" className="shrink-0 rounded-full border border-brand/30 bg-brand/[.06] px-3.5 py-2 text-xs font-semibold text-brand">Wallet</a> : null}
          </nav>

          {links.length > 0 ? (
            <nav aria-label="Current Studio page sections" className="mt-2 flex gap-1.5 overflow-x-auto">
              <span className="shrink-0 px-1 py-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-text-secondary">On this page</span>
              {links.map((item) => (
                <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-full px-3 py-1.5 text-xs text-text-secondary transition hover:bg-white/5 hover:text-brand">
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>

      {children}

      {token && (
        <section id="studio-wallet" className="mx-auto max-w-6xl scroll-mt-48 px-5 pb-16 sm:px-6" aria-labelledby="studio-wallet-heading">
          <div className="rounded-2xl border border-white/10 bg-white/[.015] p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">Creator business</p>
                <h2 id="studio-wallet-heading" className="mt-2 text-2xl font-semibold">Money at a glance</h2>
                <p className="mt-2 max-w-2xl text-sm text-text-secondary">A read-only view of your BVS seller wallet and settlement ledger.</p>
              </div>
              <Link href="/artists" className="rounded-full border border-brand/30 px-4 py-2 text-sm font-semibold text-brand">Open full wallet →</Link>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4"><StudioMoneySummary token={token} /></div>
          </div>
        </section>
      )}
    </>
  );
}
