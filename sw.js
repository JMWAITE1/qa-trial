// NGL QA Trial — Service Worker v1
// Strategy: network-first for HTML (always get latest), cache-first for icons only.
const CACHE = 'ngl-qa-trial-v1';

self.addEventListener('install', e => {
  // Pre-cache only the static icons — NOT the HTML (HTML is always fetched fresh)
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(['/qa-trial/icon-192.png', '/qa-trial/icon-512.png']).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // Never intercept: Supabase, CDN scripts, or cross-origin requests
  if (url.includes('supabase.co') ||
      url.includes('supabase.io') ||
      url.includes('jsdelivr.net') ||
      url.includes('cdn.') ||
      !url.startsWith(self.location.origin)) return;

  // Navigation requests: NETWORK FIRST — always get the latest HTML.
  // Fall back to a basic offline message if truly offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response('<h2 style="font-family:sans-serif;padding:40px">Offline — please reconnect and reload.</h2>',
          { headers: { 'Content-Type': 'text/html' } })
      )
    );
    return;
  }

  // Static assets (icons, manifest): cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response.ok) {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()));
        }
        return response;
      });
    })
  );
});
