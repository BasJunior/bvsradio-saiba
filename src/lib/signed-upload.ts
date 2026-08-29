/**
 * Client helpers for direct-to-storage uploads (R2 signed PUTs).
 * Maps browser "Failed to fetch" into actionable copy and retries transient network failures.
 */

export type SignedUploadSlot = {
  path: string;
  signedUrl: string;
  contentType: string;
  index?: number;
  token?: string;
};

const NETWORK_HINT =
  "Network error while uploading. Use stable Wi‑Fi if you can, keep this tab open, and try again. Large WAV/FLAC files need a steady connection.";

/** Turn TypeError/Failed to fetch / abort into artist-facing guidance. */
export function humanizeUploadError(err: unknown, step?: string): string {
  const raw = err instanceof Error ? err.message : String(err || "Upload failed");
  const lower = raw.toLowerCase();
  const stepBit = step ? ` (during ${step})` : "";

  if (
    lower === "failed to fetch" ||
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("load failed") ||
    lower.includes("the internet connection appears to be offline") ||
    err instanceof TypeError
  ) {
    return `${NETWORK_HINT}${stepBit}`;
  }

  if (lower.includes("abort") || lower.includes("timeout")) {
    return `Upload timed out${stepBit}. Keep the tab open on Wi‑Fi and try again. Very large files may need a stronger connection.`;
  }

  if (/413|payload too large|entity too large/i.test(raw)) {
    return "This file is too large for the current upload path. Prefer compressed MP3 when possible, or contact BVS if you need a higher limit.";
  }

  return step ? `${raw}${stepBit}` : raw;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PUT a file to a signed storage URL with limited retries on network failures.
 * Does not retry clear HTTP 4xx (except 408/429).
 */
export async function putToSignedSlot(
  slot: SignedUploadSlot,
  file: File,
  options?: { attempts?: number; label?: string },
): Promise<void> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const label = options?.label;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(slot.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": slot.contentType || file.type || "application/octet-stream",
        },
        body: file,
      });
      if (res.ok) return;

      const text = await res.text().catch(() => "");
      // Retry transient server / rate-limit responses
      if ((res.status === 408 || res.status === 429 || res.status >= 500) && attempt < attempts) {
        await sleep(400 * attempt);
        continue;
      }
      throw new Error(
        `Storage rejected the file (${res.status}). ${text.slice(0, 120) || "Try again or contact BVS."}`,
      );
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isHttpReject = /storage rejected the file/i.test(msg);
      const isNetwork =
        !isHttpReject &&
        (err instanceof TypeError ||
          /failed to fetch|networkerror|network request failed|load failed|offline|abort|timeout/i.test(
            msg,
          ));

      if (isNetwork && attempt < attempts) {
        await sleep(500 * attempt);
        continue;
      }
      throw new Error(humanizeUploadError(err, label));
    }
  }

  throw new Error(humanizeUploadError(lastError, label));
}

/** Safe JSON parse for API responses; maps bare network failures. */
export async function fetchJson<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
  step?: string,
): Promise<{ ok: boolean; status: number; data: T }> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    throw new Error(humanizeUploadError(err, step));
  }

  let data = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    if (!res.ok) {
      throw new Error(
        humanizeUploadError(
          new Error(`Request failed (server ${res.status}). Try again or contact BVS.`),
          step,
        ),
      );
    }
  }
  return { ok: res.ok, status: res.status, data };
}
