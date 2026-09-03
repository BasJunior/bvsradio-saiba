"use client";

import { useMemo, useState } from "react";

type ProviderMapItem = {
  slug: string;
  name: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type WorldPoint = { x: number; y: number };

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

/** Approx coordinates for known physical provider areas (public area pins, not door addresses). */
function approxCoords(location: string): { lat: number; lng: number } | null {
  const value = location.toLowerCase();
  if (
    value.includes("madokero") ||
    (value.includes("harare") && !value.includes("zimbabwe")) ||
    value.includes("harare")
  ) {
    // Madokero / greater Harare area — booking-area pin, not a street door
    return { lat: -17.7845, lng: 30.9658 };
  }
  if (value.includes("bulawayo")) return { lat: -20.148, lng: 28.581 };
  if (value.includes("mutare")) return { lat: -18.9707, lng: 32.6709 };
  return null;
}

function worldPoint(lat: number, lng: number, zoom: number): WorldPoint {
  const size = 256 * 2 ** zoom;
  const sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function fitZoom(points: Array<{ lat: number; lng: number }>) {
  if (points.length <= 1) return 13;
  for (let zoom = 13; zoom >= 3; zoom -= 1) {
    const mapped = points.map((point) => worldPoint(point.lat, point.lng, zoom));
    const xs = mapped.map((point) => point.x);
    const ys = mapped.map((point) => point.y);
    if (Math.max(...xs) - Math.min(...xs) <= 520 && Math.max(...ys) - Math.min(...ys) <= 300) {
      return zoom;
    }
  }
  return 3;
}

function centreFor(points: Array<{ lat: number; lng: number }>, zoom: number) {
  if (!points.length) return worldPoint(-17.825, 31.033, zoom);
  const mapped = points.map((point) => worldPoint(point.lat, point.lng, zoom));
  return {
    x: mapped.reduce((sum, point) => sum + point.x, 0) / mapped.length,
    y: mapped.reduce((sum, point) => sum + point.y, 0) / mapped.length,
  };
}

function tileUrl(x: number, y: number, zoom: number) {
  const count = 2 ** zoom;
  const wrappedX = ((x % count) + count) % count;
  if (y < 0 || y >= count) return "";
  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
}

type ResolvedProvider = ProviderMapItem & {
  locationLabel: string;
  lat: number;
  lng: number;
};

export default function MarketplaceProviderMap({
  providers,
  compact = false,
}: {
  providers: ProviderMapItem[];
  compact?: boolean;
}) {
  const mapped = useMemo(() => {
    const resolved: ResolvedProvider[] = [];
    for (const provider of providers) {
      const locationLabel = physicalLocation(provider.location);
      if (!locationLabel) continue;
      const explicitLat = Number(provider.latitude);
      const explicitLng = Number(provider.longitude);
      const coords =
        Number.isFinite(explicitLat) && Number.isFinite(explicitLng)
          ? { lat: explicitLat, lng: explicitLng }
          : approxCoords(locationLabel);
      if (!coords) continue;
      resolved.push({
        ...provider,
        locationLabel,
        lat: coords.lat,
        lng: coords.lng,
      });
    }
    return resolved;
  }, [providers]);

  const [selectedSlug, setSelectedSlug] = useState(mapped[0]?.slug || "");
  const [zoomOffset, setZoomOffset] = useState(0);

  if (!mapped.length) return null;

  const selected = mapped.find((provider) => provider.slug === selectedSlug) || mapped[0];
  const points = mapped.map((provider) => ({ lat: provider.lat, lng: provider.lng }));
  const autoZoom = fitZoom(points);
  const zoom = Math.max(3, Math.min(16, autoZoom + zoomOffset));
  const centre = centreFor(points, zoom);
  const centreTileX = Math.floor(centre.x / 256);
  const centreTileY = Math.floor(centre.y / 256);
  const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];

  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = centreTileX + dx;
      const y = centreTileY + dy;
      const src = tileUrl(x, y, zoom);
      if (!src) continue;
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        src,
        left: x * 256 - centre.x,
        top: y * 256 - centre.y,
      });
    }
  }

  const query = mapQuery(selected.locationLabel);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  const mapHeight = compact ? "min-h-[280px] h-72" : "min-h-[360px] h-80 sm:h-[28rem]";

  return (
    <section
      className={
        compact
          ? "overflow-hidden rounded-2xl border border-brand/20 bg-[#070707] shadow-2xl shadow-black/30"
          : "mt-8 overflow-hidden rounded-[1.65rem] border border-brand/20 bg-[#070707] shadow-2xl shadow-black/30 sm:mt-10 sm:rounded-3xl"
      }
      aria-label="Marketplace provider map"
    >
      <div className={compact ? "p-4" : "p-5 sm:p-6"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
              Provider map
            </p>
            <h2
              className={
                compact
                  ? "mt-1 text-lg font-semibold text-white"
                  : "mt-1 text-2xl font-semibold text-white"
              }
            >
              {compact ? selected.name : "Find physical BVS providers"}
            </h2>
            <p className="mt-1 text-sm text-white/65">
              {selected.locationLabel} · approximate area
            </p>
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
                    : "min-h-10 rounded-full border border-white/15 px-4 text-xs text-white/70 hover:border-brand/40 hover:text-white"
                }
              >
                {provider.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`relative overflow-hidden ${mapHeight}`}>
        <div className="absolute inset-0 bg-[#0b0b0a]" aria-hidden>
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute h-64 w-64 max-w-none select-none opacity-70 grayscale invert saturate-[.25] contrast-[1.12] brightness-[.5] transition-opacity duration-500"
              style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
            />
          ))}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(212,175,55,.18),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(255,255,255,.07),transparent_28%),linear-gradient(135deg,rgba(10,10,10,.2),rgba(10,10,10,.72))]" />
          <div className="bvs-provider-map-grid absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(212,175,55,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,.12)_1px,transparent_1px)] [background-size:44px_44px]" />
        </div>

        <div className="absolute left-4 top-4 z-30 rounded-full border border-brand/25 bg-black/75 px-3 py-2 text-[11px] font-semibold text-brand backdrop-blur-xl">
          BVS · area map
        </div>
        {!compact ? (
          <div className="absolute left-4 top-14 z-30 max-w-[250px] rounded-2xl border border-white/10 bg-black/70 px-3 py-2 text-[11px] leading-5 text-white/65 backdrop-blur-xl">
            Public pins show the booking area, not the studio door. Exact arrival details come after
            confirmation.
          </div>
        ) : null}
        <div className="absolute right-4 top-4 z-30 flex overflow-hidden rounded-full border border-white/10 bg-black/70 backdrop-blur-xl">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoomOffset((value) => Math.max(-4, value - 1))}
            className="px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            −
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoomOffset((value) => Math.min(3, value + 1))}
            className="border-l border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            +
          </button>
        </div>

        {mapped.map((provider) => {
          const point = worldPoint(provider.lat, provider.lng, zoom);
          const active = selected.slug === provider.slug;
          return (
            <button
              key={provider.slug}
              type="button"
              onClick={() => setSelectedSlug(provider.slug)}
              className={`group absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full text-xs font-bold transition duration-200 ${active ? "scale-110" : "hover:scale-105"}`}
              style={{
                left: `calc(50% + ${point.x - centre.x}px)`,
                top: `calc(50% + ${point.y - centre.y}px)`,
              }}
              aria-label={`Select ${provider.name}`}
            >
              <span
                className={`absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border ${active ? "border-brand/40 bg-brand/15 animate-pulse" : "border-white/15 bg-white/10"}`}
                aria-hidden
              />
              <span
                className={`relative flex min-h-9 max-w-[180px] items-center truncate rounded-full border px-3 shadow-xl backdrop-blur ${active ? "border-brand bg-brand text-black shadow-brand/20" : "border-white/15 bg-black/80 text-white shadow-black/40"}`}
              >
                {provider.name}
              </span>
            </button>
          );
        })}

        <div className="absolute bottom-9 left-4 right-4 z-30 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl sm:left-auto sm:right-4 sm:w-[340px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">
                Selected provider
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">{selected.name}</h3>
              <p className="mt-1 text-xs text-white/60">
                {selected.locationLabel} · approximate area
              </p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/50">
            Exact address and arrival instructions are handled after the provider accepts a booking.
          </p>
        </div>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-2 left-3 z-30 rounded bg-black/60 px-2 py-1 text-[9px] text-white/60 backdrop-blur"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </section>
  );
}
