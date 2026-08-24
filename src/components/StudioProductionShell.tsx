"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export default function StudioProductionShell({ children }: { children: ReactNode }) {
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
    const timer = window.requestAnimationFrame(() => {
      setAvailableSections(
        sectionLinks
          .filter((item) => document.getElementById(item.id))
          .map((item) => item.id),
      );
    });
    return () => window.cancelAnimationFrame(timer);
  }, [children]);

  const links = useMemo(
    () => sectionLinks.filter((item) => availableSections.includes(item.id)),
    [availableSections],
  );

  return (
    <>
      <div className="border-b border-white/10 bg-black/20">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">
                Creator Studio
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Publishing, performance and creator business in one workspace.
              </p>
            </div>
            <Link
              href="/marketplace"
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold hover:border-brand"
            >
              Open Marketplace
            </Link>
          </div>
          {links.length > 0 && (
            <nav
              aria-label="Creator Studio quick navigation"
              className="mt-4 flex gap-2 overflow-x-auto pb-1"
            >
              {links.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[.025] px-3.5 py-2 text-xs text-text-secondary transition hover:border-brand/50 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
              {token && (
                <a
                  href="#studio-wallet"
                  className="shrink-0 rounded-full border border-brand/30 bg-brand/[.06] px-3.5 py-2 text-xs font-medium text-brand"
                >
                  Wallet
                </a>
              )}
            </nav>
          )}
        </div>
      </div>

      {children}

      {token && (
        <section
          id="studio-wallet"
          className="mx-auto max-w-6xl scroll-mt-24 px-6 pb-16"
          aria-labelledby="studio-wallet-heading"
        >
          <div className="rounded-2xl border border-white/10 bg-white/[.015] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[.22em] text-brand">
              Creator business
            </p>
            <h2 id="studio-wallet-heading" className="mt-2 text-2xl font-semibold">
              Money at a glance
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary">
              A read-only view of your existing BVS seller wallet and settlement ledger.
            </p>
            <div className="mt-5 border-t border-white/10 pt-4">
              <StudioMoneySummary token={token} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
