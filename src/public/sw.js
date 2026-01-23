// Service Worker for Voice KY Assistant
const CACHE_NAME = 'voice-ky-v5';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/reset.css',
  '/css/app.css',
  '/js/libs/html2canvas.min.js',
  '/js/libs/jspdf.umd.min.js',
  '/js/main.js',
  '/js/state.js',
  '/js/storage.js',
  '/js/api.js',
  '/js/speech.js',
  '/js/ui.js',
  '/js/router.js',
  '/js/screens/home.js',
  '/js/screens/chat.js',
  '/js/screens/confirm.js',
  '/js/screens/done.js',
  '/js/screens/history.js',
  '/manifest.json'
];

// Install: キャッシュに静的アセットを保存
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: キャッシュ戦略
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API呼び出しはNetwork First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          // オフライン時はエラーレスポンスを返す
          return new Response(
            JSON.stringify({ error: 'offline', message: 'ネットワークに接続できません' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 静的アセットはCache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        // 有効なレスポンスのみキャッシュ
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});

// Background Sync: オフラインデータの同期
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-ky-records') {
    event.waitUntil(syncPendingRecords());
  }
});

async function syncPendingRecords() {
  // IndexedDBから未同期データを取得して送信
  // 実際の実装はstorage.jsと連携
  console.log('[SW] Syncing pending records...');
}
