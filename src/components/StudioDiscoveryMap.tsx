"use client";

import type { StudioDiscoveryProfile } from "@/lib/studio-marketplace";
import { studioPriceLabel } from "@/lib/studio-marketplace";

type Props = {
  studios: StudioDiscoveryProfile[];
  selectedKey: string;
  onSelect: (providerKey: string) => void;
};

function positions(studios: StudioDiscoveryProfile[]) {
  const located = studios.filter((studio) => Number.isFinite(studio.latitude) && Number.isFinite(studio.longitude));
  if (!located.length) {
    return new Map(studios.map((studio, index) => [studio.providerKey, {
      x: 20 + ((index * 27) % 65),
      y: 22 + ((index * 31) % 58),
    }]));
  }
  const lats = located.map((studio) => Number(studio.latitude));
  const lngs = located.map((studio) => Number(studio.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.05);
  const lngSpan = Math.max(maxLng - minLng, 0.05);
  const map = new Map<string, { x: number; y: number }>();
  studios.forEach((studio, index) => {
    if (Number.isFinite(studio.latitude) && Number.isFinite(studio.longitude)) {
      const x = 12 + ((Number(studio.longitude) - minLng + (lngSpan - (maxLng - minLng)) / 2) / lngSpan) * 76;
      const y = 12 + (1 - (Number(studio.latitude) - minLat + (latSpan - (maxLat - minLat)) / 2) / latSpan) * 76;
      map.set(studio.providerKey, { x, y });
    } else {
      map.set(studio.providerKey, { x: 18 + ((index * 23) % 68), y: 18 + ((index * 29) % 66) });
    }
  });
  return map;
}

export default function StudioDiscoveryMap({ studios, selectedKey, onSelect }: Props) {
  const pinPositions = positions(studios);
  const selected = studios.find((studio) => studio.providerKey === selectedKey) || studios[0];

  return (
    <div className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1718] shadow-2xl shadow-black/20">
      <div className="absolute inset-0 opacity-50" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(38,181,145,.17),transparent_24%),radial-gradient(circle_at_82%_72%,rgba(220,190,92,.13),transparent_26%)]" />
        <svg viewBox="0 0 1000 700" className="h-full w-full" preserveAspectRatio="none">
          <path d="M-50 110 C180 180 220 45 470 130 S790 260 1050 155" fill="none" stroke="rgba(255,255,255,.10)" strokeWidth="18" />
          <path d="M80 760 C170 520 370 505 500 330 S720 130 970 -20" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="13" />
          <path d="M-50 525 C260 445 310 620 590 560 S840 390 1050 470" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="9" />
          <path d="M230 -30 C280 170 145 260 270 390 S420 610 360 730" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="7" />
          <path d="M660 -30 C610 180 775 245 680 410 S590 605 700 730" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="7" />
        </svg>
      </div>

      <div className="absolute left-5 top-5 z-10 rounded-full border border-white/10 bg-black/55 px-3 py-2 text-xs font-semibold backdrop-blur-xl">
        BVS city map · approximate discovery pins
      </div>

      {studios.map((studio) => {
        const pos = pinPositions.get(studio.providerKey) || { x: 50, y: 50 };
        const active = selected?.providerKey === studio.providerKey;
        return (
          <button
            key={studio.providerKey}
            type="button"
            onClick={() => onSelect(studio.providerKey)}
            className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-xs font-bold shadow-xl transition duration-200 ${active ? "scale-110 bg-brand text-black ring-4 ring-brand/20" : "bg-white text-black hover:scale-105"}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            aria-label={`Select ${studio.displayName}`}
          >
            {studioPriceLabel(studio.hourlyFromUsd)}
          </button>
        );
      })}

      {selected ? (
        <div className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl border border-white/10 bg-black/75 p-4 backdrop-blur-xl sm:left-auto sm:w-[340px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Selected studio</p>
              <h3 className="mt-1 text-lg font-semibold text-white">{selected.displayName}</h3>
              <p className="mt-1 text-xs text-white/60">{selected.locationLabel}</p>
            </div>
            <div className="text-right text-xs">
              {selected.rating ? <p className="font-semibold text-white">★ {selected.rating.toFixed(1)}</p> : <p className="text-white/60">New on BVS</p>}
              <p className="mt-1 text-brand">{studioPriceLabel(selected.hourlyFromUsd)}</p>
            </div>
          </div>
          {selected.locationPrecision !== "exact" ? <p className="mt-3 text-[11px] text-white/50">Pin is approximate for discovery; booking details stay with the provider.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
