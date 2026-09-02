"use client";

import { useMemo, useState } from "react";

type ProviderMapItem = {
  slug: string;
  name: string;
  location?: string;
};

function physicalLocation(location?: string) {
  const value = String(location || "").trim();
  if (!value) return "";
  if (/\b(remote|online|virtual|worldwide|global)\b/i.test(value)) return "";
  return value;
}

function mapQuery(location: string) {
  if (/\bharare\b/i.test(location) && !/\bzimbabwe\b/i.test(location)) {
    return `${location}, Zimbabwe`;
  }
  return location;
}

export default function MarketplaceProviderMap({
  providers,
  compact = false,
}: {
  providers: ProviderMapItem[];
  compact?: boolean;
}) {
  const mapped = useMemo(
    () => providers.filter((provider) => physicalLocation(provider.location)),
    [providers],
  );
  const [selectedSlug, setSelectedSlug] = useState(mapped[0]?.slug || "");

  if (!mapped.length) return null;

  const selected =
    mapped.find((provider) => provider.slug === selectedSlug) || mapped[0];
  const location = physicalLocation(selected.location);
  const query = mapQuery(location);
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

  return (
    <section
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]"
          : "mt-8 overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/[.025] sm:mt-10 sm:rounded-3xl"
      }
      aria-label="Marketplace provider map"
    >
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
              Provider map
            </p>
            <h2 className={compact ? "mt-1 text-lg font-semibold" : "mt-1 text-2xl font-semibold"}>
              {compact ? selected.name : "Find physical BVS providers"}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">{location}</p>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center rounded-full border border-brand/40 px-4 text-xs font-semibold text-brand"
          >
            Open in Maps ↗
          </a>
        </div>

        {!compact && mapped.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Choose provider on map">
            {mapped.map((provider) => (
              <button
                key={provider.slug}
                type="button"
                onClick={() => setSelectedSlug(provider.slug)}
                className={
                  provider.slug === selected.slug
                    ? "min-h-10 rounded-full bg-brand px-4 text-xs font-semibold text-black"
                    : "min-h-10 rounded-full border border-white/15 px-4 text-xs text-text-secondary hover:border-brand/40 hover:text-white"
                }
              >
                {provider.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <iframe
        key={query}
        title={`${selected.name} map`}
        src={embedUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={compact ? "h-56 w-full border-0" : "h-72 w-full border-0 sm:h-80"}
      />
    </section>
  );
}
