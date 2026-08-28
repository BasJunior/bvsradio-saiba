"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

type ArtworkRequest = {
  id: string;
  requester_user_id: string;
  target_kind: string;
  target_id: string;
  target_title?: string;
  request_type: string;
  message: string;
  status: string;
  staff_notes?: string | null;
  proposed_artwork_url?: string | null;
  apply_to_pack_members?: boolean;
  created_at: string;
};

export default function EditorialArtworkQueue() {
  const [token, setToken] = useState("");
  const [requests, setRequests] = useState<ArtworkRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (accessToken: string) => {
    const response = await fetch("/api/admin/editorial/artwork-changes", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not load artwork requests.");
    setRequests(payload.requests || []);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Account service is not configured.");
      return;
    }
    void createClient().auth.getSession().then(async ({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Sign in with an editorial account.");
        return;
      }
      setToken(accessToken);
      await load(accessToken);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not open artwork review."));
  }, [load]);

  const act = async (requestId: string, status: "reviewing" | "resolved" | "rejected") => {
    if (!token) return;
    setBusy(requestId);
    setError("");
    try {
      const response = await fetch("/api/admin/editorial/artwork-changes", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, status, notes: notes[requestId] || "" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Editorial action failed.");
      await load(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Editorial action failed.");
    } finally {
      setBusy("");
    }
  };

  if (error && !token) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p>{error}</p>
        <Link href="/auth/login?next=/editorial/artwork" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-red-200/30 px-4 py-2">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}
      {requests.map((request) => (
        <article key={request.id} className="rounded-2xl border border-white/10 bg-white/[.02] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[.16em] text-brand">{request.target_kind.replaceAll("_", " ")} · {request.status}</p>
              <h2 className="mt-2 text-xl font-semibold">{request.target_title || request.target_id}</h2>
              <p className="mt-2 text-sm text-text-secondary">{request.message}</p>
            </div>
            <p className="text-xs text-text-secondary">{new Date(request.created_at).toLocaleString()}</p>
          </div>
          {request.proposed_artwork_url && (
            <img src={request.proposed_artwork_url} alt="Proposed replacement artwork" className="mt-4 h-40 w-40 rounded-xl border border-white/10 object-cover" />
          )}
          {request.apply_to_pack_members && <p className="mt-3 text-xs text-brand">Apply to all beat-pack members after approval.</p>}
          <textarea
            value={notes[request.id] ?? request.staff_notes ?? ""}
            onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))}
            placeholder="Staff notes"
            className="mt-4 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-brand"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy === request.id} onClick={() => void act(request.id, "reviewing")} className="min-h-11 rounded-full border border-white/20 px-4 py-2 text-sm disabled:opacity-40">Reviewing</button>
            <button disabled={busy === request.id} onClick={() => void act(request.id, "resolved")} className="min-h-11 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-40">Approve & apply</button>
            <button disabled={busy === request.id} onClick={() => void act(request.id, "rejected")} className="min-h-11 rounded-full border border-red-400/40 px-4 py-2 text-sm text-red-200 disabled:opacity-40">Reject</button>
          </div>
        </article>
      ))}
      {!requests.length && <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm text-text-secondary">No artwork-change requests yet.</p>}
    </div>
  );
}
