"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useAppSession } from "@/components/app-vnext/AppSessionProvider";
import AppPlaylists from "@/components/app-vnext/AppPlaylists";
import { readLibrary, type LibrarySection } from "@/lib/library";
import type { DiscoveryItem } from "@/lib/discovery";

const tabs: Array<{ id: LibrarySection; label: string }> = [
  { id: "favourites", label: "Saved" },
  { id: "follows", label: "Following" },
  { id: "history", label: "History" },
];

export default function AppLibraryClient({ surface }: { surface: AppSurface }) {
  const [active, setActive] = useState<LibrarySection>("favourites");
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const { signedIn } = useAppSession();

  useEffect(() => {
    const sync = () => setItems(readLibrary(active));
    sync();
    window.addEventListener("bvs:library-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("bvs:library-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, [active]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Your BVS</p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Keep your path through the scene.</h1>
      <p className="mt-3 max-w-2xl text-sm text-text-secondary">{signedIn ? "Your BVS library and playlists can follow your account across devices." : "Saved on this device for now. Join BVS to carry your library across devices."}</p>
      {!signedIn ? <Link href={`/app/${surface}/join`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Join to sync</Link> : null}

      <div className="mt-7 flex gap-2 overflow-x-auto border-b border-white/10 pb-4">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setActive(tab.id)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm ${active === tab.id ? "bg-brand font-semibold text-black" : "text-text-secondary"}`}>{tab.label}</button>)}</div>

      <div className="mt-5 space-y-2">{items.map((item) => <Link key={item.id} href={item.href} className="flex min-w-0 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.02] p-4 hover:border-brand/30"><div className="min-w-0"><h2 className="truncate font-semibold">{item.title}</h2><p className="truncate text-sm text-text-secondary">{item.subtitle}</p></div><span className="text-brand">→</span></Link>)}</div>

      {!items.length ? <div className="mt-7 rounded-[1.75rem] border border-dashed border-white/15 p-9 text-center"><h2 className="text-xl font-semibold">Your {tabs.find((tab) => tab.id === active)?.label.toLowerCase()} will live here.</h2><p className="mt-2 text-sm text-text-secondary">Explore BVS, save what matters and follow the people behind it.</p><Link href={`/app/${surface}/explore`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Explore BVS</Link></div> : null}

      <AppPlaylists surface={surface} />
    </div>
  );
}
