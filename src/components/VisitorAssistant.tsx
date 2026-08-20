"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { readRecentFlowObjects } from "@/lib/flow-memory";
import { readLibrary } from "@/lib/library";

type AskObject = {
  id: string;
  kind: "track" | "release" | "creator" | "beat" | "story" | "show" | "product" | "service";
  title: string;
  subtitle?: string;
  route: string;
  artwork?: string;
  collection?: string;
  mediaSrc?: string;
};

type Answer = {
  reply: string;
  links?: Array<{ label: string; href: string }>;
  objects?: AskObject[];
  mode?: "flow" | "guide";
  reason?: string;
};
type Message = Answer & { role: "user" | "assistant" };

function needsDeviceContext(message: string) {
  const q = message.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /what.*(been listening|listened|played)|my listening|listening history|what did i play|where.*(left off|was i|did i go)|my trail|recently explored|what did i explore|(new|latest|happening|recent).*(follow|following)|(?:follow|following).*(new|latest|happening|recent)|creators i follow|people i follow/.test(q);
}

function clientContext(message: string) {
  if (!needsDeviceContext(message)) return {};
  const item = (value: { id: string; kind: string; title: string; subtitle?: string; href?: string }) => ({
    id: value.id,
    kind: value.kind,
    title: value.title,
    subtitle: value.subtitle,
    href: value.href,
  });
  return {
    history: readLibrary("history").slice(0, 8).map(item),
    follows: readLibrary("follows").slice(0, 8).map(item),
    recent: readRecentFlowObjects().slice(0, 8).map((value) => ({
      id: value.id,
      kind: value.kind,
      title: value.title,
      href: value.route,
    })),
  };
}

function objectLabel(kind: AskObject["kind"]) {
  if (kind === "creator") return "Creator";
  if (kind === "beat") return "Beat";
  if (kind === "release") return "Release";
  if (kind === "show") return "Show";
  if (kind === "story") return "Story";
  if (kind === "service") return "Service";
  if (kind === "product") return "Product";
  return "Track";
}

function AskObjectCard({ object }: { object: AskObject }) {
  const mediaObject = object.kind === "track" || object.kind === "beat" || object.kind === "release";
  const content = (
    <>
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
        {object.artwork ? (
          <Image src={object.artwork} alt="" fill unoptimized={/^https?:\/\//i.test(object.artwork)} className="object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-brand">BVS</span>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[9px] font-semibold uppercase tracking-[.15em] text-brand">{objectLabel(object.kind)}</p>
        <p className="truncate text-sm font-semibold text-white">{object.title}</p>
        {object.subtitle ? <p className="truncate text-[11px] text-text-secondary">{object.subtitle}</p> : null}
      </div>
      <span className="shrink-0 text-xs text-brand">{mediaObject ? "Details" : "Open"} →</span>
    </>
  );

  if (mediaObject) {
    return (
      <button
        type="button"
        data-flow-detail-trigger={object.kind}
        data-flow-detail-id={object.id}
        data-flow-detail-title={object.title}
        data-flow-detail-artist={object.subtitle || "BVS creator"}
        data-flow-detail-image={object.artwork || ""}
        data-flow-detail-collection={object.collection || ""}
        data-flow-detail-src={object.mediaSrc || ""}
        data-flow-detail-href={object.route}
        className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 transition hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={object.route} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 transition hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
      {content}
    </Link>
  );
}

export default function VisitorAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      reply: "Ask me about music, releases, creators, beats, what’s happening on BVS, or your recent BVS path. I’ll use published BVS data rather than inventing an answer.",
      mode: "flow",
    },
  ]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [busy, messages, open]);

  async function send(event?: FormEvent, prompt = input) {
    event?.preventDefault();
    const message = prompt.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((items) => [...items, { role: "user", reply: message }]);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context: clientContext(message) }),
      });
      if (!response.ok) throw new Error();
      const answer = (await response.json()) as Answer;
      setMessages((items) => [...items, { role: "assistant", ...answer }]);
    } catch {
      setMessages((items) => [...items, {
        role: "assistant",
        reply: "I can’t read the BVS graph right now.",
        links: [{ label: "Explore BVS", href: "/search" }, { label: "Contact BVS", href: "/contact" }],
      }]);
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-3 z-[60] sm:right-6 md:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]">
    {open && <section aria-label="Ask BVS" className="mb-3 flex h-[min(38rem,calc(100dvh-12rem-env(safe-area-inset-bottom)))] min-h-72 w-[calc(100vw-1.5rem)] max-w-[400px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#181818] shadow-2xl md:h-[min(640px,74vh)] md:w-[calc(100vw-3rem)]">
      <header className="flex items-center justify-between border-b border-white/10 bg-bg-secondary px-5 py-4">
        <div><h2 className="font-semibold text-brand">Ask BVS</h2><p className="text-xs text-text-secondary">Flow discovery · published BVS data</p></div>
        <button onClick={() => setOpen(false)} aria-label="Close Ask BVS" className="grid h-11 w-11 place-items-center rounded-full text-2xl text-text-secondary hover:bg-white/5">×</button>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-10" : "mr-4"}>
          <p className={message.role === "user" ? "rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm text-black" : "rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 text-sm leading-relaxed"}>{message.reply}</p>
          {message.objects?.length ? <div className="mt-2 space-y-2">{message.objects.map((object) => <AskObjectCard key={`${object.kind}:${object.id}`} object={object} />)}</div> : null}
          {message.links?.length ? <div className="mt-2 flex flex-wrap gap-2">{message.links.map((link) => <Link key={`${link.href}:${link.label}`} href={link.href} data-flow-detail-skip="true" className="rounded-full border border-brand/40 px-3 py-1.5 text-xs text-brand hover:bg-brand/10">{link.label} →</Link>)}</div> : null}
        </div>)}
        {busy && <p className="text-sm text-text-secondary">Searching BVS…</p>}
        <div ref={endRef} />
      </div>
      {messages.length === 1 && <div className="flex flex-wrap gap-2 px-4 pb-3">{[
        "Who made Chiraq Drillaz?",
        "What’s new on BVS?",
        "Find beats by Wolf Bridges",
        "What have I been listening to?",
      ].map((text) => <button key={text} onClick={() => void send(undefined, text)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-text-secondary hover:border-brand/40 hover:text-white">{text}</button>)}</div>}
      <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-white/10 p-3">
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Ask about a track, creator, beat or what’s new…" aria-label="Ask BVS" className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand" />
        <button disabled={!input.trim() || busy} aria-label="Send to Ask BVS" className="h-11 w-11 rounded-full bg-brand text-black disabled:opacity-40">↑</button>
      </form>
    </section>}
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close Ask BVS" : "Open Ask BVS"} className="ml-auto min-h-11 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-xl sm:px-5 sm:py-3">{open ? "Close" : "✦ Ask BVS"}</button>
  </div>;
}
