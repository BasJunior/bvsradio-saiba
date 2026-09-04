"use client";

import { Suspense } from "react";
import AppLibraryClient from "@/components/app-vnext/AppLibraryClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { useVnextEdition } from "@/components/app-vnext/useVnextEdition";

export default function AppLibraryEdition({
  surface,
  fallback,
}: {
  surface: AppSurface;
  fallback: React.ReactNode;
}) {
  const vnext = useVnextEdition();
  if (!vnext) return fallback;
  return <AppLibraryClient surface={surface} />;
}

export function AppLibraryEditionBoundary({
  surface,
  fallback,
}: {
  surface: AppSurface;
  fallback: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <AppLibraryEdition surface={surface} fallback={fallback} />
    </Suspense>
  );
}
