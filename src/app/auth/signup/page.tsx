"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import PostSignupPremiumOptions from "@/components/auth/PostSignupPremiumOptions";
import { safeAuthDestination } from "@/lib/auth-client-flow";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getFirstTouchAttribution, trackEvent } from "@/lib/analytics";
import { trackSignupFunnel } from "@/lib/signup-funnel";

function destinationForRole(role: string) {
  return role === "listener" ? "/radio" : "/creator/studio";
}

function SignupPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const nextPath = safeAuthDestination(params.get("next"), "");
  const producerIntent =
    params.get("role") === "producer" || nextPath.includes("/create/beat");
  const initialRole = producerIntent ? "producer" : "listener";
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    username: "",
    role: initialRole,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(
    null,
  );
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    trackSignupFunnel("signup_page_viewed", {
      source: params.get("ref") || "direct",
      role: initialRole,
    });
  }, [initialRole, params]);

  const resendConfirmation = async () => {
    if (!verificationEmail) return;
    setResendMessage("Sending…");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: verificationEmail,
          resendOnly: true,
          next: nextPath,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResendMessage(data.error || "Could not resend confirmation email.");
        trackSignupFunnel("submit_failed", { source: "confirmation_resend", role: form.role });
        return;
      }
      trackSignupFunnel("confirmation_resent", { role: form.role });
      setResendMessage(
        data.message ||
          "A new confirmation link was sent. Check inbox and Spam.",
      );
    } catch {
      trackSignupFunnel("submit_failed", { source: "confirmation_resend", role: form.role });
      setResendMessage("Could not resend confirmation email.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured()) {
      trackSignupFunnel("validation_failed", { reason: "account_service_unconfigured", role: form.role });
      setError("Account service is not configured. Please try again later.");
      setLoading(false);
      return;
    }

    if (form.password.length < 8) {
      trackSignupFunnel("validation_failed", { reason: "password_too_short", role: form.role });
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      trackSignupFunnel("validation_failed", { reason: "email_invalid", role: form.role });
      setError(
        "Enter a valid email address (must include @ and a domain), e.g. you@gmail.com.",
      );
      setLoading(false);
      return;
    }

    const username = form.username.trim();
    if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) {
      trackSignupFunnel("validation_failed", { reason: "username_invalid", role: form.role });
      setError(
        "Username: 2–32 characters, letters/numbers/._- only (no spaces).",
      );
      setLoading(false);
      return;
    }

    const attribution = getFirstTouchAttribution();
    const eventAttribution = {
      utm_source: attribution.utm_source || null,
      utm_medium: attribution.utm_medium || null,
      utm_campaign: attribution.utm_campaign || null,
      utm_content: attribution.utm_content || null,
      ref: attribution.ref || null,
    };
    trackSignupFunnel("submit_attempted", { role: form.role });
    trackEvent("signup_started", { role: form.role, ...eventAttribution });

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: form.password,
          username,
          fullName: form.fullName.trim(),
          role: form.role,
          attribution,
          next: nextPath || destinationForRole(form.role),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Signup failed");
      }

      trackEvent("signup_completed", {
        role: form.role,
        needs_confirmation: data.needsConfirmation !== false,
        ...eventAttribution,
      });
      trackSignupFunnel("account_created", {
        role: form.role,
        needs_confirmation: data.needsConfirmation !== false,
      });

      if (data.needsConfirmation !== false) {
        setVerificationEmail(email);
        setInfo(null);
        trackSignupFunnel("confirmation_email_shown", { role: form.role });
        return;
      }

      setInfo(data.message || "Account created.");
      router.push(`/auth/login?next=${encodeURIComponent(nextPath || destinationForRole(form.role))}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      trackSignupFunnel("submit_failed", { role: form.role, reason: message.slice(0, 100) });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center mb-6"
            aria-label="BVS Radio home"
          >
            <Image
              src="/branding/bvs-logo-star-16x9.svg"
              alt="BVS Radio"
              width={1920}
              height={1080}
              className="h-14 w-auto rounded-none object-contain"
              priority
            />
          </Link>
          <h1 className="text-3xl font-bold">Join BVS</h1>
          <p className="text-text-secondary mt-1">
            Listen, discover, create and build your place in BVS.
          </p>
        </div>

        {verificationEmail ? (
          <div
            className="rounded-2xl border border-brand/30 bg-brand/10 p-6 text-center"
            role="status"
          >
            <h2 className="text-xl font-semibold">Check your email</h2>
            <p className="mt-3 text-sm text-text-secondary">
              We sent a confirmation link from{" "}
              <strong className="text-text-primary">
                BVS Radio (contact@bvsradio.com)
              </strong>{" "}
              to{" "}
              <strong className="text-text-primary">{verificationEmail}</strong>
              . Open it to finish creating your account.
            </p>
            <p className="mt-4 text-xs text-text-secondary">
              Also check Spam or Promotions. Use the newest email and open it in
              a full browser tab.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-4 text-sm">
              <button
                type="button"
                onClick={resendConfirmation}
                className="text-brand hover:underline"
              >
                Resend confirmation
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationEmail(null);
                  setResendMessage(null);
                }}
                className="text-brand hover:underline"
              >
                Use a different email
              </button>
              <Link
                href={`/auth/login?next=${encodeURIComponent(nextPath || destinationForRole(form.role))}`}
                className="text-brand hover:underline"
              >
                Sign in after confirming
              </Link>
            </div>
            {resendMessage && (
              <p className="mt-3 text-xs text-text-secondary">
                {resendMessage}
              </p>
            )}
            <PostSignupPremiumOptions role={form.role} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-md space-y-4">
            <label className="block text-sm font-medium">
              I am joining as
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="mt-2 w-full rounded-xl border border-white/10 bg-bg-card px-4 py-3 outline-none focus:border-brand"
              >
                <option value="listener">
                  Listener — discover, save and interact
                </option>
                <option value="artist">
                  Artist — submit music and use creator tools
                </option>
                <option value="producer">
                  Producer — upload and manage beats
                </option>
                <option value="writer">
                  Writer — pitch and publish stories
                </option>
                <option value="show_creator">
                  Show or podcast creator — upload weekly episodes
                </option>
              </select>
              <span className="mt-2 block text-xs text-text-secondary">
                This sets up your starting workspace. Every account can still
                listen and discover.
              </span>
            </label>
            <input
              type="text"
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
              autoComplete="name"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="text"
              placeholder="Username (no spaces)"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoComplete="username"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="email"
              placeholder="you@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
              inputMode="email"
              title="Use a full email like you@gmail.com"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />
            <input
              type="password"
              placeholder="Create a password (min 8 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-bg-card border border-white/10 focus:border-brand px-4 py-3 rounded-xl outline-none"
            />

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-brand" role="status">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-brand hover:bg-brand-dark disabled:opacity-70 text-black font-semibold rounded-full transition-all"
            >
              {loading ? "Creating account…" : "Create Free Account"}
            </button>
          </form>
        )}

        <p className="mx-auto max-w-md text-center mt-6 text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8" role="status">
          Opening signup…
        </p>
      }
    >
      <SignupPageInner />
    </Suspense>
  );
}