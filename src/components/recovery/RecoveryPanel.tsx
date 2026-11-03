"use client";

import Link from "next/link";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";

export default function RecoveryPanel({ missing = false, retry }: { missing?: boolean; retry?: () => void }) {
  const { surface, appChrome } = useAppSurface();
  const base = appChrome && surface ? `/app/${surface}` : "";
  return (
    <section className="relative mx-auto flex min-h-[60svh] max-w-3xl flex-col justify-center px-6 py-16" aria-labelledby="recovery-title">
      <span className="text-xs font-bold uppercase tracking-[.24em] text-brand">BVS Radio · {missing ? "404" : "A brief interruption"}</span>
      <h1 id="recovery-title" className="mt-5 max-w-xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">{missing ? "This one is off the playlist." : "Let’s get you back to the sound."}</h1>
      <p className="mt-5 max-w-lg text-base leading-relaxed text-text-secondary">{missing ? "This page may have moved, or the link may be out of date. There is still plenty to discover." : "This page couldn’t load. Try again, or head back to BVS and keep exploring."}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {retry ? <button type="button" onClick={retry} className="min-h-12 rounded-full bg-brand px-6 py-3 text-sm font-bold text-black hover:brightness-110">Try again</button> : null}
        <Link href={base || "/"} className={`min-h-12 rounded-full px-6 py-3 text-sm font-semibold ${retry ? "border border-white/20 hover:bg-white/5" : "bg-brand text-black hover:brightness-110"}`}>Back to BVS</Link>
        <Link href={base ? `${base}/explore` : "/search"} className="min-h-12 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/5">Discover music →</Link>
      </div>
    </section>
  );
}
