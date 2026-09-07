"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

const workspaceLinks = [
  { href: "/editorial", label: "Overview", match: "/editorial" },
  { href: "/editorial#ed-releases", label: "Releases" },
  { href: "/editorial#ed-beats", label: "BeatStore" },
  { href: "/editorial#ed-tracks", label: "Singles" },
  { href: "/editorial/marketplace", label: "Marketplace", match: "/editorial/marketplace" },
  { href: "/editorial/finance", label: "Finance", match: "/editorial/finance" },
  { href: "/admin/creator-workflows", label: "Writing & research", match: "/admin/creator-workflows" },
];

export default function EditorialArtworkShortcut() {
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {workspaceLinks.slice(0, 4).map((item) => {
          const active = item.match ? pathname === item.match : false;
          return <WorkspaceLink key={item.href} href={item.href} label={item.label} active={active} />;
        })}

        <Link href="/editorial/artwork" className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${artworkActive ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
          Artwork
          {pending !== null && pending > 0 ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${artworkActive ? "bg-black/15 text-black" : "bg-brand text-black"}`} aria-label={`${pending} pending cover art requests`}>
              {pending}
            </span>
          ) : null}
        </Link>

        {workspaceLinks.slice(4).map((item) => {
          const active = item.match ? pathname === item.match : false;
          return <WorkspaceLink key={item.href} href={item.href} label={item.label} active={active} />;
        })}
      </div>
    </nav>
  );
}

function WorkspaceLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={`inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm transition ${active ? "border-brand bg-brand text-black" : "border-white/15 text-text-secondary hover:border-brand/45 hover:text-text-primary"}`}>
      {label}
    </Link>
  );
}
