import { notFound } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import AppForgotPasswordClient from "@/components/app-vnext/AppForgotPasswordClient";

export default async function AppForgotPasswordPage({ params }: { params: Promise<{ surface: string }> }) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  return <AppForgotPasswordClient surface={raw as AppSurface} />;
}
