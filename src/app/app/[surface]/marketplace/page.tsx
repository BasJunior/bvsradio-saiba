import { notFound } from "next/navigation";
import AppMarketplaceClient from "@/components/app-vnext/AppMarketplaceClient";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";

export const dynamic = "force-dynamic";

export default async function AppMarketplacePage({
  params,
  searchParams,
}: {
  params: Promise<{ surface: string }>;
  searchParams: Promise<{ provider?: string | string[]; service?: string | string[]; book?: string | string[] }>;
}) {
  const raw = (await params).surface;
  if (raw !== "ios" && raw !== "android") notFound();
  const query = await searchParams;
  const provider = typeof query.provider === "string" ? query.provider : "";
  const service = typeof query.service === "string" ? query.service : "";
  const book = query.book === "1";
  return <AppMarketplaceClient surface={raw as AppSurface} initialProvider={provider} initialService={service} initialBook={book} />;
}
