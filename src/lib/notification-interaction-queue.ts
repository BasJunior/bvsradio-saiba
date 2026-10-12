/** Bounded in-memory retries; no identifiers written to shared browser storage. */
export function createNotificationInteractionQueue(getToken: () => string, send: typeof fetch = fetch) {
  type Item = { notificationId: string; event: string; attempts: number; createdAt: number };
  let pending: Item[] = [];
  let flushing = false;
  let generation = 0;
  return {
    clear() { pending = []; generation++; },
    add(notificationId: string | null, event: "notification_opened" | "deeplink_opened") {
      if (!notificationId || pending.some(i => i.notificationId === notificationId && i.event === event)) return;
      pending.push({ notificationId, event, attempts: 0, createdAt: Date.now() });
      pending = pending.slice(-20);
    },
    async flush() {
      if (flushing || !getToken()) return;
      flushing = true;
      const startedGeneration = generation;
      const batch = pending;
      pending = [];
      try {
        for (const item of batch) {
          if (generation !== startedGeneration) break;
          if (Date.now() - item.createdAt > 600000 || item.attempts >= 3) continue;
          const token = getToken();
          if (!token) { pending.push(item); continue; }
          let retry = false;
          try {
            const response = await send("/api/app/notification-interactions", {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ notificationId: item.notificationId, event: item.event }),
              keepalive: true, signal: AbortSignal.timeout(5000),
            });
            retry = response.status === 401 || response.status === 429 || response.status >= 500;
          } catch { retry = true; }
          if (retry && generation === startedGeneration) pending.push({ ...item, attempts: item.attempts + 1 });
        }
      } finally { pending = pending.slice(-20); flushing = false; }
    },
  };
}
