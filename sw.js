// Service worker : "réseau d'abord" pour l'app (toujours la dernière version), copie gardée pour marcher sans réseau.
// 08/11 (revue F4) : seulement les fichiers de l'appli (sous son dossier, pas les autres sites du même compte GitHub),
// seulement les réponses correctes (pas les erreurs) ; plus de cache pour des sites extérieurs (les librairies sont dans l'appli).
const SHELL_CACHE = "tickets-shell-v5";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;   // ni les autres sites, ni les autres dépôts
  // App : RÉSEAU D'ABORD, copie seulement en secours hors ligne.
  e.respondWith(
    fetch(e.request, { cache: "no-store" })
      .then(resp => {
        if (resp && resp.ok && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(SHELL_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || Response.error()))
  );
});
