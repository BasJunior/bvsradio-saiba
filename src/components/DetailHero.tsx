/* eslint-disable @next/next/no-img-element -- artwork comes from signed media redirects */
import type { ReactNode } from "react";

/**
 * Shared header for song, album, beat and show pages on the app and the web:
 * a softly blurred copy of the cover behind a large square cover, then the
 * title, a linked subtitle, small facts and the page's actions.
 */
export default function DetailHero({
  image,
  imageAlt,
  eyebrow,
  title,
  subtitle,
  facts = [],
  actions,
  fallback = "BVS",
}: {
  image?: string | null;
  imageAlt: string;
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  facts?: Array<string | null | undefined | false>;
  actions?: ReactNode;
  fallback?: string;
}) {
  const shown = facts.filter(Boolean) as string[];
  return (
    <section className="bvs-detail-hero" aria-labelledby="detail-title">
      {image ? <div className="bvs-detail-ambient" aria-hidden="true" style={{ backgroundImage: `url("${image.replaceAll('"', "")}")` }} /> : null}
      <div className="bvs-detail-hero-inner">
        <div className="bvs-detail-cover">
          {image ? <img src={image} alt={imageAlt} /> : <span aria-hidden="true">{fallback}</span>}
        </div>
        <div className="bvs-detail-copy">
          <p className="bvs-app-eyebrow">{eyebrow}</p>
          <h1 id="detail-title">{title}</h1>
          {subtitle ? <div className="bvs-detail-subtitle">{subtitle}</div> : null}
          {shown.length ? <p className="bvs-detail-facts">{shown.join(" · ")}</p> : null}
          {actions ? <div className="bvs-detail-actions">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

/** A titled section under a detail header, on the same hairline as app shelves. */
export function DetailSection({ title, action, children, id }: { title: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="bvs-app-shelf" aria-labelledby={id}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="bvs-app-shelf-title">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
