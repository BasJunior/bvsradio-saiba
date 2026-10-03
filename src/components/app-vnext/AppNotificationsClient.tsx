"use client";

import { loadNotificationInbox, mergeNotificationInbox, type InboxEvent } from "@/lib/notification-inbox";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { appDestination, type AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";

type NotificationEvent = InboxEvent;

function nativeEventHref(surface: AppSurface, event: NotificationEvent) {
  if (event.kind === "marketplace_message") return `/app/${surface}/studio/marketplace`;
  if (["reply", "mention", "like", "repost", "community", "moderation"].includes(event.kind)) {
    return event.href || `/app/${surface}/feed`;
  }
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

function NotificationsInbox({ surface }: { surface: AppSurface }) {
  const { user, token, signedIn, loading: sessionLoading } = useAppSession();
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const [participationUnread, setParticipationUnread] = useState(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!token) {
      queueMicrotask(() => setLoading(false));
      return;
    }
    let alive = true;

    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || !alive || document.visibilityState === "hidden") return;
      pending = true; setRefreshing(true);
      try {
        const result = await loadNotificationInbox(token, surface, controller.signal);
        if (!alive) return;
        setEvents(current => mergeNotificationInbox(current, result.loaded));
        const community = result.loaded.find(row => row.source === "participation");
        if (community) setParticipationUnread(community.unreadCount);
        setError(result.failed === result.total ? "Could not load your inbox. Try again." : result.failed ? "Some updates could not be loaded. Your available updates are shown below." : "");
        if (community?.events.length) {
          void fetch("/api/app/participation/notifications", {
            method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ids: community.events.map(event => event.notificationId).filter(Boolean), seen: true }),
          }).catch(() => null);
        }
        if (result.loaded.some(row => row.source === "operations")) {
          try { window.localStorage.setItem(`bvs_notifications_seen_at:${user?.id}`, new Date().toISOString()); } catch {}
          window.dispatchEvent(new Event("bvs:notifications-seen"));
        }
      } catch { if (alive) setError("Could not refresh your inbox. Please retry."); } finally { pending = false; if (alive) { setLoading(false); setRefreshing(false); } }
    };
    queueMicrotask(() => void refresh());
    const timer = window.setInterval(() => void refresh(), 60000);
    const onRefresh = () => void refresh();
    window.addEventListener("bvs:app-resume", onRefresh);
    window.addEventListener("bvs:native-push-received", onRefresh);
    document.addEventListener("visibilitychange", onRefresh);
    return () => {
      alive = false; controller.abort(); window.clearInterval(timer);
      window.removeEventListener("bvs:app-resume", onRefresh);
      window.removeEventListener("bvs:native-push-received", onRefresh);
      document.removeEventListener("visibilitychange", onRefresh);
    };
  }, [sessionLoading, surface, token, user?.id, reload]);

  const grouped = useMemo(() => {
    const today = new Date();
    return events.map((event) => {
      const created = new Date(event.created_at);
      const sameDay = created.toDateString() === today.toDateString();
      return {
        event,
        label: sameDay
          ? created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : created.toLocaleDateString([], { month: "short", day: "numeric" }),
      };
    });
  }, [events]);

  function markRead(event: NotificationEvent) {
    if (event.source !== "participation" || !event.notificationId || event.read_at || !token) return;
    void fetch("/api/app/participation/notifications", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [event.notificationId], read: true }),
    }).then(response => {
      if (response.ok) {
        setEvents(current => current.map(item => item.id === event.id ? { ...item, read_at: new Date().toISOString() } : item));
        setParticipationUnread(current => Math.max(0, current - 1));
        window.dispatchEvent(new Event("bvs:notifications-seen"));
      } else setError("Could not mark that update as read. Please retry.");
    }).catch(() => setError("Could not mark that update as read. Please retry."));
  }

  if (sessionLoading || (loading && !events.length)) return <div className="mx-auto max-w-4xl px-4 pt-8"><div className="h-44 animate-pulse rounded-[2rem] bg-white/[.035]" /></div>;

  if (!signedIn) return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-10 text-center sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Inbox</p>
      <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold sm:text-6xl">Your updates live here.</h1>
      <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/42">Sign in to see release decisions, creator activity, orders, money and community replies.</p>
      <Link href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/notifications`)}`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-white px-6 font-semibold text-black transition hover:bg-brand">Sign in</Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Inbox</p>
            {participationUnread > 0 ? <span className="rounded-full bg-[#929DE0]/16 px-2 py-0.5 text-[10px] font-bold text-[#c2c9ff]">{participationUnread > 99 ? "99+" : participationUnread} new</span> : null}
          </div>
          <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">What changed.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/42">Release reviews, Studio work, orders, money, replies and mentions — in one place.</p>
        </div>
        <Link href={`/app/${surface}/you`} className="rounded-full border border-white/[.08] px-4 py-2 text-sm text-white/42 transition hover:border-white/18 hover:text-white">Notification settings</Link>
      </div>

      <button type="button" disabled={refreshing} onClick={() => setReload(current => current + 1)} className="mt-5 min-h-10 rounded-full border border-white/10 px-4 text-sm text-white/70 disabled:opacity-50">{refreshing ? "Refreshing…" : "Refresh inbox"}</button>

      {error ? <p className="mt-6 rounded-[1.2rem] border border-amber-300/15 bg-amber-300/[.055] p-4 text-sm text-amber-100/80">{error}</p> : null}

      <div className="mt-8 space-y-2">
        {grouped.map(({ event, label }) => {
          const unread = event.source === "participation" && !event.read_at;
          return (
            <Link
              key={event.id}
              href={nativeEventHref(surface, event)}
              onClick={() => markRead(event)}
              className={`group block rounded-[1.3rem] border p-4 transition ${unread ? "border-[#929DE0]/25 bg-[#929DE0]/[.055]" : "border-white/[.07] bg-white/[.022] hover:border-white/15 hover:bg-white/[.04]"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {unread ? <span className="h-2 w-2 rounded-full bg-[#929DE0]" aria-label="Unread" /> : null}
                    <p className={`text-[10px] font-semibold uppercase tracking-[.15em] ${event.source === "participation" ? "text-[#c2c9ff]" : "text-brand"}`}>{event.kind.replaceAll("_", " ")}</p>
                  </div>
                  <h2 className="mt-2 font-semibold">{event.title}</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/40">{event.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-white/28">{label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {!error && !events.length ? (
        <div className="mt-8 rounded-[1.5rem] border border-dashed border-white/12 p-10 text-center">
          <h2 className="text-xl font-semibold">You’re all caught up.</h2>
          <p className="mt-2 text-sm text-white/40">New updates will appear here when something needs your attention.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function AppNotificationsClient({ surface }: { surface: AppSurface }) {
  const { user } = useAppSession();
  return <NotificationsInbox key={user?.id || "signed-out"} surface={surface} />;
}
