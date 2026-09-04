import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorMarketplaceDesk } from "@/components/CreatorMarketplaceDesk";

export default async function AppStudioMarketplacePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">Creator marketplace</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Sell what you make and what you can do.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Manage your verified provider profile, digital products and service listings in the same creator identity. Purchase rails remain storefront-policy aware.</p></div><section className="mt-7"><CreatorMarketplaceDesk embedded /></section></div>;
}
