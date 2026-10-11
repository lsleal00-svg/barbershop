/* Service worker do app do barbeiro: abre rápido e mostra a tela mesmo sem internet.
   Mude VERSAO a cada atualização publicada para os celulares baixarem a nova. */
const VERSAO = "painel-v6";
const ARQUIVOS = [
  "./", "./index.html", "./app.css", "./app.js", "./manifest.webmanifest",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/icone-180.png", "./icones/icone-32.png",
  "../css/cardapio.css", "../js/horario.js", "../js/pix.js", "../js/cardapio.js", "../vendor/jspdf.umd.min.js", "./cardapio-admin.js", "./horario-admin.js", "./pagamento.js", "./fila.js", "./caixa.js", "../css/base.css", "../js/supa.js", "../js/util.js", "../vendor/qrcode.js", "../config.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS.map((a) => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting()));
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
    fetch(e.request, { cache: "no-cache" }).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
  );
});

// Aviso de pedido novo (chega sem conteúdo: a função "notificar" só cutuca o celular).
// Também avisa as telas abertas do painel, que se atualizam na hora.
self.addEventListener("push", (e) => {
  e.waitUntil(Promise.all([
    self.registration.showNotification("Novo pedido na barbearia", {
      body: "Toque para ver e aprovar.", icon: "icones/icone-192.png", badge: "icones/icone-192.png",
      tag: "pedido", renotify: true, vibrate: [200, 100, 200],
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => lista.forEach((c) => c.postMessage({ tipo: "pedido" }))),
  ]));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
    for (const c of lista) if (c.url.includes("/app/")) return c.focus();
    return self.clients.openWindow("./");
  }));
});
