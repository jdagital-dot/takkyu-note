const CACHE = 'pingpong-v26';
const PRECACHE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

function isHtmlRequest(req) {
  return req.mode === 'navigate' ||
         (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
}

function isJsRequest(url) {
  return url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs');
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 外部サービスは素通し（Supabase / OAuth / ESM CDN）
  if (url.hostname.endsWith('.supabase.co') ||
      url.hostname.includes('google') ||
      url.hostname.includes('apple') ||
      url.hostname === 'esm.sh') {
    return;
  }

  // HTML / JS は network-first：デプロイ反映を即時に、オフライン時はキャッシュ
  if (isHtmlRequest(e.request) || isJsRequest(url)) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // 静的アセット（アイコン・manifest）は cache-first
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
