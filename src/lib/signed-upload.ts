/**
 * Client helpers for direct-to-storage uploads (R2 signed PUTs).
 * Maps browser "Failed to fetch" into actionable copy and retries transient network failures.
 * Uses XHR so multi-MB artist audio can report progress and surface mobile timeouts cleanly.
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

function putOnceWithXhr(
  slot: SignedUploadSlot,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", slot.signedUrl);
    xhr.setRequestHeader(
      "Content-Type",
      slot.contentType || file.type || "application/octet-stream",
    );
    // Large WAVs on mobile often need more than a few minutes.
    xhr.timeout = 15 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      const body = String(xhr.responseText || "").slice(0, 120);
      reject(
        new Error(
          `Storage rejected the file (${xhr.status || "network"}). ${
            body || "Try again or contact BVS."
          }`,
        ),
      );
    };

    xhr.onerror = () => reject(new TypeError("Failed to fetch"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.onabort = () => reject(new Error("Upload was aborted"));
    xhr.send(file);
  });
}

/**
 * PUT a file to a signed storage URL with limited retries on network failures.
 * Does not retry clear HTTP 4xx (except 408/429).
 */
export async function putToSignedSlot(
  slot: SignedUploadSlot,
  file: File,
  options?: {
    attempts?: number;
    label?: string;
    onProgress?: (percent: number) => void;
  },
): Promise<void> {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const label = options?.label;
  const onProgress = options?.onProgress;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await putOnceWithXhr(slot, file, onProgress);
      return;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const statusMatch = msg.match(/storage rejected the file \((\d+)/i);
      const status = statusMatch ? Number(statusMatch[1]) : 0;
      const isHttpReject = Boolean(statusMatch);
      const retryableHttp = status === 408 || status === 429 || status >= 500;
      const isNetwork =
        !isHttpReject &&
        (err instanceof TypeError ||
          /failed to fetch|networkerror|network request failed|load failed|offline|abort|timeout/i.test(
            msg,
          ));

      if ((isNetwork || retryableHttp) && attempt < attempts) {
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
