export function isExternalLegalOrLicenceUrl(url: URL) {
  const path = url.pathname;
  if (path === "/privacy" || path === "/terms" || path === "/contact" || path === "/support") return true;
  if (path === "/catalogue" && (url.hash.includes("beatstore") || url.searchParams.get("type") === "beat")) return true;
  return false;
}

export function externalBvsUrl(url: URL) {
  return `https://bvsradio.com${url.pathname}${url.search}${url.hash}`;
}
