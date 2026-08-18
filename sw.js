const CACHE = 'pingpong-v36';
const ASSETS = [
  '/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/privacy', '/terms',
  '/js/main.js', '/js/supabase-client.js', '/js/auth.js', '/js/auth-ui.js',
  '/js/account.js', '/js/players.js', '/js/player-state.js', '/js/player-ui.js',
  '/js/player-edit.js', '/js/onboarding.js', '/js/matches.js', '/js/matches-cache.js',
  '/js/opponents.js', '/js/opponents-cache.js', '/js/escape.js', '/js/demo-mode.js',
  '/js/settings-ui.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
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

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Supabase / OAuth はキャッシュせず素通し（認証・APIの整合性のため）
  if (url.hostname.endsWith('.supabase.co') ||
      url.hostname.includes('google') ||
      url.hostname.includes('apple')) {
    return;
  }

  // esm.sh（supabase-js CDN）: キャッシュ優先。バージョン付きURLで不変なので安全
  if (url.hostname === 'esm.sh') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 同一オリジン: ネットワーク優先（デプロイ即反映）、オフライン時のみキャッシュへフォールバック
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(cached =>
          cached || (e.request.mode === 'navigate' ? caches.match('/index.html') : undefined)
        )
      )
    );
  }
});
