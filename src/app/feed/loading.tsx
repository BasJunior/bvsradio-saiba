export default function FeedLoading() {
  return (
    <main className="bvs-app-page bvs-app-feed mx-auto min-h-screen max-w-4xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10" data-app-accent="feed" aria-busy="true" aria-label="Loading the Feed">
      <p className="text-[10px] font-semibold uppercase tracking-[.24em] text-white/45">BVS Pulse</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">What’s moving now.</h1>
      <div className="mt-8 space-y-3">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="flex gap-3 border-t border-white/10 py-4">
            <div className="bvs-app-skeleton h-16 w-16 shrink-0" />
            <div className="flex-1 space-y-2 pt-1"><div className="bvs-app-skeleton h-3.5 w-1/2" /><div className="bvs-app-skeleton h-3 w-1/3" /></div>
          </div>
        ))}
      </div>
    </main>
  );
}
