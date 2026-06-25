/* Learning Hub service worker.
   Precaches the app shell so it opens instantly and works offline; lesson
   files and fonts are cached as the learner visits them. Bump CACHE_VERSION
   whenever shell files change to roll users onto the new version. */
var CACHE_VERSION = "cyberedge-hub-v1";
var SHELL_CACHE = CACHE_VERSION + "-shell";
var RUNTIME_CACHE = CACHE_VERSION + "-runtime";

var SHELL_ASSETS = [
  "index.html",
  "assets/css/app.css",
  "assets/js/app.js",
  "shared/lesson-bridge.js",
  "data/courses.json",
  "data/security-plus.json",
  "data/search-index.json",
  "manifest.webmanifest",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) {
      return Promise.all(SHELL_ASSETS.map(function (u) {
        return c.add(u).catch(function () {}); // tolerate a missing optional asset
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf(CACHE_VERSION) !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;

  // App navigations: serve the shell (single-page app)
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match("index.html");
      })
    );
    return;
  }

  // Lessons + same-origin assets: cache-first, then network, then cache fill
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(RUNTIME_CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.host.indexOf("fonts.googleapis.com") > -1 || url.host.indexOf("fonts.gstatic.com") > -1) {
    e.respondWith(
      caches.open(RUNTIME_CACHE).then(function (c) {
        return c.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { c.put(req, res.clone()); return res; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
  }
});
