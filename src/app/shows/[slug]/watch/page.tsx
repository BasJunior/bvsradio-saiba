import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LiveShowViewer from "@/components/LiveShowViewer";
import { getPublicProgramme } from "@/lib/station-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const show = await getPublicProgramme((await params).slug);
  return show
    ? { title: `${show.title} Live`, description: show.description }
    : {};
}

export default async function WatchShowPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const slug = (await params).slug;
  const show = await getPublicProgramme(slug);
  if (!show) notFound();

  return (
    <LiveShowViewer
      slug={slug}
      fallbackShow={{
        slug: show.slug,
        title: show.title,
        host: show.host,
        artwork: show.image,
        schedule: show.schedule,
        description: show.description,
        tagline: show.tagline,
      }}
    />
  );
}
