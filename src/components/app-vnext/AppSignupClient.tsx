"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { SIGNUP_ROLES, type SignupRole } from "@/lib/signup-roles";

type FormState = { email: string; password: string; fullName: string; username: string; role: SignupRole | "" };

export default function AppSignupClient({ surface }: { surface: AppSurface }) {
  const next = `/app/${surface}/you`;
  const [form, setForm] = useState<FormState>({ email: "", password: "", fullName: "", username: "", role: "listener" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [notice, setNotice] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, next }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create your BVS account.");
      setConfirmationEmail(form.email.trim().toLowerCase());
      setNotice(payload.message || "Check your email to confirm your account.");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not create your BVS account.");
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (!confirmationEmail) return;
    setNotice("Sending a fresh confirmation…"); setError("");
    const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: confirmationEmail, resendOnly: true, next }) });
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    if (!response.ok) setError(payload.error || "Could not resend confirmation.");
    else setNotice(payload.message || "Fresh confirmation sent.");
  };

  if (confirmationEmail) return <div className="mx-auto max-w-xl px-4 pb-10 pt-8 sm:px-6"><div className="rounded-[2rem] border border-brand/30 bg-brand/[.07] p-6 text-center"><p className="text-xs uppercase tracking-[.2em] text-brand">One last step</p><h1 className="mt-3 text-3xl font-semibold">Check your email.</h1><p className="mt-3 text-sm text-text-secondary">We sent the BVS confirmation link to <strong className="text-text-primary">{confirmationEmail}</strong>. Open the newest message. After confirmation, BVS will return you to the app.</p>{notice ? <p className="mt-4 text-sm text-brand">{notice}</p> : null}{error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}<div className="mt-6 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => void resend()} className="min-h-11 rounded-full bg-brand px-5 font-semibold text-black">Resend</button><button type="button" onClick={() => setConfirmationEmail("")} className="min-h-11 rounded-full border border-white/15 px-5">Use another email</button></div></div></div>;

  return <div className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-brand">Join BVS · inside the app</p><h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Start with who you are today.</h1><p className="mt-3 max-w-2xl text-text-secondary">Every account can listen. Your starting role only chooses the workspace BVS prepares first; you can add more roles later.</p><form onSubmit={submit} className="mt-7 space-y-5"><fieldset><legend className="font-semibold">What do you want to do first?</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{SIGNUP_ROLES.map((role) => <button key={role.value} type="button" onClick={() => setForm({ ...form, role: role.value })} className={`rounded-2xl border p-4 text-left ${form.role === role.value ? "border-brand/50 bg-brand/10" : "border-white/10 bg-white/[.02]"}`}><span className="block font-semibold">{role.title}</span><span className="mt-1 block text-xs text-text-secondary">{role.copy}</span></button>)}</div></fieldset><div className="grid gap-3 sm:grid-cols-2"><input required autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Full name" className="min-h-12 rounded-xl border border-white/10 bg-white/[.03] px-4 outline-none focus:border-brand/50" /><input required autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="min-h-12 rounded-xl border border-white/10 bg-white/[.03] px-4 outline-none focus:border-brand/50" /></div><input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@email.com" className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 outline-none focus:border-brand/50" /><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create password · 8+ characters" className="min-h-12 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 outline-none focus:border-brand/50" />{error ? <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}<button disabled={loading || !form.role} className="min-h-12 w-full rounded-full bg-brand font-semibold text-black disabled:opacity-50">{loading ? "Creating your BVS account…" : "Create free BVS account"}</button></form><p className="mt-6 text-center text-sm text-text-secondary">Already a member? <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand">Sign in</Link></p></div>;
}
