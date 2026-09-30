"use client";

import Link from "next/link";
import { readLibrary } from "@/lib/library";
import type { AskBvsObject } from "@/lib/ask-bvs-flow";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppSurface } from "@/components/app/AppSurfaceProvider";

type Answer = { reply: string; objects?: AskBvsObject[]; links?: Array<{ label: string; href: string }> };
type Message = Answer & { role: "user" | "assistant" };

const HINT_STORAGE_KEY = "bvs_ask_hint_dismissed_v1";

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
  const [showHint, setShowHint] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      reply:
        "Ask me about published BVS music, creators, beats, verified credits, or your recent listening. I can also help you find Library, Lyrics Pad and Creator Studio.",
    },
  ]);
  const endRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setShowHint(window.localStorage.getItem(HINT_STORAGE_KEY) !== "1");
      } catch {
        setShowHint(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [busy, messages, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      launcherRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (appChrome) return null;

  const dismissHint = () => {
    setShowHint(false);
    try {
      window.localStorage.setItem(HINT_STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
  };

  const closeAssistant = () => {
    setOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  };

  const toggleAssistant = () => {
    if (!open) dismissHint();
    setOpen((value) => !value);
  };

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
        body: JSON.stringify({ message, path: pathname, context: deviceContext(message) }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error();
      const answer = (await response.json()) as Answer;
      setMessages((items) => [...items, { role: "assistant", ...answer }]);
    } catch {
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          reply: "I can’t connect to Ask BVS right now, but the BVS team can still help.",
          links: [{ label: "Contact BVS", href: "/contact" }],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-bvs-assistant
      className="fixed bottom-[calc(9.25rem+env(safe-area-inset-bottom))] right-3 z-[60] flex flex-col items-end sm:right-6 md:bottom-[calc(6.25rem+env(safe-area-inset-bottom))]"
    >
      {open ? (
        <section
          id="bvs-assistant-panel"
          role="dialog"
          aria-label="Ask BVS"
          className="mb-3 flex h-[min(36rem,calc(100dvh-12rem-env(safe-area-inset-bottom)))] min-h-0 w-[calc(100vw-1.5rem)] max-w-[390px] flex-col overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#151517]/95 shadow-2xl backdrop-blur-2xl md:h-[min(620px,72vh)] md:w-[calc(100vw-3rem)]"
        >
          <header className="flex items-center justify-between border-b border-white/10 bg-white/[.025] px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-brand">Best Virtual Sound</p>
              <h2 className="mt-1 font-semibold">Ask BVS</h2>
              <p className="text-xs text-text-secondary">Your BVS guide</p>
            </div>
            <button
              type="button"
              onClick={closeAssistant}
              aria-label="Close Ask BVS"
              className="grid h-10 w-10 place-items-center rounded-full text-xl text-text-secondary transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              ×
            </button>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">
            {messages.map((message, index) => (
              <div key={index} className={message.role === "user" ? "ml-10" : "mr-6"}>
                <p
                  className={
                    message.role === "user"
                      ? "rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm leading-6 text-black"
                      : "rounded-2xl rounded-bl-md bg-white/[0.07] px-4 py-3 text-sm leading-6"
                  }
                >
                  {message.reply}
                </p>
                {message.objects?.length ? (
                  <div className="mt-2 space-y-2">
                    {message.objects.map((object) => (
                      <Link key={`${object.kind}:${object.id}`} href={object.route} onClick={closeAssistant} className="flex min-h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[.035] p-3 hover:border-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] uppercase tracking-wider text-brand">{object.kind}</span>
                          <span className="block truncate text-sm font-semibold">{object.title}</span>
                          {object.subtitle ? <span className="block truncate text-xs text-text-secondary">{object.subtitle}</span> : null}
                        </span>
                        <span className="shrink-0 text-xs text-brand">Open →</span>
                      </Link>
                    ))}
                  </div>
                ) : null}
                {message.links ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeAssistant}
                        className="min-h-9 rounded-full border border-brand/35 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand/10"
                      >
                        {link.label} →
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <p className="mr-8 rounded-2xl rounded-bl-md bg-white/[0.04] px-4 py-3 text-sm text-text-secondary">
                Finding the best BVS path…
              </p>
            ) : null}
            <div ref={endRef} />
          </div>
          {messages.length === 1 ? (
            <div className="border-t border-white/[.06] px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-text-secondary">Try asking</p>
              <div className="flex flex-wrap gap-2">
                {starterPrompts.map((text) => (
                  <button
                    type="button"
                    key={text}
                    onClick={() => void send(undefined, text)}
                    className="min-h-9 rounded-full border border-white/12 px-3 py-2 text-xs text-text-secondary transition hover:border-brand/30 hover:text-brand"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-white/10 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={500}
              placeholder="Ask BVS where to go…"
              aria-label="Ask BVS a question"
              className="min-w-0 flex-1 rounded-full bg-white/[0.07] px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              aria-label="Send to Ask BVS"
              className="grid h-10 w-10 place-items-center rounded-full bg-brand font-semibold text-black disabled:opacity-40"
            >
              ↑
            </button>
          </form>
        </section>
      ) : null}

      {!open && showHint ? (
        <div
          data-bvs-assistant-hint
          className="mb-2 flex w-fit max-w-[min(18rem,calc(100vw-4.5rem))] items-center gap-1 rounded-full border border-white/10 bg-[#151517]/95 py-1.5 pl-3 pr-1.5 text-sm font-semibold text-white shadow-xl backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={toggleAssistant}
            className="min-h-9 px-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Ask BVS
          </button>
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Dismiss Ask BVS hint"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-text-secondary transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            ×
          </button>
        </div>
      ) : null}

      <button
        ref={launcherRef}
        type="button"
        onClick={toggleAssistant}
        aria-expanded={open}
        aria-controls={open ? "bvs-assistant-panel" : undefined}
        aria-label={open ? "Close Ask BVS" : "Open Ask BVS"}
        title={open ? "Close Ask BVS" : "Ask BVS"}
        className="grid h-12 w-12 place-items-center rounded-full border border-brand/25 bg-white text-xl font-semibold text-black shadow-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-black motion-reduce:transition-none motion-reduce:hover:scale-100"
      >
        {open ? "×" : "✦"}
      </button>
    </div>
  );
}
