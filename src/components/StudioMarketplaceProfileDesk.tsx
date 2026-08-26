"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type MinePayload = {
  providerKey?: string;
  displayName?: string;
  profile?: Record<string, unknown> | null;
  error?: string;
};

export default function StudioMarketplaceProfileDesk() {
  const [token, setToken] = useState("");
  const [visible, setVisible] = useState(false);
  const [providerKey, setProviderKey] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
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
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save studio discovery profile.");
      setMessage("Studio discovery profile saved. It can now appear in BVS Studios while your Marketplace studio role remains approved.");
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save studio discovery profile.");
    } finally {
      setBusy(false);
    }
  }

  if (!token || !visible) return null;
  const field = "mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm";

  return (
    <section className="mt-8 rounded-2xl border border-white/10 p-6" aria-labelledby="studio-discovery-profile-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">BVS Studios discovery</p>
          <h2 id="studio-discovery-profile-title" className="mt-1 text-2xl font-semibold">Make your studio bookable by city</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">This powers “Book a studio session near you.” Packages still come from your normal service listings and times still come from your booking calendar.</p>
        </div>
        {providerKey ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">{providerKey}</span> : null}
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
        <div className="rounded-xl border border-white/10 p-4 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Discovery map pin</p><p className="mt-1 text-xs text-text-secondary">Optional. BVS can show a city-only pin, or capture your current location and round it for public discovery.</p></div><button type="button" onClick={useCurrentLocation} className="rounded-full border border-brand/40 px-4 py-2 text-xs font-semibold text-brand">Use current location</button></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><input className={field} value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="Latitude" /><input className={field} value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="Longitude" /><select className={field} value={form.locationPrecision} onChange={(e) => setForm({ ...form, locationPrecision: e.target.value })}><option value="city">City-level pin</option><option value="neighborhood">Approximate area</option><option value="exact">Publish exact pin</option></select></div>
        </div>
        <div className="md:col-span-2"><button disabled={busy} className="min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-40">{busy ? "Saving…" : "Save studio discovery profile"}</button></div>
      </form>
    </section>
  );
}
