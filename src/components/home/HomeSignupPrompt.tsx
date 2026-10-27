"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { trackSignupFunnel } from "@/lib/signup-funnel";

const DISMISS_KEY = "bvs.home.signup_prompt.dismissed_at.v1";
const DISMISS_FOR_MS = 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 3200;

function recentlyDismissed() {
  try {
    const value = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    return Number.isFinite(value) && value > 0 && Date.now() - value < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export default function HomeSignupPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    let cancelled = false;

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setOpen(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || data.session || recentlyDismissed()) return;
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setOpen(true);
        trackSignupFunnel("join_prompt_shown", { source: "home_popup" });
      }, SHOW_DELAY_MS);
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
    trackSignupFunnel("join_prompt_dismissed", { source: "home_popup" });
    setOpen(false);
  };

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="home-signup-title"
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[80] mx-auto max-w-md rounded-[1.6rem] border border-brand/20 bg-[#11130f]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,.55)] backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-brand">Make BVS yours</p>
          <h2 id="home-signup-title" className="mt-2 text-2xl font-semibold tracking-tight">Join BVS free.</h2>
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

      <p className="mt-3 text-sm leading-6 text-white/55">
        Save music, follow creators, keep your Library in sync and unlock your creator workspace. After signup, you can stay free or see the Premium options straight away.
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/auth/signup?ref=home_signup_prompt"
          data-signup-source="home_popup"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-brand px-5 font-semibold text-black transition hover:bg-white"
        >
          Sign up free
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
