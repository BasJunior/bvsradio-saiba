"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase";

type View = "attention" | "orders" | "enquiries";
type OrderRow = { id: string; reference: string; title: string; amountUsd: number; status: string; buyerName: string; sellerName: string; updatedAt: string };
type EnquiryRow = { id: string; buyerName: string; sellerName: string; lastMessageAt: string };
type Message = { id: string; body: string; createdAt: string; authorRole: string; authorName: string };
type OrderEvent = { id: string; type: string; message: string; hasFile: boolean; createdAt: string; actorRole: string; actorName: string };
type Settlement = { provider: string; gross_product_revenue: number; platform_fee_amount: number; processor_fee_allocated: number; seller_net: number; settlement_status: string };
type OrderCase = {
  order: OrderRow & { brief: string; revisionsUsed: number; revisionsIncluded: number; sellerDueAt?: string; deliveredAt?: string; createdAt: string };
  events: OrderEvent[];
  settlement: Settlement | null;
  enquiryAvailable: boolean;
  enquiryMessages: Message[];
};
type EnquiryCase = { enquiry: EnquiryRow; messages: Message[] };
type Selected = { kind: "order" | "enquiry"; id: string };

const VIEWS: Array<[View, string]> = [["attention", "Needs attention"], ["orders", "All orders"], ["enquiries", "Enquiries"]];
const usd = (value: number) => `$${Number(value || 0).toFixed(2)}`;
const label = (value: string) => String(value || "").replaceAll("_", " ");
const when = (value?: string) => (value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—");

async function call<T>(query: string): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in with an Editorial staff account.");
  const response = await fetch(`/api/admin/editorial/disputes${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Dispute data could not load.");
  return payload;
}

function Thread({ messages, empty }: { messages: Message[]; empty: string }) {
  if (!messages.length) return <p className="mt-3 text-sm text-text-secondary">{empty}</p>;
  return (
    <ol className="mt-3 space-y-3">
      {messages.map((message) => (
        <li key={message.id} className="rounded-xl border border-white/10 p-3 text-sm">
          <p className="text-xs text-text-secondary"><span className="capitalize">{message.authorRole}</span> · {message.authorName} · {when(message.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
        </li>
      ))}
    </ol>
  );
}

function OrderDetail({ data }: { data: OrderCase }) {
  const { order, events, settlement } = data;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[.16em] text-brand">{label(order.status)}</p>
          <h2 className="mt-1 text-2xl font-semibold">{order.title}</h2>
          <p className="mt-1 text-xs text-text-secondary">{order.reference} · {usd(order.amountUsd)}</p>
        </div>
        <Link href="/editorial/finance" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-4 text-sm">Open Finance →</Link>
      </div>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-text-secondary">Buyer</dt><dd>{order.buyerName}</dd></div>
        <div><dt className="text-xs text-text-secondary">Seller</dt><dd>{order.sellerName}</dd></div>
        <div><dt className="text-xs text-text-secondary">Ordered</dt><dd>{when(order.createdAt)}</dd></div>
        <div><dt className="text-xs text-text-secondary">Seller due</dt><dd>{when(order.sellerDueAt)}</dd></div>
        <div><dt className="text-xs text-text-secondary">Delivered</dt><dd>{when(order.deliveredAt)}</dd></div>
        <div><dt className="text-xs text-text-secondary">Revisions used</dt><dd>{order.revisionsUsed} of {order.revisionsIncluded}</dd></div>
      </dl>
      <h3 className="mt-6 font-semibold">Buyer’s brief</h3>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-secondary">{order.brief}</p>
      <h3 className="mt-6 font-semibold">Money</h3>
      {settlement ? (
        <p className="mt-2 text-sm text-text-secondary">
          {label(settlement.settlement_status)} via {settlement.provider} · Gross {usd(settlement.gross_product_revenue)} · BVS fee {usd(settlement.platform_fee_amount)} · Processing {usd(settlement.processor_fee_allocated)} · Seller net {usd(settlement.seller_net)}
        </p>
      ) : <p className="mt-2 text-sm text-text-secondary">No settlement record found for this order.</p>}
      <h3 className="mt-6 font-semibold">Order activity</h3>
      {events.length ? (
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className={`rounded-xl border p-3 text-sm ${event.type === "dispute" || event.type === "cancel_requested" ? "border-amber-300/40" : "border-white/10"}`}>
              <p className="text-xs text-text-secondary"><span className="capitalize">{label(event.type)}</span> · {event.actorRole} · {event.actorName} · {when(event.createdAt)}</p>
              {event.message ? <p className="mt-1 whitespace-pre-wrap break-words">{event.message}</p> : null}
              {event.hasFile ? <p className="mt-1 text-xs text-text-secondary">A file was attached.</p> : null}
            </li>
          ))}
        </ol>
      ) : <p className="mt-3 text-sm text-text-secondary">No activity has been recorded on this order.</p>}
      <h3 className="mt-6 font-semibold">Before-sale enquiry</h3>
      {data.enquiryAvailable
        ? <Thread messages={data.enquiryMessages} empty="These two people did not exchange enquiry messages." />
        : <p className="mt-3 text-sm text-amber-100">Enquiry messages could not be read, so this may not be the full history.</p>}
    </>
  );
}

export default function EditorialDisputesPage() {
  const [view, setView] = useState<View>("attention");
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([]);
  const [enquiriesAvailable, setEnquiriesAvailable] = useState(true);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [detail, setDetail] = useState<OrderCase | EnquiryCase | null>(null);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async (next: View) => {
    setState("loading");
    setError("");
    try {
      if (next === "enquiries") {
        const payload = await call<{ enquiries: EnquiryRow[]; available: boolean }>("?view=enquiries");
        setEnquiries(payload.enquiries);
        setEnquiriesAvailable(payload.available);
      } else {
        const payload = await call<{ orders: OrderRow[] }>(`?view=${next}`);
        setOrders(payload.orders);
      }
      setState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Dispute data could not load.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(view), 0);
    return () => window.clearTimeout(timer);
  }, [load, view]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    setDetail(null);
    setDetailError("");
    call<OrderCase | EnquiryCase>(`?${selected.kind}=${selected.id}`)
      .then((payload) => { if (active) setDetail(payload); })
      .catch((caught) => { if (active) setDetailError(caught instanceof Error ? caught.message : "This case could not load."); });
    return () => { active = false; };
  }, [selected]);

  const needle = query.trim().toLowerCase();
  const shownOrders = useMemo(() => orders.filter((item) => [item.reference, item.title, item.buyerName, item.sellerName].join(" ").toLowerCase().includes(needle)), [orders, needle]);
  const shownEnquiries = useMemo(() => enquiries.filter((item) => [item.buyerName, item.sellerName].join(" ").toLowerCase().includes(needle)), [enquiries, needle]);
  const count = view === "enquiries" ? shownEnquiries.length : shownOrders.length;
  const emptyText = needle ? "Nothing matches this search." : view === "attention" ? "No disputes or cancellation requests are open." : view === "orders" ? "No service orders yet." : enquiriesAvailable ? "No enquiries yet." : "Enquiries could not be read.";

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-[.18em] text-brand">Marketplace support</p>
      <h1 className="mt-2 text-4xl font-semibold">Disputes &amp; enquiries</h1>
      <p className="mt-2 max-w-2xl text-text-secondary">One record of each order, its messages and its money. This desk is read-only, and opening a case is recorded in the audit log.</p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {VIEWS.map(([key, text]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => { setView(key); setSelected(null); setDetail(null); }} className={`min-h-11 rounded-full border px-4 text-sm ${view === key ? "border-brand bg-brand/10 text-brand" : "border-white/10 text-text-secondary"}`}>{text}</button>
        ))}
        <label className="sr-only" htmlFor="dispute-search">Search cases</label>
        <input id="dispute-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, title or person" className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-base sm:min-w-64 sm:flex-none sm:text-sm" />
      </div>

      {state === "error" ? (
        <div role="alert" className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
          <p className="font-semibold">Cases did not load</p>
          <p className="mt-1 text-sm text-text-secondary">{error} Open cases may be waiting.</p>
          <button type="button" onClick={() => void load(view)} className="mt-4 min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-black">Retry</button>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div>
            <p role="status" className="text-xs text-text-secondary">{state === "loading" ? "Loading…" : `${count} ${count === 1 ? "case" : "cases"}`}</p>
            {state === "ready" && !count ? <p className="mt-3 rounded-xl border border-dashed border-white/10 p-5 text-sm text-text-secondary">{emptyText}</p> : null}
            <ul className="mt-3 space-y-2" aria-label="Cases">
              {view !== "enquiries" ? shownOrders.map((item) => (
                <li key={item.id}>
                  <button type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelected({ kind: "order", id: item.id })} className={`w-full rounded-xl border p-3 text-left text-sm ${selected?.id === item.id ? "border-brand/60 bg-brand/[.06]" : "border-white/10"}`}>
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs text-text-secondary">{label(item.status)} · {usd(item.amountUsd)} · {item.reference}</span>
                    <span className="mt-1 block text-xs text-text-secondary">{item.buyerName} → {item.sellerName}</span>
                  </button>
                </li>
              )) : shownEnquiries.map((item) => (
                <li key={item.id}>
                  <button type="button" aria-pressed={selected?.id === item.id} onClick={() => setSelected({ kind: "enquiry", id: item.id })} className={`w-full rounded-xl border p-3 text-left text-sm ${selected?.id === item.id ? "border-brand/60 bg-brand/[.06]" : "border-white/10"}`}>
                    <span className="block font-medium">{item.buyerName} → {item.sellerName}</span>
                    <span className="mt-1 block text-xs text-text-secondary">{when(item.lastMessageAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <section aria-label="Case detail" className="rounded-2xl border border-white/10 bg-white/[.025] p-5">
            {detailError ? <p role="alert" className="text-sm text-amber-100">{detailError}</p>
              : !selected ? <p className="text-sm text-text-secondary">Choose a case to see its full history.</p>
              : !detail ? <p role="status" className="text-sm text-text-secondary">Opening case…</p>
              : "order" in detail ? <OrderDetail data={detail} />
              : (
                <>
                  <h2 className="text-2xl font-semibold">{detail.enquiry.buyerName} → {detail.enquiry.sellerName}</h2>
                  <Thread messages={detail.messages} empty="This enquiry has no messages." />
                </>
              )}
          </section>
        </div>
      )}
    </main>
  );
}
