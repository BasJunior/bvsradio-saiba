import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Collecting Societies Explained",
  description: "What music collecting societies do, what joining can earn you, and how membership affects your music on BVS.",
};

const SOCIETIES = [
  ["Songwriters", "ZIMURA (Zimbabwe), SAMRO (South Africa), GEMA (Germany), PRS (UK), ASCAP and BMI (US)"],
  ["Performers and recording owners", "SAMPRA (South Africa), GVL (Germany), PPL (UK), SoundExchange (US)"],
];

export default function SocietiesPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">For artists</p>
      <h1 className="mt-3 text-4xl font-semibold">Collecting societies, explained</h1>
      <p className="mt-4 text-text-secondary">A society collects royalties for musicians. Radio stations and other music users pay the society for permission to play music, and it shares that money with its members.</p>

      <h2 className="mt-10 text-2xl font-semibold">Who they represent</h2>
      <dl className="mt-4 space-y-4">
        {SOCIETIES.map(([who, names]) => (
          <div key={who} className="rounded-2xl border border-white/10 p-4"><dt className="font-semibold">{who}</dt><dd className="mt-1 text-sm text-text-secondary">{names}</dd></div>
        ))}
      </dl>

      <h2 className="mt-10 text-2xl font-semibold">Should you join?</h2>
      <p className="mt-3 text-text-secondary">That’s your decision, and it can be worth it. Societies can collect money you couldn’t easily collect yourself, including from other countries. Joining is usually cheap, but check the current fee and read the agreement, because you normally hand over the right to license your songs.</p>

      <h2 className="mt-10 text-2xl font-semibold">How this affects BVS</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-text-secondary">
        <li>You can post on BVS whether or not you’re a member.</li>
        <li>If a society controls your song, you may not be able to give BVS permission yourself. Playing it on BVS may have to wait until BVS has a licence or the society agrees.</li>
        <li>Your profile, services, presets and store distribution can continue.</li>
        <li>If your society gives written permission for BVS, send it to us and we can clear those songs.</li>
        <li>If you join a society later, update your answer in <Link href="/creator/studio/rights" className="text-brand underline">Studio</Link> so we can keep your music in the right place.</li>
      </ul>
      <p className="mt-8 text-xs text-text-secondary">This is general information, not legal advice. <Link href="/contact" className="text-brand underline">Contact BVS</Link> with questions.</p>
    </main>
  );
}
