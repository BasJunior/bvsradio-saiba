import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryAction from "@/components/LibraryAction";
import AppShareButton from "@/components/app-vnext/AppShareButton";
import type { DiscoveryItem } from "@/lib/discovery";
import { getPublicProgramme } from "@/lib/station-content";

export const dynamic = "force-dynamic";

export default async function AppShowPage({ params }: { params: Promise<{ surface: string; slug: string }> }) {
  const { surface, slug } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  const programme = await getPublicProgramme(slug);
  if (!programme) notFound();
  const item: DiscoveryItem = {
    id: `show-${programme.slug}`,
    kind: "show",
    title: programme.title,
    subtitle: programme.schedule,
    href: `/app/${surface}/show/${programme.slug}`,
    image: programme.image,
  };
  const phase = programme.status || "preview";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6">
      <Link href={`/app/${surface}`} className="text-sm text-text-secondary">← Home</Link>
      <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025]">
        <div className="relative aspect-[16/9] bg-white/5">
          <Image src={programme.image} alt="" fill className="object-cover" priority />
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-brand/10 px-3 py-1.5 font-semibold text-brand">{String(phase).toUpperCase()}</span>
            <span className="rounded-full border border-white/10 px-3 py-1.5 text-text-secondary">{programme.schedule}</span>
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{programme.title}</h1>
          <p className="mt-2 text-sm text-text-secondary">Hosted by {programme.host}</p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-text-secondary">{programme.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LibraryAction item={item} section="follows" />
            <AppShareButton title={programme.title} text={`${programme.title} on BVS`} path={`/app/${surface}/show/${programme.slug}`} />
          </div>
        </div>
      </section>
    </div>
  );
}
