"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type LaunchChecklist = {
  approvedStudioRole: boolean;
  location: boolean;
  gallery: boolean;
  package: boolean;
  availability: boolean;
  ready: boolean;
};

type MinePayload = {
  providerKey?: string;
  displayName?: string;
  profile?: Record<string, unknown> | null;
  launchChecklist?: LaunchChecklist;
  futureSlots?: Array<{ id: string; starts_at: string; ends_at: string; timezone: string }>;
  publishedServices?: number;
  error?: string;
};

const emptyChecklist: LaunchChecklist = {
  approvedStudioRole: true,
  location: false,
  gallery: false,
  package: false,
  availability: false,
  ready: false,
};

export default function StudioMarketplaceProfileDesk() {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [providerKey, setProviderKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checklist, setChecklist] = useState<LaunchChecklist>(emptyChecklist);
  const [publishedServices, setPublishedServices] = useState(0);
  const [futureSlotCount, setFutureSlotCount] = useState(0);
  const [form, setForm] = useState({
    city: "",
    country: "Zimbabwe",
    countryCode: "ZW",
    neighborhood: "",
    locationLabel: "",
    timezone: "Africa/Harare",
    amenities: "",
    genres: "",
    roomTypes: "Recording studio",
    capacity: "",
    hourlyFromUsd: "",
    latitude: "",
    longitude: "",
    locationPrecision: "neighborhood",
    gallery: "",
  });

  async function load(accessToken: string) {
    const response = await fetch("/api/marketplace/studios?scope=mine", {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 403) {
      setVisible(false);
      return;
    }
    const payload = await response.json().catch(() => ({})) as MinePayload;
    if (!response.ok) {
      setVisible(true);
      setMessage(payload.error || "Studio discovery profile is not ready.");
      return;
    }
    setVisible(true);
    setProviderKey(payload.providerKey || "");
    setChecklist(payload.launchChecklist || emptyChecklist);
    setPublishedServices(Number(payload.publishedServices) || 0);
    setFutureSlotCount(payload.futureSlots?.length || 0);
    const profile = payload.profile || {};
    setForm((current) => ({
      ...current,
      city: String(profile.city || ""),
      country: String(profile.country || current.country),
      countryCode: String(profile.country_code || current.countryCode),
      neighborhood: String(profile.neighborhood || ""),
      locationLabel: String(profile.location_label || ""),
      timezone: String(profile.timezone || current.timezone),
      amenities: Array.isArray(profile.amenities) ? profile.amenities.join(", ") : "",
      genres: Array.isArray(profile.genres) ? profile.genres.join(", ") : "",
      roomTypes: Array.isArray(profile.room_types) ? profile.room_types.join(", ") : current.roomTypes,
      capacity: profile.capacity == null ? "" : String(profile.capacity),
      hourlyFromUsd: profile.hourly_from_usd == null ? "" : String(profile.hourly_from_usd),
      latitude: profile.latitude == null ? "" : String(profile.latitude),
      longitude: profile.longitude == null ? "" : String(profile.longitude),
      locationPrecision: String(profile.location_precision || current.locationPrecision),
      gallery: Array.isArray(profile.gallery) ? profile.gallery.join("\n") : "",
    }));
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void createClient().auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || "";
      setToken(accessToken);
      if (accessToken) void load(accessToken);
    });
  }, []);

  function useCurrentLocation() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("This browser cannot provide a map pin. You can save the city without coordinates.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(5),
          longitude: position.coords.longitude.toFixed(5),
          locationPrecision: "neighborhood",
        }));
        setMessage("Approximate studio pin captured. BVS rounds public coordinates unless you explicitly publish an exact pin.");
      },
      () => setMessage("Location permission was not granted. City-only discovery still works."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/marketplace/studios", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "save_studio_profile",
          ...form,
          amenities: form.amenities.split(",").map((item) => item.trim()).filter(Boolean),
          genres: form.genres.split(",").map((item) => item.trim()).filter(Boolean),
          roomTypes: form.roomTypes.split(",").map((item) => item.trim()).filter(Boolean),
          gallery: form.gallery.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save studio discovery profile.");
      setMessage("Studio discovery profile saved. Complete the launch checklist to make the listing useful to bookers.");
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save studio discovery profile.");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !visible) return null;
  const field = "mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm";
  const checks = [
    ["Approved studio role", checklist.approvedStudioRole, "Editorial-approved Marketplace studio role"],
    ["Location", checklist.location, "City and country published"],
    ["Studio photos", checklist.gallery, "At least one HTTPS or BVS-hosted image"],
    ["Session package", checklist.package, `${publishedServices} published service${publishedServices === 1 ? "" : "s"}`],
    ["Future availability", checklist.availability, futureSlotCount ? `${futureSlotCount} upcoming slot${futureSlotCount === 1 ? "" : "s"} loaded` : "Publish a booking slot"],
  ] as const;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 p-6" aria-labelledby="studio-discovery-profile-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">BVS Studios discovery</p>
          <h2 id="studio-discovery-profile-title" className="mt-1 text-2xl font-semibold">Launch your studio listing</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">Your normal Marketplace service listings supply packages and prices. This profile supplies the location, photos and studio-specific discovery details.</p>
        </div>
        <div className="text-right">
          {providerKey ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">{providerKey}</span> : null}
          <p className={`mt-2 text-xs font-semibold ${checklist.ready ? "text-brand" : "text-text-secondary"}`}>{checklist.ready ? "Ready for BVS Studios" : "Launch checklist incomplete"}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {checks.map(([label, done, detail]) => (
          <div key={label} className={`rounded-xl border p-3 ${done ? "border-brand/30 bg-brand/[.04]" : "border-white/10 bg-white/[.02]"}`}>
            <p className={`text-sm font-semibold ${done ? "text-brand" : "text-white"}`}>{done ? "✓ " : "○ "}{label}</p>
            <p className="mt-1 text-[11px] text-text-secondary">{detail}</p>
          </div>
        ))}
      </div>

      {message ? <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-text-secondary">{message}</p> : null}
      <form onSubmit={submit} className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-text-secondary">City<input required className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Harare" /></label>
        <label className="text-xs text-text-secondary">Country<input required className={field} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Zimbabwe" /></label>
        <label className="text-xs text-text-secondary">Neighborhood / area<input className={field} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Madokero" /></label>
        <label className="text-xs text-text-secondary">Public location label<input className={field} value={form.locationLabel} onChange={(e) => setForm({ ...form, locationLabel: e.target.value })} placeholder="Madokero, Harare" /></label>
        <label className="text-xs text-text-secondary">Starting rate (USD)<input className={field} type="number" min="1" step=".01" value={form.hourlyFromUsd} onChange={(e) => setForm({ ...form, hourlyFromUsd: e.target.value })} placeholder="30" /></label>
        <label className="text-xs text-text-secondary">Room capacity<input className={field} type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="4" /></label>
        <label className="text-xs text-text-secondary">Amenities, comma separated<input className={field} value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="Vocal booth, parking, Wi-Fi" /></label>
        <label className="text-xs text-text-secondary">Room types<input className={field} value={form.roomTypes} onChange={(e) => setForm({ ...form, roomTypes: e.target.value })} placeholder="Recording studio, vocal booth" /></label>
        <label className="text-xs text-text-secondary">Genres / strengths<input className={field} value={form.genres} onChange={(e) => setForm({ ...form, genres: e.target.value })} placeholder="Afrobeats, Hip-hop, Gospel" /></label>
        <label className="text-xs text-text-secondary">Timezone<input className={field} value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Africa/Harare" /></label>

        <label className="text-xs text-text-secondary md:col-span-2">
          Studio gallery URLs
          <textarea className={field} rows={4} value={form.gallery} onChange={(e) => setForm({ ...form, gallery: e.target.value })} placeholder="https://…/control-room.jpg\nhttps://…/vocal-booth.jpg" />
          <span className="mt-1 block text-[11px]">One URL per line. HTTPS or BVS-hosted image paths only; up to 12 images.</span>
        </label>

        <div className="rounded-xl border border-white/10 p-4 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Discovery map pin</p><p className="mt-1 text-xs text-text-secondary">Optional. BVS can show a city-only pin, or capture your current location and round it for public discovery.</p></div><button type="button" onClick={useCurrentLocation} className="rounded-full border border-brand/40 px-4 py-2 text-xs font-semibold text-brand">Use current location</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><input className={field} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="Latitude" /><input className={field} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="Longitude" /><select className={field} value={form.locationPrecision} onChange={(e) => setForm({ ...form, locationPrecision: e.target.value })}><option value="city">City-level pin</option><option value="neighborhood">Approximate area</option><option value="exact">Publish exact pin</option></select></div>
        </div>
        <div className="md:col-span-2"><button disabled={busy} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Saving…" : "Save studio discovery profile"}</button></div>
      </form>
    </section>
  );
}
