import { notFound } from "next/navigation";
import BeatPackUploadForm from "@/components/BeatPackUploadForm";
import MyBeatStore from "@/components/MyBeatStore";
import StudioSubHeader from "@/components/app-vnext/StudioSubHeader";

export default async function AppStudioBeatsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <main data-studio-accent="beats" className="bvs-studio-home bvs-app-studio-web mx-auto max-w-5xl px-4 pb-14 pt-4 sm:px-6">
    <StudioSubHeader href={`/app/${surface}/studio`} eyebrow="BeatStore" title="Your beats" copy="Upload single beats or packs with their licences, then manage everything listeners can find in BeatStore." />
    <section className="bvs-studio-work p-4 sm:p-6" aria-label="Upload beats"><BeatPackUploadForm /></section>
    <section className="mt-6" aria-label="Your BeatStore catalogue"><MyBeatStore managementOnly /></section>
  </main>;
}
