import { notFound } from "next/navigation";
import AppExploreClient from "@/components/app-vnext/AppExploreClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

const allowedKinds = new Set(["all", "music", "artists", "producers", "beats"]);

export default async function AppExplorePage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>;
  searchParams?: Promise<{ q?: string | string[]; kind?: string | string[] }>;
}) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const queryParams = searchParams ? await searchParams : {};
  const qRaw = Array.isArray(queryParams.q) ? queryParams.q[0] : queryParams.q;
  const kindRaw = Array.isArray(queryParams.kind) ? queryParams.kind[0] : queryParams.kind;
  const initialQuery = String(qRaw || "").slice(0, 160);
  const initialKind = allowedKinds.has(String(kindRaw || "")) ? String(kindRaw) : "all";
  return <AppExploreClient surface={raw as AppSurface} initialQuery={initialQuery} initialKind={initialKind as "all" | "music" | "artists" | "producers" | "beats"} />;
}
