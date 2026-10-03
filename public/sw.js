/* BVS offline shell: never persist account HTML, RSC payloads, API or audio. */
const SHELL_CACHE = "bvs-shell-v2";
const ASSET_CACHE = "bvs-assets-v2";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/bvs-icon-v2-192.png", "/bvs-icon-v2-512.png", "/branding/bvs-logo.png"];
const MAX_ASSETS = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("bvs-") && ![SHELL_CACHE, ASSET_CACHE].includes(key)).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

async function rememberAsset(request, response) {
  const cache = await caches.open(ASSET_CACHE);
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map(key => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.headers.get("RSC") === "1") return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline.html")) || new Response("You are offline. Reconnect and reload BVS.", { status: 503, headers: { "Content-Type": "text/plain" } })));
    return;
  }
  // Only versioned public build files and the explicit branded shell are cacheable.
  if (!url.pathname.startsWith("/_next/static/") && !PRECACHE.includes(url.pathname)) return;
  const network = fetch(request).then(response => {
    if (response.ok) event.waitUntil(rememberAsset(request, response.clone()).catch(() => undefined));
    return response;
  });
  event.respondWith(caches.match(request).then(cached => {
    if (cached) { event.waitUntil(network.catch(() => undefined)); return cached; }
    return network;
  }));
});
