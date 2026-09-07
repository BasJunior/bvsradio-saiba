"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AppSurfaceNotFound() {
  const pathname = usePathname();
  const surface = pathname.startsWith("/app/android") ? "android" : "ios";
  const base = `/app/${surface}`;

  return (
    <section className="mx-auto flex min-h-[62vh] max-w-xl flex-col justify-center px-5 py-14 text-center sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">BVS</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">That page is not available here.</h1>
      <p className="mt-4 text-sm leading-6 text-text-secondary">
        The app is still intact. Return to BVS or open Discover instead of leaving the app experience.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href={base} className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Back to BVS</Link>
        <Link href={`${base}/explore`} className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white">Open Discover</Link>
      </div>
    </section>
  );
}
