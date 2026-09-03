"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import AppNotificationSettings from "@/components/app-vnext/AppNotificationSettings";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { getAppPreference, setAppPreference } from "@/lib/app-native";

type DataMode = "auto" | "saver" | "high";

export default function AppYouClient({ surface }: { surface: AppSurface }) {
  const { user, loading, signedIn, isCreator, premiumActive, premiumPlanLabel } = useAppSession();
  const [dataMode, setDataMode] = useState<DataMode>("auto");
  const [wifiOnly, setWifiOnly] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([getAppPreference("bvs_app_data_mode"), getAppPreference("bvs_app_wifi_downloads")]).then(([savedMode, savedWifi]) => {
      if (!alive) return;
      if (savedMode === "auto" || savedMode === "saver" || savedMode === "high") setDataMode(savedMode);
      setWifiOnly(savedWifi !== "0");
    });
    return () => { alive = false; };
  }, []);

  const updateMode = (next: DataMode) => {
    setDataMode(next);
    void setAppPreference("bvs_app_data_mode", next);
    window.dispatchEvent(new CustomEvent("bvs:app-data-mode", { detail: { mode: next } }));
  };
  const updateWifi = (next: boolean) => {
    setWifiOnly(next);
    void setAppPreference("bvs_app_wifi_downloads", next ? "1" : "0");
  };
  const signOut = async () => {
    if (!isSupabaseConfigured()) return;
    await createClient().auth.signOut();
    window.location.href = `/app/${surface}`;
  };

  if (loading) return <div className="mx-auto max-w-4xl px-4 pt-8"><div className="h-40 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;
  if (!signedIn) return <div className="mx-auto max-w-4xl px-4 pb-10 pt-8 text-center sm:px-6"><p className="text-xs uppercase tracking-[.2em] text-brand">You</p><h1 className="mt-2 text-4xl font-semibold">Make BVS yours.</h1><p className="mx-auto mt-4 max-w-xl text-text-secondary">Join to sync your library, follow creators and grow the same account into a Studio identity later.</p><Link href={`/app/${surface}/join`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-brand px-6 font-semibold text-black">Join BVS</Link><div className="mt-3"><Link href={`/auth/login?next=${encodeURIComponent(`/app/${surface}/you`)}`} className="text-sm text-brand">Already a member? Sign in</Link></div></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs uppercase tracking-[.2em] text-brand">You</p>
      <h1 className="mt-2 text-4xl font-semibold">Your BVS identity.</h1>
      <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[.025] p-5"><p className="text-sm text-text-secondary">Signed in as</p><p className="mt-1 truncate text-xl font-semibold">{user?.email}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-white/10 px-3 py-1.5 text-xs">{isCreator ? "Creator account" : "Listener account"}</span>{premiumActive ? <span className="rounded-full border border-brand/35 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand">Premium · {premiumPlanLabel || "Active"}</span> : null}</div></div>

      <section className="mt-7"><p className="text-xs uppercase tracking-[.18em] text-brand">Listening data</p><h2 className="mt-1 text-2xl font-semibold">Control how BVS uses your connection.</h2><div className="mt-4 grid gap-2 sm:grid-cols-3">{(["auto", "saver", "high"] as DataMode[]).map((mode) => <button key={mode} type="button" onClick={() => updateMode(mode)} className={`rounded-2xl border p-4 text-left ${dataMode === mode ? "border-brand/45 bg-brand/10" : "border-white/10 bg-white/[.02]"}`}><span className="block font-semibold capitalize">{mode === "saver" ? "Data Saver" : mode === "high" ? "High quality" : "Auto"}</span><span className="mt-1 block text-xs text-text-secondary">{mode === "saver" ? "Use less data, reduce artwork preloading and prefer efficient streams." : mode === "high" ? "Prefer richer media when the network allows." : "Let BVS adapt to the connection."}</span></button>)}</div><label className="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-white/10 p-4"><span><span className="block font-semibold">Downloads on Wi-Fi only</span><span className="mt-1 block text-xs text-text-secondary">Applies to rights-controlled vNext offline downloads.</span></span><input type="checkbox" checked={wifiOnly} onChange={(event) => updateWifi(event.target.checked)} className="h-5 w-5 accent-brand" /></label></section>

      <AppNotificationSettings surface={surface} />

      <section className="mt-7 grid gap-2 sm:grid-cols-2"><Link href={`/app/${surface}/notifications`} className="rounded-2xl border border-white/10 p-4"><h2 className="font-semibold">BVS inbox</h2><p className="mt-1 text-sm text-text-secondary">Editorial, creator, order and account updates without leaving the app.</p></Link><Link href={`/app/${surface}/account`} className="rounded-2xl border border-white/10 p-4"><h2 className="font-semibold">Account Centre</h2><p className="mt-1 text-sm text-text-secondary">Profile, creator roles, data export and account deletion.</p></Link>{isCreator ? <Link href={`/app/${surface}/studio`} className="rounded-2xl border border-brand/25 bg-brand/[.05] p-4"><h2 className="font-semibold">BVS Studio</h2><p className="mt-1 text-sm text-text-secondary">Open your creator workspace.</p></Link> : <Link href={`/app/${surface}/account#creator-role`} className="rounded-2xl border border-brand/25 bg-brand/[.05] p-4"><h2 className="font-semibold">Become a creator</h2><p className="mt-1 text-sm text-text-secondary">Add a creator role to this account.</p></Link>}</section>
      <button type="button" onClick={() => void signOut()} className="mt-8 min-h-11 rounded-full border border-white/15 px-5 text-sm text-text-secondary hover:border-red-400/40 hover:text-red-200">Sign out</button>
    </div>
  );
}
