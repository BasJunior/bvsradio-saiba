"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type EnquirySummary = { id: string; role: "buyer" | "seller" | "staff"; buyerName: string; sellerName: string; lastMessageAt: string };
type EnquiryMessage = { id: string; body: string; createdAt: string; mine: boolean; authorName: string };
type ThreadPayload = { enquiry: EnquirySummary | null; messages: EnquiryMessage[]; error?: string };
type Session = { token: string; userId: string } | null;

const API = "/api/marketplace/enquiries";
const LOAD_ERROR = "Messages could not load. You can still try sending below.";

function useSession() {
  const [session, setSession] = useState<Session | undefined>(undefined);
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSession(null);
      return;
    }
    createClient().auth.getSession().then(({ data }) => {
      setSession(data.session ? { token: data.session.access_token, userId: data.session.user.id } : null);
    });
  }, []);
  return session;
}

async function callApi<T>(token: string, query: string, init?: RequestInit) {
  const response = await fetch(`${API}${query}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Marketplace messages are not available right now.");
  return payload;
}

function when(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function Messages({ messages }: { messages: EnquiryMessage[] }) {
  if (!messages.length) return null;
  return (
    <ol className="mt-4 max-h-80 space-y-3 overflow-y-auto" aria-label="Messages">
      {messages.map((message) => (
        <li key={message.id} className={`rounded-xl border p-3 text-sm ${message.mine ? "ml-6 border-brand/30 bg-brand/[.06]" : "mr-6 border-white/10"}`}>
          <p className="text-xs text-text-secondary">{message.mine ? "You" : message.authorName} · {when(message.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{message.body}</p>
        </li>
      ))}
    </ol>
  );
}

function Composer({ label, send }: { label: string; send: (message: string) => Promise<void> }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await send(value);
      setValue("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="enquiry-message" className="text-xs font-semibold text-text-secondary">{label}</label>
      <textarea
        id="enquiry-message"
        rows={3}
        maxLength={2000}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm"
      />
      <p className="mt-2 text-xs text-text-secondary">Keep contact on BVS. Phone numbers, emails and social handles are blocked so we can help with disputes and refunds.</p>
      {error ? <p role="alert" className="mt-2 text-sm text-amber-200">{error}</p> : null}
      <button type="submit" disabled={busy || !value.trim()} className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black disabled:opacity-50">
        {busy ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}

export function MarketplaceEnquiryPanel({ sellerUserId, providerName, slug }: { sellerUserId: string; providerName: string; slug: string }) {
  const session = useSession();
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!session || session.userId === sellerUserId) return;
    callApi<ThreadPayload>(session.token, `?seller=${sellerUserId}`)
      .then((payload) => setMessages(payload.messages))
      .catch(() => setLoadError(LOAD_ERROR));
  }, [session, sellerUserId]);

  if (session === undefined) return null;
  if (session?.userId === sellerUserId) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[.025] p-5" aria-label={`Message ${providerName}`}>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Ask before you buy</p>
      <h2 className="mt-2 text-lg font-semibold">Message {providerName}</h2>
      {!session ? (
        <Link href={`/auth/login?next=${encodeURIComponent(`/marketplace/${slug}`)}`} className="mt-4 inline-flex min-h-11 items-center rounded-full border border-brand/40 px-5 text-sm font-semibold text-brand">
          Sign in to send a message
        </Link>
      ) : (
        <>
          {loadError ? <p role="status" className="mt-3 text-sm text-text-secondary">{loadError}</p> : null}
          <Messages messages={messages} />
          <Composer
            label="Your question"
            send={async (message) => {
              const payload = await callApi<ThreadPayload>(session.token, "", { method: "POST", body: JSON.stringify({ sellerUserId, message }) });
              setMessages(payload.messages);
              setLoadError("");
            }}
          />
          <Link href="/marketplace/enquiries" className="mt-4 inline-flex text-sm text-brand hover:underline">All your enquiries →</Link>
        </>
      )}
    </section>
  );
}

export function MarketplaceEnquiryInbox({ initialId }: { initialId?: string }) {
  const session = useSession();
  const [enquiries, setEnquiries] = useState<EnquirySummary[]>([]);
  const [selected, setSelected] = useState(initialId || "");
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const refresh = useCallback(async (token: string) => {
    try {
      const payload = await callApi<{ enquiries: EnquirySummary[] }>(token, "");
      setEnquiries(payload.enquiries);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (session) void refresh(session.token);
  }, [session, refresh]);

  useEffect(() => {
    if (!session || !selected) return;
    callApi<ThreadPayload>(session.token, `?id=${encodeURIComponent(selected)}`)
      .then((payload) => setMessages(payload.messages))
      .catch(() => setMessages([]));
  }, [session, selected]);

  if (session === undefined) return <p className="mt-6 text-sm text-text-secondary">Loading…</p>;
  if (!session) {
    return <Link href="/auth/login?next=/marketplace/enquiries" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-brand px-5 text-sm font-semibold text-black">Sign in to see your enquiries</Link>;
  }
  if (state === "error") return <p role="alert" className="mt-6 text-sm text-text-secondary">Your enquiries could not load. Please try again.</p>;
  if (state === "ready" && !enquiries.length) return <p className="mt-6 text-sm text-text-secondary">No enquiries yet. Questions you send or receive on a store will appear here.</p>;

  const active = enquiries.find((item) => item.id === selected);
  return (
    <div className="mt-6 grid gap-5 md:grid-cols-[18rem_minmax(0,1fr)]">
      <ul className="space-y-2" aria-label="Enquiries">
        {enquiries.map((item) => (
          <li key={item.id}>
            <button type="button" aria-pressed={item.id === selected} onClick={() => setSelected(item.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${item.id === selected ? "border-brand/60 bg-brand/[.06]" : "border-white/10"}`}>
              <span className="block font-medium">{item.role === "seller" ? item.buyerName : item.sellerName}</span>
              <span className="mt-1 block text-xs text-text-secondary">{when(item.lastMessageAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-5" aria-label="Conversation">
        {active ? (
          <>
            <h2 className="text-lg font-semibold">{active.role === "seller" ? active.buyerName : active.sellerName}</h2>
            <Messages messages={messages} />
            {active.role !== "staff" ? (
              <Composer
                label="Your reply"
                send={async (message) => {
                  const payload = await callApi<ThreadPayload>(session.token, "", { method: "POST", body: JSON.stringify({ enquiryId: active.id, message }) });
                  setMessages(payload.messages);
                  void refresh(session.token);
                }}
              />
            ) : null}
          </>
        ) : <p className="text-sm text-text-secondary">Choose a conversation.</p>}
      </section>
    </div>
  );
}
