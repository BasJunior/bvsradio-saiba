"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type ApprovalStatus = "checking" | "ready" | "approving" | "approved" | "error";

export default function AppQrApproveClient({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pairing = searchParams.get("pairing") || "";
  const approvalToken = searchParams.get("token") || "";
  const [status, setStatus] = useState<ApprovalStatus>("checking");
  const [detail, setDetail] = useState("Checking your BVS account…");
  const [email, setEmail] = useState("");

  const approvalPath = useMemo(() => {
    const params = new URLSearchParams();
    if (pairing) params.set("pairing", pairing);
    if (approvalToken) params.set("token", approvalToken);
    const suffix = params.toString();
    return `/app/${surface}/qr/approve${suffix ? `?${suffix}` : ""}`;
  }, [approvalToken, pairing, surface]);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!pairing || !approvalToken) {
        if (!alive) return;
        setStatus("error");
        setDetail("This QR login link is incomplete. Scan a new code from the computer.");
        return;
      }
      if (!isSupabaseConfigured()) {
        if (!alive) return;
        setStatus("error");
        setDetail("Account service is unavailable right now. Scan a new code later.");
        return;
      }
      const { data } = await createClient().auth.getSession();
      if (!alive) return;
      if (!data.session) {
        router.replace(`/app/${surface}/login?next=${encodeURIComponent(approvalPath)}`);
        return;
      }
      setEmail(data.session.user.email || "your BVS account");
      setStatus("ready");
      setDetail("Only approve if this QR code is visible on the computer in front of you.");
    };
    void check();
    return () => { alive = false; };
  }, [approvalPath, approvalToken, pairing, router, surface]);

  const approve = async () => {
    setStatus("approving");
    setDetail("Approving this computer…");
    try {
      const { data } = await createClient().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.replace(`/app/${surface}/login?next=${encodeURIComponent(approvalPath)}`);
        return;
      }
      const response = await fetch("/api/auth/qr/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ pairingId: pairing, approvalToken }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not approve this computer.");
      window.history.replaceState({}, "", `/app/${surface}/qr/approve`);
      setStatus("approved");
      setDetail("Computer approved. Return to it — BVS will finish signing you in automatically.");
    } catch (issue) {
      setStatus("error");
      setDetail(issue instanceof Error ? issue.message : "Could not approve this computer.");
    }
  };

  return (
    <div className="mx-auto flex min-h-[68dvh] max-w-lg items-center px-4 pb-12 pt-8 sm:px-6">
      <section className="w-full rounded-[2rem] border border-white/[.09] bg-white/[.025] p-6 text-center shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Secure device login</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Approve this computer?</h1>
        {email ? <p className="mt-3 text-sm text-white/48">Signed in as <strong className="text-white">{email}</strong></p> : null}
        <p className="mt-5 text-sm leading-6 text-white/48">{detail}</p>

        {status === "ready" ? (
          <button type="button" onClick={() => void approve()} className="mt-7 min-h-12 w-full rounded-full bg-brand px-6 font-semibold text-black transition hover:bg-white">
            Approve computer
          </button>
        ) : null}

        {status === "checking" || status === "approving" ? (
          <div className="mt-7 rounded-full border border-brand/20 bg-brand/[.06] px-5 py-3 text-sm font-medium text-brand">
            {status === "checking" ? "Checking account…" : "Approving…"}
          </div>
        ) : null}

        {status === "approved" ? (
          <Link href={`/app/${surface}`} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/15 px-6 font-semibold text-white">
            Continue in BVS
          </Link>
        ) : null}

        {status === "error" ? (
          <div className="mt-7 space-y-3">
            <Link href={`/app/${surface}`} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/15 px-6 font-semibold text-white">
              Return to BVS
            </Link>
            <p className="text-xs text-white/30">For security, expired or incomplete QR codes must be scanned again from the computer.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
