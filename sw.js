// Pályázatfigyelő – service worker
// Stratégia:
//  - statikus fájlok (HTML/CSS/JS/ikonok): cache-first, hogy offline is induljon az app
//  - data/*.json: network-first, hogy a frissített pályázati/forrás-adatok átjöjjenek;
//    ha nincs hálózat, a legutóbb cache-elt válasz szolgál ki.
const CACHE_VERSION = "pf-v1";
const STATIC_CACHE = CACHE_VERSION + "-static";
const DATA_CACHE = CACHE_VERSION + "-data";

const APP_SHELL = [
  "./",
  "./index.html",
  "./palyazatfigyelo.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names
        .filter((name) => name !== STATIC_CACHE && name !== DATA_CACHE)
        .map((name) => caches.delete(name))
    )).then(() => self.clients.claim())
  );
});

function isDataRequest(url) {
  return url.pathname.includes("/data/") && url.pathname.endsWith(".json");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // csak saját eredetű kéréseket kezelünk

  if (isDataRequest(url)) {
    // network-first a data/*.json fájlokra
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // cache-first a statikus fájlokra
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
        return res;
      }).catch(() => {
        // offline fallback navigációnál: az app főoldala
        if (req.mode === "navigate") return caches.match("./palyazatfigyelo.html");
        return undefined;
      });
    })
  );
});
