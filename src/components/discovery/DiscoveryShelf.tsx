import type { ReactNode } from "react";

export default function DiscoveryShelf({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs uppercase tracking-[0.2em] text-brand">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="bvs-discovery-shelf mt-5 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
        {children}
      </div>
    </section>
  );
}
