/* Objeo — service worker PWA
 * Network-first for documents, no caching of account messages or API responses.
 */
const CACHE = 'objeo-pwa-v2';
const OFFLINE_URL = '/offline.html';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith('objeo-pwa-') && key !== CACHE).map(key => caches.delete(key))))
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

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = typeof data.title === 'string' ? data.title.slice(0,120) : 'Objeo';
  const body = typeof data.body === 'string' ? data.body.slice(0,500) : 'Vous avez une nouvelle notification.';
  let url = '/';
  try { const u = new URL(data.url || '/', self.location.origin); if (u.origin === self.location.origin) url = u.href; } catch {}
  event.waitUntil(self.registration.showNotification(title, {body, icon:'/assets/icon-192.png', data:{url}}));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = new URL('/', self.location.origin);
  try { const u = new URL(event.notification.data?.url || '/', self.location.origin); if(u.origin === self.location.origin) url = u; } catch {}
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) { if(client.url === url.href && 'focus' in client) return client.focus(); }
    return self.clients.openWindow(url.href);
  })());
});
