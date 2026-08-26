"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  marketplaceStorefronts,
  type MarketplaceStorefront,
} from "@/lib/marketplace-storefronts";

type MarketplacePayload = {
  profiles?: Parameters<typeof marketplaceStorefronts>[0];
  listings?: Parameters<typeof marketplaceStorefronts>[1];
};
type Slot = { id: string; startsAt: string; endsAt: string; timezone: string };

function dateLabel(slot: Slot) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: slot.timezone || "Africa/Harare",
  }).format(new Date(slot.startsAt));
}

function timeLabel(slot: Slot) {
  const zone = slot.timezone || "Africa/Harare";
  const format = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zone });
  return `${format.format(new Date(slot.startsAt))}–${format.format(new Date(slot.endsAt))}`;
}

function usd(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function MarketplaceBookingPage() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const providerKey = String(params.slug || "");
  const serviceRef = search.get("service") || "";
  const packageRaw = search.get("package");
  const packageIndex = packageRaw == null ? undefined : Number(packageRaw);
  const [marketplace, setMarketplace] = useState<MarketplacePayload>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotState, setSlotState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/marketplace", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<MarketplacePayload> : Promise.reject(new Error("Marketplace unavailable")))
      .then(setMarketplace)
      .catch(() => null);
    fetch(`/api/marketplace/bookings?provider=${encodeURIComponent(providerKey)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Calendar unavailable");
        setSlots(payload.slots || []);
        setSlotState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setSlotState("unavailable");
      });
    return () => controller.abort();
  }, [providerKey]);

  const provider = useMemo<MarketplaceStorefront | null>(() => {
    return marketplaceStorefronts(marketplace.profiles || [], marketplace.listings || []).find((item) => item.slug === providerKey) || null;
  }, [marketplace, providerKey]);
  const service = provider?.services.find((item) => item.id === serviceRef) || null;
  const selectedPackage = service && packageIndex !== undefined && Number.isInteger(packageIndex) && packageIndex >= 0 ? service.packages?.[packageIndex] : undefined;

  const grouped = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = dateLabel(slot);
      groups.set(key, [...(groups.get(key) || []), slot]);
    }
    return [...groups.entries()];
  }, [slots]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!provider || !service || !selectedSlot) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerKey: provider.slug,
          serviceRef: service.id,
          packageIndex: selectedPackage ? packageIndex : undefined,
          slotId: selectedSlot,
          customerName: form.name,
          customerEmail: form.email,
          customerPhone: form.phone,
          projectNotes: form.notes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not request booking.");
      setComplete(true);
      setMessage(payload.message || "Booking request received.");
      setSlots((current) => current.filter((slot) => slot.id !== selectedSlot));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request booking.");
    } finally {
      setBusy(false);
    }
  }

  if (!provider || !service) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href={`/marketplace/${providerKey}`} className="text-sm text-brand">← Provider store</Link>
        <h1 className="mt-6 text-4xl font-semibold">Choose a bookable service</h1>
        <p className="mt-3 text-text-secondary">Open the provider store and choose a service that uses calendar booking.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/marketplace/${provider.slug}?service=${encodeURIComponent(service.id)}`} className="text-sm text-brand hover:underline">← {provider.name}</Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Book with {provider.name}</p>
          <h1 className="mt-2 text-balance text-4xl font-semibold sm:text-5xl">{selectedPackage ? `${service.title} — ${selectedPackage.name}` : service.title}</h1>
          <p className="mt-3 text-text-secondary">{service.description}</p>
          <p className="mt-4 text-2xl font-semibold text-brand">{selectedPackage ? usd(selectedPackage.priceUsd) : service.priceLabel || usd(service.priceUsd)}</p>

          <div className="mt-9">
            <h2 className="text-2xl font-semibold">Choose an available time</h2>
            <p className="mt-2 text-sm text-text-secondary">Only time slots published by the provider appear here. A selected slot is held atomically when your request is accepted by BVS.</p>

            {slotState === "loading" ? <div className="mt-5 h-28 animate-pulse rounded-2xl bg-white/[.04]" /> : null}
            {slotState === "unavailable" ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-5 text-sm text-text-secondary">
                Booking infrastructure is not active for this provider yet. You can still view the service, but BVS will not show invented availability.
              </div>
            ) : null}
            {slotState === "ready" && !slots.length ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-6 text-sm text-text-secondary">
                {provider.name} has not published any open booking times yet. Check back after the studio adds availability.
              </div>
            ) : null}

            <div className="mt-5 space-y-5">
              {grouped.map(([date, daySlots]) => (
                <div key={date}>
                  <p className="text-sm font-semibold">{date}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {daySlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlot(slot.id)}
                        aria-pressed={selectedSlot === slot.id}
                        className={selectedSlot === slot.id
                          ? "min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black"
                          : "min-h-11 rounded-full border border-white/15 px-4 text-sm hover:border-brand/50"}
                      >
                        {timeLabel(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-white/10 bg-white/[.025] p-5 lg:sticky lg:top-24">
          <h2 className="text-xl font-semibold">Booking request</h2>
          {complete ? (
            <div className="mt-4 rounded-xl border border-brand/30 bg-brand/[.05] p-4 text-sm">
              <p className="font-semibold text-brand">Request received</p>
              <p className="mt-2 text-text-secondary">{message}</p>
              <p className="mt-3 text-xs text-text-secondary">The session is not final until the provider confirms it.</p>
            </div>
          ) : (
            <form className="mt-4 space-y-3" onSubmit={submit}>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Your name" />
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Email" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Phone (optional)" />
              <textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Project notes, song details or session requirements" />
              <button disabled={!selectedSlot || busy || slotState !== "ready"} className="min-h-11 w-full rounded-full bg-brand px-5 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Requesting…" : "Request this time"}
              </button>
              {message ? <p className="text-xs text-text-secondary">{message}</p> : null}
            </form>
          )}
          <p className="mt-4 text-xs text-text-secondary">Price shown is the service starting/package price. Any scope changes must be agreed before the provider confirms the booking.</p>
        </aside>
      </div>
    </main>
  );
}
