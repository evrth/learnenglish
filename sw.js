// =============================================
//  Service Worker — ListenUp PWA
// =============================================
var CACHE_NAME = 'listenup-v1';
var ASSETS = [
  '/learnenglish/',
  '/learnenglish/index.html',
  '/learnenglish/app.js',
  '/learnenglish/auth.js',
  '/learnenglish/style.css',
  '/learnenglish/manifest.json'
];

// Cài đặt: cache các file tĩnh
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Kích hoạt: xoá cache cũ
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: dùng cache nếu offline, network nếu online
self.addEventListener('fetch', function(e) {
  // Không cache request đến Supabase API
  if (e.request.url.includes('supabase.co')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(function(res) {
        // Lưu bản copy mới vào cache
        var resClone = res.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(function() {
        // Offline: dùng cache
        return caches.match(e.request);
      })
  );
});
