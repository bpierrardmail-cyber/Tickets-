// Service worker : "réseau d'abord" pour l'app (toujours la dernière version),
// "cache d'abord" pour les CDN (moteur OCR + langues) afin de garder l'hors-ligne.
const SHELL_CACHE = "tickets-shell-v3";
const CDN_CACHE   = "tickets-cdn-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

// Hôtes dont on garde durablement les fichiers (lib OCR, données de langue)
const CDN_HOSTS = ["unpkg.com", "cdn.jsdelivr.net", "tessdata.projectnaptha.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  const keep = [SHELL_CACHE, CDN_CACHE];
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // 1) App (même origine) : RESEAU D'ABORD, cache seulement en secours hors-ligne.
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(SHELL_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(e.request).then(r => r || Response.error()))
    );
    return;
  }

  // 2) CDN (OCR + langues) : cache d'abord, on stocke au passage.
  if (CDN_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      try {
        const resp = await fetch(e.request);
        cache.put(e.request, resp.clone()).catch(() => {});
        return resp;
      } catch (err) {
        return hit || Response.error();
      }
    })());
  }
});
