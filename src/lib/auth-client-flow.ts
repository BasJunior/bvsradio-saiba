/** Bound optional account setup so a stalled request cannot strand a signed-in user. */
export async function withAuthTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function safeAuthDestination(value: string | null, fallback = "/", root?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://bvsradio.com");
    if (url.origin !== "https://bvsradio.com") return fallback;
    if (root && url.pathname !== root && !url.pathname.startsWith(`${root}/`)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
