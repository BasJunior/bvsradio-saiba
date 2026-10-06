import DiscoveryDirectory from "@/components/home/DiscoveryDirectory";
import { getPublishedProducers } from "@/lib/artist-content";
import { fairDailyOrder } from "@/lib/fair-discovery-order";
export const metadata = { title: "Producers", description: "Discover verified BVS producers and their published beats." };
export default async function ProducersDirectoryPage() {
  const producers = fairDailyOrder(await getPublishedProducers(), "producers");
  return <DiscoveryDirectory title="Producers" kicker="BVS BeatStore" accent="purple" description="Explore verified producers and their published beats." browseHref="/catalogue?type=beat#beatstore" browseLabel="Browse all beats" emptyMessage="Producer profiles will appear after verification and their first published beat." items={producers.map(producer => ({ id: producer.id, name: producer.name, image: producer.image, href: `/artist/${encodeURIComponent(producer.username)}`, detail: `Verified producer · ${producer.beatCount} published ${producer.beatCount === 1 ? 'beat' : 'beats'}`, description: producer.genres.join(' · '), secondaryHref: `/catalogue?type=beat&producer=${encodeURIComponent(producer.username)}#browse`, secondaryLabel: "View catalogue" }))} />;
}
