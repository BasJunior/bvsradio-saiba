import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import AppEditionShell from "@/components/app-vnext/AppEditionShell";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export const metadata: Metadata = {
  title: "BVS Radio App",
  description: "The curated BVS Radio mobile edition.",
  robots: { index: false, follow: true },
};

export default async function AppSurfaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ surface: string }>;
}) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return (
    <Suspense fallback={children}>
      <AppEditionShell surface={surface as AppSurface}>{children}</AppEditionShell>
    </Suspense>
  );
}
