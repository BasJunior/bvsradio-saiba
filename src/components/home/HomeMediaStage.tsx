import Link from "next/link";

type HomeMediaStageAction = {
  href: string;
  label: string;
  accent?: "listen" | "discover" | "feed" | "beats" | "studio" | "marketplace" | "shows";
};

type HomeMediaStageProps = {
  eyebrow: string;
  title: string;
  description?: string;
  src: string;
  poster?: string;
  actions?: HomeMediaStageAction[];
  live?: boolean;
};

export default function HomeMediaStage({
  eyebrow,
  title,
  description,
  src,
  poster,
  actions = [],
  live = false,
}: HomeMediaStageProps) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/35 shadow-[0_24px_80px_rgba(0,0,0,.32)]">
      <div className="relative aspect-video overflow-hidden bg-black">
        <video
          className="h-full w-full object-cover"
          src={src}
          poster={poster}
          autoPlay
          muted
          loop={!live}
          playsInline
          controls
          preload="metadata"
          aria-label={`${eyebrow}: ${title}`}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 sm:p-4">
          <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.18em] text-white backdrop-blur-md">
            {live ? "Live on BVS" : eyebrow}
          </span>
          {live ? (
            <span className="rounded-full bg-red-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-white shadow-lg">
              Live
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand sm:text-xs">
            {live ? "Now playing" : eyebrow}
          </p>
          <h1 className="mt-1.5 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary sm:text-base">
              {description}
            </p>
          ) : null}
        </div>

        {actions.length ? (
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {actions.map((action) => (
              <Link
                key={`${action.href}-${action.label}`}
                href={action.href}
                data-home-accent={action.accent}
                className="bvs-home-accent-button inline-flex min-h-11 items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold backdrop-blur-sm"
              >
                {action.label} →
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
