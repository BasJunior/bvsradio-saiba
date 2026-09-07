"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppSurface } from "@/components/app-vnext/AppBootstrap";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type Status = "checking" | "ready" | "approving" | "approved" | "error";

export default function AppQrApproveClient({ surface }: { surface: AppSurface }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pairing = searchParams.get("pairing") || "";
  const approvalToken = searchParams.get("token") || "";
  const returnPath = useMemo(() => {
    const params = new URLSearchParams();
    if (pairing) params.set("pairing", pairing);
    if (approvalToken) params.set("token", approvalToken);
    return `/app/${surface}/qr/approve${params.size ? `?${params.toString()}` : ""}`;
  }, [approvalToken, pairing, surface]);
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState("Checking your BVS account…");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!pairing || !approvalToken) {
        if (!active) return;
        setStatus("error");
        setDetail("This QR login link is incomplete. Scan a new code from the computer.");
        return;
      }
      if (!isSupabaseConfigured()) {
        if (!active) return;
        setStatus("error");
        setDetail("Account service is temporarily unavailable.");
        return;
      }
      const { data } = await createClient().auth.getSession();
      if (!active) return;
      if (!data.session) {
        router.replace(`/app/${surface}/login?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      setEmail(data.session.user.email || "your BVS account");
      setStatus("ready");
      setDetail("Only approve if this QR code is visible on the computer in front of you.");
    };
    void check();
    return () => { active = false; };
  }, [approvalToken, pairing, returnPath, router, surface]);

  const approve = async () => {
    if (!pairing || !approvalToken || status === "approving") return;
    setStatus("approving");
    setDetail("Approving this computer…");
    try {
      const { data } = await createClient().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        router.replace(`/app/${surface}/login?next=${encodeURIComponent(returnPath)}`);
        return;
      }
      const response = await fetch("/api/auth/qr/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ pairingId: pairing, approvalToken }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not approve this computer.");
      window.history.replaceState(window.history.state, "", `/app/${surface}/qr/approve`);
      setStatus("approved");
      setDetail("Computer approved. It will finish signing in automatically.");
    } catch (issue) {
      setStatus("error");
      setDetail(issue instanceof Error ? issue.message : "Could not approve this computer.");
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:px-6">
      <section className="rounded-[1.8rem] border border-white/[.08] bg-white/[.025] p-6 text-center sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-brand">Secure device login</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Approve this computer?</h1>
        {email ? <p className="mt-3 text-sm text-white/48">Signed in as <strong className="text-white">{email}</strong></p> : null}
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/48">{detail}</p>

        {status === "ready" ? (
          <button type="button" onClick={() => void approve()} className="mt-7 min-h-12 w-full rounded-full bg-brand px-6 font-semibold text-black">
            Approve computer
          </button>
        ) : null}
        {status === "checking" || status === "approving" ? <p className="mt-7 text-sm font-semibold text-brand">{status === "approving" ? "Approving…" : "Checking account…"}</p> : null}
        {status === "approved" ? (
          <button type="button" onClick={() => router.replace(`/app/${surface}`)} className="mt-7 min-h-12 w-full rounded-full border border-white/15 px-6 font-semibold text-white">
            Continue in BVS
          </button>
        ) : null}
        {status === "error" ? (
          <div className="mt-7 space-y-3">
            <button type="button" onClick={() => router.replace(`/app/${surface}`)} className="min-h-11 w-full rounded-full border border-white/15 px-5 text-sm font-semibold">Back to BVS</button>
            <p className="text-xs text-white/35">For security, expired or incomplete QR links must be regenerated on the computer.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
