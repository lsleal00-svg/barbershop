/* graficos.js — gráficos do Caixa: colunas por dia e ranking em barras deitadas.
   Uma série só (a cor do tema), grade fina e discreta, eixo com valores redondos,
   rótulo só no maior valor e no dia de hoje, dica ao passar o dedo/mouse ou com o teclado,
   e a tabela "Ver números" continua sendo o caminho acessível para todos os valores.
   No estilo Elegante, a grade vira marcações de mostrador. A entrada é animada com GSAP
   (só quando a pessoa não pediu menos movimento). */
(function () {
  "use strict";
  const { esc } = U;

  /* valores redondos para o eixo: 0, 50, 100… e compactos a partir de mil (1 mil, 2,5 mil) */
  function passoBonito(max, n) {
    const bruto = max / n, pot = Math.pow(10, Math.floor(Math.log10(bruto || 1))), f = bruto / pot;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pot;
  }
  const compacto = (v, dinheiro) => {
    const t = v >= 1000 ? (v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    return dinheiro ? "R$ " + t : t;
  };

  // rótulo na ponta da coluna: valor exato até mil (99,80), compacto acima (1,2 mil)
  const rotuloValor = (v, dinheiro) => v >= 1000 ? compacto(v, false) : v.toLocaleString("pt-BR", { minimumFractionDigits: dinheiro && v % 1 ? 2 : 0, maximumFractionDigits: dinheiro ? 2 : 0 });
  /* Colunas: dados = [{ rot, curto, v, hoje? }] */
  function colunas(dados, formatar, opc) {
    opc = opc || {};
    const dinheiro = opc.dinheiro !== false;
    const maxV = Math.max(0, ...dados.map((d) => d.v));
    const passo = passoBonito(maxV || 1, 3), topo = Math.max(passo, Math.ceil((maxV || 1) / passo) * passo);
    // a largura do desenho acompanha a tela, para as letras saírem no tamanho certo no celular
    const L = Math.round(Math.max(300, Math.min(640, opc.largura || ((window.innerWidth || 640) - 72)))), A_ = L < 460 ? 210 : 232, esq = 52, dir = 8, cima = 26, baixo = 30;
    const largura = L - esq - dir, altura = A_ - cima - baixo, base = cima + altura;
    const banda = largura / dados.length, larg = Math.min(24, banda * 0.5);
    const y = (v) => base - (v / topo) * altura;
    const iMax = maxV ? dados.findIndex((d) => d.v === maxV) : -1;
    const ticks = [];
    for (let v = 0; v <= topo + 1e-9; v += passo) ticks.push(v);
    const grade = ticks.map((v) => `<g class="g-tick"><line x1="${esq}" x2="${L - dir}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? "g-base" : "g-grade"}"/>
      <text x="${esq - 10}" y="${y(v) + 4}" text-anchor="end" class="g-eixo-y">${esc(compacto(v, dinheiro))}</text></g>`).join("");
    // marcações de mostrador (só aparecem no estilo Elegante): 4 traços entre cada valor do eixo
    const mostrador = [];
    for (let k = 0; k < (ticks.length - 1) * 5; k++) {
      const yy = base - (k / ((ticks.length - 1) * 5)) * altura;
      mostrador.push(`<line x1="${esq - (k % 5 ? 3 : 6)}" x2="${esq}" y1="${yy}" y2="${yy}" class="g-indice${k % 5 ? "" : " forte"}"/>`);
    }
    const marcas = dados.map((d, i) => {
      const cx = esq + i * banda + banda / 2, x = cx - larg / 2;
      const h = d.v ? Math.max(3, base - y(d.v)) : 0, topoY = base - h, r = Math.min(4, h);
      const caminho = h ? `M${x},${base} V${topoY + r} Q${x},${topoY} ${x + r},${topoY} H${x + larg - r} Q${x + larg},${topoY} ${x + larg},${topoY + r} V${base} Z` : "";
      const rotular = d.v && (i === iMax || d.hoje);
      return `<g class="g-col${d.hoje ? " hoje" : ""}${i === iMax ? " maior" : ""}" tabindex="0" role="listitem" data-i="${i}" aria-label="${esc(d.rot)}: ${esc(formatar(d.v))}">
        <rect class="g-alvo" x="${esq + i * banda}" y="${cima - 18}" width="${banda}" height="${altura + 18 + baixo}"/>
        <rect class="g-trilho" x="${x}" y="${cima}" width="${larg}" height="${altura}" rx="${larg / 2}"/>
        ${caminho ? `<path d="${caminho}" class="g-marca"/>` : ""}
        ${rotular ? `<text x="${cx}" y="${topoY - 8}" text-anchor="middle" class="g-valor">${esc(rotuloValor(d.v, dinheiro))}</text>` : ""}
        <text x="${cx}" y="${base + 20}" text-anchor="middle" class="g-eixo-x">${esc(d.curto)}</text></g>`;
    }).join("");
    return `<div class="g-quadro"><svg class="grafico g-colunas" viewBox="0 0 ${L} ${A_}" role="img" aria-label="${esc(opc.titulo || "Gráfico")}">
      <g class="g-mostrador" aria-hidden="true">${mostrador.join("")}</g>${grade}<g role="list">${marcas}</g></svg>
      <div class="g-dica oculto" role="status" aria-live="polite"></div></div>`;
  }

  /* Ranking: dados = [{ rot, v }] — barras deitadas, valor na ponta */
  function barras(dados, formatar) {
    const max = Math.max(1, ...dados.map((d) => d.v));
    return `<div class="ranking" role="list">${dados.map((d, i) => `<div class="rk-linha${i === 0 ? " lider" : ""}" role="listitem" tabindex="0" aria-label="${esc(d.rot)}: ${esc(formatar(d.v))}">
      <span class="rk-nome">${esc(d.rot)}</span><span class="rk-trilho"><i class="rk-indice" style="left:25%"></i><i class="rk-indice forte" style="left:50%"></i><i class="rk-indice" style="left:75%"></i><span class="rk-barra" style="width:${Math.max(2, (d.v / max) * 100)}%"></span></span>
      <span class="rk-valor">${esc(formatar(d.v))}</span></div>`).join("")}</div>`;
  }

  /* Dica (tooltip) das colunas: segue o dedo, o mouse e o foco do teclado. */
  function ligar(raiz, dados, formatar) {
    U.$$(".g-quadro", raiz).forEach((q) => {
      const dica = U.$(".g-dica", q), svg = U.$("svg", q);
      const mostrar = (g) => {
        const d = dados[Number(g.dataset.i)];
        if (!d) return;
        U.$$(".g-col", q).forEach((x) => x.classList.toggle("apagada", x !== g));
        dica.textContent = "";
        const v = document.createElement("b"); v.textContent = formatar(d.v);
        const r = document.createElement("span"); r.textContent = d.rot;
        dica.append(v, r);
        dica.classList.remove("oculto");
        const caixa = q.getBoundingClientRect(), alvo = (U.$(".g-marca", g) || U.$(".g-trilho", g)).getBoundingClientRect();
        const meio = alvo.left + alvo.width / 2 - caixa.left;
        dica.style.left = Math.max(8, Math.min(caixa.width - dica.offsetWidth - 8, meio - dica.offsetWidth / 2)) + "px";
        dica.style.top = Math.max(0, alvo.top - caixa.top - dica.offsetHeight - 10) + "px";
      };
      const esconder = () => { dica.classList.add("oculto"); U.$$(".g-col", q).forEach((x) => x.classList.remove("apagada")); };
      U.$$(".g-col", q).forEach((g) => {
        g.addEventListener("pointerenter", () => mostrar(g));
        g.addEventListener("focus", () => mostrar(g));
        g.addEventListener("blur", esconder);
      });
      svg.addEventListener("pointerleave", esconder);
    });
  }

  /* Entrada: colunas crescem da base e as barras do ranking crescem da esquerda. Uma vez por desenho. */
  function animar(raiz) {
    const g = window.gsap;
    if (!g) return;
    const mm = g.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const cols = U.$$(".g-marca", raiz), rk = U.$$(".rk-barra", raiz);
      if (cols.length) g.from(cols, { scaleY: 0, transformOrigin: "50% 100%", duration: 0.8, ease: "expo.out", stagger: 0.045 });
      if (rk.length) g.from(rk, { scaleX: 0, transformOrigin: "0% 50%", duration: 0.8, ease: "expo.out", stagger: 0.05 });
      const valores = U.$$(".g-valor", raiz);
      if (valores.length) g.from(valores, { autoAlpha: 0, y: 6, duration: 0.4, delay: 0.45, ease: "power2.out" });
    });
    // o matchMedia desfaz sozinho se a preferência mudar; aqui só soltamos a referência quando o gráfico sai da tela
    setTimeout(() => { if (!document.body.contains(raiz)) mm.revert(); }, 5000);
  }

  /* O número grande do caixa conta até o valor (só na primeira vez que aparece). */
  function contar(el, valor, formatar) {
    const g = window.gsap;
    if (!el || !g || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !valor) return;
    const obj = { v: 0 };
    g.to(obj, { v: valor, duration: 0.9, ease: "expo.out", onUpdate: () => { el.textContent = formatar(Math.round(obj.v * 100) / 100); },
      onComplete: () => { el.textContent = formatar(valor); } });
  }

  window.GRAFICOS = { colunas, barras, ligar, animar, contar };
})();
