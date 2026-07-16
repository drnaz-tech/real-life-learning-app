// Bump this whenever the app shell changes so returning families do not stay
// on an older cached JavaScript bundle after a production deployment.
const CACHE_NAME = 'orbit-oak-v6';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?version=6',
  './manifest.webmanifest',
  './assets/icon.svg',
  './src/app-v5.js?version=6',
  './src/state.js',
  './src/data/missions.js',
  './src/integrations/supabase-config.js',
  './src/integrations/supabase-service.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match('./index.html'))));
});
