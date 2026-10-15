import { createHmac } from "node:crypto";

/**
 * Call ONLY from the broadcaster's actual media-start acknowledgement callback,
 * never from queue selection, a scheduled clock, OBS's UI, or a browser player.
 * Caller persists the event in its durable outbox until this function succeeds.
 */
export async function reportSignalStarted(event, {
  endpoint = "https://bvsradio.com/api/internal/playout/started",
  secret = process.env.BVS_PLAYOUT_SIGNING_SECRET,
  stationId = process.env.BVS_PLAYOUT_STATION_ID,
  fetchImpl = fetch,
} = {}) {
  if (!secret || secret.length < 32 || !stationId) throw new Error("Playout Signal credentials are not configured.");
  const target = new URL(endpoint);
  if (target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname)))
    throw new Error("Playout proof requires HTTPS.");
  const body = JSON.stringify({
    stationId, eventId: event.eventId, trackId: event.trackId, startedAt: event.startedAt,
  });
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(timestamp + "." + body).digest("hex");
  const response = await fetchImpl(target, {
    method: "POST", headers: {
      "Content-Type": "application/json", "x-bvs-timestamp": timestamp, "x-bvs-signature": signature,
    }, body, signal: AbortSignal.timeout(8000), redirect: "error",
  });
  if (!response.ok) {
    const error = new Error("Signal proof was not accepted: HTTP " + response.status);
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return response.json();
}
