"use client";

import { useCallback, useEffect, useState } from "react";

/** Hide a previous account's data immediately, and cancel superseded requests. */
export function useAccountJson<T>({ owner, token, url, enabled = true, errorMessage = "Could not load your data." }: {
  owner: string; token: string; url: string; enabled?: boolean; errorMessage?: string;
}) {
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ owner: string; url: string; request: string; data: T | null; error: string } | null>(null);
  const request = JSON.stringify([owner, url, token, refresh]);
  const ready = Boolean(enabled && owner && token);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 12000);
    void fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal })
      .then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || errorMessage);
        if (active) setResult({ owner, url, request, data: payload as T, error: "" });
      })
      .catch(caught => {
        if (active) setResult({ owner, url, request, data: null, error: controller.signal.aborted ? "Loading took too long. Please try again." : caught instanceof Error ? caught.message : errorMessage });
      })
      .finally(() => window.clearTimeout(deadline));
    return () => { active = false; controller.abort(); window.clearTimeout(deadline); };
  }, [errorMessage, owner, ready, request, token, url]);
  const sameOwner = ready && result?.owner === owner && result.url === url;
  return {
    data: sameOwner ? result.data : null,
    error: sameOwner ? result.error : "",
    loading: ready && result?.request !== request,
    reload: useCallback(() => setRefresh(value => value + 1), []),
  };
}
