"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  { key: "community", title: "Community push", note: "Optional device alerts for replies, mentions and public participation. Off by default." },
  { key: "marketing", title: "BVS news", note: "Optional product/news messages. Off by default." },
];

type ParticipationPreferences = {
  inbox_enabled: boolean;
  external_community_enabled: boolean;
  digest_enabled: boolean;
  digest_time: string;
  timezone: string;
  quiet_start: string | null;
  quiet_end: string | null;
};

const participationDefaults: ParticipationPreferences = {
  inbox_enabled: true,
  external_community_enabled: false,
  digest_enabled: false,
  digest_time: "18:00",
  timezone: "UTC",
  quiet_start: null,
  quiet_end: null,
};

export default function AppNotificationSettings({ surface }: { surface: AppSurface }) {
  const { token, signedIn, isCreator } = useAppSession();
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [participation, setParticipation] = useState<ParticipationPreferences>(participationDefaults);
  const [participationAvailable, setParticipationAvailable] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermissionState>("unavailable");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const deviceTimezone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    const [permission, response, participationResponse] = await Promise.all([
      getPushPermission(),
      fetch("/api/app/notification-preferences", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null),
      fetch("/api/app/participation/preferences", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null),
    ]);
    setPushPermission(permission);
    if (response?.ok) {
      const payload = (await response.json()) as { preferences?: Partial<Preferences> };
      setPreferences({ ...defaults, ...(payload.preferences || {}) });
    }
    if (participationResponse?.ok) {
      const payload = (await participationResponse.json()) as { enabled?: boolean; preferences?: Partial<ParticipationPreferences> };
      setParticipationAvailable(payload.enabled !== false);
      const next = { ...participationDefaults, ...(payload.preferences || {}) };
      setParticipation(next);
      setPreferences((current) => ({ ...current, community: Boolean(next.external_community_enabled) }));
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  if (!signedIn) return null;

  const patchParticipation = async (patch: Partial<ParticipationPreferences>, quiet = false) => {
    if (!token || !participationAvailable) return false;
    const before = participation;
    const optimistic = { ...participation, ...patch };
    setParticipation(optimistic);
    const response = await fetch("/api/app/participation/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!response?.ok) {
      setParticipation(before);
      if (!quiet) setMessage("Could not save community notification settings.");
      return false;
    }
    const payload = await response.json().catch(() => ({})) as { preferences?: Partial<ParticipationPreferences> };
    setParticipation({ ...participationDefaults, ...(payload.preferences || optimistic) });
    if (!quiet) setMessage("Saved.");
    return true;
  };

  const saveCategory = async (next: Preferences) => {
    if (!token) return false;
    const response = await fetch("/api/app/notification-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(next),
    }).catch(() => null);
    return Boolean(response?.ok);
  };

  const update = async (key: PreferenceKey, value: boolean) => {
    if (!token) return;
    const before = preferences;
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setMessage("");

    if (key === "community" && participationAvailable) {
      const saved = await patchParticipation({ external_community_enabled: value }, true);
      if (!saved) {
        setPreferences(before);
        return;
      }
      void saveCategory(next);
      setMessage("Saved.");
      return;
    }

    const saved = await saveCategory(next);
    if (!saved) {
      setPreferences(before);
      setMessage("Could not save that notification setting.");
      return;
    }
    setMessage("Saved.");
  };

  const enablePush = async () => {
    if (!token) return;
    setBusy(true);
    setMessage("");
    const result = await registerPushDevice(token, surface);
    setPushPermission(result.permission);
    if (result.ok) {
      await patchParticipation({ external_community_enabled: true }, true);
      setPreferences((current) => ({ ...current, community: true }));
      void saveCategory({ ...preferences, community: true });
      setMessage("This device is registered for BVS lock-screen alerts.");
    } else {
      setMessage(result.error || (result.permission === "denied" ? "Notifications are disabled in iPhone Settings." : "Notifications were not enabled."));
    }
    setBusy(false);
  };

  const toggleDigest = async (value: boolean) => {
    await patchParticipation({ digest_enabled: value, timezone: deviceTimezone });
  };

  return <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[.18em] text-brand">Notifications</p>
        <h2 className="mt-1 text-2xl font-semibold">Useful alerts, under your control.</h2>
        <p className="mt-2 max-w-xl text-sm text-text-secondary">BVS asks for system permission only when you choose to enable alerts. Every category can be controlled here.</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void enablePush()} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Enabling…" : pushPermission === "granted" ? "Refresh device registration" : "Enable on this device"}</button>
    </div>
    <p className="mt-3 text-xs text-text-secondary">System permission: <span className="font-semibold text-white">{pushPermission}</span></p>

    <div className="mt-5 divide-y divide-white/10">
      {rows.filter((row) => isCreator || row.key !== "creator_work").map((row) => <label key={row.key} className="flex items-center justify-between gap-4 py-4">
        <span><span className="block font-semibold">{row.title}</span><span className="mt-1 block text-xs text-text-secondary">{row.note}</span></span>
        <input type="checkbox" checked={preferences[row.key]} onChange={(event) => void update(row.key, event.target.checked)} className="h-5 w-5 shrink-0 accent-brand" />
      </label>)}
    </div>

    {participationAvailable ? <div className="mt-5 rounded-[1.3rem] border border-[#929DE0]/18 bg-[#929DE0]/[.045] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#c2c9ff]">BVS participation</p>
      <label className="mt-3 flex items-center justify-between gap-4 border-b border-white/[.07] pb-4">
        <span><span className="block font-semibold">Community inbox</span><span className="mt-1 block text-xs text-text-secondary">Keep replies, mentions, likes and reposts in your account-scoped BVS Inbox.</span></span>
        <input type="checkbox" checked={participation.inbox_enabled} onChange={(event) => void patchParticipation({ inbox_enabled: event.target.checked })} className="h-5 w-5 shrink-0 accent-[#929DE0]" />
      </label>
      <label className="flex items-center justify-between gap-4 border-b border-white/[.07] py-4">
        <span><span className="block font-semibold">Daily BVS Pulse</span><span className="mt-1 block text-xs text-text-secondary">One concise daily catch-up from your community activity. Off by default.</span></span>
        <input type="checkbox" checked={participation.digest_enabled} onChange={(event) => void toggleDigest(event.target.checked)} className="h-5 w-5 shrink-0 accent-[#929DE0]" />
      </label>
      {participation.digest_enabled ? <div className="grid gap-3 pt-4 sm:grid-cols-3">
        <label className="text-xs text-white/48"><span className="mb-1.5 block font-semibold text-white/70">Pulse time</span><input type="time" value={participation.digest_time.slice(0, 5)} onChange={(event) => void patchParticipation({ digest_time: event.target.value, timezone: deviceTimezone })} className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#929DE0]/45" /></label>
        <label className="text-xs text-white/48"><span className="mb-1.5 block font-semibold text-white/70">Quiet from</span><input type="time" value={(participation.quiet_start || "").slice(0, 5)} onChange={(event) => void patchParticipation({ quiet_start: event.target.value || null, timezone: deviceTimezone })} className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#929DE0]/45" /></label>
        <label className="text-xs text-white/48"><span className="mb-1.5 block font-semibold text-white/70">Quiet until</span><input type="time" value={(participation.quiet_end || "").slice(0, 5)} onChange={(event) => void patchParticipation({ quiet_end: event.target.value || null, timezone: deviceTimezone })} className="min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[#929DE0]/45" /></label>
        <p className="sm:col-span-3 text-[11px] text-white/32">Timezone: {participation.timezone}. The daily-run guard prevents duplicate pulses even if the worker retries.</p>
      </div> : null}
    </div> : null}

    {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
  </section>;
}
