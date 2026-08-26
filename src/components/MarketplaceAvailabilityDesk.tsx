"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Slot = {
  id: string;
  provider_key: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  note?: string | null;
};

type Booking = {
  id: string;
  slot_id: string;
  service_ref: string;
  service_title: string;
  price_usd?: number | string | null;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  project_notes?: string | null;
  status: string;
  created_at: string;
};

function zonedInputIso(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return "";
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return "";
  }
  const partsFor = (value: number) => Object.fromEntries(
    formatter.formatToParts(new Date(value)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = partsFor(guess);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    guess += desired - represented;
  }
  const finalParts = partsFor(guess);
  if (
    Number(finalParts.year) !== year ||
    Number(finalParts.month) !== month ||
    Number(finalParts.day) !== day ||
    Number(finalParts.hour) !== hour ||
    Number(finalParts.minute) !== minute
  ) return "";
  return new Date(guess).toISOString();
}

function label(slot: Slot) {
  const zone = slot.timezone || "Africa/Harare";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: zone }).format(new Date(slot.starts_at));
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: zone });
  return `${day} · ${time.format(new Date(slot.starts_at))}–${time.format(new Date(slot.ends_at))}`;
}

export default function MarketplaceAvailabilityDesk() {
  const [token, setToken] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "blocked">("idle");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [form, setForm] = useState({ date: "", start: "", end: "", timezone: "Africa/Harare", note: "" });

  const load = async (accessToken: string) => {
    setState("loading");
    const response = await fetch("/api/marketplace/availability", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Availability is not ready.");
      setState("blocked");
      return;
    }
    setProviderKey(payload.providerKey || "");
    setSlots(payload.slots || []);
    setBookings(payload.bookings || []);
    setState("ready");
  };

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    createClient().auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token || "";
      setToken(accessToken);
      if (accessToken) void load(accessToken);
    });
  }, []);

  const available = useMemo(() => slots.filter((slot) => slot.status === "available"), [slots]);
  const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === "requested"), [bookings]);
  const confirmedBookings = useMemo(() => bookings.filter((booking) => booking.status === "confirmed"), [bookings]);
  const slotById = useMemo(() => new Map(slots.map((slot) => [slot.id, slot])), [slots]);
  const upcomingConfirmedBookings = useMemo(() => confirmedBookings.filter((booking) => {
    const slot = slotById.get(booking.slot_id);
    return !slot || Date.parse(slot.ends_at) >= Date.now();
  }), [confirmedBookings, slotById]);
  const completedBookings = useMemo(() => confirmedBookings.filter((booking) => {
    const slot = slotById.get(booking.slot_id);
    return Boolean(slot && Date.parse(slot.ends_at) < Date.now());
  }), [confirmedBookings, slotById]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/marketplace/availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Availability update failed.");
    return payload;
  }

  async function addSlot(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const startsAt = zonedInputIso(form.date, form.start, form.timezone);
    const endsAt = zonedInputIso(form.date, form.end, form.timezone);
    if (!startsAt || !endsAt) {
      setMessage("Choose a valid date, time and IANA timezone such as Africa/Harare.");
      return;
    }
    try {
      await post({ action: "add_slot", startsAt, endsAt, timezone: form.timezone, note: form.note });
      setMessage("Availability published.");
      setForm((value) => ({ ...value, start: "", end: "", note: "" }));
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish availability.");
    }
  }

  async function closeSlot(slotId: string) {
    setMessage("");
    setBusyId(slotId);
    try {
      await post({ action: "block_slot", slotId });
      setMessage("Slot closed.");
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not close slot.");
    } finally {
      setBusyId("");
    }
  }

  async function respondBooking(bookingId: string, decision: "confirm" | "decline") {
    setMessage("");
    setBusyId(bookingId);
    try {
      await post({ action: "respond_booking", bookingId, decision });
      setMessage(decision === "confirm" ? "Booking confirmed and the slot is now booked." : "Booking declined and the future slot was released.");
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update booking.");
    } finally {
      setBusyId("");
    }
  }

  if (!token) return null;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 p-6" aria-labelledby="marketplace-availability-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Booking calendar</p>
          <h2 id="marketplace-availability-title" className="mt-1 text-2xl font-semibold">Publish real studio availability</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">Customers only see slots you publish here. Requests hold a slot until you confirm or decline it, preventing the same time from being booked twice.</p>
        </div>
        {providerKey ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-text-secondary">Store: {providerKey}</span> : null}
      </div>

      {message ? <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-text-secondary">{message}</p> : null}

      {state === "blocked" ? (
        <p className="mt-5 text-sm text-text-secondary">Availability unlocks after Editorial approves your Marketplace profile and the booking schema is active.</p>
      ) : (
        <>
          <form onSubmit={addSlot} className="mt-6 grid gap-3 md:grid-cols-5">
            <label className="text-xs text-text-secondary">Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" /></label>
            <label className="text-xs text-text-secondary">Starts<input required type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" /></label>
            <label className="text-xs text-text-secondary">Ends<input required type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" /></label>
            <label className="text-xs text-text-secondary">Timezone<input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" /></label>
            <div className="flex items-end"><button className="min-h-11 w-full rounded-full bg-brand px-4 text-sm font-semibold text-black">Publish slot</button></div>
            <label className="text-xs text-text-secondary md:col-span-5">Slot note (optional)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" placeholder="e.g. Vocal booth available" /></label>
          </form>

          <div className="mt-8 border-t border-white/10 pt-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Booking inbox</p>
                <h3 className="mt-1 text-xl font-semibold">Requests waiting for you</h3>
              </div>
              {pendingBookings.length ? <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{pendingBookings.length} pending</span> : null}
            </div>
            {state === "ready" && !pendingBookings.length ? <p className="mt-3 text-sm text-text-secondary">No booking requests are waiting.</p> : null}
            <div className="mt-4 space-y-3">
              {pendingBookings.map((booking) => {
                const slot = slotById.get(booking.slot_id);
                return (
                  <article key={booking.id} className="rounded-2xl border border-brand/20 bg-brand/[.035] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[.12em] text-brand">{booking.service_title}</p>
                        <h4 className="mt-1 font-semibold">{booking.customer_name}</h4>
                        {slot ? <p className="mt-1 text-sm text-text-secondary">{label(slot)}</p> : null}
                        <p className="mt-1 text-xs text-text-secondary">{booking.customer_email}{booking.customer_phone ? ` · ${booking.customer_phone}` : ""}</p>
                      </div>
                      {booking.price_usd != null ? <strong>${Number(booking.price_usd).toFixed(2)}</strong> : null}
                    </div>
                    {booking.project_notes ? <p className="mt-3 whitespace-pre-wrap rounded-xl border border-white/10 p-3 text-sm text-text-secondary">{booking.project_notes}</p> : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button disabled={busyId === booking.id} type="button" onClick={() => void respondBooking(booking.id, "confirm")} className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-black disabled:opacity-40">Confirm booking</button>
                      <button disabled={busyId === booking.id} type="button" onClick={() => void respondBooking(booking.id, "decline")} className="min-h-11 rounded-full border border-white/15 px-4 text-sm disabled:opacity-40">Decline</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {upcomingConfirmedBookings.length ? (
            <div className="mt-8 border-t border-white/10 pt-7">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Upcoming confirmed sessions</p>
              <div className="mt-3 space-y-2">
                {upcomingConfirmedBookings.map((booking) => {
                  const slot = slotById.get(booking.slot_id);
                  return (
                    <div key={booking.id} className="rounded-xl border border-white/10 p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div><p className="font-medium">{booking.service_title} · {booking.customer_name}</p>{slot ? <p className="mt-1 text-xs text-text-secondary">{label(slot)}</p> : null}</div>
                        <span className="text-xs font-semibold text-brand">Confirmed · upcoming</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {completedBookings.length ? (
            <div className="mt-8 border-t border-white/10 pt-7">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-brand">Completed sessions</p>
              <p className="mt-1 text-xs text-text-secondary">Completed is derived from a confirmed booking whose published slot has ended. The client can now leave one verified BVS studio review.</p>
              <div className="mt-3 space-y-2">
                {completedBookings.map((booking) => {
                  const slot = slotById.get(booking.slot_id);
                  return (
                    <div key={booking.id} className="rounded-xl border border-white/10 bg-white/[.02] p-4">
                      <div className="flex flex-wrap justify-between gap-3">
                        <div><p className="font-medium">{booking.service_title} · {booking.customer_name}</p>{slot ? <p className="mt-1 text-xs text-text-secondary">{label(slot)}</p> : null}</div>
                        <span className="text-xs font-semibold text-text-secondary">Completed · review eligible</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-8 border-t border-white/10 pt-7">
            <h3 className="font-semibold">Upcoming published slots</h3>
            {state === "loading" ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/[.04]" /> : null}
            {state === "ready" && !available.length ? <p className="mt-3 text-sm text-text-secondary">No open slots published yet.</p> : null}
            <div className="mt-3 space-y-2">
              {available.map((slot) => (
                <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
                  <div><p className="text-sm font-medium">{label(slot)}</p>{slot.note ? <p className="mt-1 text-xs text-text-secondary">{slot.note}</p> : null}</div>
                  <button disabled={busyId === slot.id} type="button" onClick={() => void closeSlot(slot.id)} className="rounded-full border border-white/15 px-3 py-2 text-xs text-text-secondary hover:text-white disabled:opacity-40">Close slot</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
