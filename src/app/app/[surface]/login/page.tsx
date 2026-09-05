import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppLoginClient from "@/components/app-vnext/AppLoginClient";

export default async function AppLoginPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-80 max-w-xl animate-pulse rounded-[2rem] bg-white/[.025]" aria-hidden="true" />}>
      <AppLoginClient surface={raw as AppSurface} />
    </Suspense>
  );
}
