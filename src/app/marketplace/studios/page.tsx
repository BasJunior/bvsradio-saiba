"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StudioDiscoveryMap from "@/components/StudioDiscoveryMap";
import { marketplaceStorefronts, type MarketplaceStorefront } from "@/lib/marketplace-storefronts";
import {
  haversineKm,
  studioPriceLabel,
  studioSlotMatches,
  studioSlotMinutes,
  type StudioAvailabilitySlot,
  type StudioDiscoveryProfile,
} from "@/lib/studio-marketplace";

type MarketplacePayload = {
  profiles?: Parameters<typeof marketplaceStorefronts>[0];
  listings?: Parameters<typeof marketplaceStorefronts>[1];
};
type StudioPayload = {
  studios?: StudioDiscoveryProfile[];
  cities?: Array<{ city: string; country: string; count: number }>;
};
type StudioCard = { studio: StudioDiscoveryProfile; provider: MarketplaceStorefront; distanceKm: number | null };

function nextSlotLabel(value?: string | null) {
  if (!value) return "No published availability yet";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "View availability";
  return `Next slot ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)}`;
}

function matchingSlot(studio: StudioDiscoveryProfile, date: string, minutes: number) {
  return (studio.availableSlots || []).find((slot) => studioSlotMatches(slot, date, minutes)) || null;
}

function slotLabel(slot: StudioAvailabilitySlot | null) {
  if (!slot) return "";
  const start = new Date(slot.startsAt);
  if (!Number.isFinite(start.getTime())) return "";
  const length = studioSlotMinutes(slot);
  return `Available ${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: slot.timezone || "UTC" }).format(start)}${length ? ` · ${Math.round(length / 60 * 10) / 10}h slot` : ""}`;
}

