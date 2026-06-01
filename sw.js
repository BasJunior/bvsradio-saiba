const CACHE_NAME = 'bvsradio-v1';
const STATIC_ASSETS = [
 '/',
 '/index.html',
 '/radio.html',
 '/offline.html',
 '/assets/css/style.css',
 '/assets/images/Bvsradio_logo.png',
 '/assets/images/icon-192.png',
 '/assets/images/icon-512.png',
 '/manifest.json'
];

// Install — precache static assets
self.addEventListener('install', event => {
 event.waitUntil(
 caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
 );
 self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', event => {
 event.waitUntil(
 caches.keys().then(keys =>
 Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
 )
 );
 self.clients.claim();
});

// Fetch — cache-first for static, network-first for dynamic
self.addEventListener('fetch', event => {
 if (event.request.method !== 'GET') return;

 // Skip cross-origin requests (Google AdSense, Spotify, etc.)
 const url = new URL(event.request.url);
 if (url.origin !== location.origin) return;

 // Cache-first for static assets
 if (STATIC_ASSETS.includes(url.pathname) ||
 url.pathname.startsWith('/assets/') ||
 url.pathname.startsWith('/music/')) {
 event.respondWith(
 caches.match(event.request).then(cached =>
 cached || fetch(event.request).then(response => {
 const clone = response.clone();
 caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
 return response;
 })
 )
 );
 } else {
 // Network-first for everything else
 event.respondWith(
 fetch(event.request)
 .then(response => {
 const clone = response.clone();
 caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
 return response;
 })
 .catch(() => caches.match(event.request).then(cached =>
 cached || caches.match('/offline.html')
 ))
 );
 }
});