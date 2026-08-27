"use client";

import { useMemo, useState } from "react";
import type { StudioDiscoveryProfile } from "@/lib/studio-marketplace";
import { studioPriceLabel } from "@/lib/studio-marketplace";

type Props = {
  studios: StudioDiscoveryProfile[];
  selectedKey: string;
  onSelect: (providerKey: string) => void;
};

type WorldPoint = { x: number; y: number };

function worldPoint(lat: number, lng: number, zoom: number): WorldPoint {
  const size = 256 * 2 ** zoom;
  const sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function fitZoom(studios: StudioDiscoveryProfile[]) {
  const located = studios.filter((studio) => Number.isFinite(studio.latitude) && Number.isFinite(studio.longitude));
  if (located.length <= 1) return 13;
  for (let zoom = 13; zoom >= 3; zoom -= 1) {
    const points = located.map((studio) => worldPoint(Number(studio.latitude), Number(studio.longitude), zoom));
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    if (Math.max(...xs) - Math.min(...xs) <= 520 && Math.max(...ys) - Math.min(...ys) <= 300) return zoom;
  }
  return 3;
}

function centreFor(studios: StudioDiscoveryProfile[], zoom: number) {
  const located = studios.filter((studio) => Number.isFinite(studio.latitude) && Number.isFinite(studio.longitude));
  if (!located.length) return worldPoint(-17.825, 31.033, zoom);
  const points = located.map((studio) => worldPoint(Number(studio.latitude), Number(studio.longitude), zoom));
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function tileUrl(x: number, y: number, zoom: number) {
  const count = 2 ** zoom;
  const wrappedX = ((x % count) + count) % count;
  if (y < 0 || y >= count) return "";
  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`;
}

export default function StudioDiscoveryMap({ studios, selectedKey, onSelect }: Props) {
  const autoZoom = useMemo(() => fitZoom(studios), [studios]);
  const [zoomOffset, setZoomOffset] = useState(0);
  const zoom = Math.max(3, Math.min(16, autoZoom + zoomOffset));
  const centre = useMemo(() => centreFor(studios, zoom), [studios, zoom]);
  const selected = studios.find((studio) => studio.providerKey === selectedKey) || studios[0];
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

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-brand/20 bg-[#070707] shadow-2xl shadow-black/30">
      <div className="absolute inset-0 bg-[#0b0b0a]" aria-hidden>
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute h-64 w-64 max-w-none select-none opacity-70 grayscale invert saturate-[.25] contrast-[1.12] brightness-[.5]"
            style={{ left: `calc(50% + ${tile.left}px)`, top: `calc(50% + ${tile.top}px)` }}
          />
        ))}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(212,175,55,.18),transparent_34%),radial-gradient(circle_at_80%_90%,rgba(255,255,255,.07),transparent_28%),linear-gradient(135deg,rgba(10,10,10,.2),rgba(10,10,10,.72))]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(212,175,55,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,.12)_1px,transparent_1px)] [background-size:44px_44px]" />
      </div>

      <div className="absolute left-4 top-4 z-30 rounded-full border border-brand/25 bg-black/75 px-3 py-2 text-[11px] font-semibold text-brand backdrop-blur-xl">
        BVS Studios · area map
      </div>
      <div className="absolute left-4 top-14 z-30 max-w-[250px] rounded-2xl border border-white/10 bg-black/70 px-3 py-2 text-[11px] leading-5 text-white/65 backdrop-blur-xl">
        Public pins show the booking area, not the studio door. Exact arrival details come after confirmation.
      </div>
      <div className="absolute right-4 top-4 z-30 flex overflow-hidden rounded-full border border-white/10 bg-black/70 backdrop-blur-xl">
        <button type="button" aria-label="Zoom out" onClick={() => setZoomOffset((value) => Math.max(-4, value - 1))} className="px-3 py-2 text-sm text-white/80 hover:bg-white/10">−</button>
        <button type="button" aria-label="Zoom in" onClick={() => setZoomOffset((value) => Math.min(3, value + 1))} className="border-l border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/10">+</button>
      </div>

      {studios.map((studio) => {
        if (!Number.isFinite(studio.latitude) || !Number.isFinite(studio.longitude)) return null;
        const point = worldPoint(Number(studio.latitude), Number(studio.longitude), zoom);
        const active = selected?.providerKey === studio.providerKey;
        return (
          <button
            key={studio.providerKey}
            type="button"
            onClick={() => onSelect(studio.providerKey)}
            className={`group absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full text-xs font-bold transition duration-200 ${active ? "scale-110" : "hover:scale-105"}`}
            style={{ left: `calc(50% + ${point.x - centre.x}px)`, top: `calc(50% + ${point.y - centre.y}px)` }}
            aria-label={`Select ${studio.displayName}`}
          >
            <span className={`absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border ${active ? "border-brand/40 bg-brand/15" : "border-white/15 bg-white/10"}`} aria-hidden />
            <span className={`relative flex min-h-9 items-center rounded-full border px-3 shadow-xl backdrop-blur ${active ? "border-brand bg-brand text-black shadow-brand/20" : "border-white/15 bg-black/80 text-white shadow-black/40"}`}>
              {studioPriceLabel(studio.hourlyFromUsd)}
            </span>
          </button>
        );
      })}

      {selected ? (
        <div className="absolute bottom-9 left-4 right-4 z-30 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-xl sm:left-auto sm:w-[340px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Selected studio</p>
              <h3 className="mt-1 text-lg font-semibold text-white">{selected.displayName}</h3>
              <p className="mt-1 text-xs text-white/60">{selected.locationLabel} · approximate area</p>
            </div>
            <div className="text-right text-xs">
              {selected.rating ? <p className="font-semibold text-white">★ {selected.rating.toFixed(1)}</p> : <p className="text-white/60">New on BVS</p>}
              <p className="mt-1 text-brand">{studioPriceLabel(selected.hourlyFromUsd)}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/50">Exact address and arrival instructions are handled after the provider accepts a booking.</p>
        </div>
      ) : null}

      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-2 left-3 z-30 rounded bg-black/60 px-2 py-1 text-[9px] text-white/60 backdrop-blur"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
