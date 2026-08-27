import Link from "next/link";
import ReleaseSubmitForm from "@/components/ReleaseSubmitForm";
import CreatorFormAnalytics from "@/components/CreatorFormAnalytics";

export default async function CreateReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ songWorkspace?: string }>;
}) {
  const songWorkspaceId = String((await searchParams).songWorkspace || "").trim();
  return (
    <main className="mx-auto max-w-4xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <CreatorFormAnalytics intent="release" />
      <Link href="/creator/studio" className="text-sm text-brand">← Studio</Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Create · Release</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Release music</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        This screen only asks for what BVS needs to prepare the release, check the rights and send it through review. You can manage status later from Studio.
      </p>
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
        <ReleaseSubmitForm songWorkspaceId={songWorkspaceId || undefined} />
      </div>
    </main>
  );
}
