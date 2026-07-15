"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Answer = { reply: string; links?: Array<{ label: string; href: string }> };
type Message = Answer & { role: "user" | "assistant" };

export default function VisitorAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", reply: "Hi — I’m the BVS guide. Ask me about listening live, music submissions, artists, or audio services." },
  ]);

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
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error();
      const answer = (await response.json()) as Answer;
      setMessages((items) => [...items, { role: "assistant", ...answer }]);
    } catch {
      setMessages((items) => [...items, { role: "assistant", reply: "I can’t connect right now.", links: [{ label: "Contact BVS", href: "/contact" }] }]);
    } finally {
      setBusy(false);
    }
  }

  return <div className="fixed bottom-24 right-4 z-[60] sm:right-6 sm:bottom-28">
    {open && <section aria-label="BVS visitor assistant" className="mb-3 flex h-[min(600px,70vh)] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#101018] shadow-2xl">
      <header className="flex items-center justify-between border-b border-white/10 bg-bg-secondary px-5 py-4">
        <div><h2 className="font-semibold text-brand">BVS Guide</h2><p className="text-xs text-text-secondary">Visitor support</p></div>
        <button onClick={() => setOpen(false)} aria-label="Close assistant" className="text-2xl text-text-secondary">×</button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, index) => <div key={index} className={message.role === "user" ? "ml-10" : "mr-8"}>
          <p className={message.role === "user" ? "rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm text-black" : "rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 text-sm"}>{message.reply}</p>
          {message.links && <div className="mt-2 flex gap-2">{message.links.map((link) => <Link key={link.href} href={link.href} className="rounded-full border border-brand/40 px-3 py-1.5 text-xs text-brand">{link.label} →</Link>)}</div>}
        </div>)}
        {busy && <p className="text-sm text-text-secondary">Thinking…</p>}
      </div>
      {messages.length === 1 && <div className="flex flex-wrap gap-2 px-4 pb-3">{["How do I listen?", "Submit my music", "Audio services"].map((text) => <button key={text} onClick={() => void send(undefined, text)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-text-secondary">{text}</button>)}</div>}
      <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-white/10 p-3">
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Ask about BVS Radio…" aria-label="Message BVS guide" className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand" />
        <button disabled={!input.trim() || busy} aria-label="Send message" className="h-10 w-10 rounded-full bg-brand text-black disabled:opacity-40">↑</button>
      </form>
    </section>}
    <button onClick={() => setOpen((value) => !value)} aria-expanded={open} className="ml-auto rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-xl">{open ? "Close" : "✦ Ask BVS"}</button>
  </div>;
}
