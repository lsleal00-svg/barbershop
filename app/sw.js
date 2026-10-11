/* Service worker do app do barbeiro: abre rápido e mostra a tela mesmo sem internet.
   Mude VERSAO a cada atualização publicada para os celulares baixarem a nova. */
const VERSAO = "painel-v1";
const ARQUIVOS = [
  "./", "./index.html", "./app.css", "./app.js", "./manifest.webmanifest",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/icone-180.png", "./icones/icone-32.png",
  "../css/base.css", "../js/supa.js", "../js/util.js", "../vendor/qrcode.js", "../config.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Arquivos do próprio site: tenta a internet primeiro (pega atualização) e cai no cache.
// Chamadas ao Supabase nunca passam pelo cache.
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
