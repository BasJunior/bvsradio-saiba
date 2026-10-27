"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { trackSignupFunnel } from "@/lib/signup-funnel";

const DISMISS_KEY = "bvs.home.signup_prompt.dismissed_at.v1";
const VARIANT_KEY = "bvs.home.signup_prompt.variant.v1";
const SESSION_SHOWN_KEY = "bvs.home.signup_prompt.shown.v1";
const DISMISS_FOR_MS = 24 * 60 * 60 * 1000;

type PromptVariant = "direct" | "identity";

type PromptCopy = {
  delayMs: number;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
};

const PROMPT_VARIANTS: Record<PromptVariant, PromptCopy> = {
  direct: {
    delayMs: 3500,
    eyebrow: "Make BVS yours",
    title: "Join BVS free.",
    copy: "Save music, follow creators, keep your Library in sync and unlock your creator workspace. After signup, you can stay free or see the Premium options straight away.",
    cta: "Sign up free",
  },
  identity: {
    delayMs: 8000,
    eyebrow: "Your BVS",
    title: "Keep the music with you.",
    copy: "Create a free account to save what you find, follow artists and pick up where you left off. If you create music, your Studio is ready too.",
    cta: "Make it yours",
  },
};

function recentlyDismissed() {
  try {
    const value = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    return Number.isFinite(value) && value > 0 && Date.now() - value < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function alreadyShownThisSession() {
  try {
    return window.sessionStorage.getItem(SESSION_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markShownThisSession() {
  try {
    window.sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
  } catch {
    // Session-level frequency cap is best effort when storage is unavailable.
  }
}

function assignedVariant(): PromptVariant {
  try {
    const existing = window.localStorage.getItem(VARIANT_KEY);
    if (existing === "direct" || existing === "identity") return existing;
    const next: PromptVariant = Math.random() < 0.5 ? "direct" : "identity";
    window.localStorage.setItem(VARIANT_KEY, next);
    return next;
  } catch {
    return "direct";
  }
}

export default function HomeSignupPrompt() {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<PromptVariant>("direct");

  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    let cancelled = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setOpen(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || data.session || recentlyDismissed() || alreadyShownThisSession()) return;

      const selectedVariant = assignedVariant();
      const selectedCopy = PROMPT_VARIANTS[selectedVariant];
      setVariant(selectedVariant);

      timer = window.setTimeout(() => {
        if (cancelled) return;
        markShownThisSession();
        setOpen(true);
        trackSignupFunnel("join_prompt_shown", {
          source: "home_popup",
          variant: selectedVariant,
          delay_ms: selectedCopy.delayMs,
        });
      }, selectedCopy.delayMs);
    });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Dismissal still works for this render when storage is unavailable.
    }
    trackSignupFunnel("join_prompt_dismissed", { source: "home_popup", variant });
    setOpen(false);
  };

  if (!open) return null;

  const prompt = PROMPT_VARIANTS[variant];

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="home-signup-title"
      className="fixed inset-x-3 bottom-[calc(10.5rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-md rounded-[1.6rem] border border-brand/20 bg-[#11130f]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-20 sm:mx-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">{prompt.eyebrow}</p>
          <h2 id="home-signup-title" className="mt-2 text-2xl font-semibold tracking-tight">{prompt.title}</h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss signup prompt"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 text-lg text-white/60 transition hover:border-white/20 hover:text-white"
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-white/55">{prompt.copy}</p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/auth/signup?ref=home_signup_prompt_${variant}`}
          data-signup-source={`home_popup_${variant}`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand px-5 font-semibold text-black transition hover:bg-white"
        >
          {prompt.cta}
        </Link>
        <Link
          href="/auth/login"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 px-5 font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Sign in
        </Link>
      </div>

      <p className="mt-3 text-center text-[11px] leading-5 text-white/32">Listening stays free. Premium never buys editorial approval or guaranteed streams.</p>
    </aside>
  );
}
