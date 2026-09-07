"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";

type Answer = { reply: string; links?: Array<{ label: string; href: string }> };
type Message = Answer & { role: "user" | "assistant" };

const starterPrompts = [
  "Find music for me",
  "Open Lyrics Pad",
  "Where are my playlists?",
  "How does Creator Studio work?",
];

export default function VisitorAssistant() {
  const { appChrome } = useAppSurface();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", reply: "Hi — I’m Ask BVS. I can help you find what to listen to, where your Library and Lyrics Pad live, how Creator Studio or BeatStore work, and where to go when you need BVS support." },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [busy, messages, open]);

  if (appChrome) return null;

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
        body: JSON.stringify({ message, path: pathname }),
      });
      if (!response.ok) throw new Error();
      const answer = (await response.json()) as Answer;
      setMessages((items) => [...items, { role: "assistant", ...answer }]);
    } catch {
      setMessages((items) => [...items, { role: "assistant", reply: "I can’t connect to Ask BVS right now, but the BVS team can still help.", links: [{ label: "Contact BVS", href: "/contact" }] }]);
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-3 z-[60] sm:right-6 md:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]">
    {open && <section aria-label="Ask BVS" className="mb-3 flex h-[min(36rem,calc(100dvh-12rem-env(safe-area-inset-bottom)))] min-h-72 w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#151517]/95 shadow-2xl backdrop-blur-2xl md:h-[min(620px,72vh)] md:w-[calc(100vw-3rem)]">
      <header className="flex items-center justify-between border-b border-white/10 bg-white/[.025] px-5 py-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Best Virtual Sound</p><h2 className="mt-1 font-semibold">Ask BVS</h2><p className="text-xs text-text-secondary">Your BVS guide</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close Ask BVS" className="grid h-10 w-10 place-items-center rounded-full text-xl text-text-secondary transition hover:bg-white/5 hover:text-white">×</button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-10" : "mr-6"}>
          <p className={message.role === "user" ? "rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm leading-6 text-black" : "rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 text-sm leading-6"}>{message.reply}</p>
          {message.links && <div className="mt-2 flex flex-wrap gap-2">{message.links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="min-h-9 rounded-full border border-brand/35 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand/10">{link.label} →</Link>)}</div>}
        </div>)}
        {busy && <p className="mr-8 rounded-2xl rounded-bl-md bg-white/[0.04] px-4 py-3 text-sm text-text-secondary">Finding the best BVS path…</p>}
        <div ref={endRef} />
      </div>
      {messages.length === 1 && <div className="border-t border-white/[.06] px-4 py-3"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-text-secondary">Try asking</p><div className="flex flex-wrap gap-2">{starterPrompts.map((text) => <button type="button" key={text} onClick={() => void send(undefined, text)} className="min-h-9 rounded-full border border-white/12 px-3 py-2 text-xs text-text-secondary transition hover:border-brand/30 hover:text-brand">{text}</button>)}</div></div>}
      <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-white/10 p-3">
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Ask BVS where to go…" aria-label="Ask BVS a question" className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand" />
        <button type="submit" disabled={!input.trim() || busy} aria-label="Send to Ask BVS" className="grid h-10 w-10 place-items-center rounded-full bg-brand font-semibold text-black disabled:opacity-40">↑</button>
      </form>
    </section>}
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Close Ask BVS" : "Open Ask BVS"} className="ml-auto min-h-11 rounded-full border border-brand/25 bg-[#151517]/95 px-4 py-2.5 text-sm font-semibold text-white shadow-xl backdrop-blur-xl transition hover:border-brand/45 hover:text-brand sm:px-5 sm:py-3">{open ? "Close" : "✦ Ask BVS"}</button>
  </div>;
}
