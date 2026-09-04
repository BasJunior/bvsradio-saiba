"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import { getPushPermission, registerPushDevice, type PushPermissionState } from "@/lib/app-native";

type PreferenceKey = "releases" | "shows" | "creator_work" | "orders" | "community" | "marketing";
type Preferences = Record<PreferenceKey, boolean>;
const defaults: Preferences = { releases: true, shows: true, creator_work: true, orders: true, community: false, marketing: false };
const rows: Array<{ key: PreferenceKey; title: string; note: string }> = [
  { key: "releases", title: "New music", note: "Releases from creators you follow and meaningful BVS discovery alerts." },
  { key: "shows", title: "Shows & rooms", note: "Reminders for followed shows, rooms going live and important schedule changes." },
  { key: "creator_work", title: "Studio work", note: "Editorial requests, release reviews, rights tasks and creator actions." },
  { key: "orders", title: "Orders & money", note: "Marketplace orders, deliveries, payout and account-money state changes." },
  { key: "community", title: "Community", note: "Replies and room activity you explicitly participate in." },
  { key: "marketing", title: "BVS news", note: "Optional product/news messages. Off by default." },
];

export default function AppNotificationSettings({ surface }: { surface: AppSurface }) {
  const { token, signedIn, isCreator } = useAppSession();
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>("unavailable");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    const [permission, response] = await Promise.all([
      getPushPermission(),
      fetch("/api/app/notification-preferences", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null),
    ]);
    setPushPermission(permission);
    if (response?.ok) {
      const payload = (await response.json()) as { preferences?: Partial<Preferences> };
      setPreferences({ ...defaults, ...(payload.preferences || {}) });
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  if (!signedIn) return null;

  const update = async (key: PreferenceKey, value: boolean) => {
    if (!token) return;
    const before = preferences;
    setPreferences((current) => ({ ...current, [key]: value }));
    const response = await fetch("/api/app/notification-preferences", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ [key]: value }) }).catch(() => null);
    if (!response?.ok) { setPreferences(before); setMessage("Notification preferences could not be saved right now. Try again in a moment."); }
    else setMessage("Saved.");
  };

  const enablePush = async () => {
    if (!token) return;
    setBusy(true); setMessage("");
    const result = await registerPushDevice(token, surface);
    setPushPermission(result.permission);
    setMessage(result.ok ? "This device is registered for BVS notifications." : (result.error || (result.permission === "denied" ? "Notifications are disabled in system settings." : "Notifications were not enabled.")));
    setBusy(false);
  };

  return <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.18em] text-brand">Notifications</p><h2 className="mt-1 text-2xl font-semibold">Useful alerts, under your control.</h2><p className="mt-2 max-w-xl text-sm text-text-secondary">BVS asks for system permission only when you choose to enable alerts. Every category can be controlled here.</p></div><button type="button" disabled={busy} onClick={() => void enablePush()} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Enabling…" : pushPermission === "granted" ? "Refresh device registration" : "Enable on this device"}</button></div>
    <p className="mt-3 text-xs text-text-secondary">System permission: <span className="font-semibold text-white">{pushPermission}</span></p>
    <div className="mt-5 divide-y divide-white/10">{rows.filter((row) => isCreator || row.key !== "creator_work").map((row) => <label key={row.key} className="flex items-center justify-between gap-4 py-4"><span><span className="block font-semibold">{row.title}</span><span className="mt-1 block text-xs text-text-secondary">{row.note}</span></span><input type="checkbox" checked={preferences[row.key]} onChange={(event) => void update(row.key, event.target.checked)} className="h-5 w-5 shrink-0 accent-brand" /></label>)}</div>
    {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
  </section>;
}
