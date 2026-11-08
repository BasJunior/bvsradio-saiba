"use client";

import Link from "next/link";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import { readLibrary } from "@/lib/library";
import type { AskBvsObject } from "@/lib/ask-bvs-flow";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";

type Answer = { reply: string; objects?: AskBvsObject[]; links?: Array<{ label: string; href: string }> };
type Message = Answer & { role: "user" | "assistant" };

const starterPrompts = [
  "What’s new on BVS?",
  "Find beats by Wolf Bridges",
  "Open Lyrics Pad",
  "Where are my playlists?",
  "What have I been listening to?",
];

function deviceContext(message: string) {
  const history = /what.*(been listening|listened|played)|my listening|listening history|what did i play/i.test(message);
  const follows = /(new|latest|happening|recent).*(follow|following)|(?:follow|following).*(new|latest|happening|recent)|creators i follow|people i follow/i.test(message);
  try {
    return {
      history: history ? readLibrary("history").slice(0, 8) : [],
      follows: follows ? readLibrary("follows").slice(0, 8) : [],
    };
  } catch {
    return {};
  }
}

export default function VisitorAssistant() {
  const { appChrome } = useAppSurface();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [premiumMode, setPremiumMode] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [premiumNotice, setPremiumNotice] = useState("");
  const premiumButtonRef = useRef<HTMLButtonElement | null>(null);
  const offerCloseRef = useRef<HTMLButtonElement | null>(null);
  const [premium, setPremium] = useState<{ eligible: boolean; available: boolean; signedIn: boolean } | null>(null);
  const tokenRef = useRef("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const requestRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (open && messages.length) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [busy, messages, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (showOffer) { setShowOffer(false); premiumButtonRef.current?.focus(); return; }
      setOpen(false);
      launcherRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, showOffer]);

  useEffect(() => {
    if (showOffer) offerCloseRef.current?.focus();
  }, [showOffer]);

  useEffect(() => {
    if (!open || !isSupabaseConfigured()) return;
    let active = true;
    const controller = new AbortController();
    const client = createClient();
    const sync = async () => {
      try {
        const { data } = await client.auth.getSession();
        if (!active) return;
        tokenRef.current = data.session?.access_token || "";
        const response = await fetch("/api/chat/premium", { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}, signal: controller.signal, cache: "no-store" });
        const status = await response.json();
        if (active) setPremium(typeof status.eligible === "boolean" ? status : null);
      } catch { if (active) setPremium(null); }
    };
    void sync();
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        requestRef.current?.abort();
        setMessages([]);
        setInput("");
        setPremiumMode(false);
      }
      tokenRef.current = "";
      setPremium(null);
      // Let the auth callback release its session lock before checking membership.
      window.setTimeout(() => { if (active) void sync(); }, 0);
    });
    return () => { active = false; controller.abort(); listener.subscription.unsubscribe(); };
  }, [open]);

  if (appChrome) return null;

  const closeAssistant = () => {
    setShowOffer(false);
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  };

  const toggleAssistant = () => {
    setOpen((value) => !value);
  };

  async function send(event?: FormEvent, prompt = input) {
    event?.preventDefault();
    const message = prompt.trim();
    if (!message || requestRef.current || (premiumMode && (!premium?.eligible || !premium.available))) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const deadline = window.setTimeout(() => controller.abort("timeout"), 25_000);
    setInput("");
    setBusy(true);
    setMessages((items) => [...items, { role: "user", reply: message }]);
    try {
      let token = tokenRef.current;
      if (premiumMode && isSupabaseConfigured()) {
        const { data } = await createClient().auth.getSession();
        token = data.session?.access_token || "";
      }
      const response = await fetch(premiumMode ? "/api/chat/premium" : "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(premiumMode && token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(premiumMode ? { messages: [...messages.map(item => ({ role: item.role, content: item.reply })), { role: "user", content: message }].slice(-12) } : { message, path: pathname, context: { ...deviceContext(message), previousResults: [...messages].reverse().find(item => item.role === "assistant" && item.objects?.length)?.objects?.map(item => ({ id: item.id, kind: item.kind })), shownIds: messages.flatMap(item => item.objects || []).map(item => `${item.kind}:${item.id}`).slice(-40) } }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) setPremium(null);
        setMessages(items => [...items, { role: "assistant", reply: failure.error || "Ask BVS is temporarily unavailable. Please try again." }]);
        return;
      }
      const answer = (await response.json()) as Answer;
      if (controller.signal.aborted) return;
      setMessages((items) => [...items, { role: "assistant", ...answer }]);
    } catch {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          reply: "I can’t connect to Ask BVS right now, but the BVS team can still help.",
          links: [{ label: "Contact BVS", href: "/contact" }],
        },
      ]);
    } finally {
      window.clearTimeout(deadline);
      if (requestRef.current === controller) requestRef.current = null;
      setBusy(false);
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  return (
    <div data-bvs-assistant className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-3 z-[60] flex flex-col items-end sm:right-6 md:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]">
      {open ? (
        <section id="bvs-assistant-panel" role="dialog" aria-label="Ask BVS" className="relative mb-3 flex h-[min(42rem,calc(100dvh-13rem-env(safe-area-inset-bottom)))] min-h-0 w-[calc(100vw-1.5rem)] max-w-[500px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#141416] text-white shadow-[0_24px_90px_rgba(0,0,0,.55)] sm:w-[min(500px,calc(100vw-3rem))]">
          {/* Keep the controls quiet; give the conversation most of the available space. */}
          <header className="flex shrink-0 items-center justify-between border-b border-white/[.07] px-5 py-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-brand/10 text-lg text-brand">✦</span>
              <div><h2 className="text-sm font-semibold">Ask BVS</h2><p className="mt-0.5 text-[11px] text-white/45">Music, creators & your next move</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button ref={premiumButtonRef} type="button" disabled={busy} aria-pressed={premiumMode} onClick={() => {
                setPremiumNotice("");
                if (!premium?.eligible) { setShowOffer(true); return; }
                if (!premium.available) { setPremiumNotice("Premium responses are temporarily unavailable. You can keep using the BVS guide."); return; }
                setPremiumMode(value => !value);
              }} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold disabled:opacity-40 ${premiumMode ? "border-brand/40 bg-brand/15 text-brand" : "border-white/15 text-white/65 hover:border-brand/40 hover:text-brand"}`}><span aria-hidden="true">✦</span>Premium</button>
              <button type="button" disabled={busy || !messages.length} onClick={() => { setMessages([]); setInput(""); inputRef.current?.focus(); }} aria-label="Start a new BVS conversation" title="New conversation" className="grid h-10 w-10 place-items-center rounded-xl text-xl text-white/55 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-25">＋</button>
              <button type="button" onClick={closeAssistant} aria-label="Close Ask BVS" className="grid h-10 w-10 place-items-center rounded-xl text-xl text-white/55 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-brand">×</button>
            </div>
          </header>

          {premiumNotice ? <p role="status" className="shrink-0 px-5 pt-3 text-xs leading-5 text-white/55">{premiumNotice}</p> : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {!messages.length ? (
              <div className="flex min-h-full flex-col justify-center py-3">
                <span aria-hidden="true" className="mb-5 text-3xl text-brand">✦</span>
                <h3 className="max-w-xs text-2xl font-semibold leading-tight tracking-tight">Where will the sound take you?</h3>
                <p className="mt-3 max-w-sm text-sm leading-6 text-white/55">Find a beat, discover an artist or get help with your next release. Start with a question.</p>
                <div className="mt-6 grid gap-2">
                  {starterPrompts.slice(0, 4).map(text => <button type="button" key={text} disabled={premiumMode && (!premium?.eligible || !premium.available)} onClick={() => void send(undefined, text)} className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-3 text-left text-xs text-white/70 transition hover:border-brand/35 hover:bg-white/[.03] hover:text-white focus-visible:outline-2 focus-visible:outline-brand">{text}<span aria-hidden="true" className="text-white/30">↗</span></button>)}
                </div>
              </div>
            ) : (
              <div role="log" aria-label="Conversation with Ask BVS" aria-live="polite" aria-relevant="additions" className="space-y-6">
                {messages.map((message, index) => (
                  <div key={index} className={message.role === "user" ? "ml-10 flex justify-end" : "min-w-0"}>
                    <div className={message.role === "user" ? "max-w-full rounded-2xl rounded-br-md bg-white/[.08] px-4 py-3" : "w-full"}>
                      <p className="sr-only">{message.role === "user" ? "You" : "Ask BVS"}</p>
                      {message.role === "assistant" ? <div aria-hidden="true" className="mb-2 text-xs font-semibold text-brand">✦ BVS</div> : null}
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/85">{message.reply}</p>
                      {message.objects?.length ? <div className="mt-4 space-y-2">{message.objects.map(object => (
                        <Link key={`${object.kind}:${object.id}`} href={object.route} onClick={closeAssistant} className="flex min-h-16 items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] p-3 transition hover:border-brand/40 focus-visible:outline-2 focus-visible:outline-brand">
                          <span className="min-w-0 flex-1"><span className="block text-[10px] uppercase tracking-wider text-brand">{object.kind}</span><span className="mt-1 block truncate text-sm font-medium">{object.title}</span>{object.subtitle ? <span className="mt-0.5 block truncate text-xs text-white/45">{object.subtitle}</span> : null}{object.matchReason ? <span className="mt-1 block text-xs leading-5 text-white/60">{object.matchReason}</span> : null}</span><span aria-hidden="true" className="text-white/40">↗</span>
                        </Link>
                      ))}</div> : null}
                      {message.links?.length ? <div className="mt-3 flex flex-wrap gap-2">{message.links.map(link => <Link key={link.href} href={link.href} onClick={closeAssistant} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-brand hover:bg-brand/5 focus-visible:outline-2 focus-visible:outline-brand">{link.label}<span aria-hidden="true">↗</span></Link>)}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {busy ? <div role="status" className="mt-6 flex items-center gap-2 text-xs text-white/50"><span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />Looking through BVS…</div> : null}
            <div ref={endRef} />
          </div>

          {/* COMPOSER — Enter sends; Shift+Enter adds a line. Requests can be stopped. */}
          <div className="shrink-0 px-4 pb-3 pt-2">
            <form onSubmit={event => void send(event)} className="rounded-2xl border border-white/15 bg-[#202023] p-3 focus-within:border-white/35">
              <textarea ref={inputRef} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
              }} rows={2} disabled={premiumMode && (!premium?.eligible || !premium.available)} maxLength={premiumMode ? 4000 : 500} placeholder="Ask about anything on BVS…" aria-label="Ask BVS a question" className="max-h-32 min-h-12 w-full resize-none bg-transparent text-sm leading-6 text-white outline-none placeholder:text-white/35" />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[10px] text-white/35">{premiumMode ? "Premium responses · 30 messages/hour" : "BVS music & platform guide"}</span>
                {busy ? <button type="button" onClick={() => requestRef.current?.abort()} aria-label="Stop BVS response" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black focus-visible:outline-2 focus-visible:outline-brand"><span aria-hidden="true" className="h-3 w-3 rounded-sm bg-black" /></button> : <button type="submit" disabled={!input.trim() || (premiumMode && (!premium?.eligible || !premium.available))} aria-label="Send to Ask BVS" className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-semibold text-black transition hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-white disabled:bg-white/10 disabled:text-white/25">↑</button>}
              </div>
            </form>
            <p className="mt-2 text-center text-[10px] text-white/35">Check release and licence details on the linked pages.</p>
          </div>
          {/* The offer overlays this same guide; upgrading does not navigate to a second assistant. */}
          {showOffer ? <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/75 p-5 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" aria-labelledby="bvs-premium-offer-title" aria-describedby="bvs-premium-offer-copy" onKeyDown={event => {
              if (event.key !== "Tab") return;
              const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]'));
              const first = controls[0], last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }} className="relative w-full rounded-2xl border border-white/15 bg-[#202023] p-6 shadow-2xl">
              <button ref={offerCloseRef} type="button" onClick={() => { setShowOffer(false); premiumButtonRef.current?.focus(); }} aria-label="Close Premium offer" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-xl text-white/60 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-brand">×</button>
              <p className="pr-10 text-xs font-semibold uppercase tracking-widest text-brand">✦ BVS Premium</p>
              <h3 id="bvs-premium-offer-title" className="mt-4 text-2xl font-semibold tracking-tight">More from your BVS guide.</h3>
              <p id="bvs-premium-offer-copy" className="mt-3 text-sm leading-6 text-white/65">Get deeper answers, creative ideas and help planning your next move, right here in Ask BVS. Listener Premium is the entry level; current paid creator memberships also qualify.</p>
              <ul className="mt-4 space-y-2 text-sm text-white/75"><li>Continue in the same conversation</li><li>Writing, production and release-planning help</li><li>Up to 30 Premium questions per hour</li></ul>
              <p className="mt-4 text-xs leading-5 text-white/45">The current listener membership is BVS Supporter. Premium Instant covers a release and does not include this access.{premium && !premium.available ? " Premium responses are not available in this environment yet." : ""}</p>
              <Link href="/premium?family=supporter" onClick={closeAssistant} className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-black hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-white">View listener membership →</Link>
              <button type="button" onClick={() => { setShowOffer(false); premiumButtonRef.current?.focus(); }} className="mt-2 min-h-11 w-full text-sm text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-brand">Keep using the free guide</button>
            </div>
          </div> : null}
        </section>
      ) : null}
      {/* One labelled launcher replaces the separate speech bubble and floating icon. */}
      <button ref={launcherRef} type="button" onClick={toggleAssistant} aria-expanded={open} aria-controls={open ? "bvs-assistant-panel" : undefined} aria-label={open ? "Close Ask BVS" : "Open Ask BVS"} className="inline-flex min-h-12 items-center gap-2.5 rounded-full border border-white/20 bg-[#202023] px-4 py-3 text-sm font-medium text-white shadow-xl transition hover:border-brand/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
        <span aria-hidden="true" className="text-lg text-brand">{open ? "×" : "✦"}</span><span className="sr-only sm:not-sr-only">{open ? "Close" : "Ask BVS"}</span>
      </button>
    </div>
  );
}
