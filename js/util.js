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

  /* Ícones desenhados (traço 2, mesmo estilo em todo o sistema). */
  const ICONES = {
    tesoura: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
    sacola: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    lista: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3"/>',
    baixar: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/>',
    esquerda: '<path d="m15 6-6 6 6 6"/>',
    direita: '<path d="m9 6 6 6-6 6"/>',
    estrela: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
    estrelaCheia: '<path fill="currentColor" d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/>',
    sino: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    abrir: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    recibo: '<path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    pix: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12Z"/><path d="M8.8 12h6.4"/>',
    dinheiro: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
    dividir: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 6v12"/><path d="M6.5 10.5h2.5M15 13.5h2.5"/>',
    calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
    rolar: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>',
  };
  U.icone = (nome) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ""}</svg>`;

  /* Barra do navegador/celular na cor do topo do tema. */
  U.corDaBarra = function () {
    const m = document.querySelector('meta[name="theme-color"]');
    const cor = getComputedStyle(document.documentElement).getPropertyValue("--casca").trim();
    if (m && cor) m.setAttribute("content", cor);
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
      const tecla = (e) => { if (e.key === "Escape" && fundo === [...document.querySelectorAll(".modal-fundo")].pop()) fechar(null); };
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
  /* Logo redondo: disco branco com o logo inteiro dentro, aro escuro fino e cantos transparentes.
     Assim o logo fica redondo em qualquer lugar: telas, ícone do app instalado, QR Code e PDF. */
  U.logoRedondo = function (img, lado) {
    const cv = document.createElement("canvas"); cv.width = cv.height = lado;
    const g = cv.getContext("2d"), r = lado / 2;
    g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.closePath(); g.clip();
    g.fillStyle = "#fff"; g.fillRect(0, 0, lado, lado);
    const caixa = lado * 0.80;
    const esc = Math.min(caixa / img.naturalWidth, caixa / img.naturalHeight);
    const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
    const aro = Math.max(2, lado * 0.02);
    g.lineWidth = aro; g.strokeStyle = "#1d1b18";
    g.beginPath(); g.arc(r, r, r - aro / 2, 0, Math.PI * 2); g.stroke();
    return cv.toDataURL("image/png");
  };
  /* Recorte redondo como no WhatsApp: a imagem fica de fundo, o círculo marca o corte.
     Arraste para posicionar; aproxime com o controle, a roda do mouse ou dois dedos.
     Devolve uma função gerar(lado) -> PNG redondo (cantos transparentes), ou null se cancelar. */
  U.corDaBorda = function (img) {
    try {
      const cv = document.createElement("canvas"); cv.width = cv.height = 32;
      const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 32, 32);
      const d = g.getImageData(0, 0, 32, 32).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < 32; i++) for (const [x, y] of [[i, 0], [i, 31], [0, i], [31, i]]) {
        const k = (y * 32 + x) * 4; if (d[k + 3] < 128) { r += 255; gg += 255; b += 255; } else { r += d[k]; gg += d[k + 1]; b += d[k + 2]; } n++;
      }
      return `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
    } catch (e) { return "#ffffff"; }
  };
  U.recortarCirculo = function (img, titulo) {
    const W = img.naturalWidth, H = img.naturalHeight;
    let fundoCor = U.corDaBorda(img);
    let gerar = null;
    const espera = U.modal(titulo || "Ajustar o logo", `
      <p class="sub" style="margin:0 0 .6rem">Arraste a imagem para posicionar dentro do círculo. Use o controle abaixo (ou dois dedos) para aproximar.</p>
      <div class="recorte"><canvas aria-label="Área de recorte"></canvas></div>
      <div class="recorte-zoom"><span aria-hidden="true">−</span><input type="range" min="0" max="1000" value="0" aria-label="Aproximar"><span aria-hidden="true">+</span></div>
      <div class="recorte-fundo"><span>Fundo:</span>
        <button type="button" class="chip-cor" data-cor="auto" aria-pressed="true" title="Cor da borda da imagem"></button>
        <button type="button" class="chip-cor" data-cor="#ffffff" aria-pressed="false" style="background:#fff" title="Branco"></button>
        <button type="button" class="chip-cor" data-cor="#111111" aria-pressed="false" style="background:#111" title="Preto"></button>
      </div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Usar este recorte", valor: true },
    ]);
    const fundo = [...document.querySelectorAll(".modal-fundo")].pop();
    const caixa = U.$(".recorte", fundo), cv = U.$("canvas", caixa), g = cv.getContext("2d");
    const zoom = U.$(".recorte-zoom input", fundo);
    const auto = fundoCor;
    U.$('.chip-cor[data-cor="auto"]', fundo).style.background = auto;
    let L = 300, D = 270, s = 1, sMin = 1, sMax = 4, cx = 150, cy = 150;
    const raio = () => D / 2;
    function limitar() {
      const w = W * s, h = H * s, c0 = (L - D) / 2, c1 = c0 + D;
      cx = w >= D ? Math.min(c0 + w / 2, Math.max(c1 - w / 2, cx)) : Math.max(c0 + w / 2, Math.min(c1 - w / 2, cx));
      cy = h >= D ? Math.min(c0 + h / 2, Math.max(c1 - h / 2, cy)) : Math.max(c0 + h / 2, Math.min(c1 - h / 2, cy));
    }
    function desenhar() {
      const k = cv.width / L;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.fillStyle = "#1b1b1b"; g.fillRect(0, 0, L, L);
      g.fillStyle = fundoCor; g.beginPath(); g.arc(L / 2, L / 2, raio(), 0, Math.PI * 2); g.fill();
      g.imageSmoothingQuality = "high";
      g.drawImage(img, cx - W * s / 2, cy - H * s / 2, W * s, H * s);
      g.fillStyle = "rgba(0,0,0,.58)"; g.beginPath(); g.rect(0, 0, L, L); g.arc(L / 2, L / 2, raio(), 0, Math.PI * 2, true); g.fill("evenodd");
      g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 2; g.beginPath(); g.arc(L / 2, L / 2, raio(), 0, Math.PI * 2); g.stroke();
    }
    const deSlider = () => sMin * Math.pow(sMax / sMin, zoom.value / 1000);
    const paraSlider = () => { zoom.value = Math.round(1000 * Math.log(s / sMin) / Math.log(sMax / sMin)); };
    function escalar(novo, px, py) {
      novo = Math.max(sMin, Math.min(sMax, novo));
      px = px == null ? L / 2 : px; py = py == null ? L / 2 : py;
      cx = px + (cx - px) * novo / s; cy = py + (cy - py) * novo / s; s = novo;
      limitar(); paraSlider(); desenhar();
    }
    function medir() {
      L = Math.max(200, Math.round(caixa.clientWidth || 300)); D = L * 0.9;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = cv.height = Math.round(L * dpr); cv.style.width = cv.style.height = L + "px";
    }
    medir();
    const cobre = D / Math.min(W, H);             // a imagem preenche o círculo
    sMin = D / Math.max(W, H);                    // a imagem inteira cabe no círculo
    sMax = Math.max(cobre * 4, sMin * 4);
    s = cobre; cx = cy = L / 2; limitar(); paraSlider(); desenhar();
    zoom.oninput = () => escalar(deSlider());
    // arrastar e pinçar
    const toques = new Map(); let pinca = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * L / r.width, (e.clientY - r.top) * L / r.height]; };
    cv.addEventListener("pointerdown", (e) => { cv.setPointerCapture(e.pointerId); toques.set(e.pointerId, pos(e)); pinca = null; });
    cv.addEventListener("pointermove", (e) => {
      if (!toques.has(e.pointerId)) return;
      const antes = toques.get(e.pointerId), agora = pos(e); toques.set(e.pointerId, agora);
      if (toques.size === 1) { cx += agora[0] - antes[0]; cy += agora[1] - antes[1]; limitar(); desenhar(); }
      else if (toques.size === 2) {
        const [a, b] = [...toques.values()], dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinca) escalar(s * dist / pinca, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
        pinca = dist;
      }
    });
    const solta = (e) => { toques.delete(e.pointerId); pinca = null; };
    cv.addEventListener("pointerup", solta); cv.addEventListener("pointercancel", solta);
    cv.addEventListener("wheel", (e) => { e.preventDefault(); const [x, y] = pos(e); escalar(s * Math.exp(-e.deltaY / 400), x, y); }, { passive: false });
    U.$$(".chip-cor", fundo).forEach((bt) => bt.onclick = () => {
      U.$$(".chip-cor", fundo).forEach((o) => o.setAttribute("aria-pressed", String(o === bt)));
      fundoCor = bt.dataset.cor === "auto" ? auto : bt.dataset.cor; desenhar();
    });
    return espera.then((ok) => {
      if (!ok) return null;
      const c0 = (L - D) / 2, cor = fundoCor, S0 = s, X = cx, Y = cy;
      gerar = (lado) => {
        const out = document.createElement("canvas"); out.width = out.height = lado;
        const o = out.getContext("2d"), f = lado / D;
        o.beginPath(); o.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2); o.closePath(); o.clip();
        o.fillStyle = cor; o.fillRect(0, 0, lado, lado);
        o.imageSmoothingQuality = "high";
        o.drawImage(img, (X - W * S0 / 2 - c0) * f, (Y - H * S0 / 2 - c0) * f, W * S0 * f, H * S0 * f);
        return out.toDataURL("image/png");
      };
      return gerar;
    });
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
