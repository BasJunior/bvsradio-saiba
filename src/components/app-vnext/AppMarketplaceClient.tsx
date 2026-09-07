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
  const iosCommerceRestricted = surface === "ios";

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
    setShareMessage(ok ? "Link ready to share." : "Could not share this link.");
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
      setBookingMessage(next.message || "Request sent. The provider still needs to confirm the time.");
      setSlots((current) => current.filter((slot) => slot.id !== selectedSlot));
      setSelectedSlot("");
    } catch (error) {
      setBookingMessage(error instanceof Error ? error.message : "Could not request this booking.");
    } finally {
      setBookingBusy(false);
    }
  }

  if (state === "loading") {
    return <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6"><div className="h-56 animate-pulse rounded-[2rem] bg-white/[.035]" /></div>;
  }

  if (provider) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
        <button type="button" onClick={() => router.push(base)} className="text-sm text-white/42 transition hover:text-white">← Marketplace</button>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/[.07] bg-white/[.025] shadow-[0_24px_70px_rgba(0,0,0,.25)]">
          {provider.heroImage ? <img src={provider.heroImage} alt="" data-bvs-data-heavy="true" className="aspect-[16/7] w-full object-cover" /> : null}
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-brand/[.09] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-brand">{provider.kind.replaceAll("_", " ")}</span>
              {provider.verified ? <span className="rounded-full border border-white/[.08] px-3 py-1 text-[10px] text-white/52">Verified</span> : null}
              {provider.official ? <span className="rounded-full border border-brand/22 px-3 py-1 text-[10px] text-brand">BVS official</span> : null}
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">{provider.name}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/46 sm:text-base">{provider.headline}</p>
            {provider.location ? <p className="mt-3 text-sm text-brand">{provider.location}</p> : null}
            {!iosCommerceRestricted ? <button type="button" onClick={() => void shareWebStore(provider)} className="mt-6 min-h-10 rounded-full border border-white/[.08] px-4 text-sm text-white/46 transition hover:border-white/18 hover:text-white">Share</button> : null}
          </div>
        </section>

        <section className="mt-10">
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">What they offer</p>
          <h2 className="mt-2 text-3xl font-semibold">Choose what moves the project forward.</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {provider.services.map((item) => {
              const active = service?.id === item.id;
              return (
                <article key={item.id} className={`rounded-[1.4rem] border p-5 transition ${active ? "border-brand/28 bg-brand/[.055]" : "border-white/[.07] bg-white/[.02] hover:border-white/15 hover:bg-white/[.035]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-brand">{item.category}</p><h3 className="mt-2 text-xl font-semibold">{item.title}</h3></div>
                    {!iosCommerceRestricted ? <strong className="shrink-0 text-brand">{servicePrice(item)}</strong> : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/40">{item.description}</p>
                  {item.turnaroundDays ? <p className="mt-2 text-xs text-white/30">Typical turnaround: {item.turnaroundDays} days</p> : null}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {item.bookingMode === "calendar" ? (
                      <button type="button" onClick={() => openService(provider.slug, item.id, true)} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-brand">Check availability</button>
                    ) : (
                      <button type="button" onClick={() => openService(provider.slug, item.id)} className="min-h-10 rounded-full border border-brand/28 px-4 text-sm font-semibold text-brand transition hover:bg-brand/[.08]">View details</button>
                    )}
                    {!iosCommerceRestricted ? <button type="button" onClick={() => void shareWebStore(provider, item)} className="min-h-10 rounded-full border border-white/[.08] px-4 text-sm text-white/42 transition hover:border-white/18 hover:text-white">Share</button> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {service ? (
          <section className="mt-8 rounded-[1.75rem] border border-brand/16 bg-gradient-to-br from-brand/[.055] to-white/[.018] p-5 sm:p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Selected service</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div><h2 className="text-3xl font-semibold">{service.title}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-white/42">{service.description}</p></div>
              {!iosCommerceRestricted ? <strong className="text-xl text-brand">{servicePrice(service)}</strong> : null}
            </div>

            {!iosCommerceRestricted && service.packages?.length ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {service.packages.map((pkg) => (
                  <div key={pkg.name} className="rounded-[1.1rem] border border-white/[.07] bg-black/10 p-4">
                    <div className="flex justify-between gap-3"><span className="font-semibold">{pkg.name}</span><span className="text-brand">${pkg.priceUsd.toFixed(2)}</span></div>
                    {pkg.description ? <p className="mt-2 text-xs leading-5 text-white/34">{pkg.description}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}

            {service.bookingMode === "calendar" ? (
              <div className="mt-6">
                {!showBooking ? <button type="button" onClick={() => setShowBooking(true)} className="min-h-11 rounded-full bg-white px-5 font-semibold text-black transition hover:bg-brand">View available times</button> : null}
                {showBooking && slotState === "loading" ? <div className="mt-4 h-24 animate-pulse rounded-[1.3rem] bg-white/[.035]" /> : null}
                {showBooking && slotState === "error" ? <p className="mt-4 rounded-[1.1rem] border border-amber-300/16 bg-amber-300/[.035] p-4 text-sm text-white/42">Availability is not available for this provider right now.</p> : null}
                {showBooking && slotState === "ready" && !slots.length && !bookingMessage ? <p className="mt-4 rounded-[1.1rem] border border-dashed border-white/12 p-4 text-sm text-white/40">No times are currently published. Check back when the provider opens new availability.</p> : null}
                {showBooking && groupedSlots.length ? (
                  <div className="mt-5 space-y-4">
                    {groupedSlots.map(([date, daySlots]) => (
                      <div key={date}>
                        <p className="text-sm font-semibold">{date}</p>
                        <div className="mt-2 flex flex-wrap gap-2">{daySlots.map((slot) => <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot.id)} className={selectedSlot === slot.id ? "min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-black" : "min-h-10 rounded-full border border-white/12 px-4 text-sm text-white/58"}>{timeLabel(slot)}</button>)}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {showBooking && slotState === "ready" && slots.length ? (
                  <form onSubmit={(event) => void submitBooking(event)} className="mt-6 grid gap-3 sm:grid-cols-2">
                    <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-[1rem] border border-white/[.08] bg-black/20 p-3 text-sm outline-none focus:border-brand/35" placeholder="Your name" />
                    <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-[1rem] border border-white/[.08] bg-black/20 p-3 text-sm outline-none focus:border-brand/35" placeholder="Email" />
                    <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="rounded-[1rem] border border-white/[.08] bg-black/20 p-3 text-sm outline-none focus:border-brand/35" placeholder="Phone (optional)" />
                    <textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="rounded-[1rem] border border-white/[.08] bg-black/20 p-3 text-sm outline-none focus:border-brand/35 sm:row-span-2" placeholder="Tell them about the project" />
                    <button disabled={!selectedSlot || bookingBusy} className="min-h-11 rounded-full bg-brand px-5 font-semibold text-black disabled:opacity-40">{bookingBusy ? "Sending…" : "Request this time"}</button>
                  </form>
                ) : null}
                {bookingMessage ? <p role="status" className="mt-4 rounded-[1.1rem] border border-brand/18 bg-brand/[.045] p-4 text-sm text-brand">{bookingMessage}</p> : null}
              </div>
            ) : !iosCommerceRestricted ? (
              <div className="mt-6 rounded-[1.2rem] border border-white/[.07] bg-black/10 p-4">
                <p className="font-semibold">Continue on the BVS web store</p>
                <p className="mt-2 text-sm leading-6 text-white/38">This offer is available here for discovery. When you’re ready to purchase, open or share the secure BVS web-store link.</p>
                <button type="button" onClick={() => void shareWebStore(provider, service)} className="mt-4 min-h-10 rounded-full border border-brand/28 px-4 text-sm font-semibold text-brand transition hover:bg-brand/[.08]">Share store link</button>
              </div>
            ) : <div className="mt-6 rounded-[1.2rem] border border-white/[.07] bg-black/10 p-4"><p className="font-semibold">Available for discovery</p><p className="mt-2 text-sm leading-6 text-white/38">Purchasing and checkout for this offer are not available in the iOS app.</p></div>}
          </section>
        ) : null}

        {provider.policyNotes?.length ? (
          <section className="mt-6 rounded-[1.25rem] border border-white/[.07] bg-white/[.018] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/35">Good to know</p>
            <ul className="mt-3 space-y-1 text-sm leading-6 text-white/40">{provider.policyNotes.map((note) => <li key={note}>• {note}</li>)}</ul>
          </section>
        ) : null}
        {shareMessage ? <p role="status" className="mt-4 text-xs text-brand">{shareMessage}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Marketplace</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">Find the people who make the next version better.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/44 sm:text-base">Studios, production and creative services connected to the same BVS ecosystem.</p>
        </div>
        <Link href={`/app/${surface}/studio/marketplace`} className="min-h-10 rounded-full border border-white/[.08] px-4 py-2 text-sm text-white/42 transition hover:border-white/18 hover:text-white">Manage my provider profile</Link>
      </div>

      {state === "error" ? <p className="mt-6 rounded-[1.2rem] border border-amber-300/16 bg-amber-300/[.035] p-4 text-sm text-white/42">Marketplace could not refresh fully. Available BVS providers are still shown below.</p> : null}

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((item) => (
          <article key={item.slug} className="group overflow-hidden rounded-[1.55rem] border border-white/[.07] bg-white/[.025] transition hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[.04]">
            {item.heroImage ? <img src={item.heroImage} alt="" data-bvs-data-heavy="true" className="aspect-[16/9] w-full object-cover transition duration-500 group-hover:scale-[1.01]" /> : <div className="grid aspect-[16/9] place-items-center bg-white/[.03] text-[10px] font-semibold uppercase tracking-[.16em] text-brand">BVS provider</div>}
            <div className="p-4">
              <div className="flex flex-wrap gap-2"><span className="rounded-full bg-brand/[.08] px-2.5 py-1 text-[10px] uppercase tracking-[.12em] text-brand">{item.kind.replaceAll("_", " ")}</span>{item.verified ? <span className="rounded-full border border-white/[.07] px-2.5 py-1 text-[10px] text-white/45">Verified</span> : null}</div>
              <h2 className="mt-3 text-xl font-semibold">{item.name}</h2>
              <p className="mt-2 text-sm leading-6 text-white/40">{item.headline}</p>
              {item.location ? <p className="mt-2 text-xs text-brand">{item.location}</p> : null}
              <div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-white/30">{item.services.length} offer{item.services.length === 1 ? "" : "s"}</span><button type="button" onClick={() => openProvider(item.slug)} className="min-h-10 rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-brand">View provider</button></div>
            </div>
          </article>
        ))}
      </div>

      {!providers.length ? <div className="mt-8 rounded-[1.4rem] border border-dashed border-white/12 p-8 text-center text-sm text-white/40">No approved providers are available yet.</div> : null}
    </div>
  );
}
