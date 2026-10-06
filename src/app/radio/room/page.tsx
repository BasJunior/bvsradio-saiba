import type { Metadata } from "next";
import Link from "next/link";
import ListenerRoom from "@/components/radio/ListenerRoom";

export const metadata: Metadata = {
  title: "Listener Room | BVS Radio",
  description: "Talk about what you’re hearing, discover tracks and meet fellow BVS listeners.",
};

export default function RadioRoomPage() {
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
    <header className="mb-8">
      <Link href="/radio" className="text-sm text-brand hover:underline">Back to BVS Radio</Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-text-secondary">Listen together</p>
      <h1 className="mt-2 text-4xl font-extrabold uppercase tracking-tight sm:text-6xl">Listener room</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">A place for the music you’re hearing and the people discovering it with you. React, ask a question, or put someone onto their next favourite track.</p>
    </header>
    <ListenerRoom standalone />
  </main>;
}
