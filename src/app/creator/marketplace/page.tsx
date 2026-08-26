import { CreatorMarketplaceDesk } from "@/components/CreatorMarketplaceDesk";
import MarketplaceAvailabilityDesk from "@/components/MarketplaceAvailabilityDesk";
import StudioMarketplaceProfileDesk from "@/components/StudioMarketplaceProfileDesk";

export default function CreatorMarketplacePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <CreatorMarketplaceDesk embedded />
      <StudioMarketplaceProfileDesk />
      <MarketplaceAvailabilityDesk />
    </main>
  );
}
