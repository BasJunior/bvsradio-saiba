"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { isSupabaseConfigured } from "@/lib/supabase";

const fieldClass = "min-h-12 w-full rounded-[1rem] border border-white/[.08] bg-white/[.025] px-4 outline-none transition focus:border-brand/35 focus:bg-white/[.04]";

export default function AppForgotPasswordClient({ surface }: { surface: AppSurface }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Account service is not configured.");
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not send a reset email.");
      setSent(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not send a reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-8 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Account recovery</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Reset your password.</h1>
      <p className="mt-4 text-sm leading-6 text-white/42">We will email you a secure link to choose a new password.</p>
      {sent ? (
        <div role="status" className="mt-7 rounded-[1.5rem] border border-brand/20 bg-brand/[.06] p-6 text-center">
          <h2 className="text-2xl font-semibold">Check your email.</h2>
          <p className="mt-3 text-sm leading-6 text-white/46">If an account exists for that address, BVS sent a reset link. Check your spam folder too.</p>
          <Link href={`/app/${surface}/login`} className="mt-6 inline-flex min-h-11 items-center rounded-full bg-white px-5 font-semibold text-black">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label htmlFor="app-reset-email" className="block text-sm text-white/58">Email address</label>
          <input id="app-reset-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
          {error ? <p role="alert" className="rounded-[1rem] border border-red-400/20 bg-red-500/[.08] p-3 text-sm text-red-200">{error}</p> : null}
          <button type="submit" disabled={loading} className="min-h-12 w-full rounded-full bg-white font-semibold text-black transition hover:bg-brand disabled:opacity-50">{loading ? "Sending…" : "Send reset link"}</button>
          <p className="text-center text-sm"><Link href={`/app/${surface}/login`} className="text-brand">Back to sign in</Link></p>
        </form>
      )}
    </div>
  );
}
