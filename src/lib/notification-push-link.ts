const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const parameter = "bvs_notice";
/** Build 17 preserves href, not arbitrary APNs payload keys. */
export function notificationPushHref(href: string, notificationId?: string | null) {
  if (!notificationId || !uuid.test(notificationId) || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://bvsradio.com");
  url.searchParams.set(parameter, notificationId);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function notificationPushAction(href: string, id?: unknown) {
  try {
    const url = new URL(href, "https://bvsradio.com");
    const candidate = typeof id === "string" && uuid.test(id) ? id : url.searchParams.get(parameter) || "";
    url.searchParams.delete(parameter);
    return {
      href: href.startsWith("/") && !href.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : url.toString(),
      notificationId: uuid.test(candidate) ? candidate : null,
    };
  } catch { return { href, notificationId: null }; }
}
