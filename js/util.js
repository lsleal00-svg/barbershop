/* util.js — peças usadas pelas três telas (controle, app, cliente). */
(function () {
  "use strict";
  const U = {};

  U.$ = (sel, raiz) => (raiz || document).querySelector(sel);
  U.$$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
  U.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  U.PLANOS = [
    ["7", "7 dias"], ["15", "15 dias"], ["30", "30 dias"], ["60", "60 dias"],
    ["90", "90 dias"], ["180", "6 meses"], ["365", "1 ano"], ["vitalicio", "Vitalício"],
  ];
  U.nomePlano = (p) => (U.PLANOS.find((x) => x[0] === String(p)) || [p, p])[1];
  U.data = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
  U.diasAte = (iso) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null);

  /* ---------- avisos (sem alert/confirm do navegador) ---------- */
  U.aviso = function (msg, tipo) {
    let box = U.$("#avisos");
    if (!box) { box = document.createElement("div"); box.id = "avisos"; box.setAttribute("aria-live", "polite"); document.body.appendChild(box); }
    const el = document.createElement("div");
    el.className = "aviso " + (tipo || "ok");
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { el.classList.add("saindo"); setTimeout(() => el.remove(), 300); }, tipo === "erro" ? 5000 : 2800);
  };

  U.modal = function (titulo, corpoHtml, botoes) {
    return new Promise((resolve) => {
      const fundo = document.createElement("div");
      fundo.className = "modal-fundo";
      fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${U.esc(titulo)}">
        <div class="modal-topo"><h2>${U.esc(titulo)}</h2><button class="fechar" aria-label="Fechar">×</button></div>
        <div class="modal-corpo">${corpoHtml}</div>
        <div class="modal-rodape"></div></div>`;
      const rod = U.$(".modal-rodape", fundo);
      const fechar = (v) => { fundo.remove(); document.removeEventListener("keydown", tecla); resolve(v); };
      const tecla = (e) => { if (e.key === "Escape") fechar(null); };
      (botoes || [{ rotulo: "Fechar", valor: null }]).forEach((b) => {
        const el = document.createElement("button");
        el.className = "btn " + (b.classe || "");
        el.textContent = b.rotulo;
        el.onclick = async () => {
          if (b.antes) {
            el.disabled = true;
            try { const ok = await b.antes(fundo); if (ok === false) { el.disabled = false; return; } }
            catch (e) { el.disabled = false; U.aviso(e.message, "erro"); return; }
            el.disabled = false;
          }
          if (!b.fica) fechar(b.valor === undefined ? true : b.valor);
        };
        rod.appendChild(el);
      });
      U.$(".fechar", fundo).onclick = () => fechar(null);
      fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(null); });
      document.addEventListener("keydown", tecla);
      document.body.appendChild(fundo);
      const foco = U.$("input,select,textarea", fundo);
      if (foco) foco.focus();
    });
  };
  U.confirmar = (titulo, texto, rotulo, perigo) =>
    U.modal(titulo, `<p>${texto}</p>`, [
      { rotulo: "Cancelar", valor: false, classe: "sec" },
      { rotulo: rotulo || "Confirmar", valor: true, classe: perigo ? "perigo" : "" },
    ]);

  U.ocupado = async function (botao, fn) {
    const txt = botao.textContent;
    botao.disabled = true; botao.classList.add("carregando");
    try { return await fn(); }
    finally { botao.disabled = false; botao.classList.remove("carregando"); botao.textContent = txt; }
  };

  U.copiar = async function (texto) {
    try { await navigator.clipboard.writeText(texto); }
    catch (e) {
      const t = document.createElement("textarea");
      t.value = texto; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } finally { t.remove(); }
    }
    U.aviso("Copiado!");
  };
  U.whatsapp = (texto, telefone) => {
    const num = String(telefone || "").replace(/\D/g, "");
    const alvo = num ? "https://wa.me/" + (num.length <= 11 ? "55" + num : num) : "https://wa.me/";
    window.open(alvo + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
  };

  /* ---------- QR Code (vendor/qrcode.js) ---------- */
  U.qrSvg = function (texto, tam) {
    const qr = window.qrcode(0, "M"); qr.addData(texto); qr.make();
    const n = qr.getModuleCount(), m = 2, total = n + m * 2;
    let caminho = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) caminho += `M${x + m} ${y + m}h1v1h-1z`;
    return `<svg class="qr" viewBox="0 0 ${total} ${total}" width="${tam || 220}" height="${tam || 220}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="#fff"/><path d="${caminho}" fill="#000"/></svg>`;
  };
  /* PNG do QR Code. titulo vai em cima (ex.: "Baixe agora o nosso aplicativo:"), legenda embaixo. */
  U.qrPng = function (texto, legenda, logoImg, titulo) {
    const qr = window.qrcode(0, "H"); qr.addData(texto); qr.make();
    const n = qr.getModuleCount(), cel = Math.floor(900 / (n + 8)), lado = cel * (n + 8);
    const topo = titulo ? 140 : 0, extra = legenda ? 120 : 0;
    const cv = document.createElement("canvas"); cv.width = lado; cv.height = topo + lado + extra;
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
    if (titulo) {
      g.fillStyle = "#10233a"; g.font = "bold 50px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText(titulo, lado / 2, 105, lado - 60);
    }
    g.fillStyle = "#000";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) g.fillRect((x + 4) * cel, topo + (y + 4) * cel, cel, cel);
    if (logoImg && logoImg.complete && logoImg.naturalWidth) {
      const t = Math.round(lado * 0.2), p = (lado - t) / 2;
      g.fillStyle = "#fff"; g.beginPath(); g.arc(lado / 2, topo + lado / 2, t / 2 + 10, 0, Math.PI * 2); g.fill();
      try {
        g.save(); g.beginPath(); g.arc(lado / 2, topo + lado / 2, t / 2, 0, Math.PI * 2); g.clip();
        g.drawImage(logoImg, p, topo + p, t, t); g.restore();
      } catch (e) { /* imagem sem CORS: QR sem logo */ }
    }
    if (legenda) {
      g.fillStyle = "#10233a"; g.font = "bold 44px system-ui, sans-serif"; g.textAlign = "center";
      g.fillText(legenda.slice(0, 34), lado / 2, topo + lado + 70);
    }
    try { return cv.toDataURL("image/png"); } catch (e) { return null; }
  };
  U.FRASE_QR = "Baixe agora o nosso aplicativo:";

  /* Logo redondo (para o PDF e outros desenhos). */
  U.circular = function (img, lado) {
    const cv = document.createElement("canvas"); cv.width = cv.height = lado;
    const g = cv.getContext("2d");
    g.beginPath(); g.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = "#fff"; g.fillRect(0, 0, lado, lado);
    const m = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado);
    return cv.toDataURL("image/png");
  };

  /* Bip de pedido novo (respeita a chave "Som" da aba Fila). */
  U.bip = function () {
    try { if (localStorage.getItem("bs_som") === "0") return; } catch (e) { /* */ }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.16);
      });
    } catch (e) { /* sem som */ }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  };

  /* Olhinho para ver a senha: entra sozinho em todo campo de senha que aparecer. */
  const OLHO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const OLHO_FECHADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function olho(inp) {
    if (inp.dataset.olho) return;
    inp.dataset.olho = "1";
    const caixa = document.createElement("div"); caixa.className = "campo-senha";
    inp.parentNode.insertBefore(caixa, inp); caixa.appendChild(inp);
    const b = document.createElement("button");
    b.type = "button"; b.className = "ver-senha"; b.setAttribute("aria-label", "Mostrar senha"); b.innerHTML = OLHO;
    b.onclick = () => {
      const mostrar = inp.type === "password";
      inp.type = mostrar ? "text" : "password";
      b.innerHTML = mostrar ? OLHO_FECHADO : OLHO;
      b.setAttribute("aria-label", mostrar ? "Esconder senha" : "Mostrar senha");
      b.classList.toggle("ativo", mostrar); inp.focus();
    };
    caixa.appendChild(b);
  }
  const procurarSenhas = () => document.querySelectorAll('input[type="password"]:not([data-olho])').forEach(olho);
  new MutationObserver(procurarSenhas).observe(document.documentElement, { childList: true, subtree: true });
  procurarSenhas();
  U.baixar = function (dataUrl, nome) {
    const a = document.createElement("a"); a.href = dataUrl; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
  };

  /* ---------- imagens: quadrado com fundo branco ---------- */
  U.lerImagem = (arquivo) => new Promise((ok, falha) => {
    if (!arquivo || !/^image\//.test(arquivo.type)) return falha(new Error("Escolha um arquivo de imagem (PNG ou JPG)."));
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("Não foi possível abrir essa imagem."));
    img.src = url;
  });
  U.quadrado = function (img, lado, tipo, qualidade) {
    const cv = document.createElement("canvas"); cv.width = cv.height = lado;
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, lado, lado);
    const esc = Math.min(lado / img.naturalWidth, lado / img.naturalHeight) * 0.92;
    const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
    return cv.toDataURL(tipo || "image/png", qualidade);
  };
  U.recorteQuadrado = function (img, lado) {   // foto de perfil: corta o centro
    const cv = document.createElement("canvas"); cv.width = cv.height = lado;
    const g = cv.getContext("2d");
    const m = Math.min(img.naturalWidth, img.naturalHeight);
    g.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado);
    return new Promise((ok) => cv.toBlob(ok, "image/webp", 0.82));
  };

  /* ---------- instalar o app (Android/PC) e instrução do iPhone ---------- */
  let pedidoInstalar = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); pedidoInstalar = e;
    document.dispatchEvent(new CustomEvent("pode-instalar"));
  });
  U.podeInstalar = () => !!pedidoInstalar;
  U.ehIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  U.instalado = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  U.instalar = async function () {
    if (pedidoInstalar) {
      pedidoInstalar.prompt();
      const r = await pedidoInstalar.userChoice.catch(() => null);
      pedidoInstalar = null;
      return r && r.outcome === "accepted";
    }
    const iphone = U.ehIphone();
    await U.modal("Instalar o app", iphone
      ? `<ol class="passos"><li>Abra este link no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> <span aria-hidden="true">⬆︎</span>.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Toque em <b>Adicionar</b>.</li></ol>`
      : `<ol class="passos"><li>Abra o menu do navegador (<b>⋮</b>).</li><li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</li><li>Confirme.</li></ol><p class="dica">No computador, o ícone de instalar também aparece na barra de endereço.</p>`);
    return false;
  };

  U.registrarSW = function (caminho) {
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register(caminho).catch(() => {});
    }
  };

  window.U = U;
})();
