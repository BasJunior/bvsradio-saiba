import Link from "next/link";
import { notFound } from "next/navigation";
import { AppStudioMoneyPanel } from "@/components/app-vnext/AppStudioTokenPanels";

export default async function AppStudioMoneyPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div data-studio-accent="money" className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="bvs-studio-accent-button inline-flex rounded-full border px-4 py-2 text-sm">← Studio</Link><div className="mt-5"><p className="bvs-studio-accent-label text-xs uppercase tracking-[.2em]">Money</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">See where creator value becomes payable money.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Qualified listening, marketplace revenue, settlements and available balance remain distinct so creators can understand what is measured, pending and actually payable.</p></div><section className="mt-7"><AppStudioMoneyPanel /></section></div>;
}
