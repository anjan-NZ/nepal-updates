// Offline shell: app files cached on install; feed.json network-first (falls back to last copy).
var V = 'nu-v6';
var SHELL = ['./', 'index.html', 'status.html', 'style.css', 'app.js', 'status.js', 'theme.js', 'favicon.svg',
  'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  var live = u.pathname.endsWith('/feed.json');
  e.respondWith(
    fetch(r).then(function (res) {
      if (res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () {
      return caches.match(r, { ignoreSearch: true }).then(function (m) { return m || (live ? Response.error() : caches.match('index.html')); });
    })
  );
});
