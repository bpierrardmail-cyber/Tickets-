// Service worker : coquille locale + cache des assets distants (OCR, React).
// Stratégie : "cache d'abord" pour les CDN, donc après un premier chargement
// EN LIGNE, le moteur Tesseract + les langues restent disponibles HORS-LIGNE.
const SHELL_CACHE = "tickets-shell-v2";
const CDN_CACHE   = "tickets-cdn-v2";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

// Hôtes dont on garde durablement les fichiers (lib OCR, données de langue, React/Babel)
const CDN_HOSTS = ["unpkg.com", "cdn.jsdelivr.net", "tessdata.projectnaptha.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
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

  // 1) Coquille locale : cache d'abord, sinon réseau.
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }

  // 2) CDN (OCR + langues + React) : cache d'abord, on stocke au passage.
  if (CDN_HOSTS.some(h => url.hostname.endsWith(h))) {
    e.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      try {
        const resp = await fetch(e.request);
        // On met en cache même les réponses opaques (lang data volumineuses).
        cache.put(e.request, resp.clone()).catch(() => {});
        return resp;
      } catch (err) {
        // Hors-ligne et pas en cache : on laisse échouer proprement.
        return hit || Response.error();
      }
    })());
  }
});
