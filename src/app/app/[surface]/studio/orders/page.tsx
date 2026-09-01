import Link from "next/link";
import { notFound } from "next/navigation";
import CreatorServiceOrders from "@/components/CreatorServiceOrders";

export default async function AppStudioOrdersPage({ params }: { params: Promise<{ surface: string }> }) {
  const { surface } = await params;
  if (surface !== "ios" && surface !== "android") notFound();
  return <div className="mx-auto max-w-5xl px-4 pb-12 pt-6 sm:px-6"><Link href={`/app/${surface}/studio`} className="text-sm text-text-secondary">← Studio</Link><div className="mt-5"><p className="text-xs uppercase tracking-[.2em] text-brand">Orders</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Deliver professional work without leaving BVS.</h1><p className="mt-3 max-w-2xl text-sm text-text-secondary">Service orders, deadlines and delivery state use the existing BVS marketplace backend. Storefront payment policy stays separate from the creator’s work queue.</p></div><section className="mt-7"><CreatorServiceOrders /></section></div>;
}
