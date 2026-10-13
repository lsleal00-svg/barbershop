/* Service worker do app do cliente (todas as barbearias usam o mesmo arquivo).
   Mude VERSAO a cada atualização publicada. */
const VERSAO = "cliente-v8";
const ARQUIVOS = ["./", "./index.html", "./cliente.css", "./cliente.js",
  "../css/cardapio.css", "../js/horario.js", "../js/cardapio.js", "../js/pix.js", "../vendor/qrcode.js", "../css/base.css", "../fontes/barlow-condensed-600.woff2", "../fontes/barlow-condensed-800.woff2", "../js/supa.js", "../js/util.js", "../config.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});
