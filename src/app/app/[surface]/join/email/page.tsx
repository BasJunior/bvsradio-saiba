import { notFound } from "next/navigation";
import AppSignupClient from "@/components/app-vnext/AppSignupClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

function containedNext(surface: AppSurface, raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && value.startsWith(`/app/${surface}/`) && !value.startsWith(`/app/${surface}//`)) return value;
  return `/app/${surface}/you`;
}

export default async function AppEmailSignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const surface = raw as AppSurface;
  const query = await searchParams;
  return <AppSignupClient surface={surface} nextPath={containedNext(surface, query.next)} />;
}
