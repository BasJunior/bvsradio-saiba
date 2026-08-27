import Link from "next/link";
import QuickServiceCreate from "@/components/QuickServiceCreate";
import CreatorFormAnalytics from "@/components/CreatorFormAnalytics";

export default function CreateServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <CreatorFormAnalytics intent="service" />
      <Link href="/creator/studio" className="text-sm text-brand">← Studio</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Create · Service</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Offer a service</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        Tell BVS what you offer. If you have not set up a client-facing profile yet, we only ask for the essentials first.
      </p>
      <div className="mt-8">
        <QuickServiceCreate />
      </div>
    </main>
  );
}
