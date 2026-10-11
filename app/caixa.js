/* caixa.js — aba "Caixa" (dono e caixa): total do dia, gráficos dos últimos
   7 dias, relatórios (dia, intervalo, mês) e inadimplência com cobrança. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO;
  const A = () => window.APP;
  const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", prazo: "À prazo" };
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
  const contaTipo = (ps, t) => ps.reduce((s, p) => s + (p.itens || []).filter((i) => i.tipo === t).length, 0);
  const devendo = (ps) => ps.filter((p) => p.forma === "prazo" && !p.pago);
  const formaPaga = (p) => p.pago_forma || (p.forma === "prazo" ? "dinheiro" : p.forma);

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
    const pix = soma(rec.filter((p) => formaPaga(p) === "pix")), din = soma(rec.filter((p) => formaPaga(p) === "dinheiro"));
    const SECOES = [["cortes", "Gráficos de corte"], ["produtos", "Gráficos de produtos"], ["relatorios", "Relatórios"], ["inadimplencia", `Inadimplência${devendo(d7.pedidos).length ? ` (${devendo(d7.pedidos).length})` : ""}`]];
    corpo.innerHTML = `
      <section class="cartao caixa-hoje" aria-label="Total do caixa hoje">
        <div class="rotulo-kpi">Total em caixa hoje · ${esc(diaSemana(hoje))} ${esc(br(hoje))}</div>
        <div class="heroi">${C.dinheiro(pix + din)}</div>
        <div class="caixa-hoje-detalhe"><span>Pix <b>${C.dinheiro(pix)}</b></span><span>Dinheiro <b>${C.dinheiro(din)}</b></span>
          <span>${rec.length} venda${rec.length === 1 ? "" : "s"}</span></div>
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
  const tabela = (cab, linhas) => `<div class="tabela-rolar"><table class="tabela"><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
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
    const pix = soma(rec.filter((p) => formaPaga(p) === "pix")), din = soma(rec.filter((p) => formaPaga(p) === "dinheiro"));
    const aReceber = soma(devendo(d7.pedidos));
    const dias = Array.from({ length: 7 }, (_, i) => somaDias(de, i)).map((d) => ({ dia: d, rot: `${diaSemana(d)} ${br(d)}`, curto: diaSemana(d), v: soma(rec.filter((p) => ymd(p.pago_em) === d)) }));
    el.innerHTML = `<section class="cartao"><h2>Cortes · últimos 7 dias</h2><p class="pequeno suave">${esc(br(de))} a ${esc(br(hoje))}</p>
      <div class="kpis">
        ${tile("Cortes de cabelo realizados", contaTipo(real, "cabelo"))}
        ${tile("Barbas realizadas", contaTipo(real, "barba"))}
        ${tile("Recebido em Pix", C.dinheiro(pix))}
        ${tile("Recebido em dinheiro", C.dinheiro(din))}
        ${tile("Cortes à prazo", real.filter((p) => p.forma === "prazo").length)}
        ${tile("Total geral (Pix + dinheiro)", C.dinheiro(pix + din), "inclui à prazo já pagos")}
        ${tile("A receber (à prazo)", C.dinheiro(aReceber), "todos os em aberto")}
      </div>
      <h3 style="margin-top:1rem">Recebido com cortes por dia</h3>
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
      <div class="kpis">${tile("Valor total com produtos", C.dinheiro(total))}${tile("Unidades vendidas", lista.reduce((s, x) => s + x.qtd, 0))}</div>
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
    const linhas = vendas.map((p) => [
      relatorio.modo === "dia" ? hora(p.pago_em) : `${br(ymd(p.pago_em)).slice(0, 5)} ${hora(p.pago_em)}`,
      esc(p.cliente_nome), p.tipo === "produto" ? "Produto" : "Corte",
      (p.itens || []).map((i) => `${i.qtd > 1 ? i.qtd + "× " : ""}${esc(i.nome)}`).join(", "),
      FORMAS[formaPaga(p)] + (p.forma === "prazo" ? " (à prazo)" : ""), C.dinheiro(p.total)]);
    const resumo = { titulo, de, ate, vendas, cortes, prods, real, linhas, pix: soma(vendas.filter((p) => formaPaga(p) === "pix")), din: soma(vendas.filter((p) => formaPaga(p) === "dinheiro")) };
    saida.innerHTML = `<h3 style="margin-top:1rem">${esc(titulo)}</h3>
      <div class="kpis">${tile("Cortes", C.dinheiro(soma(cortes)), `${cortes.length} recebimento(s)`)}${tile("Produtos", C.dinheiro(soma(prods)), `${prods.length} venda(s)`)}
        ${tile("Pix", C.dinheiro(resumo.pix))}${tile("Dinheiro", C.dinheiro(resumo.din))}${tile("Total geral", C.dinheiro(soma(vendas)))}</div>
      <p class="pequeno suave">Cortes realizados no período: <b>${real.length}</b> (${contaTipo(real, "cabelo")} de cabelo, ${contaTipo(real, "barba")} de barba). À prazo pago entra no dia em que foi pago.</p>
      ${vendas.length ? tabela(["Quando", "Cliente", "Tipo", "Itens", "Pagamento", "Valor"], linhas) : `<p class="suave pequeno">Nenhuma venda no período.</p>`}
      <div class="linha-acoes"><button class="btn sec" id="r-pdf"${vendas.length ? "" : " disabled"}>Baixar PDF</button></div>`;
    $("#r-pdf", el).onclick = () => pdf(resumo);
  }
  function pdf(r) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const linha = (y) => { doc.setDrawColor(220); doc.line(14, y, 196, y); };
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text(A().b().nome, 14, 18);
    doc.setFontSize(12); doc.text(r.titulo, 14, 26);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Cortes: ${C.dinheiro(soma(r.cortes))}   Produtos: ${C.dinheiro(soma(r.prods))}   Pix: ${C.dinheiro(r.pix)}   Dinheiro: ${C.dinheiro(r.din)}`, 14, 34);
    doc.setFont("helvetica", "bold"); doc.text(`Total geral: ${C.dinheiro(soma(r.vendas))}`, 14, 40);
    doc.setFont("helvetica", "normal"); doc.text(`Cortes realizados: ${r.real.length}`, 120, 40);
    let y = 50;
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
    const forma = await U.modal("Pagamento recebido", `<p><b>${esc(p.cliente_nome)}</b> pagou <b>${C.dinheiro(p.total)}</b>. Como foi pago?</p>`, [
      { rotulo: "Cancelar", classe: "sec", valor: null }, { rotulo: "Dinheiro", classe: "sec", valor: "dinheiro" }, { rotulo: "Pix", valor: "pix" },
    ]);
    if (!forma) return;
    try {
      await A().S.rpc("pagamento_confirmar", { p_id: p.id, p_forma: forma });
      U.aviso("Pagamento registrado no caixa de hoje.");
      await tela(corpoAtual);
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  window.APP_ABAS = Object.assign(window.APP_ABAS || {}, { caixa: tela });
})();
