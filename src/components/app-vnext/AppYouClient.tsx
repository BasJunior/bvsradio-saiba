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

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 pt-8"><div className="h-40 animate-pulse rounded-[2rem] bg-white/[.035]" /></div>;
  }

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 text-center sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Your BVS</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-semibold sm:text-6xl">Make the experience yours.</h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/44 sm:text-base">Keep your Library in sync, follow creators, join rooms and unlock Studio access when you’re ready to create.</p>
        <Link href={`/app/${surface}/join`} className="mt-7 inline-flex min-h-11 items-center rounded-full bg-white px-6 font-semibold text-black transition hover:bg-brand">Create account</Link>
        <div className="mt-3"><Link href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/you`)}`} className="text-sm text-white/54 transition hover:text-brand">Already have an account? Sign in</Link></div>
        <div className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
          <a href="https://bvsradio.com/contact" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/[.08] px-4 py-2 text-white/40 transition hover:border-white/18 hover:text-white">Support ↗</a>
          <a href="https://bvsradio.com/privacy" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/[.08] px-4 py-2 text-white/40 transition hover:border-white/18 hover:text-white">Privacy ↗</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">You</p>
      <h1 className="mt-3 text-4xl font-semibold sm:text-6xl">Your BVS, your settings.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/43 sm:text-base">Identity, notifications, playback preferences and creator access — all in one place.</p>

      <section className="mt-7 rounded-[1.7rem] border border-white/[.07] bg-white/[.025] p-5 backdrop-blur-xl sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/34">Signed in</p>
        <p className="mt-2 truncate text-xl font-semibold">{user?.email}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/[.08] bg-white/[.025] px-3 py-1.5 text-xs text-white/52">{isCreator ? "Creator" : "Listener"}</span>
          {premiumActive ? <span className="rounded-full border border-brand/25 bg-brand/[.08] px-3 py-1.5 text-xs font-semibold text-brand">Premium · {premiumPlanLabel || "Active"}</span> : null}
        </div>
      </section>

      <section className="mt-9">
        <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Playback & data</p>
        <h2 className="mt-2 text-3xl font-semibold">Tune BVS to your connection.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Choose how much media BVS loads. Auto works well for most people.</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {(["auto", "saver", "high"] as DataMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateMode(mode)}
              className={`rounded-[1.3rem] border p-4 text-left transition ${dataMode === mode ? "border-brand/35 bg-brand/[.075]" : "border-white/[.07] bg-white/[.02] hover:border-white/15 hover:bg-white/[.035]"}`}
            >
              <span className="block font-semibold">{mode === "saver" ? "Data Saver" : mode === "high" ? "High" : "Auto"}</span>
              <span className="mt-2 block text-xs leading-5 text-white/36">{mode === "saver" ? "Load less artwork and reduce background media use." : mode === "high" ? "Prefer richer media when your connection can handle it." : "Let BVS adapt automatically to your network."}</span>
            </button>
          ))}
        </div>

        <label className="mt-3 flex items-center justify-between gap-4 rounded-[1.3rem] border border-white/[.07] bg-white/[.02] p-4">
          <span>
            <span className="block font-semibold">Download on Wi-Fi only</span>
            <span className="mt-1 block text-xs text-white/34">Helps avoid unexpected mobile-data use for offline music.</span>
          </span>
          <input type="checkbox" checked={wifiOnly} onChange={(event) => updateWifi(event.target.checked)} className="h-5 w-5 accent-brand" />
        </label>
      </section>

      <AppNotificationSettings surface={surface} />

      <section className="mt-9 grid gap-3 sm:grid-cols-2">
        <Link href={`/app/${surface}/notifications`} className="group rounded-[1.35rem] border border-white/[.07] bg-white/[.02] p-5 transition hover:border-white/15 hover:bg-white/[.035]">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Inbox</p>
          <h2 className="mt-2 text-xl font-semibold">Updates that matter.</h2>
          <p className="mt-2 text-sm leading-6 text-white/38">Editorial decisions, creator activity, orders and account updates.</p>
        </Link>
        <Link href={`/app/${surface}/account`} className="group rounded-[1.35rem] border border-white/[.07] bg-white/[.02] p-5 transition hover:border-white/15 hover:bg-white/[.035]">
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Account</p>
          <h2 className="mt-2 text-xl font-semibold">Identity & access.</h2>
          <p className="mt-2 text-sm leading-6 text-white/38">Profile, creator roles, privacy, export and account controls.</p>
        </Link>
        {isCreator ? (
          <Link href={`/app/${surface}/studio`} className="group rounded-[1.35rem] border border-brand/18 bg-brand/[.045] p-5 transition hover:border-brand/30 hover:bg-brand/[.07]">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Studio</p>
            <h2 className="mt-2 text-xl font-semibold">Your work starts here.</h2>
            <p className="mt-2 text-sm leading-6 text-white/38">Releases, review, distribution, performance and money.</p>
          </Link>
        ) : (
          <Link href={`/app/${surface}/account#creator-role`} className="group rounded-[1.35rem] border border-brand/18 bg-brand/[.045] p-5 transition hover:border-brand/30 hover:bg-brand/[.07]">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-brand">Create</p>
            <h2 className="mt-2 text-xl font-semibold">Turn on creator access.</h2>
            <p className="mt-2 text-sm leading-6 text-white/38">Apply for the creator role that fits the work you want to do.</p>
          </Link>
        )}
      </section>

      <div className="mt-7 flex flex-wrap gap-2 text-sm">
        <a href="https://bvsradio.com/contact" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/[.08] px-4 py-2 text-white/40 transition hover:border-white/18 hover:text-white">Support ↗</a>
        <a href="https://bvsradio.com/privacy" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/[.08] px-4 py-2 text-white/40 transition hover:border-white/18 hover:text-white">Privacy ↗</a>
      </div>

      <button type="button" onClick={() => void signOut()} className="mt-8 min-h-11 rounded-full border border-white/[.08] px-5 text-sm text-white/38 transition hover:border-red-400/30 hover:text-red-200">Sign out</button>
    </div>
  );
}
