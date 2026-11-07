import { notFound } from "next/navigation";
import { CreatorMarketplaceDesk } from "@/components/CreatorMarketplaceDesk";
import StudioSubHeader from "@/components/app-vnext/StudioSubHeader";

export default async function AppStudioMarketplacePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return (
    <main data-studio-accent="marketplace" className="bvs-studio-home bvs-app-studio-web mx-auto max-w-7xl px-4 pb-14 pt-4 sm:px-6">
      <StudioSubHeader href={`/app/${surface}/studio`} eyebrow="Marketplace" title="Profile & storefront" copy="Set up your public profile and the services people can book from you." />
      <CreatorMarketplaceDesk embedded surface={surface} />
    </main>
  );
}
