import {
  humanizeUploadError,
  type SignedUploadSlot,
} from "@/lib/signed-upload";

export function uploadCrateFile(
  slot: SignedUploadSlot,
  file: File,
  progress: (percent: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    if (signal?.aborted)
      return reject(
        new Error("Upload paused. Your completed files are saved."),
      );
    signal?.addEventListener("abort", abort, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.open("PUT", slot.signedUrl);
    xhr.timeout = 180000;
    xhr.setRequestHeader(
      "Content-Type",
      slot.contentType || file.type || "application/octet-stream",
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `Storage rejected ${file.name} (${xhr.status}). Retry this file.`,
          ),
        );
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error(humanizeUploadError(new Error("Failed to fetch"))));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(
        new Error(
          "Upload timed out. Retry this file; completed files are saved.",
        ),
      );
    };
    xhr.onabort = () => {
      cleanup();
      reject(new Error("Upload paused. Your completed files are saved."));
    };
    xhr.send(file);
  });
}
export async function retryCrateFile(
  slot: SignedUploadSlot,
  file: File,
  progress: (percent: number) => void,
  signal?: AbortSignal,
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await uploadCrateFile(slot, file, progress, signal);
      return;
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (
        signal?.aborted ||
        attempt === 3 ||
        /\((400|401|403|404|413)\)/.test(message)
      )
        throw e;
      await new Promise((r) => setTimeout(r, attempt * 700));
    }
  }
}
export async function audioFingerprint(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
