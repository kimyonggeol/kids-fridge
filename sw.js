// 앱 화면은 캐시 우선(백그라운드 갱신), 레시피 데이터는 네트워크 우선
const CACHE = 'kf-v1.0.0';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'data/ingredients.json', 'data/recipes.json', 'data/version.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;               // 서버 통신은 그대로
  if (url.pathname.includes('/data/')) {                          // 레시피: 네트워크 우선
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.pathname, copy)); }
      return res;
    }).catch(() => caches.match(url.pathname)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {   // 앱 화면: 캐시 우선 + 갱신
    const net = fetch(req).then(res => {
      if (res.ok && (url.origin === location.origin || url.hostname.includes('jsdelivr'))) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
