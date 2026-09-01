import Link from "next/link";
import { notFound } from "next/navigation";
import BeatPackUploadForm from "@/components/BeatPackUploadForm";
import MyBeatStore from "@/components/MyBeatStore";

export default async function AppStudioBeatsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">BeatStore Studio</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Publish the sound behind the song.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Upload individual beats or packs, preserve licensing metadata, then manage the same BeatStore catalogue listeners discover in vNext.</p></div><section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[.02] p-4 sm:p-6"><BeatPackUploadForm /></section><section className="mt-7"><MyBeatStore /></section></div>;
}
