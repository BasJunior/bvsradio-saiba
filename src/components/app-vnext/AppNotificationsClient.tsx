"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { appDestination, type AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

type NotificationEvent = { id: string; title: string; detail: string; created_at: string; href: string; kind: string };

function nativeEventHref(surface: AppSurface, event: NotificationEvent) {
  if (event.kind === "order") return `/app/${surface}/studio/orders`;
  if (["premium", "payout"].includes(event.kind)) return `/app/${surface}/studio/money`;
  if (event.kind === "profile") return `/app/${surface}/account`;
  if (event.kind === "beat") return `/app/${surface}/studio/beats`;
  if (["track", "release", "request", "message"].includes(event.kind)) return `/app/${surface}/studio/release`;
  if (["writer", "article", "show", "episode"].includes(event.kind)) return `/app/${surface}/studio`;
  if (typeof window !== "undefined") {
    const translated = appDestination(surface, new URL(event.href || "/account", window.location.origin));
    if (translated) return translated;
  }
  return `/app/${surface}/you`;
}

export default function AppNotificationsClient({ surface }: { surface: AppSurface }) {
  const { token, signedIn, loading: sessionLoading } = useAppSession();
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionLoading) return;
    if (!token) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!alive) return;
        if (!response.ok) throw new Error(payload?.error || "Could not load notifications.");
        setEvents(payload.events || []);
        setError("");
        try {
          window.localStorage.setItem("bvs_notifications_seen_at", new Date().toISOString());
          window.dispatchEvent(new Event("bvs:notifications-seen"));
        } catch {
          // Seen-state is a client enhancement only.
        }
      })
      .catch((caught) => alive && setError(caught instanceof Error ? caught.message : "Could not load notifications."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [sessionLoading, token]);

  const grouped = useMemo(() => {
    const today = new Date();
    return events.map((event) => {
      const created = new Date(event.created_at);
      const sameDay = created.toDateString() === today.toDateString();
      return { event, label: sameDay ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : created.toLocaleDateString([], { month: "short", day: "numeric" }) };
    });
  }, [events]);

  if (sessionLoading || loading) return <div className="mx-auto max-w-4xl px-4 pt-8"><div className="h-44 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;
  if (!signedIn) return <div className="mx-auto max-w-3xl px-4 pb-10 pt-10 text-center sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">BVS inbox</p><h1 className="mt-2 text-4xl font-semibold">Sign in to see your updates.</h1><Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/notifications`)}`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold text-black">Sign in</Link></div>;

  return <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs uppercase tracking-[.2em] text-brand">BVS inbox</p><h1 className="mt-2 text-4xl font-semibold">What changed.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Release reviews, Studio work, orders, money and account updates stay inside the vNext app shell.</p></div><Link href={`/app/${surface}/you`} className="rounded-full border border-white/15 px-4 py-2 text-sm">Notification settings</Link></div>
    {error ? <p className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p> : null}
    <div className="mt-7 space-y-2">{grouped.map(({ event, label }) => <Link key={event.id} href={nativeEventHref(surface, event)} className="block rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:border-brand/35"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs uppercase tracking-[.14em] text-brand">{event.kind.replaceAll("_", " ")}</p><h2 className="mt-1 font-semibold">{event.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">{event.detail}</p></div><span className="shrink-0 text-xs text-text-secondary">{label}</span></div></Link>)}</div>
    {!error && !events.length ? <div className="mt-8 rounded-[1.75rem] border border-dashed border-white/15 p-10 text-center"><h2 className="text-xl font-semibold">You’re all caught up.</h2><p className="mt-2 text-sm text-text-secondary">New BVS workflow and account updates will appear here.</p></div> : null}
  </div>;
}
