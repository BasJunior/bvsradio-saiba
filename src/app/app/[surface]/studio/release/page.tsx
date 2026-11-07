import { notFound } from "next/navigation";
import AppStudioReleaseClient from "@/components/app-vnext/AppStudioReleaseClient";
import StudioSubHeader from "@/components/app-vnext/StudioSubHeader";

export default async function AppStudioReleasePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <main data-studio-accent="core" className="bvs-studio-home bvs-app-studio-web mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6">
    <StudioSubHeader href={`/app/${surface}/studio`} eyebrow="Releases" title="Release music" copy="Submit your music, follow BVS review, see when it’s live, and track delivery to other stores." />
    <div className="mt-5"><AppStudioReleaseClient surface={surface} /></div>
  </main>;
}
