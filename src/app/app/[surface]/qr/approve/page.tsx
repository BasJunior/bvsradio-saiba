import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppQrApproveClient from "@/components/app-vnext/AppQrApproveClient";

export default async function AppQrApprovePage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-72 max-w-xl animate-pulse rounded-[2rem] bg-white/[.025]" aria-hidden="true" />}>
      <AppQrApproveClient surface={raw as AppSurface} />
    </Suspense>
  );
}
