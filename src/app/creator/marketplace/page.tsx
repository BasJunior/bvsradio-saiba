import { CreatorMarketplaceDesk } from "@/components/CreatorMarketplaceDesk";
import MarketplaceAvailabilityDesk from "@/components/MarketplaceAvailabilityDesk";

export default function CreatorMarketplacePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <CreatorMarketplaceDesk embedded />
      <MarketplaceAvailabilityDesk />
    </main>
  );
}
