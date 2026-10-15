"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import type { BvsSignalPayload } from "@/lib/bvs-signal";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function useBvsSignal(trackId: string | undefined, source: string) {
  const router = useRouter();
  const [data, setData] = useState<BvsSignalPayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const requestScope = useRef<{ active: boolean; trackId?: string }>({ active: false });
  const readSequence = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const scope = { active: true, trackId };
    requestScope.current = scope;
    pending.current = false;
    if (!trackId || !UUID.test(trackId)) return;
    let controller: AbortController | null = null;
    const client = isSupabaseConfigured() ? createClient() : null;
    const valid = () => scope.active;
    const load = async () => {
      const sequence = ++readSequence.current;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const token = client ? (await client.auth.getSession()).data.session?.access_token : "";
        if (!valid() || signal.aborted || sequence !== readSequence.current) return;
        setBusy(false);
        const response = await fetch(`/api/signal/tracks/${trackId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined, cache: "no-store",
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        });
        const payload = await response.json();
        if (!valid() || signal.aborted || sequence !== readSequence.current) return;
        if (!response.ok || payload.trackId !== trackId || payload.available !== true) throw new Error("Signal is temporarily unavailable.");
        setData(payload); setError("");
      } catch {
        if (valid() && !signal.aborted && sequence === readSequence.current) { setData(null); setError("Signal is temporarily unavailable."); }
      }
    };
    void load();
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      // Synchronous invalidation: a previous account's async request can never win.
      scope.active = false; controller?.abort(); setData(null); setBusy(false);
      setEpoch(value => value + 1);
    }).data.subscription;
    const refresh = () => { if (!document.hidden && !pending.current) void load(); };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      scope.active = false; controller?.abort(); subscription?.unsubscribe();
      window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh);
    };
  }, [trackId, epoch]);

  const catchTrack = async () => {
    if (!trackId || !UUID.test(trackId) || pending.current || !isSupabaseConfigured()) return;
    const scope = requestScope.current;
    const valid = () => scope.active && scope.trackId === trackId;
    pending.current = true; setBusy(true); setError("");
    readSequence.current++;
    try {
      const token = (await createClient().auth.getSession()).data.session?.access_token;
      if (!valid()) return;
      if (!token) {
        const next = window.location.pathname + window.location.search;
        router.push(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const response = await fetch(`/api/signal/tracks/${trackId}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ source }), signal: AbortSignal.timeout(10_000),
      });
      const payload = await response.json();
      if (!valid()) return;
      if (!response.ok || payload.trackId !== trackId || payload.available !== true) throw new Error(payload.error || "Could not confirm your Catch.");
      setData(payload);
    } catch (caught) {
      if (valid()) setError(caught instanceof Error ? caught.message : "Could not confirm your Catch.");
    } finally {
      if (valid()) { pending.current = false; setBusy(false); }
    }
  };
  return { signal: data?.trackId === trackId ? data : null, error, busy, catchTrack, retry: () => setEpoch(value => value + 1) };
}
