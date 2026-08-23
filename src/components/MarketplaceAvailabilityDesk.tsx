"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

function localInputIso(date: string, time: string) {
  if (!date || !time) return "";
  const value = new Date(`${date}T${time}:00`);
  return Number.isFinite(value.getTime()) ? value.toISOString() : "";
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
  const [state, setState] = useState<"idle" | "loading" | "ready" | "blocked">("idle");
  const [message, setMessage] = useState("");
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
    const startsAt = localInputIso(form.date, form.start);
    const endsAt = localInputIso(form.date, form.end);
    if (!startsAt || !endsAt) {
      setMessage("Choose a date, start time and end time.");
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
    try {
      await post({ action: "block_slot", slotId });
      setMessage("Slot closed.");
      await load(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not close slot.");
    }
  }

  if (!token) return null;

  return (
    <section className="mt-8 rounded-2xl border border-white/10 p-6" aria-labelledby="marketplace-availability-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Booking calendar</p>
          <h2 id="marketplace-availability-title" className="mt-1 text-2xl font-semibold">Publish real studio availability</h2>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">Customers only see slots you publish here. Closing a slot removes it from public booking. Confirmed/held bookings are never exposed as available.</p>
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
            <label className="text-xs text-text-secondary md:col-span-5">Internal/public note (optional)<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white" placeholder="e.g. Vocal booth available" /></label>
          </form>

          <div className="mt-7">
            <h3 className="font-semibold">Upcoming published slots</h3>
            {state === "loading" ? <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/[.04]" /> : null}
            {state === "ready" && !available.length ? <p className="mt-3 text-sm text-text-secondary">No open slots published yet.</p> : null}
            <div className="mt-3 space-y-2">
              {available.map((slot) => (
                <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3">
                  <div><p className="text-sm font-medium">{label(slot)}</p>{slot.note ? <p className="mt-1 text-xs text-text-secondary">{slot.note}</p> : null}</div>
                  <button type="button" onClick={() => void closeSlot(slot.id)} className="rounded-full border border-white/15 px-3 py-2 text-xs text-text-secondary hover:text-white">Close slot</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
