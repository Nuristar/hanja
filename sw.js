// 오프라인 캐시. 앱 화면은 인터넷이 되면 최신 파일을 먼저 받고, 안 되면 저장해 둔 파일을 쓴다.
var VERSION = 'hanja-v6';
var CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // 획순 데이터(큰 파일)는 있으면 미리 받아 두고, 없어도 설치는 계속한다.
    return c.addAll(CORE).then(function () { return c.add('./strokes.json').catch(function () {}); });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function timeout(ms) { return new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isFont && url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      Promise.race([fetch('./index.html', { cache: 'no-store' }), timeout(3000)]).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put('./index.html', copy); }); }
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }

  if (url.pathname.slice(-12) === 'strokes.json') {
    // 크기가 커서 한 번 받아 두면 계속 쓴다(캐시 우선).
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) { if (res && res.ok) { var cp = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); } return res; });
    }));
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
