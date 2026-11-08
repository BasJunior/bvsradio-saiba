"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MarketplaceEnquiryInbox } from "@/components/MarketplaceEnquiries";

function Inbox() {
  const search = useSearchParams();
  return <MarketplaceEnquiryInbox initialId={search.get("id") || undefined} />;
}

export default function MarketplaceEnquiriesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/marketplace" className="text-sm text-brand hover:underline">← Marketplace</Link>
      <h1 className="mt-4 text-4xl font-semibold">Marketplace enquiries</h1>
      <p className="mt-2 text-text-secondary">Questions between buyers and sellers, kept on BVS.</p>
      <Suspense fallback={<p className="mt-6 text-sm text-text-secondary">Loading…</p>}>
        <Inbox />
      </Suspense>
    </main>
  );
}
