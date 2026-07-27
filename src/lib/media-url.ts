const PUBLIC_BUCKET_MARKER = "/storage/v1/object/public/bvsradio-audio/";
const PRIVATE_EPISODE_MARKER = "/storage/v1/object/show-episodes/";

export function mediaUrlForKey(key: string) {
  return `/api/media/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

export function mediaKeyFromStoredValue(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/api/media/")) {
    return raw
      .slice("/api/media/".length)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");
  }
  const publicAt = raw.indexOf(PUBLIC_BUCKET_MARKER);
  if (publicAt >= 0) {
    return decodeURIComponent(raw.slice(publicAt + PUBLIC_BUCKET_MARKER.length));
  }
  const episodeAt = raw.indexOf(PRIVATE_EPISODE_MARKER);
  if (episodeAt >= 0) {
    return `show-episodes/${decodeURIComponent(raw.slice(episodeAt + PRIVATE_EPISODE_MARKER.length))}`;
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/assets/") || raw.startsWith("/music/")) {
    return null;
  }
  return raw.replace(/^\/+/, "");
}

export function mediaUrlForStoredValue(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const key = mediaKeyFromStoredValue(raw);
  return key ? mediaUrlForKey(key) : raw;
}
