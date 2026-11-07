"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

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

  // The Artwork chip in the editorial bar, with the count of requests to review.
  return (
    <Link href="/editorial/artwork" aria-current={artworkActive ? "page" : undefined} data-catalogue-href={catalogueHref} className="bvs-editorial-chip">
      Artwork
      {pending !== null && pending > 0 ? (
        <span className="bvs-editorial-count" aria-label={`${pending} pending cover art requests`}>{pending}</span>
      ) : null}
    </Link>
  );
}
