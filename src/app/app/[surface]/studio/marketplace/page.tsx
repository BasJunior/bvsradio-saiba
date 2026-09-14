import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatorMarketplaceDesk } from "@/components/CreatorMarketplaceDesk";

export default async function AppStudioMarketplacePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return (
    <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link>
      <CreatorMarketplaceDesk embedded surface={surface} />
    </main>
  );
}
