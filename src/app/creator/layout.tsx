export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-bvs-surface="creator-workspace" className="relative min-h-screen overflow-hidden bg-bg-primary">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] opacity-70"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(212,175,55,.12), transparent 30%), radial-gradient(circle at 82% 8%, rgba(255,255,255,.035), transparent 24%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
