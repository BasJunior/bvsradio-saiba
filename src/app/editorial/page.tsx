import Link from 'next/link'

export default function EditorialHome() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-xs uppercase tracking-[.22em] text-brand">BVS operations</p>
      <h1 className="mt-2 text-4xl font-semibold">Editorial home</h1>
      <p className="mt-4 text-text-secondary">
        Search Command (top of every staff page) opens the exact work object. Use the queue list only when you need the
        full table.
      </p>
      <div className="mt-8 grid gap-3">
        <Link href="/editorial/queues" className="rounded-2xl border border-white/15 p-5 hover:border-brand">
          <p className="font-semibold">Queue lists</p>
          <p className="mt-1 text-sm text-text-secondary">Tracks, beats, releases, names, wallet — the classic table.</p>
        </Link>
        <Link href="/editorial/finance" className="rounded-2xl border border-white/15 p-5 hover:border-brand">
          <p className="font-semibold">Finance</p>
          <p className="mt-1 text-sm text-text-secondary">Ledger, refunds, processor fees.</p>
        </Link>
        <Link href="/editorial/marketplace" className="rounded-2xl border border-white/15 p-5 hover:border-brand">
          <p className="font-semibold">Marketplace review</p>
          <p className="mt-1 text-sm text-text-secondary">Service and product listings.</p>
        </Link>
      </div>
    </main>
  )
}
