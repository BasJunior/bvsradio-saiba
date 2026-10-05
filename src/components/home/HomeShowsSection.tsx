import { getPublicProgrammes } from "@/lib/station-content";
import CreatorPortraitRail from "./CreatorPortraitRail";

export default async function HomeShowsSection() {
  const shows = await getPublicProgrammes();
  return <CreatorPortraitRail data-home-accent="shows" title="Shows" kicker="Conversations and replay moments" tone="ink" allHref="/shows" items={shows.map(show => ({
    id: show.slug, name: show.title, image: show.image, href: `/shows/${show.slug}`, detail: `${show.schedule}${show.tagline ? ` · ${show.tagline}` : ""}`,
  }))} />;
}
