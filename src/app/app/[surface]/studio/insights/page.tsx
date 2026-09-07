import Link from "next/link";
import { notFound } from "next/navigation";
import { AppStudioInsightsPanel } from "@/components/app-vnext/AppStudioTokenPanels";

export default async function AppStudioInsightsPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">Creator insights</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Understand attention without confusing it with money.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">BVS keeps listening, saves, follows and creator-performance signals separate from payable balances. The mobile view uses the same source-of-truth insight API as Studio.</p></div><section className="mt-7"><AppStudioInsightsPanel /></section></div>;
}
