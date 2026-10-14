/* caixa.js — aba "Caixa" (dono e caixa): total do dia, gráficos dos últimos
   7 dias, relatórios (dia, intervalo, mês) e inadimplência com cobrança. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO;
  const A = () => window.APP;
  const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", prazo: "À prazo", misto: "Várias formas", debito: "Débito", credito: "Crédito" };
  let d7 = null, secao = "cortes", corpoAtual = null, relatorio = { modo: "dia" };

  /* ---------- datas no relógio da barbearia ---------- */
  const fuso = () => (d7 && d7.fuso) || "America/Sao_Paulo";
  const ymd = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: fuso() });
  const somaDias = (y, n) => { const d = new Date(y + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const br = (y) => y.split("-").reverse().join("/");
  const diaSemana = (y) => HORARIO.DIAS_CURTOS[new Date(y + "T12:00:00Z").getUTCDay()];
  const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso() });
  const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);

  /* ---------- contas ---------- */
  const recebidos = (ps, de, ate) => ps.filter((p) => p.pago && p.pago_em && ymd(p.pago_em) >= de && ymd(p.pago_em) <= ate);
  const realizados = (ps, de, ate) => ps.filter((p) => p.tipo === "servico" && p.finalizado_em && ymd(p.finalizado_em) >= de && ymd(p.finalizado_em) <= ate);
  const soma = (ps) => ps.reduce((s, p) => s + Number(p.total), 0);
  const contaTipo = (ps, t) => ps.reduce((s, p) => s + (p.itens || []).filter((i) => i.tipo === t).reduce((n, i) => n + Number(i.qtd || 1), 0), 0);
  const devendo = (ps) => ps.filter((p) => p.forma === "prazo" && !p.pago);
  const formaPaga = (p) => p.pago_forma || (p.forma === "prazo" ? "dinheiro" : p.forma);
  /* Quanto entrou em cada forma (uma venda pode ter dinheiro + Pix + cartão) e a taxa da maquininha. */
  const listaPag = (p) => (Array.isArray(p.pagamentos) && p.pagamentos.length ? p.pagamentos
    : formaPaga(p) === "misto" ? [{ f: "pix", v: p.pago_pix }, { f: "dinheiro", v: p.pago_dinheiro }] : [{ f: formaPaga(p), v: p.total }]);
  const partes = (p) => {
    const r = { pix: 0, din: 0, deb: 0, cred: 0 };
    listaPag(p).forEach((x) => { r[{ pix: "pix", dinheiro: "din", debito: "deb", credito: "cred" }[x.f] || "din"] += Number(x.v || 0); });
    return r;
  };
  const somaPor = (k) => (ps) => Math.round(ps.reduce((s, p) => s + partes(p)[k], 0) * 100) / 100;
  const somaPix = somaPor("pix"), somaDin = somaPor("din"), somaDeb = somaPor("deb"), somaCred = somaPor("cred");
  const somaCartao = (ps) => somaDeb(ps) + somaCred(ps);
  const somaTaxa = (ps) => Math.round(ps.reduce((s, p) => s + Number(p.taxa_valor || 0), 0) * 100) / 100;
  const liquido = (ps) => Math.round((soma(ps) - somaTaxa(ps)) * 100) / 100;
  const textoPag = (p) => listaPag(p).length > 1 ? listaPag(p).map((x) => `${FORMAS[x.f] || x.f} ${C.dinheiro(x.v)}`).join(" + ") : FORMAS[formaPaga(p)];
  const temCartao = () => d7 && (d7.aceita_debito || d7.aceita_credito);

  async function buscar(de, ate) { return A().S.rpc("caixa_dados", { p_de: de, p_ate: ate }); }

  async function tela(corpo) {
    corpoAtual = corpo;
    corpo.innerHTML = `<p class="suave">Carregando o caixa…</p>`;
    try {
      const hojeLocal = new Date().toLocaleDateString("en-CA", { timeZone: A().b().fuso || "America/Sao_Paulo" });
      d7 = await buscar(somaDias(hojeLocal, -6), hojeLocal);
    } catch (err) { corpo.innerHTML = `<p class="suave">${esc(err.message)}</p>`; return; }
    if (!relatorio.dia) relatorio.dia = d7.hoje;
    desenhar();
  }

  function desenhar() {
    const corpo = corpoAtual;
    const hoje = d7.hoje, rec = recebidos(d7.pedidos, hoje, hoje);
    const pix = somaPix(rec), din = somaDin(rec), cart = somaCartao(rec), taxa = somaTaxa(rec);
    const SECOES = [["cortes", "Gráficos de corte"], ["produtos", "Gráficos de produtos"], ["relatorios", "Relatórios"], ["inadimplencia", `Inadimplência${devendo(d7.pedidos).length ? ` (${devendo(d7.pedidos).length})` : ""}`]];
    corpo.innerHTML = `
      <section class="cartao caixa-hoje" aria-label="Total do caixa hoje">
        <div class="rotulo-kpi">Total em caixa hoje · ${esc(diaSemana(hoje))} ${esc(br(hoje))}</div>
        <div class="heroi">${C.dinheiro(soma(rec))}</div>
        <div class="caixa-hoje-detalhe"><span>Pix <b>${C.dinheiro(pix)}</b></span><span>Dinheiro <b>${C.dinheiro(din)}</b></span>
          ${cart || temCartao() ? `<span>Cartão <b>${C.dinheiro(cart)}</b></span>` : ""}
          <span>${rec.length} venda${rec.length === 1 ? "" : "s"}</span></div>
        ${taxa ? `<div class="caixa-hoje-liquido"><span>Taxa da maquininha <b>−${C.dinheiro(taxa)}</b></span><span>Líquido <b>${C.dinheiro(soma(rec) - taxa)}</b></span></div>` : ""}
      </section>
      <div class="caixa-corpo">
        <nav class="caixa-menu" aria-label="Seções do caixa">${SECOES.map(([id, t]) => `<button data-sec="${id}" aria-current="${id === secao}">${t}</button>`).join("")}</nav>
        <div class="caixa-secao" id="caixa-secao"></div>
      </div>`;
    $$(".caixa-menu button", corpo).forEach((bt) => (bt.onclick = () => { secao = bt.dataset.sec; desenhar(); }));
    ({ cortes: secaoCortes, produtos: secaoProdutos, relatorios: secaoRelatorios, inadimplencia: secaoInadimplencia })[secao]($("#caixa-secao", corpo));
  }

  /* ---------- peças visuais ---------- */
  const tile = (rotulo, valor, nota) => `<div class="kpi"><div class="rotulo-kpi">${rotulo}</div><div class="valor-kpi">${valor}</div>${nota ? `<div class="nota-kpi">${nota}</div>` : ""}</div>`;

  /* Colunas (um único dado por dia): barras finas, ponta arredondada, valor no topo e na dica. */
  function colunas(dados, formatar) {
    const max = Math.max(1, ...dados.map((d) => d.v));
    const L = 320, A_ = 150, base = 128, banda = L / dados.length, larg = Math.min(24, banda * 0.55);
    const barras = dados.map((d, i) => {
      const h = d.v ? Math.max(4, (d.v / max) * (base - 22)) : 0, x = i * banda + (banda - larg) / 2, y = base - h;
      const r = Math.min(4, h);
      const caminho = h ? `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + larg - r} Q${x + larg},${y} ${x + larg},${y + r} V${base} Z` : "";
      return `<g class="col" tabindex="0" aria-label="${esc(d.rot)}: ${esc(formatar(d.v))}">
        <rect class="alvo" x="${i * banda}" y="0" width="${banda}" height="${A_}" fill="transparent"><title>${esc(d.rot)}: ${esc(formatar(d.v))}</title></rect>
        ${caminho ? `<path d="${caminho}" class="marca"/>` : ""}
        ${d.v ? `<text x="${x + larg / 2}" y="${y - 5}" text-anchor="middle" class="rotulo-valor">${esc(formatar(d.v).replace("R$", "").trim())}</text>` : ""}
        <text x="${x + larg / 2}" y="${base + 16}" text-anchor="middle" class="rotulo-eixo">${esc(d.curto)}</text></g>`;
    }).join("");
    return `<svg class="grafico" viewBox="0 0 ${L} ${A_}" role="img"><line x1="0" x2="${L}" y1="${base}" y2="${base}" class="eixo"/>${barras}</svg>`;
  }
  /* Barras deitadas para o ranking (nomes longos cabem à esquerda). */
  function barras(dados, formatar) {
    const max = Math.max(1, ...dados.map((d) => d.v));
    return `<div class="ranking">${dados.map((d) => `<div class="rk-linha" title="${esc(d.rot)}: ${esc(formatar(d.v))}">
      <span class="rk-nome">${esc(d.rot)}</span><span class="rk-trilho"><span class="rk-barra" style="width:${Math.max(2, (d.v / max) * 100)}%"></span></span>
      <span class="rk-valor">${esc(formatar(d.v))}</span></div>`).join("")}</div>`;
  }
  const tabela = (cab, linhas, classe) => `<div class="tabela-rolar"><table class="tabela${classe ? " " + classe : ""}"><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c, i) => `<td data-rot="${esc(String(cab[i] || "").replace(/<[^>]+>/g, ""))}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  function alternarTabela(raiz) {
    $$("[data-ver]", raiz).forEach((bt) => (bt.onclick = () => {
      const alvo = $("#" + bt.dataset.ver, raiz); const aberto = !alvo.classList.toggle("oculto");
      bt.textContent = aberto ? "Esconder números" : "Ver números";
    }));
  }

  /* ---------- seções ---------- */
  function secaoCortes(el) {
    const hoje = d7.hoje, de = somaDias(hoje, -6);
    const real = realizados(d7.pedidos, de, hoje), rec = recebidos(d7.pedidos, de, hoje).filter((p) => p.tipo === "servico");
    const pix = somaPix(rec), din = somaDin(rec), cart = somaCartao(rec), taxa = somaTaxa(rec);
    const aReceber = soma(devendo(d7.pedidos));
    const dias = Array.from({ length: 7 }, (_, i) => somaDias(de, i)).map((d) => ({ dia: d, rot: `${diaSemana(d)} ${br(d)}`, curto: diaSemana(d), v: liquido(rec.filter((p) => ymd(p.pago_em) === d)) }));
    el.innerHTML = `<section class="cartao"><h2>Cortes · últimos 7 dias</h2><p class="pequeno suave">${esc(br(de))} a ${esc(br(hoje))}</p>
      <div class="kpis">
        ${tile("Cortes de cabelo realizados", contaTipo(real, "cabelo"))}
        ${tile("Barbas realizadas", contaTipo(real, "barba"))}
        ${tile("Recebido em Pix", C.dinheiro(pix))}
        ${tile("Recebido em dinheiro", C.dinheiro(din))}
        ${cart || temCartao() ? tile("Recebido em cartão", C.dinheiro(cart), `débito ${C.dinheiro(somaDeb(rec))} · crédito ${C.dinheiro(somaCred(rec))}`) : ""}
        ${taxa ? tile("Taxa da maquininha", "−" + C.dinheiro(taxa), "descontada pelo banco") : ""}
        ${tile("Cortes à prazo", real.filter((p) => p.forma === "prazo").length)}
        ${tile("Total geral", C.dinheiro(soma(rec)), "inclui à prazo já pagos")}
        ${taxa ? tile("Total líquido", C.dinheiro(soma(rec) - taxa), "já sem a taxa do cartão") : ""}
        ${tile("A receber (à prazo)", C.dinheiro(aReceber), "todos os em aberto")}
      </div>
      <h3 style="margin-top:1rem">Recebido com cortes por dia${taxa ? " (líquido, já sem a taxa do cartão)" : ""}</h3>
      ${colunas(dias, C.dinheiro)}
      <button class="link" data-ver="tab-cortes">Ver números</button>
      <div id="tab-cortes" class="oculto">${tabela(["Dia", "Recebido"], dias.map((d) => [esc(d.rot), C.dinheiro(d.v)]))}</div></section>`;
    alternarTabela(el);
  }

  function agruparProdutos(ps) {
    const m = new Map();
    ps.forEach((p) => (p.itens || []).forEach((i) => {
      const x = m.get(i.nome) || { rot: i.nome, qtd: 0, valor: 0 };
      x.qtd += Number(i.qtd || 1); x.valor += Number(i.valor) * Number(i.qtd || 1); m.set(i.nome, x);
    }));
    return [...m.values()].sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
  }
  function secaoProdutos(el) {
    const hoje = d7.hoje, de = somaDias(hoje, -6);
    const vendas = recebidos(d7.pedidos, de, hoje).filter((p) => p.tipo === "produto");
    const lista = agruparProdutos(vendas), total = soma(vendas);
    el.innerHTML = `<section class="cartao"><h2>Produtos · últimos 7 dias</h2><p class="pequeno suave">${esc(br(de))} a ${esc(br(hoje))}</p>
      <div class="kpis">${tile("Valor total com produtos", C.dinheiro(total))}${tile("Unidades vendidas", lista.reduce((s, x) => s + x.qtd, 0))}
        ${somaTaxa(vendas) ? tile("Líquido (sem a taxa do cartão)", C.dinheiro(liquido(vendas))) : ""}</div>
      ${lista.length ? `<h3 style="margin-top:1rem">Mais vendidos (quantidade)</h3>${barras(lista.slice(0, 10).map((x) => ({ rot: x.rot, v: x.qtd })), (v) => v + " un.")}
        <h3 style="margin-top:1rem">Vendidos no período</h3>${tabela(["Produto", "Quantidade", "Valor"], lista.map((x) => [esc(x.rot), x.qtd, C.dinheiro(x.valor)]))}`
        : `<p class="suave pequeno" style="margin-top:1rem">Nenhum produto vendido nos últimos 7 dias.</p>`}</section>`;
  }

  /* ---------- relatórios ---------- */
  function periodo() {
    if (relatorio.modo === "dia") return [relatorio.dia, relatorio.dia];
    if (relatorio.modo === "intervalo") return [relatorio.de, relatorio.ate];
    const [y, m] = relatorio.mes.split("-").map(Number);
    const ult = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return [`${relatorio.mes}-01`, `${relatorio.mes}-${String(ult).padStart(2, "0")}`];
  }
  async function secaoRelatorios(el) {
    const hoje = d7.hoje;
    relatorio.de = relatorio.de || somaDias(hoje, -6); relatorio.ate = relatorio.ate || hoje; relatorio.mes = relatorio.mes || hoje.slice(0, 7);
    el.innerHTML = `<section class="cartao"><h2>Relatórios</h2>
      <div class="abas-mini" role="tablist">${[["dia", "Por dia"], ["intervalo", "Intervalo"], ["mes", "Mensal"]].map(([m, t]) => `<button class="chip" data-modo="${m}" aria-pressed="${relatorio.modo === m}">${t}</button>`).join("")}</div>
      <div class="filtros-rel">
        ${relatorio.modo === "dia" ? `<label>Dia<input type="date" id="r-dia" value="${relatorio.dia}" max="${hoje}"></label>` : ""}
        ${relatorio.modo === "intervalo" ? `<label>De<input type="date" id="r-de" value="${relatorio.de}" max="${hoje}"></label><label>Até<input type="date" id="r-ate" value="${relatorio.ate}" max="${hoje}"></label>` : ""}
        ${relatorio.modo === "mes" ? `<label>Mês<input type="month" id="r-mes" value="${relatorio.mes}" max="${hoje.slice(0, 7)}"></label>` : ""}
        <button class="btn" id="r-gerar">Gerar relatório</button>
      </div>
      <div id="r-saida"></div></section>`;
    $$("[data-modo]", el).forEach((bt) => (bt.onclick = () => { relatorio.modo = bt.dataset.modo; secaoRelatorios(el); }));
    $("#r-gerar", el).onclick = () => gerar(el);
    gerar(el);
  }
  async function gerar(el) {
    if ($("#r-dia", el)) relatorio.dia = $("#r-dia", el).value;
    if ($("#r-de", el)) { relatorio.de = $("#r-de", el).value; relatorio.ate = $("#r-ate", el).value; }
    if ($("#r-mes", el)) relatorio.mes = $("#r-mes", el).value;
    const [de, ate] = periodo();
    const saida = $("#r-saida", el);
    if (!de || !ate) return U.aviso("Escolha as datas.", "erro");
    if (ate < de) return U.aviso("A data final precisa ser depois da inicial.", "erro");
    if (relatorio.modo === "intervalo" && diasEntre(de, ate) > 29) return U.aviso("O intervalo pode ter no máximo 30 dias.", "erro");
    saida.innerHTML = `<p class="suave pequeno">Gerando…</p>`;
    let dados;
    try { dados = await buscar(de, ate); } catch (err) { saida.innerHTML = `<p class="suave">${esc(err.message)}</p>`; return; }
    const vendas = recebidos(dados.pedidos, de, ate);
    const cortes = vendas.filter((p) => p.tipo === "servico"), prods = vendas.filter((p) => p.tipo === "produto");
    const real = realizados(dados.pedidos, de, ate);
    const titulo = relatorio.modo === "dia" ? `Vendas de ${br(de)}` : relatorio.modo === "mes" ? `Vendas de ${de.slice(5, 7)}/${de.slice(0, 4)}` : `Vendas de ${br(de)} a ${br(ate)}`;
    const quandoTxt = (p) => relatorio.modo === "dia" ? hora(p.pago_em) : `${br(ymd(p.pago_em)).slice(0, 5)} ${hora(p.pago_em)}`;
    const itensTxt = (p) => (p.itens || []).map((i) => `${i.qtd > 1 ? i.qtd + "× " : ""}${esc(i.nome)}`).join(", ");
    const extrasPag = (p) => [p.forma === "prazo" ? "à prazo" : "", p.origem === "balcao" ? "balcão" : ""].filter(Boolean).join(" · ");
    // PDF: uma linha de texto por venda
    const linhas = vendas.map((p) => [quandoTxt(p), esc(p.cliente_nome), p.tipo === "produto" ? "Produto" : "Corte", itensTxt(p),
      textoPag(p) + (extrasPag(p) ? " · " + extrasPag(p) : "") + (Number(p.taxa_valor) ? ` · taxa −${C.dinheiro(p.taxa_valor)}` : ""), C.dinheiro(p.total)]);
    // tela: cada forma numa linha (valor junto da forma), taxa à parte
    const pagHtml = (p) => `${listaPag(p).map((x) => `<span class="rel-parte">${FORMAS[x.f] || esc(x.f)} ${C.dinheiro(x.v)}</span>`).join("")}${
      extrasPag(p) ? `<span class="rel-extra">${esc(extrasPag(p))}</span>` : ""}${Number(p.taxa_valor) ? `<span class="rel-extra">taxa −${C.dinheiro(p.taxa_valor)}</span>` : ""}`;
    const linhasTela = vendas.map((p) => [quandoTxt(p), `${esc(p.cliente_nome)}${p.tipo === "produto" ? ` <span class="selo">Produto</span>` : ""}`,
      itensTxt(p), pagHtml(p), C.dinheiro(p.total),
      `<button class="btn mini sec btn-excluir" data-excluir="${p.id}" aria-label="Excluir venda de ${esc(p.cliente_nome)}">${U.icone("lixeira")}Excluir</button>`]);
    const resumo = { titulo, de, ate, vendas, cortes, prods, real, linhas, pix: somaPix(vendas), din: somaDin(vendas), deb: somaDeb(vendas), cred: somaCred(vendas), taxa: somaTaxa(vendas) };
    saida.innerHTML = `<h3 style="margin-top:1rem">${esc(titulo)}</h3>
      <div class="kpis">${tile("Cortes", C.dinheiro(soma(cortes)), `${cortes.length} recebimento(s)`)}${tile("Produtos", C.dinheiro(soma(prods)), `${prods.length} venda(s)`)}
        ${tile("Pix", C.dinheiro(resumo.pix))}${tile("Dinheiro", C.dinheiro(resumo.din))}
        ${resumo.deb + resumo.cred || dados.aceita_debito || dados.aceita_credito ? tile("Cartão", C.dinheiro(resumo.deb + resumo.cred), `débito ${C.dinheiro(resumo.deb)} · crédito ${C.dinheiro(resumo.cred)}`) : ""}
        ${resumo.taxa ? tile("Taxa da maquininha", "−" + C.dinheiro(resumo.taxa), "descontada pelo banco") : ""}</div>
      <div class="total-banda${resumo.taxa ? " com-taxa" : ""}">${resumo.taxa
        ? `${tile("Total líquido", C.dinheiro(soma(vendas) - resumo.taxa), "já sem a taxa do cartão")}${tile("Total geral", C.dinheiro(soma(vendas)), "antes da taxa")}`
        : tile("Total geral", C.dinheiro(soma(vendas)))}</div>
      <p class="pequeno suave">Cortes realizados no período: <b>${real.length}</b> (${contaTipo(real, "cabelo")} de cabelo, ${contaTipo(real, "barba")} de barba). À prazo pago entra no dia em que foi pago.</p>
      ${vendas.length ? tabela(["Quando", "Cliente", "Itens", "Pagamento", "Valor", ""], linhasTela, "tabela-vendas") : `<p class="suave pequeno">Nenhuma venda no período.</p>`}
      <div class="linha-acoes"><button class="btn sec" id="r-pdf"${vendas.length ? "" : " disabled"}>Baixar PDF</button></div>`;
    $("#r-pdf", el).onclick = () => pdf(resumo);
    $$("[data-excluir]", saida).forEach((bt) => (bt.onclick = () => excluirVenda(vendas.find((p) => p.id === bt.dataset.excluir), el)));
  }
  function pdf(r) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const linha = (y) => { doc.setDrawColor(220); doc.line(14, y, 196, y); };
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(A().b().nome, 14, 18);
    doc.setFontSize(12); doc.text(r.titulo, 14, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Cortes: ${C.dinheiro(soma(r.cortes))}   Produtos: ${C.dinheiro(soma(r.prods))}   Pix: ${C.dinheiro(r.pix)}   Dinheiro: ${C.dinheiro(r.din)}   Cartão: ${C.dinheiro(r.deb + r.cred)}`, 14, 34);
    doc.setFont("helvetica", "bold"); doc.text(`Total geral: ${C.dinheiro(soma(r.vendas))}${r.taxa ? `   Taxa da maquininha: -${C.dinheiro(r.taxa)}   Líquido: ${C.dinheiro(soma(r.vendas) - r.taxa)}` : ""}`, 14, 40);
    doc.setFont("helvetica", "normal"); doc.text(`Cortes realizados: ${r.real.length}`, r.taxa ? 14 : 120, r.taxa ? 46 : 40);
    let y = r.taxa ? 56 : 50;
    const cols = [14, 40, 80, 100, 160, 196];
    const cab = ["Quando", "Cliente", "Tipo", "Itens", "Pagamento", "Valor"];
    const desenharCab = () => { doc.setFont("helvetica", "bold"); cab.forEach((c, i) => doc.text(c, i === 5 ? cols[5] : cols[i], y, i === 5 ? { align: "right" } : undefined)); doc.setFont("helvetica", "normal"); y += 2; linha(y); y += 5; };
    desenharCab();
    const limpo = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    r.linhas.forEach((l) => {
      if (y > 280) { doc.addPage(); y = 18; desenharCab(); }
      const itens = doc.splitTextToSize(limpo(l[3]), 56);
      doc.text(limpo(l[0]), cols[0], y); doc.text(doc.splitTextToSize(limpo(l[1]), 38)[0], cols[1], y); doc.text(l[2], cols[2], y);
      doc.text(itens, cols[3], y); doc.text(limpo(l[4]), cols[4] - 2, y); doc.text(limpo(l[5]), cols[5], y, { align: "right" });
      y += Math.max(6, itens.length * 4.5);
    });
    doc.save(`relatorio-${A().b().slug}-${r.de}${r.ate !== r.de ? "-a-" + r.ate : ""}.pdf`);
  }

  async function excluirVenda(p, el) {
    if (!p) return;
    const ok = await U.confirmar("Excluir venda", `Excluir a venda de <b>${esc(p.cliente_nome)}</b> (${C.dinheiro(p.total)} · ${(p.itens || []).map((i) => esc(i.nome)).join(", ")})?<br>Ela sai do caixa, dos gráficos e dos relatórios. Não dá para desfazer.`, "Excluir venda", true);
    if (!ok) return;
    try {
      await A().S.rpc("venda_excluir", { p_id: p.id });
      U.aviso("Venda excluída.");
      const hojeLocal = new Date().toLocaleDateString("en-CA", { timeZone: fuso() });
      d7 = await buscar(somaDias(hojeLocal, -6), hojeLocal);
      desenhar();
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  /* ---------- inadimplência ---------- */
  function secaoInadimplencia(el) {
    const hoje = d7.hoje;
    const lista = devendo(d7.pedidos).map((p) => Object.assign({ dias: diasEntre(hoje, p.prazo_data) }, p)).sort((a, b) => a.dias - b.dias);
    el.innerHTML = `<section class="cartao"><h2>Inadimplência</h2>
      <p class="pequeno suave">Clientes que pagaram à prazo. Ao tocar em <b>Pago</b>, o valor entra nos relatórios do dia de hoje (não do dia do corte).</p>
      ${lista.length ? `<div class="kpis">${tile("Total em aberto", C.dinheiro(soma(lista)))}${tile("Atrasados", lista.filter((p) => p.dias < 0).length)}</div>` + lista.map((p) => {
        const atrasado = p.dias < 0;
        return `<div class="devedor${atrasado ? " atrasado" : ""}" data-id="${p.id}">
          <div class="dv-info"><b>${esc(p.cliente_nome)}</b> <span class="selo ${atrasado ? "erro" : "alerta"}">${atrasado ? "Inadimplente" : "Devendo"}</span>
            <div><b>${C.dinheiro(p.total)}</b> · ${(p.itens || []).map((i) => esc(i.nome)).join(", ")}</div>
            <div class="pequeno suave">Vencimento ${esc(br(p.prazo_data))} · ${atrasado ? `atrasado há ${-p.dias} dia(s)` : p.dias === 0 ? "vence hoje" : `faltam ${p.dias} dia(s)`}${p.cliente_whatsapp ? " · " + esc(p.cliente_whatsapp) : ""}</div></div>
          <div class="dv-acoes"><button class="btn" data-a="pago">Pago</button>${atrasado ? `<button class="btn sec" data-a="cobrar">Efetuar cobrança</button>` : ""}</div></div>`;
      }).join("") : `<p class="suave pequeno">Ninguém devendo. 🎉</p>`}</section>`;
    $$(".devedor [data-a]", el).forEach((bt) => (bt.onclick = () => {
      const p = lista.find((x) => x.id === bt.closest(".devedor").dataset.id);
      if (bt.dataset.a === "cobrar") return cobrar(p);
      pagar(p);
    }));
  }
  function mensagemCobranca(p) {
    const pix = d7.pix ? `\nPix (${PIX.NOMES[d7.pix.tipo]}): ${PIX.mostrarChave(d7.pix.tipo, d7.pix.chave)} — ${d7.pix.titular}` : "";
    return `Olá, ${p.cliente_nome.split(" ")[0]}! Aqui é da *${d7.barbearia}*.\n\nConsta em aberto o valor de *${C.dinheiro(p.total)}* referente a ${(p.itens || []).map((i) => i.nome).join(", ")}` +
      `${p.finalizado_em ? ` do dia ${br(ymd(p.finalizado_em))}` : ""}, com vencimento em ${br(p.prazo_data)}.\n\nVocê pode pagar no balcão ou por Pix.${pix}\n\nObrigado!`;
  }
  function cobrar(p) {
    const msg = mensagemCobranca(p);
    U.copiar(msg);
    U.whatsapp(msg, p.cliente_whatsapp);
  }
  async function pagar(p) {
    const r = await window.BALCAO.receberPedido(Number(p.total), "Pagamento recebido", `<b>${esc(p.cliente_nome)}</b> está pagando o que devia. Como foi pago?`, window.BALCAO.cfgDaBarbearia(A().b()));
    if (!r) return;
    try {
      await A().S.rpc("pedido_pagar", { p_id: p.id, p_pagamentos: r.pagamentos });
      U.aviso(`Pagamento registrado no caixa de hoje${r.troco ? ` · troco ${C.dinheiro(r.troco)}` : ""}.`);
      await tela(corpoAtual);
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  window.APP_ABAS = Object.assign(window.APP_ABAS || {}, { caixa: tela });
})();
