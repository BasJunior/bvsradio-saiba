import type { Metadata } from "next";
import Link from "next/link";
import CommunityChat from "@/components/CommunityChat";

export const metadata: Metadata = {
  title: "Live Room | BVS Radio",
  description: "Join the BVS Radio live room while the station keeps playing.",
};

export default function RadioRoomPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link href="/radio" className="text-sm text-brand hover:underline">← Back to BVS Radio</Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS live room</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Listen together.</h1>
        <p className="mt-4 max-w-2xl text-base text-text-secondary sm:text-lg">
          The station keeps playing through the persistent BVS player while you follow the room. Signed-in listeners can read; eligible members can join the conversation.
        </p>
      </header>

      <CommunityChat roomId="bvs-live" roomTitle="BVS live room" loginNext="/radio/room" />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
        <p>Keep it about the music and the moment. Reports go privately to BVS moderators.</p>
        <Link href="/radio/schedule" className="text-brand hover:underline">See the station schedule →</Link>
      </div>
    </main>
  );
}
