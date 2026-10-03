"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

const moreLinks = [
  { href: "/editorial/marketplace", label: "Marketplace" },
  { href: "/editorial/finance", label: "Finance" },
  { href: "/admin/creator-workflows", label: "Writing & research" },
];

export default function EditorialArtworkShortcut({ catalogueHref }: { catalogueHref: string }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    void createClient().auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      const response = await fetch("/api/admin/editorial/artwork-changes", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      if (!active) return;
      const requests = Array.isArray(payload.requests) ? payload.requests : [];
      setPending(requests.filter((item: { status?: string }) => ["open", "reviewing"].includes(String(item.status || ""))).length);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const artworkActive = pathname === "/editorial/artwork";

  return (
    <nav aria-label="Editorial workspace" className="py-3">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-text-secondary">Editorial workspace</p>
        <Link href="/editorial#ed-overview" className="text-xs font-semibold text-brand">Needs attention →</Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-1">
        <WorkspaceLink href="/editorial" label="Workflow" active={pathname === '/editorial' || pathname === '/admin/editorial'} />
        <WorkspaceLink href={catalogueHref} label="Catalogue" active={pathname.startsWith(catalogueHref)} />

        <Link href="/editorial/artwork" aria-current={artworkActive ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${artworkActive ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
          Artwork
          {pending !== null && pending > 0 ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${artworkActive ? "bg-black/15 text-black" : "bg-brand text-black"}`} aria-label={`${pending} pending cover art requests`}>
              {pending}
            </span>
          ) : null}
        </Link>

        <details className="relative">
          <summary className="cursor-pointer rounded-full border border-white/15 px-4 py-2 text-sm text-text-secondary">More</summary>
          <div className="absolute left-0 top-full z-40 mt-2 min-w-52 rounded-2xl border border-white/15 bg-bg-primary p-2 shadow-xl">
            {moreLinks.map(item => <Link key={item.href} href={item.href} onClick={event => event.currentTarget.closest('details')?.removeAttribute('open')} aria-current={pathname === item.href ? 'page' : undefined} className="block rounded-xl px-3 py-3 text-sm text-text-secondary hover:bg-white/5 hover:text-white">{item.label}</Link>)}
          </div>
        </details>
      </div>
    </nav>
  );
}

function WorkspaceLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm transition ${active ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
      {label}
    </Link>
  );
}
