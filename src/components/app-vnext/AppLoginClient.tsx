"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

const fieldClass = "min-h-12 w-full rounded-[1rem] border border-white/[.08] bg-white/[.025] px-4 outline-none transition focus:border-brand/35 focus:bg-white/[.04]";

function safeNext(surface: AppSurface, value: string | null) {
  const fallback = `/app/${surface}/you`;
  if (!value || !value.startsWith(`/app/${surface}`) || value.startsWith("//")) return fallback;
  return value;
}

export default function AppLoginClient({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(surface, searchParams.get("next"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alreadyIn, setAlreadyIn] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    void createClient().auth.getSession().then(({ data }) => setAlreadyIn(data.session?.user?.email || ""));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (!isSupabaseConfigured()) throw new Error("Account service is not configured. Please try again later.");
      const id = identifier.trim();
      if (!id) throw new Error("Enter your email or username.");
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: id, password }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        session?: { access_token?: string; refresh_token?: string };
      };
      if (!response.ok) throw new Error(payload.error || "Sign in failed.");
      const accessToken = payload.session?.access_token;
      const refreshToken = payload.session?.refresh_token;
      if (!accessToken || !refreshToken) throw new Error("Sign in succeeded but no session was returned.");
      const { error: sessionError } = await createClient().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) throw sessionError;
      await fetch("/api/auth/profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => null);
      router.replace(next);
      router.refresh();
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-12 pt-8 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Your BVS identity</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Welcome back.</h1>
      <p className="mt-4 text-sm leading-6 text-white/42">Sign in without leaving the BVS app.</p>

      {alreadyIn ? (
        <div className="mt-7 rounded-[1.25rem] border border-brand/20 bg-brand/[.06] p-4 text-sm text-white/56">
          You are already signed in. <Link href={next} className="font-semibold text-brand">Continue to BVS</Link>, or use a different account below.
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-7 space-y-4">
        <div>
          <label htmlFor="app-login-identifier" className="mb-2 block text-sm text-white/58">Email or username</label>
          <input id="app-login-identifier" required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="app-login-password" className="mb-2 block text-sm text-white/58">Password</label>
          <input id="app-login-password" required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} />
        </div>
        <div className="flex justify-end">
          <Link href={`/app/${surface}/forgot-password`} className="text-sm text-brand">Forgot password?</Link>
        </div>
        {error ? <p role="alert" className="rounded-[1rem] border border-red-400/20 bg-red-500/[.08] p-3 text-sm text-red-200">{error}</p> : null}
        <button type="submit" disabled={loading} className="min-h-12 w-full rounded-full bg-white font-semibold text-black transition hover:bg-brand disabled:opacity-50">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/38">New to BVS? <Link href={`/app/${surface}/join/email`} className="font-semibold text-brand">Create an account</Link></p>
    </div>
  );
}
