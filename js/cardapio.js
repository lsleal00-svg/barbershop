/* cardapio.js — peças do cardápio usadas pelo app do barbeiro e pela tela do cliente. */
(function () {
  "use strict";
  const ico = (n) => (typeof window !== "undefined" && window.U && window.U.icone ? window.U.icone(n) : "");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const C = {};

  // Só dois tipos de categoria: serviço (cortes, barba, química…) e produto ("outros" no banco).
  C.TIPOS = { servico: "Serviço", outros: "Produto", cabelo: "Serviço", barba: "Serviço" };
  C.NOVO = { servico: "Adicionar novo serviço", outros: "Adicionar novo produto", cabelo: "Adicionar novo serviço", barba: "Adicionar novo serviço" };
  C.ehProduto = (tipo) => tipo === "outros";
  C.ICONES = [
    // cortes, barba e cuidados
    "✂️", "💈", "🪒", "🧔", "🧔‍♂️", "👨", "👦", "👶", "👴", "💇‍♂️", "💇", "💆‍♂️", "👨‍🦲", "👨‍🦱", "👨‍🦰", "👱‍♂️", "🪮", "🧴", "🧼", "🫧", "💦", "🔥", "❄️", "🌿", "🎨", "🖌️", "✨", "💎",
    // roupas e acessórios
    "🧢", "👕", "👔", "🧥", "🩳", "👖", "🧦", "👟", "🕶️", "⌚", "💍", "🎒", "👜", "🧣",
    // bebidas e lanches
    "🥤", "🧃", "☕", "🍺", "🍻", "🥃", "🍷", "💧", "🍫", "🍬", "🍪", "🍿", "🍔", "🍕",
    // lazer e outros
    "🎱", "🎮", "🃏", "⚽", "🏀", "🎵", "📱", "🔌", "🎁", "🏷️", "🛍️", "⭐", "👑", "💯", "❤️", "🔝", "🆕", "💲",
  ];
  C.CORES = ["#1d1b18", "#a88a4f", "#b8322a", "#2f6e47", "#1f4e8c", "#6b3fa0", "#d9a521", "#e0567a", "#0f7c80", "#5b5b5b"];

  C.dinheiro = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  C.final = (it) => Math.round(Number(it.preco) * (100 - (it.desconto || 0))) / 100;
  C.lerPreco = (txt) => {
    const s = String(txt || "").replace(/[^\d,.]/g, "");
    if (!s) return NaN;
    const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
    return Math.round(n * 100) / 100;
  };

  // Desenhos próprios (sem marca): tesoura + pente para serviços, sacola para produtos.
  const SVG_CORTE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#1d1b18" stroke-width="5" stroke-linecap="round"><circle cx="34" cy="86" r="11"/><circle cx="58" cy="94" r="11"/><path d="M41 77 L82 22"/><path d="M52 84 L70 28"/></g><g fill="#1d1b18"><rect x="66" y="52" width="14" height="52" rx="3" transform="rotate(28 73 78)"/></g><g stroke="#1d1b18" stroke-width="3"><path d="M84 52 l14 7 M82 58 l14 7 M80 64 l14 7 M78 70 l14 7 M76 76 l14 7 M74 82 l14 7 M72 88 l14 7"/></g></svg>`;
  const SVG_PRODUTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#1d1b18" stroke-width="5" stroke-linejoin="round"><path d="M30 44 h60 l-6 52 h-48 z"/><path d="M46 44 v-8 a14 14 0 0 1 28 0 v8"/></g></svg>`;
  C.imagemPadrao = (tipo) => "data:image/svg+xml," + encodeURIComponent(tipo === "outros" ? SVG_PRODUTO : SVG_CORTE);
  C.foto = (it, tipo) => it.foto_url || C.imagemPadrao(tipo);

  C.precoHtml = (it) => it.desconto
    ? `<span class="preco"><s>${C.dinheiro(it.preco)}</s> <b>${C.dinheiro(C.final(it))}</b></span>`
    : `<span class="preco"><b>${C.dinheiro(it.preco)}</b></span>`;

  C.cartao = function (it, tipo, extra) {
    return `<article class="item-card${it.esgotado ? " esgotado" : ""}${it.foto_url ? "" : " sem-foto"}" data-id="${esc(it.id)}"><div class="etiqueta-corpo">
      <div class="item-foto"><img src="${esc(C.foto(it, tipo))}" alt="" loading="lazy">
        ${it.desconto ? `<span class="etiqueta-desconto">-${it.desconto}%</span>` : ""}
        ${it.destaque && extra && extra.admin ? `<span class="etiqueta-destaque">${ico("estrelaCheia")}Destaque</span>` : ""}
        ${it.esgotado ? `<span class="etiqueta-esgotado">Esgotado</span>` : ""}</div>
      <div class="item-info"><h3>${esc(it.nome)}</h3>${C.precoHtml(it)}</div>
      ${extra && extra.acoes ? `<div class="item-acoes">${extra.acoes}</div>` : ""}
    </div></article>`;
  };

  /* Carrossel dos destaques: passa sozinho a cada 4 s, arrasta com o dedo,
     barra de rolagem no computador. Para quando a pessoa mexe. */
  C.carrossel = function (alvo, itens, tipoDe) {
    if (!itens.length) { alvo.innerHTML = ""; alvo.classList.add("oculto"); return; }
    alvo.classList.remove("oculto"); alvo.setAttribute("aria-label", "Em destaque");
    alvo.innerHTML = `<div class="destaques-topo">
        <div class="setas"><button class="seta" data-d="-1" aria-label="Anterior">${ico("esquerda")}</button><button class="seta" data-d="1" aria-label="Próximo">${ico("direita")}</button></div></div>
      <div class="trilho" tabindex="0">${itens.map((it) => `<div class="slide" data-id="${esc(it.id)}">
        <img src="${esc(C.foto(it, tipoDe(it)))}" alt="">
        <div class="slide-texto"><span class="selo-destaque">Destaque</span>${it.desconto ? ` <span class="selo-off">-${it.desconto}%</span>` : ""}
          <h3>${esc(it.nome)}</h3>${C.precoHtml(it)}</div></div>`).join("")}</div>
      <div class="pontos">${itens.map((_, i) => `<span${i ? "" : ' class="ativo"'}></span>`).join("")}</div>`;
    const trilho = alvo.querySelector(".trilho"), pontos = Array.from(alvo.querySelectorAll(".pontos span"));
    let i = 0, parado = false, retomar;
    const ir = (n) => { i = (n + itens.length) % itens.length; trilho.scrollTo({ left: trilho.clientWidth * i, behavior: "smooth" }); };
    trilho.addEventListener("scroll", () => {
      const n = Math.round(trilho.scrollLeft / Math.max(1, trilho.clientWidth));
      if (n !== i && n >= 0 && n < itens.length) i = n;
      pontos.forEach((p, k) => p.classList.toggle("ativo", k === i));
    }, { passive: true });
    const pausar = () => { parado = true; clearTimeout(retomar); retomar = setTimeout(() => (parado = false), 8000); };
    ["pointerdown", "wheel", "touchstart", "mouseenter"].forEach((e) => trilho.addEventListener(e, pausar, { passive: true }));
    alvo.querySelectorAll(".seta").forEach((b) => (b.onclick = () => { pausar(); ir(i + Number(b.dataset.d)); }));
    if (alvo._timer) clearInterval(alvo._timer);
    if (itens.length > 1) alvo._timer = setInterval(() => { if (!parado && document.visibilityState === "visible") ir(i + 1); }, 4000);
  };

  if (typeof module !== "undefined") module.exports = C; else window.CARDAPIO = C;
})();
