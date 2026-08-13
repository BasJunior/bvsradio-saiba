import Link from "next/link";
import BvsObjectCard from "@/components/flow/BvsObjectCard";
import type { BvsCardVariant, BvsObject } from "@/lib/bvs-object";

export default function AppRail({
  eyebrow,
  title,
  description,
  href,
  hrefLabel,
  objects,
  variant = "rail-card",
  scrollKey,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  objects: BvsObject[];
  variant?: BvsCardVariant;
  scrollKey: string;
}) {
  if (!objects.length) return null;
  const headingId = `${scrollKey}-title`;
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{eyebrow}</p>
          <h2 id={headingId} className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{description}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="shrink-0 text-sm text-brand hover:underline">
            {hrefLabel || "See all →"}
          </Link>
        ) : null}
      </div>
      <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" data-flow-scroll-key={scrollKey}>
        {objects.map((object) => (
          <div key={`${object.kind}:${object.id}`} className={`snap-start ${variant === "compact-row" ? "w-[min(86vw,22rem)] shrink-0" : variant === "feature-card" ? "w-[min(86vw,22rem)] shrink-0" : ""}`}>
            <BvsObjectCard object={object} variant={variant} />
          </div>
        ))}
      </div>
    </section>
  );
}
