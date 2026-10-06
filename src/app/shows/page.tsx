import type { Metadata } from "next";
import DiscoveryDirectory from "@/components/home/DiscoveryDirectory";
import { getPublicProgrammes } from "@/lib/station-content";
export const metadata: Metadata = { title: "Shows", description: "Explore published and upcoming BVS Radio programmes." };
export const revalidate = 60;
export default async function ShowsPage() {
  const shows = await getPublicProgrammes();
  return <DiscoveryDirectory title="Shows" kicker="Conversations and replay moments" description="Explore BVS programmes and published recordings. Upcoming concepts remain clearly labelled." browseHref="/radio/schedule" browseLabel="Station schedule" emptyMessage="Programmes will appear here when published by BVS editorial." items={shows.map(show => ({ id: show.slug, name: show.title, image: show.image, href: `/shows/${show.slug}`, detail: `${show.status === 'active' ? 'Published' : 'Upcoming programme'} · ${show.schedule}`, description: show.description }))} />;
}
