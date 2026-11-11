"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBrowserSession } from "@/lib/use-browser-session";

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
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const { session } = useBrowserSession();
  const [songLabAllowed, setSongLabAllowed] = useState(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) { setSongLabAllowed(false); return; }
    let active = true;
    fetch("/api/creator/song-lab/access", {
      headers: { Authorization: "Bearer " + token }, cache: "no-store",
    }).then(async (response) => response.ok ? response.json() : { allowed: false })
      .then((result) => { if (active) setSongLabAllowed(result.allowed === true); })
      .catch(() => { if (active) setSongLabAllowed(false); });
    return () => { active = false; };
  }, [session?.access_token]);

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

  // Close the Create menu on an outside tap or Escape (a bare <details> stays open).
  useEffect(() => {
    const close = (event: Event) => {
      const menu = document.querySelector<HTMLDetailsElement>(".bvs-studio-create-menu[open]");
      if (!menu) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);

  const links = useMemo(
    () => sectionLinks.filter((item) => availableSections.includes(item.id)),
    [availableSections],
  );

  return (
    <div className={`bvs-square-studio bvs-studio-console ${pathname === "/creator/studio" ? "is-overview" : ""}`}>
      <div className="bvs-studio-workspace-nav sticky top-16 z-40 border-b border-white/10 bg-bg-primary/90 backdrop-blur-xl supports-[backdrop-filter]:bg-bg-primary/80">
        <div className="mx-auto max-w-6xl px-5 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p data-studio-accent="core" className="bvs-studio-accent-label text-[10px] font-semibold uppercase tracking-[.22em]">Creator Studio</p>
              <p className="mt-0.5 truncate text-xs text-text-secondary">Create. Publish. Get paid.</p>
            </div>
            <Link href="/marketplace" data-studio-accent="marketplace" className="bvs-studio-accent-button hidden shrink-0 rounded-full border px-4 py-2 text-xs font-semibold sm:inline-flex">Public Marketplace</Link>
          </div>

          <nav aria-label="Creator Studio workspace" className="bvs-studio-workspace-links mt-3 flex flex-wrap items-center gap-2 pb-1">
            {workspaceLinks.map((item) => {
              const active = item.match ? pathname === item.match : item.startsWith ? pathname.startsWith(item.startsWith) || (item.label === "Catalogue" && (pathname.startsWith("/creator/studio/releases/") || pathname.startsWith("/creator/studio/songs/"))) : false;
              return (
                <div key={item.href} className="contents"><Link href={item.href} data-studio-accent={item.accent} aria-current={active ? "page" : undefined} className={`bvs-studio-accent-button shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold ${active ? "ring-1 ring-current/25" : ""}`}>
                  {item.label}
                </Link>
                {item.match === '/creator/studio' ? <details className="bvs-studio-create-menu relative">
                  <summary data-studio-accent="core" aria-current={pathname.startsWith('/creator/studio/create/') ? 'page' : undefined} className="bvs-studio-accent-button cursor-pointer rounded-full border px-3.5 py-2 text-xs font-semibold"><span aria-hidden="true">＋</span><span>Create</span><span className="bvs-studio-create-chevron" aria-hidden="true">⌄</span></summary>
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

          {songLabAllowed ? <Link href="/creator/studio/ai-song-lab"
            aria-current={pathname.startsWith("/creator/studio/ai-song-lab") ? "page" : undefined}
            className="bvs-studio-song-lab-entry mt-4 flex min-h-12 items-center justify-between gap-2 border border-[#c1ff52]/45 bg-[#c1ff52]/10 px-3 py-3 text-xs font-bold text-[#d8ff9c] hover:bg-[#c1ff52]/15"
          >
            <span><span aria-hidden="true">✦</span> AI Song Lab <span className="ml-1 text-[10px] font-normal uppercase tracking-wide">Premium</span></span>
            <span aria-hidden="true">↗</span>
          </Link> : null}
        </div>
      </div>

      <div className="bvs-studio-console-content">{children}</div>

      <footer id="studio-wallet" className="bvs-studio-footer" aria-label="Studio resources">
        <div><strong>BVS Studio</strong><p>Your work. From first upload to the next release.</p></div>
        <nav aria-label="Studio business and support"><Link href="/creator/studio/earnings">Earnings &amp; wallet</Link><Link href="/creator/studio/payouts">Payouts</Link><Link href="/contact?topic=studio">Studio support</Link><Link href="/faq">Help &amp; guidance</Link></nav>
        <p className="bvs-studio-footer-note">Review balances, statements and payout details in Earnings.</p>
      </footer>
    </div>
  );
}
