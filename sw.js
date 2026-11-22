/* Objeo — service worker PWA
 * Network-first for documents, no caching of account messages or API responses.
 */
const CACHE = 'objeo-pwa-v1';
const OFFLINE_URL = '/offline.html';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith('objeo-pwa-') && key !== CACHE).map(key => caches.delete(key)))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    })
  );
});