export default function StudioMarketplacePage() {
  const [marketplace, setMarketplace] = useState<MarketplacePayload>({});
  const [studioPayload, setStudioPayload] = useState<StudioPayload>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [cityQuery, setCityQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateQuery, setDateQuery] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [mobileMode, setMobileMode] = useState<"list" | "map">("list");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/marketplace", { cache: "no-store", signal: controller.signal }).then((r) => r.ok ? r.json() : {}),
      fetch("/api/marketplace/studios", { cache: "no-store", signal: controller.signal }).then((r) => r.ok ? r.json() : Promise.reject(new Error("Studio discovery unavailable"))),
    ])
      .then(([marketplaceData, studioData]) => {
        setMarketplace(marketplaceData);
        setStudioPayload(studioData);
        const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const requestedCity = params?.get("city") || "";
        const requestedDate = params?.get("date") || "";
        const requestedMinutes = Number(params?.get("duration") || 0);
        const firstCity = requestedCity || studioData.cities?.[0]?.city || studioData.studios?.[0]?.city || "";
        setCityQuery(requestedCity);
        setSelectedCity(firstCity);
        setDateQuery(/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : "");
        setSessionMinutes([60, 90, 120, 180, 240].includes(requestedMinutes) ? requestedMinutes : 0);
        setSelectedKey((current) => current || studioData.studios?.[0]?.providerKey || "");
        setState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, []);

  const storefronts = useMemo(
    () => marketplaceStorefronts(marketplace.profiles || [], marketplace.listings || []),
    [marketplace],
  );

  const cards = useMemo<StudioCard[]>(() => {
    const result: StudioCard[] = [];
    for (const studio of studioPayload.studios || []) {
      const provider = storefronts.find((item) => item.slug === studio.providerKey);
      if (!provider) continue;
      const servicePrices = provider.services
        .filter((service) => service.bookingMode === "calendar" && service.priceUsd > 0)
        .map((service) => service.priceUsd);
      const lowest = servicePrices.length ? Math.min(...servicePrices) : null;
      const enrichedStudio: StudioDiscoveryProfile = {
        ...studio,
        hourlyFromUsd: lowest ?? studio.hourlyFromUsd ?? null,
      };
      const distanceKm = geo && Number.isFinite(enrichedStudio.latitude) && Number.isFinite(enrichedStudio.longitude)
        ? haversineKm(geo.lat, geo.lng, Number(enrichedStudio.latitude), Number(enrichedStudio.longitude))
        : null;
      result.push({ studio: enrichedStudio, provider, distanceKm });
    }
    return result;
  }, [studioPayload.studios, storefronts, geo]);

  const filtered = useMemo(() => {
    const cityNeedle = (selectedCity || cityQuery).trim().toLowerCase();
    return cards
      .filter(({ studio }) => !cityNeedle || studio.city.toLowerCase().includes(cityNeedle) || studio.country.toLowerCase().includes(cityNeedle) || studio.neighborhood?.toLowerCase().includes(cityNeedle))
      .filter(({ provider }) => serviceFilter === "all" || provider.services.some((service) => `${service.title} ${service.category}`.toLowerCase().includes(serviceFilter)))
      .filter(({ studio }) => (!dateQuery && !sessionMinutes) || Boolean(matchingSlot(studio, dateQuery, sessionMinutes)))
      .sort((a, b) => {
        if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
        if (a.studio.verified !== b.studio.verified) return a.studio.verified ? -1 : 1;
        return (b.studio.rating || 0) - (a.studio.rating || 0);
      });
  }, [cards, selectedCity, cityQuery, serviceFilter, dateQuery, sessionMinutes]);

  useEffect(() => {
    if (filtered.length && !filtered.some((item) => item.studio.providerKey === selectedKey)) {
      setSelectedKey(filtered[0].studio.providerKey);
    }
  }, [filtered, selectedKey]);

  function selectFromMap(providerKey: string) {
    setSelectedKey(providerKey);
    setMobileMode("list");
    requestAnimationFrame(() => {
      document.getElementById(`studio-card-${providerKey}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function useMyLocation() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Location is not available on this device. Choose a city instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setGeo(next);
        const located = cards
          .filter(({ studio }) => Number.isFinite(studio.latitude) && Number.isFinite(studio.longitude))
          .map((item) => ({ ...item, km: haversineKm(next.lat, next.lng, Number(item.studio.latitude), Number(item.studio.longitude)) }))
          .sort((a, b) => a.km - b.km);
        if (located[0]) {
          setSelectedCity(located[0].studio.city);
          setCityQuery(located[0].studio.city);
          setSelectedKey(located[0].studio.providerKey);
          setLocationMessage(`Showing the closest BVS studio area: ${located[0].studio.city}. Public distances use approximate discovery pins.`);
        } else {
          setLocationMessage("Location found. Studio distance will appear when providers publish map pins.");
        }
      },
      () => setLocationMessage("Location permission was not granted. You can still search by city."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  const cityCount = filtered.length;
  const activeCity = selectedCity || cityQuery || "your area";
  const availabilityFiltered = Boolean(dateQuery || sessionMinutes);

  return (
    <main className="mx-auto max-w-[1500px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_20%_10%,rgba(38,181,145,.15),transparent_32%),linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.015))] p-6 sm:p-9">
        <div className="max-w-4xl">
          <Link href="/marketplace" className="text-sm text-brand hover:underline">← Services Marketplace</Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[.22em] text-brand">BVS Studios</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold sm:text-5xl lg:text-6xl">Book a studio session near you.</h1>
          <p className="mt-4 max-w-3xl text-base text-text-secondary sm:text-lg">Search real BVS studio availability by city, date and session length. Public map pins show the studio area for discovery; exact arrival details stay inside confirmed bookings.</p>
        </div>

        <div className="mt-7 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 md:grid-cols-[minmax(0,1.35fr)_minmax(150px,.7fr)_minmax(150px,.7fr)_auto]">
          <label className="flex items-center gap-3 rounded-xl bg-white/[.04] px-4">
            <span aria-hidden>⌖</span>
            <input value={cityQuery} onChange={(event) => { setCityQuery(event.target.value); setSelectedCity(""); }} placeholder="Harare, Bulawayo, Johannesburg…" className="min-h-12 w-full bg-transparent text-sm outline-none placeholder:text-white/35" />
          </label>
          <label className="rounded-xl bg-white/[.04] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-white/45">Date<input type="date" value={dateQuery} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDateQuery(event.target.value)} className="mt-1 block min-h-7 w-full bg-transparent text-sm normal-case tracking-normal text-white outline-none" /></label>
          <label className="rounded-xl bg-white/[.04] px-3 py-2 text-[10px] uppercase tracking-[.12em] text-white/45">Session length<select value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))} className="mt-1 block min-h-7 w-full bg-transparent text-sm normal-case tracking-normal text-white outline-none"><option value={0}>Any length</option><option value={60}>1 hour+</option><option value={90}>1.5 hours+</option><option value={120}>2 hours+</option><option value={180}>3 hours+</option><option value={240}>4 hours+</option></select></label>
          <button type="button" onClick={useMyLocation} className="min-h-12 rounded-xl bg-brand px-5 text-sm font-semibold text-black">Near me</button>
        </div>
        {locationMessage ? <p className="mt-3 text-xs text-text-secondary">{locationMessage}</p> : null}

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {(studioPayload.cities || []).map((city) => <button key={`${city.city}-${city.country}`} type="button" onClick={() => { setSelectedCity(city.city); setCityQuery(city.city); }} className={`shrink-0 rounded-full border px-4 py-2 text-sm ${selectedCity === city.city ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary hover:border-white/25"}`}>{city.city} · {city.count}</button>)}
          {availabilityFiltered ? <button type="button" onClick={() => { setDateQuery(""); setSessionMinutes(0); }} className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm text-text-secondary hover:text-white">Clear availability filters</button> : null}
        </div>
      </section>

      <section className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Studio discovery</p><h2 className="mt-1 text-2xl font-semibold sm:text-3xl">{cityCount} {cityCount === 1 ? "BVS studio" : "BVS studios"} {availabilityFiltered ? "available" : "listed"} in {activeCity}</h2>{availabilityFiltered ? <p className="mt-1 text-xs text-text-secondary">Only studios with a published slot matching your date/length are shown.</p> : null}</div>
        <div className="flex flex-wrap gap-2">{[["all", "All sessions"],["record", "Recording"],["mix", "Mixing"],["master", "Mastering"],["production", "Production"]].map(([value, label]) => <button key={value} type="button" onClick={() => setServiceFilter(value)} className={`rounded-full border px-3 py-2 text-xs ${serviceFilter === value ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary"}`}>{label}</button>)}</div>
      </section>

      <div className="mt-5 flex rounded-full border border-white/10 p-1 lg:hidden"><button type="button" onClick={() => setMobileMode("list")} className={`flex-1 rounded-full py-2 text-sm ${mobileMode === "list" ? "bg-white/10" : "text-text-secondary"}`}>List</button><button type="button" onClick={() => setMobileMode("map")} className={`flex-1 rounded-full py-2 text-sm ${mobileMode === "map" ? "bg-white/10" : "text-text-secondary"}`}>Map</button></div>

      {state === "loading" ? <div className="mt-6 h-80 animate-pulse rounded-[2rem] bg-white/[.035]" /> : null}
      {state === "error" ? <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-5 text-sm text-text-secondary">Studio discovery could not load. The general Services Marketplace remains available.</div> : null}

      {state === "ready" ? <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,760px)_minmax(420px,1fr)]">
        <div className={mobileMode === "map" ? "hidden lg:block" : "space-y-4"}>
          {!filtered.length ? <div className="rounded-[2rem] border border-dashed border-white/15 p-10 text-center"><h3 className="text-xl font-semibold">No published BVS studio matches this search yet.</h3><p className="mt-2 text-sm text-text-secondary">Try another date, a shorter session, another city, or clear filters. BVS never invents studio availability or ratings.</p></div> : null}
          {filtered.map(({ studio, provider, distanceKm }) => {
            const image = studio.gallery[0] || provider.heroImage;
            const slot = matchingSlot(studio, dateQuery, sessionMinutes);
            const detailParams = new URLSearchParams();
            if (dateQuery) detailParams.set("date", dateQuery);
            if (sessionMinutes) detailParams.set("duration", String(sessionMinutes));
            const detailHref = `/marketplace/studios/${studio.providerKey}${detailParams.size ? `?${detailParams.toString()}` : ""}`;
            return <article id={`studio-card-${studio.providerKey}`} key={studio.providerKey} onMouseEnter={() => setSelectedKey(studio.providerKey)} onClick={() => setSelectedKey(studio.providerKey)} className={`group scroll-mt-24 overflow-hidden rounded-[1.75rem] border bg-white/[.025] transition ${selectedKey === studio.providerKey ? "border-brand/50 shadow-xl shadow-brand/5" : "border-white/10 hover:border-white/20"}`}>
              <div className="grid sm:grid-cols-[240px_minmax(0,1fr)]">
                <Link href={detailHref} className="relative block min-h-52 overflow-hidden bg-black/30">{image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:bg-gradient-to-r" />{studio.verified ? <span className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-black">BVS verified</span> : null}{studio.gallery.length > 1 ? <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white backdrop-blur">{studio.gallery.length} photos</span> : null}</Link>
                <div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-text-secondary">{studio.locationLabel}{distanceKm != null ? ` · approx. ${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km away` : ""}</p><Link href={detailHref} className="mt-1 block text-2xl font-semibold hover:text-brand">{studio.displayName}</Link></div><div className="text-right">{studio.rating ? <p className="font-semibold">★ {studio.rating.toFixed(1)} <span className="text-xs font-normal text-text-secondary">({studio.reviewCount})</span></p> : <p className="text-xs text-text-secondary">New on BVS</p>}<p className="mt-1 text-sm font-semibold text-brand">{studioPriceLabel(studio.hourlyFromUsd)}</p></div></div>
                  <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{provider.headline}</p><div className="mt-4 flex flex-wrap gap-2">{provider.services.filter((service) => service.bookingMode === "calendar").slice(0, 3).map((service) => <span key={service.id} className="rounded-full bg-white/5 px-3 py-1 text-xs text-text-secondary">{service.title}</span>)}</div><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className={`text-xs ${slot ? "font-semibold text-brand" : "text-text-secondary"}`}>{slot ? slotLabel(slot) : nextSlotLabel(studio.nextAvailableAt)}</span><Link href={detailHref} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">View studio</Link></div>
                </div>
              </div>
            </article>;
          })}
        </div>
        <aside className={`${mobileMode === "list" ? "hidden lg:block" : "block"} h-fit lg:sticky lg:top-24`}><StudioDiscoveryMap studios={filtered.map((item) => item.studio)} selectedKey={selectedKey} onSelect={selectFromMap} /></aside>
      </div> : null}
    </main>
  );
}
