
const CACHE = 'medistore-v9.7';
const ASSETS = ['./','./index.html','./manifest.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); });
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).then(r=>{ caches.open(CACHE).then(c=>c.put(e.request,r.clone())); return r; }).catch(()=>caches.match(e.request)) ); });
