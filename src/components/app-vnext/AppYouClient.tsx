"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import AppNotificationSettings from "@/components/app-vnext/AppNotificationSettings";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { getAppPreference, setAppPreference, unregisterPushDevice } from "@/lib/app-native";
import { LibIcon, type LibIconName } from "@/components/app-vnext/LibraryVisuals";

type DataMode = "auto" | "saver" | "high";

export default function AppYouClient({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const { user, token, loading, signedIn, isCreator, premiumActive, premiumPlanLabel } = useAppSession();
  const [dataMode, setDataMode] = useState<DataMode>("auto");
  const [signOutError, setSignOutError] = useState("");
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
    try { if (token) await unregisterPushDevice(token); } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Could not disconnect notifications."); return;
    }
    await createClient().auth.signOut();
    router.replace(`/app/${surface}`);
    router.refresh();
  };

  if (loading) {
    return (
      <div className="bvs-app-page mx-auto max-w-2xl px-4 pt-6" data-app-accent="lime" aria-busy="true">
        <div className="bvs-app-skeleton h-16 w-16" /><div className="bvs-app-skeleton mt-4 h-8 w-40" /><div className="bvs-app-skeleton mt-6 h-40" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="bvs-app-page mx-auto max-w-2xl px-4 pb-12 pt-5 sm:px-6" data-app-accent="lime">
        <p className="bvs-app-eyebrow">Your BVS</p>
        <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">You</h1>
        <div className="mt-5 border border-white/12 bg-[#121214] p-5">
          <span className="grid h-14 w-14 place-items-center bg-white/[.07] text-white/60"><LibIcon name="people" size={26} /></span>
          <h2 className="mt-4 text-xl font-bold">Make the experience yours.</h2>
          <p className="mt-1.5 text-sm leading-6 text-white/55">Keep your Library in sync, follow creators, join rooms and unlock Studio when you’re ready to create.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/app/${surface}/join`} className="bvs-app-pill bvs-app-pill--primary min-h-11 px-5">Create account</Link>
            <Link href={`/app/${surface}/login?next=${encodeURIComponent(`/app/${surface}/you`)}`} className="bvs-app-pill min-h-11 px-5">Sign in</Link>
          </div>
        </div>
        <SettingsGroup title="Help">
          <SettingsRow href="https://bvsradio.com/contact" external icon="chat" rgb="163 219 255" label="Support" />
          <SettingsRow href="https://bvsradio.com/privacy" external icon="lock" rgb="255 255 255" label="Privacy" />
        </SettingsGroup>
      </div>
    );
  }

  const initial = (user?.email || "B").trim().charAt(0).toUpperCase();

  return (
    <div className="bvs-app-page mx-auto max-w-2xl px-4 pb-12 pt-5 sm:px-6" data-app-accent="lime">
      <p className="bvs-app-eyebrow">Your BVS</p>
      <h1 className="mt-1 text-[2.4rem] font-bold leading-none tracking-tight sm:text-6xl">You</h1>

      <Link href={`/app/${surface}/account`} className="bvs-app-card mt-5 flex items-center gap-4 p-4">
        <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center bg-[#c1ff52] text-2xl font-black text-black">{initial}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold">{user?.email}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex min-h-6 items-center border border-white/15 px-2 text-[11px] text-white/60">{isCreator ? "Creator" : "Listener"}</span>
            {premiumActive ? <span data-studio-accent="money" className="bvs-studio-accent-button inline-flex min-h-6 items-center border px-2 text-[11px] font-semibold">Premium · {premiumPlanLabel || "Active"}</span> : null}
          </span>
        </span>
        <LibIcon name="chevron" size={18} className="shrink-0 text-white/35" />
      </Link>

      <SettingsGroup title="Your BVS">
        <SettingsRow href={`/app/${surface}/notifications`} icon="chat" rgb="193 167 255" label="Inbox" note="Editorial decisions, orders and account updates" />
        <SettingsRow href={`/app/${surface}/library`} icon="heart" rgb="193 167 255" label="Library" note="Likes, playlists and downloads" />
        {isCreator
          ? <SettingsRow href={`/app/${surface}/studio`} icon="mic" rgb="163 219 255" label="Studio" note="Releases, review, performance and money" />
          : <SettingsRow href={`/app/${surface}/account#creator-role`} icon="sparkle" rgb="193 255 82" label="Turn on creator access." note="Apply for the creator role that fits your work" />}
        <SettingsRow href={`/app/${surface}/account`} icon="people" rgb="255 255 255" label="Account" note="Profile, roles, privacy, export and controls" />
      </SettingsGroup>

      <section className="bvs-app-shelf" aria-labelledby="you-playback-heading">
        <h2 id="you-playback-heading" className="bvs-app-shelf-title">Playback & data</h2>
        <p className="mt-1 text-sm text-white/50">Choose how much media BVS loads. Auto suits most connections.</p>
        <div className="mt-3 grid grid-cols-3 border border-white/12" role="radiogroup" aria-label="Data mode">
          {(["auto", "saver", "high"] as DataMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={dataMode === mode}
              onClick={() => updateMode(mode)}
              className={`min-h-11 border-r border-white/12 px-2 text-sm font-semibold transition last:border-r-0 ${dataMode === mode ? "bg-[#c1ff52] text-black" : "text-white/65 hover:bg-white/[.05]"}`}
            >
              {mode === "saver" ? "Data Saver" : mode === "high" ? "High" : "Auto"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/45">{dataMode === "saver" ? "Loads less artwork and reduces background media use." : dataMode === "high" ? "Prefers richer media when your connection can handle it." : "BVS adapts automatically to your network."}</p>
        <label className="mt-3 flex min-h-14 items-center justify-between gap-4 border-y border-white/12 py-3">
          <span>
            <span className="block text-[15px] font-semibold">Download on Wi-Fi only</span>
            <span className="mt-0.5 block text-xs text-white/45">Avoids unexpected mobile-data use for offline music.</span>
          </span>
          <input type="checkbox" role="switch" checked={wifiOnly} onChange={(event) => updateWifi(event.target.checked)} className="bvs-app-switch" />
        </label>
      </section>

      <AppNotificationSettings surface={surface} />

      <SettingsGroup title="Help">
        <SettingsRow href="https://bvsradio.com/contact" external icon="chat" rgb="163 219 255" label="Support" />
        <SettingsRow href="https://bvsradio.com/privacy" external icon="lock" rgb="255 255 255" label="Privacy" />
      </SettingsGroup>

      {signOutError ? <p role="alert" className="mt-5 text-sm text-red-200">{signOutError}</p> : null}
      <button type="button" onClick={() => void signOut()} className="mt-8 min-h-12 w-full border border-white/12 text-[15px] font-semibold text-red-300 transition hover:border-red-400/40 hover:bg-red-400/[.06]">Sign out</button>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bvs-app-shelf">
      <h2 className="bvs-app-shelf-title">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function SettingsRow({ href, icon, rgb, label, note, external = false }: { href: string; icon: LibIconName; rgb: string; label: string; note?: string; external?: boolean }) {
  const body = <>
    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center" style={{ background: `rgb(${rgb} / .12)`, color: `rgb(${rgb})` }}><LibIcon name={icon} size={19} /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-semibold">{label}</span>{note ? <span className="block truncate text-[13px] text-white/45">{note}</span> : null}</span>
    <LibIcon name={external ? "share" : "chevron"} size={17} className="shrink-0 text-white/35" />
  </>;
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="bvs-app-row flex items-center gap-3 py-3">{body}</a>
    : <Link href={href} className="bvs-app-row flex items-center gap-3 py-3">{body}</Link>;
}
