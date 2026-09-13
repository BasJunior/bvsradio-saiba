import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSessionProvider } from "@/components/app-vnext/AppSessionProvider";
import ParticipationThreadPanel from "@/components/feed/ParticipationThreadPanel";
import { participationEnabled } from "@/lib/participation-server";
export const dynamic = "force-dynamic";
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  if (!participationEnabled()) notFound();
  const { id } = await params;
  return <main data-bvs-section="feed" className="mx-auto min-h-screen max-w-3xl px-4 pb-32 pt-24 sm:px-6">
    <Link href="/feed" className="inline-flex min-h-11 items-center text-sm">← Feed</Link>
    <h1 className="my-5 text-3xl font-semibold">Conversation</h1>
    <AppSessionProvider><ParticipationThreadPanel threadId={id} surface={null} enabled showRoot /></AppSessionProvider>
  </main>;
}
