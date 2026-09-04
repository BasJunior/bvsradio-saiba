"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { marketplaceStorefronts, type MarketplaceStorefront, type StorefrontService } from "@/lib/marketplace-storefronts";
import { shareBvs } from "@/lib/app-native";

type MarketplacePayload = {
  profiles?: Parameters<typeof marketplaceStorefronts>[0];
  listings?: Parameters<typeof marketplaceStorefronts>[1];
};

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
};

type BookingForm = {
  name: string;
  email: string;
  phone: string;
  notes: string;
};

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
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: zone,
  });
  return `${formatter.format(new Date(slot.startsAt))}–${formatter.format(new Date(slot.endsAt))}`;
}

function servicePrice(service: StorefrontService) {
  return service.priceLabel || `$${Number(service.priceUsd || 0).toFixed(2)}`;
}

export default function AppMarketplaceClient({
  surface,
  initialProvider = "",
  initialService = "",
  initialBook = false,
}: {
  surface: AppSurface;
  initialProvider?: string;
  initialService?: string;
  initialBook?: boolean;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<MarketplacePayload>({});
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [showBooking, setShowBooking] = useState(initialBook);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotState, setSlotState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [form, setForm] = useState<BookingForm>({ name: "", email: "", phone: "", notes: "" });
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/marketplace", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Marketplace unavailable");
        return response.json() as Promise<MarketplacePayload>;
      })
      .then((next) => {
        setPayload(next);
        setState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, []);

  const providers = useMemo(() => marketplaceStorefronts(payload.profiles || [], payload.listings || []), [payload]);
  const provider = useMemo<MarketplaceStorefront | null>(() => {
    if (!initialProvider) return null;
    return providers.find((item) => item.slug === initialProvider) || null;
  }, [initialProvider, providers]);
  const service = useMemo(() => provider?.services.find((item) => item.id === initialService) || null, [initialService, provider]);

  useEffect(() => {
    setShowBooking(initialBook);
    setSelectedSlot("");
    setBookingMessage("");
  }, [initialBook, initialProvider, initialService]);

  useEffect(() => {
    if (!showBooking || !provider || !service || service.bookingMode !== "calendar") return;
    const controller = new AbortController();
    setSlotState("loading");
    setSlots([]);
    fetch(`/api/marketplace/bookings?provider=${encodeURIComponent(provider.slug)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const next = await response.json().catch(() => ({})) as { slots?: Slot[]; error?: string };
        if (!response.ok) throw new Error(next.error || "Availability could not load.");
        setSlots(next.slots || []);
        setSlotState("ready");
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") setSlotState("error");
      });
    return () => controller.abort();
  }, [provider, service, showBooking]);

  const groupedSlots = useMemo(() => {
    const grouped = new Map<string, Slot[]>();
    for (const slot of slots) {
      const label = dateLabel(slot);
      grouped.set(label, [...(grouped.get(label) || []), slot]);
    }
    return [...grouped.entries()];
  }, [slots]);

  const base = `/app/${surface}/marketplace`;
  const openProvider = (slug: string) => router.push(`${base}?provider=${encodeURIComponent(slug)}`);
  const openService = (providerSlug: string, serviceId: string, book = false) => {
    const params = new URLSearchParams({ provider: providerSlug, service: serviceId });
    if (book) params.set("book", "1");
    router.push(`${base}?${params.toString()}`);
  };

  async function shareWebStore(selectedProvider: MarketplaceStorefront, selectedService?: StorefrontService) {
    const url = `https://bvsradio.com/marketplace/${encodeURIComponent(selectedProvider.slug)}${selectedService ? `?service=${encodeURIComponent(selectedService.id)}` : ""}`;
    const ok = await shareBvs({
      title: selectedService ? `${selectedService.title} · ${selectedProvider.name}` : selectedProvider.name,
      text: selectedService ? `View ${selectedService.title} from ${selectedProvider.name} on BVS.` : `View ${selectedProvider.name} on BVS Marketplace.`,
      url,
    });
    setShareMessage(ok ? "Web store link ready to share." : "Could not share the web store link.");
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    if (!provider || !service || !selectedSlot) return;
    setBookingBusy(true);
    setBookingMessage("");
    try {
      const response = await fetch("/api/marketplace/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerKey: provider.slug,
          serviceRef: service.id,
          slotId: selectedSlot,
          customerName: form.name,
          customerEmail: form.email,
          customerPhone: form.phone,
          projectNotes: form.notes,
        }),
      });
      const next = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (!response.ok) throw new Error(next.error || "Could not request this booking.");
      setBookingMessage(next.message || "Booking request received. The provider still needs to confirm it.");
      setSlots((current) => current.filter((slot) => slot.id !== selectedSlot));
      setSelectedSlot("");
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : "Could not request this booking.");
    } finally {
      setBookingBusy(false);
    }
  }

  if (state === "loading") {
    return <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6"><div className="h-56 animate-pulse rounded-[2rem] bg-white/[.04]" /></div>;
  }

  if (provider) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <button type="button" onClick={() => router.push(base)} className="text-sm text-text-secondary">← Marketplace</button>
        <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.025]">
          {provider.heroImage ? <img src={provider.heroImage} alt="" data-bvs-data-heavy="true" className="aspect-[16/7] w-full object-cover" /> : null}
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap gap-2"><span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{provider.kind.replaceAll("_", " ")}</span>{provider.verified ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs">BVS verified</span> : null}{provider.official ? <span className="rounded-full border border-brand/30 px-3 py-1 text-xs text-brand">Official BVS</span> : null}</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{provider.name}</h1>
            <p className="mt-3 max-w-3xl text-text-secondary">{provider.headline}</p>
            {provider.location ? <p className="mt-2 text-sm text-brand">{provider.location}</p> : null}
            <button type="button" onClick={() => void shareWebStore(provider)} className="mt-5 min-h-10 rounded-full border border-white/15 px-4 text-sm text-text-secondary">Share provider</button>
          </div>
        </section>

        <section className="mt-8">
          <p className="text-xs uppercase tracking-[.18em] text-brand">Services & products</p>
          <h2 className="mt-1 text-2xl font-semibold">Choose what you need.</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{provider.services.map((item) => {
            const active = service?.id === item.id;
            return <article key={item.id} className={`rounded-2xl border p-5 ${active ? "border-brand/50 bg-brand/[.06]" : "border-white/10 bg-white/[.02]"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.15em] text-brand">{item.category}</p><h3 className="mt-1 text-xl font-semibold">{item.title}</h3></div><strong className="shrink-0 text-brand">{servicePrice(item)}</strong></div>
              <p className="mt-3 text-sm leading-6 text-text-secondary">{item.description}</p>
              {item.turnaroundDays ? <p className="mt-2 text-xs text-text-secondary">Target turnaround: {item.turnaroundDays} days</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.bookingMode === "calendar" ? <button type="button" onClick={() => openService(provider.slug, item.id, true)} className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-black">See availability</button> : <button type="button" onClick={() => openService(provider.slug, item.id)} className="min-h-10 rounded-full border border-brand/40 px-4 text-sm font-semibold text-brand">View details</button>}
                <button type="button" onClick={() => void shareWebStore(provider, item)} className="min-h-10 rounded-full border border-white/10 px-4 text-sm text-text-secondary">Share</button>
              </div>
            </article>;
          })}</div>
        </section>

        {service ? <section className="mt-8 rounded-[1.75rem] border border-brand/20 bg-brand/[.04] p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[.18em] text-brand">Selected</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{service.title}</h2><p className="mt-2 max-w-2xl text-sm text-text-secondary">{service.description}</p></div><strong className="text-xl text-brand">{servicePrice(service)}</strong></div>
          {service.packages?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{service.packages.map((pkg) => <div key={pkg.name} className="rounded-xl border border-white/10 p-4"><div className="flex justify-between gap-3"><span className="font-semibold">{pkg.name}</span><span className="text-brand">${pkg.priceUsd.toFixed(2)}</span></div>{pkg.description ? <p className="mt-1 text-xs text-text-secondary">{pkg.description}</p> : null}</div>)}</div> : null}

          {service.bookingMode === "calendar" ? <div className="mt-6">
            {!showBooking ? <button type="button" onClick={() => setShowBooking(true)} className="min-h-11 rounded-full bg-brand px-5 font-semibold text-black">Check published times</button> : null}
            {showBooking && slotState === "loading" ? <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white/[.04]" /> : null}
            {showBooking && slotState === "error" ? <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[.04] p-4 text-sm text-text-secondary">Booking infrastructure is not active for this provider yet.</p> : null}
            {showBooking && slotState === "ready" && !slots.length && !bookingMessage ? <p className="mt-4 rounded-xl border border-dashed border-white/15 p-4 text-sm text-text-secondary">No published times are open right now. BVS never invents availability.</p> : null}
            {showBooking && groupedSlots.length ? <div className="mt-5 space-y-4">{groupedSlots.map(([date, daySlots]) => <div key={date}><p className="text-sm font-semibold">{date}</p><div className="mt-2 flex flex-wrap gap-2">{daySlots.map((slot) => <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot.id)} className={selectedSlot === slot.id ? "min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-black" : "min-h-10 rounded-full border border-white/15 px-4 text-sm"}>{timeLabel(slot)}</button>)}</div></div>)}</div> : null}
            {showBooking && slotState === "ready" && slots.length ? <form onSubmit={(event) => void submitBooking(event)} className="mt-6 grid gap-3 sm:grid-cols-2">
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Your name" />
              <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Email" />
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm" placeholder="Phone (optional)" />
              <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm sm:row-span-2" placeholder="Project notes" />
              <button disabled={!selectedSlot || bookingBusy} className="min-h-11 rounded-full bg-brand px-5 font-semibold text-black disabled:opacity-40">{bookingBusy ? "Requesting…" : "Request selected time"}</button>
            </form> : null}
            {bookingMessage ? <p role="status" className="mt-4 rounded-xl border border-brand/25 bg-brand/[.05] p-4 text-sm text-brand">{bookingMessage}</p> : null}
          </div> : <div className="mt-6 rounded-2xl border border-white/10 bg-black/10 p-4">
            <p className="font-semibold">Storefront-policy aware purchase</p>
            <p className="mt-2 text-sm text-text-secondary">This vNext app shows the verified offer and price but does not silently send digital or checkout purchases through a web payment screen. Share the BVS web-store link when you want to continue outside this app build.</p>
            <button type="button" onClick={() => void shareWebStore(provider, service)} className="mt-4 min-h-10 rounded-full border border-brand/40 px-4 text-sm font-semibold text-brand">Share web-store link</button>
          </div>}
        </section> : null}

        {provider.policyNotes?.length ? <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-5"><p className="text-xs uppercase tracking-[.18em] text-amber-200">Provider notes</p><ul className="mt-3 space-y-1 text-sm text-text-secondary">{provider.policyNotes.map((note) => <li key={note}>• {note}</li>)}</ul></section> : null}
        {shareMessage ? <p role="status" className="mt-4 text-xs text-brand">{shareMessage}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">BVS Marketplace</p><h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Find the people and services behind better records.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">Browse BVS providers inside the app. Calendar services can be requested here; purchases remain storefront-policy aware.</p></div><Link href={`/app/${surface}/studio/marketplace`} className="min-h-10 rounded-full border border-white/15 px-4 py-2 text-sm text-text-secondary">Manage provider store</Link></div>
      {state === "error" ? <p className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[.04] p-4 text-sm text-text-secondary">Live Marketplace listings could not refresh. Seeded BVS providers remain available.</p> : null}
      <div className="mt-7 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{providers.map((item) => <article key={item.slug} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[.025]">{item.heroImage ? <img src={item.heroImage} alt="" data-bvs-data-heavy="true" className="aspect-[16/9] w-full object-cover" /> : <div className="grid aspect-[16/9] place-items-center bg-white/[.03] text-xs text-brand">BVS PROVIDER</div>}<div className="p-4"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-brand">{item.kind.replaceAll("_", " ")}</span>{item.verified ? <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px]">Verified</span> : null}</div><h2 className="mt-3 text-xl font-semibold">{item.name}</h2><p className="mt-1 text-sm text-text-secondary">{item.headline}</p>{item.location ? <p className="mt-2 text-xs text-brand">{item.location}</p> : null}<div className="mt-4 flex items-center justify-between gap-3"><span className="text-xs text-text-secondary">{item.services.length} offer{item.services.length === 1 ? "" : "s"}</span><button type="button" onClick={() => openProvider(item.slug)} className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-black">Open provider</button></div></div></article>)}</div>
      {!providers.length ? <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-text-secondary">No approved providers are available yet.</div> : null}
    </div>
  );
}
