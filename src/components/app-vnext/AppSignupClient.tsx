"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import PostSignupPremiumOptions from "@/components/auth/PostSignupPremiumOptions";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { getFirstTouchAttribution, trackEvent } from "@/lib/analytics";
import { trackSignupFunnel } from "@/lib/signup-funnel";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/signup-roles";

type FormState = { email: string; password: string; fullName: string; username: string; role: SignupRole | "" };

const fieldClass = "min-h-12 w-full rounded-[1rem] border border-white/[.08] bg-white/[.025] px-4 outline-none transition focus:border-brand/35 focus:bg-white/[.04]";

export default function AppSignupClient({ surface, nextPath }: { surface: AppSurface; nextPath?: string }) {
  const next = nextPath?.startsWith(`/app/${surface}/`) && !nextPath.startsWith(`/app/${surface}//`)
    ? nextPath
    : `/app/${surface}/you`;
  const [form, setForm] = useState<FormState>({ email: "", password: "", fullName: "", username: "", role: "listener" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    trackSignupFunnel("signup_page_viewed", { source: "app_join", role: "listener", app_surface: surface });
  }, [surface]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(""); setNotice("");

    const email = form.email.trim().toLowerCase();
    const username = form.username.trim();
    const fullName = form.fullName.trim();
    if (!form.role) {
      trackSignupFunnel("validation_failed", { reason: "role_required", app_surface: surface });
      setError("Choose what you want to do first."); setLoading(false); return;
    }
    if (!fullName) {
      trackSignupFunnel("validation_failed", { reason: "full_name_required", role: form.role, app_surface: surface });
      setError("Enter your name."); setLoading(false); return;
    }
    if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) {
      trackSignupFunnel("validation_failed", { reason: "username_invalid", role: form.role, app_surface: surface });
      setError("Username: 2–32 characters, letters/numbers/._- only (no spaces)."); setLoading(false); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      trackSignupFunnel("validation_failed", { reason: "email_invalid", role: form.role, app_surface: surface });
      setError("Enter a valid email address."); setLoading(false); return;
    }
    if (form.password.length < 8) {
      trackSignupFunnel("validation_failed", { reason: "password_too_short", role: form.role, app_surface: surface });
      setError("Password must be at least 8 characters."); setLoading(false); return;
    }

    const attribution = getFirstTouchAttribution();
    const eventAttribution = {
      utm_source: attribution.utm_source || null,
      utm_medium: attribution.utm_medium || null,
      utm_campaign: attribution.utm_campaign || null,
      utm_content: attribution.utm_content || null,
      ref: attribution.ref || null,
    };
    trackSignupFunnel("submit_attempted", { role: form.role, app_surface: surface });
    trackEvent("signup_started", { role: form.role, surface, ...eventAttribution });

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email, username, fullName, next, attribution }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; needsConfirmation?: boolean };
      if (!response.ok) throw new Error(payload.error || "Could not create your BVS account.");

      trackEvent("signup_completed", {
        role: form.role,
        surface,
        needs_confirmation: payload.needsConfirmation !== false,
        ...eventAttribution,
      });
      trackSignupFunnel("account_created", {
        role: form.role,
        app_surface: surface,
        needs_confirmation: payload.needsConfirmation !== false,
      });
      setConfirmationEmail(email);
      setNotice(payload.message || "Check your email to confirm your account.");
      trackSignupFunnel("confirmation_email_shown", { role: form.role, app_surface: surface });
    } catch (issue) {
      const message = issue instanceof Error ? issue.message : "Could not create your BVS account.";
      trackSignupFunnel("submit_failed", { role: form.role, app_surface: surface, reason: message.slice(0, 100) });
      setError(message);
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (!confirmationEmail) return;
    setNotice("Sending a fresh confirmation…"); setError("");
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: confirmationEmail, resendOnly: true, next }) });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) {
        trackSignupFunnel("submit_failed", { source: "confirmation_resend", role: form.role, app_surface: surface });
        setError(payload.error || "Could not resend confirmation.");
      } else {
        trackSignupFunnel("confirmation_resent", { role: form.role, app_surface: surface });
        setNotice(payload.message || "Fresh confirmation sent.");
      }
    } catch {
      trackSignupFunnel("submit_failed", { source: "confirmation_resend", role: form.role, app_surface: surface });
      setError("Could not resend confirmation.");
    }
  };

  if (confirmationEmail) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
        <div className="rounded-[2rem] border border-brand/18 bg-gradient-to-br from-brand/[.065] to-white/[.02] p-6 text-center sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Almost there</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Check your email.</h1>
          <p className="mt-4 text-sm leading-6 text-white/42">We sent a confirmation link to <strong className="text-white/82">{confirmationEmail}</strong>. Open the newest message and we’ll bring you back to BVS.</p>
          {notice ? <p className="mt-4 text-sm text-brand">{notice}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button type="button" onClick={() => void resend()} className="min-h-11 rounded-full bg-white px-5 font-semibold text-black transition hover:bg-brand">Resend</button>
            <button type="button" onClick={() => setConfirmationEmail("")} className="min-h-11 rounded-full border border-white/[.1] px-5 text-white/58">Use another email</button>
          </div>
          <PostSignupPremiumOptions role={form.role || "listener"} surface={surface} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 pt-8 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Create account</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Start with what you want from music today.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-white/42 sm:text-base">Everyone can listen. Your starting role simply shapes the first workspace you see; the same identity can grow with you later.</p>

      <form onSubmit={submit} noValidate className="mt-8 space-y-6">
        <fieldset>
          <legend className="font-semibold">What do you want to do first?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SIGNUP_ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => setForm({ ...form, role: role.value })}
                className={`rounded-[1.25rem] border p-4 text-left transition ${form.role === role.value ? "border-brand/28 bg-brand/[.065]" : "border-white/[.07] bg-white/[.02] hover:border-white/15 hover:bg-white/[.035]"}`}
              >
                <span className="block font-semibold">{role.title}</span>
                <span className="mt-2 block text-xs leading-5 text-white/36">{role.copy}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <input required autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" className={fieldClass} />
          <input required autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className={fieldClass} />
        </div>
        <input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" className={fieldClass} />
        <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create password · 8+ characters" className={fieldClass} />

        {error ? <p className="rounded-[1rem] border border-red-400/20 bg-red-500/[.08] p-3 text-sm text-red-200">{error}</p> : null}
        <button disabled={loading || !form.role} className="min-h-12 w-full rounded-full bg-white font-semibold text-black transition hover:bg-brand disabled:opacity-50">{loading ? "Creating your account…" : "Create free account"}</button>
      </form>

      <p className="mt-6 text-center text-sm text-white/38">Already have an account? <Link href={`/app/${surface}/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand">Sign in</Link></p>
    </div>
  );
}
