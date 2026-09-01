import Link from "next/link";
import { notFound } from "next/navigation";
import StudioMoneySummary from "@/components/StudioMoneySummary";

export default async function AppStudioMoneyPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">Money</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">See where creator value becomes payable money.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Qualified listening, marketplace revenue, settlements and available balance remain distinct so creators can understand what is measured, pending and actually payable.</p></div><section className="mt-7"><StudioMoneySummary /></section></div>;
}
