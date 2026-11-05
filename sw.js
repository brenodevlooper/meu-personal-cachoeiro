/* Service worker: abre o app sem internet (casca + último dado visto).
   Rede primeiro para tudo do próprio site — versão nova entra na hora;
   cache só como reserva. Supabase e CDN nunca são cacheados aqui. */
const CACHE = "mpc-v1";
const CASCA = ["./", "index.html", "css/app.css", "js/app.js", "js/painel.js", "js/ui.js", "js/config.js", "js/regras.js", "js/plano.js",
  "js/catalogo-seed.js", "js/db/index.js", "js/db/local.js", "js/db/supabase.js", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "termos.html", "privacidade.html", "css/legal.css"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCA)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
