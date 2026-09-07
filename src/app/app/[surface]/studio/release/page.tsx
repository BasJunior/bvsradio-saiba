import Link from "next/link";
import { notFound } from "next/navigation";
import AppStudioReleaseClient from "@/components/app-vnext/AppStudioReleaseClient";

export default async function AppStudioReleasePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">Release music</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">From submission to proof.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Submit securely, follow editorial review, see when BVS playback is actually live, then track wider store delivery separately.</p></div><div className="mt-7"><AppStudioReleaseClient surface={surface} /></div></div>;
}
