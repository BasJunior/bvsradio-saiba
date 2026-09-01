import Link from "next/link";
import { notFound } from "next/navigation";
import ReleaseSubmitForm from "@/components/ReleaseSubmitForm";

export default async function AppStudioReleasePage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-4xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">Release music</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Submit a release from your phone.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">The app reuses BVS’s secure signed-upload and rights-evidence workflow. Nothing bypasses editorial or mobile distribution clearance.</p></div><div className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[.02] p-4 sm:p-6"><ReleaseSubmitForm /></div><p className="mt-4 text-xs text-text-secondary">vNext native transfer hooks will let the specialist bind background/resumable device uploads without changing this release contract.</p></div>;
}
