import { notFound } from "next/navigation";
import AppSignupClient from "@/components/app-vnext/AppSignupClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export default async function AppEmailSignupPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return <AppSignupClient surface={raw as AppSurface} />;
}
