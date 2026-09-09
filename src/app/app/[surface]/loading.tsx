export default function AppSurfaceLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8" aria-label="Opening BVS">
      <section className="rounded-[2.2rem] border border-white/[.08] bg-[#111113]/72 px-5 py-7 sm:px-9 sm:py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Best Virtual Sound</p>
        <div className="mt-5 h-12 w-4/5 animate-pulse rounded-2xl bg-white/[.05]" />
        <div className="mt-4 h-5 w-3/5 animate-pulse rounded-full bg-white/[.035]" />
      </section>
      <div className="mt-5 h-32 animate-pulse rounded-[1.8rem] bg-white/[.03]" />
    </div>
  );
}
