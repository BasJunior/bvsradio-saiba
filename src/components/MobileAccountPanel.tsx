"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function MobileAccountPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedInEmail, setSignedInEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMessage("Account service is unavailable.");
      setLoading(false);
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSignedInEmail(data.session?.user?.email || "");
      setLoading(false);
    });
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user?.email || "");
    });
    return () => auth.subscription.unsubscribe();
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!isSupabaseConfigured() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setPassword("");
      setMessage("Signed in to the BVS listener account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await createClient().auth.signOut();
      setSignedInEmail("");
      setMessage("Signed out.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-white/10 p-6 text-sm text-text-secondary">Loading listener account…</div>;
  }

  if (signedInEmail) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Listener account</p>
        <h2 className="mt-2 text-2xl font-semibold">Signed in</h2>
        <p className="mt-2 break-all text-sm text-text-secondary">{signedInEmail}</p>
        <p className="mt-4 text-sm leading-6 text-text-secondary">
          This App Store surface keeps account access limited to listener identity and session controls. Creator, editorial, finance and administrative tools remain on the BVS website and are not native app features.
        </p>
        <button type="button" onClick={() => void signOut()} disabled={busy} className="mt-5 rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-50">Sign out</button>
        {message ? <p className="mt-4 text-sm text-text-secondary" role="status">{message}</p> : null}
      </section>
    );
  }

  return (
    <form onSubmit={signIn} className="rounded-2xl border border-white/10 bg-white/[.025] p-6">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-brand">Listener account</p>
      <h2 className="mt-2 text-2xl font-semibold">Sign in</h2>
      <p className="mt-2 text-sm text-text-secondary">Use the review account from App Review Information or your BVS listener account.</p>
      <label className="mt-5 block text-sm">Email
        <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand" />
      </label>
      <label className="mt-4 block text-sm">Password
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-brand" />
      </label>
      <button type="submit" disabled={busy || !email.trim() || !password} className="mt-5 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
      {message ? <p className="mt-4 text-sm text-text-secondary" role="status">{message}</p> : null}
    </form>
  );
}
