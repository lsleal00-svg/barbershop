/* balcao.js — "Informar pagamentos": a equipe registra no balcão os cortes e
   produtos de quem não usou o app. Monta uma comanda, escolhe o barbeiro e a
   forma (Pix, dinheiro com troco, Pix + dinheiro ou à prazo) e o pedido vai
   para o Caixa, gráficos e relatórios como se fosse do app.
   Também oferece a calculadora de troco para as outras telas (BALCAO.troco). */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO;
  const A = () => window.APP;
  const NOTAS = [2, 5, 10, 20, 50, 100, 200];

  let cats = [], itens = [], dados = null, atual = null, busca = "", comanda = [], tela = null;

  const tipoDe = (it) => ((cats.find((c) => c.id === it.categoria_id) || {}).tipo) || "outros";
  const ehServico = (it) => tipoDe(it) !== "outros";
  const totalComanda = () => Math.round(comanda.reduce((s, x) => s + C.final(x.item) * x.qtd, 0) * 100) / 100;
  const qtdComanda = () => comanda.reduce((s, x) => s + x.qtd, 0);
  const norm = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const centavos = (v) => Math.round(Number(v) * 100);
  const lerValor = (txt) => { const n = C.lerPreco(txt); return isNaN(n) ? NaN : Math.round(n * 100) / 100; };
  const valorCampo = (v) => (Math.round(v * 100) / 100).toFixed(2).replace(".", ",");

  /* Notas que fazem sentido para "o cliente deu…": o valor exato e as próximas notas acima do total. */
  function sugestoesNotas(total) {
    const s = new Set([total]);
    for (const n of NOTAS) if (n > total) { s.add(n); if (s.size >= 4) break; }
    const dez = Math.ceil(total / 10) * 10; if (dez > total && s.size < 4) s.add(dez);
    return Array.from(s).sort((a, b) => a - b).slice(0, 4);
  }

  /* ---------- calculadora de troco (bloco reutilizável) ---------- */
  function trocoHtml(id, total, rotulo) {
    return `<div class="troco" id="${id}">
      <label for="${id}-rec">${esc(rotulo || "Valor recebido em dinheiro")}</label>
      <div class="troco-linha"><span class="troco-rs" aria-hidden="true">R$</span>
        <input id="${id}-rec" inputmode="decimal" autocomplete="off" placeholder="${valorCampo(total)}"></div>
      <div class="notas" role="group" aria-label="O cliente deu">${sugestoesNotas(total).map((v) =>
        `<button type="button" class="chip nota" data-v="${v}">${v === total ? "Valor exato" : C.dinheiro(v).replace(",00", "")}</button>`).join("")}</div>
      <div class="troco-res" aria-live="polite"></div></div>`;
  }
  /* Liga o bloco; devolve funções para ler o estado e trocar o total (no Pix + dinheiro o total muda). */
  function ligarTroco(raiz, id, totalInicial, aoMudar) {
    const caixa = $("#" + id, raiz), inp = $(`#${id}-rec`, caixa), res = $(".troco-res", caixa);
    let total = totalInicial;
    const estado = () => {
      const t = inp.value.trim();
      if (!t) return { vazio: true, ok: true };
      const v = lerValor(t);
      if (isNaN(v)) return { ok: false, msg: "Valor inválido." };
      const dif = (centavos(v) - centavos(total)) / 100;
      return dif < 0 ? { ok: false, falta: -dif, recebido: v } : { ok: true, troco: dif, recebido: v };
    };
    const pintar = () => {
      const e = estado();
      res.className = "troco-res" + (e.vazio ? "" : e.ok ? " ok" : " falta");
      res.innerHTML = e.vazio ? `<span class="pequeno suave">Digite quanto o cliente entregou para ver o troco.</span>`
        : e.msg ? esc(e.msg)
        : e.ok ? `<span>Troco</span><b class="num">${C.dinheiro(e.troco)}</b>`
        : `<span>Faltam</span><b class="num">${C.dinheiro(e.falta)}</b>`;
      $$(".nota", caixa).forEach((n) => n.setAttribute("aria-pressed", String(!e.vazio && e.recebido !== undefined && centavos(n.dataset.v) === centavos(e.recebido))));
      if (aoMudar) aoMudar(e);
    };
    inp.oninput = pintar;
    $$(".nota", caixa).forEach((n) => (n.onclick = () => { inp.value = valorCampo(Number(n.dataset.v)); pintar(); }));
    pintar();
    return {
      estado,
      novoTotal(t) {
        total = t;
        $(".notas", caixa).innerHTML = sugestoesNotas(t).map((v) => `<button type="button" class="chip nota" data-v="${v}">${v === t ? "Valor exato" : C.dinheiro(v).replace(",00", "")}</button>`).join("");
        $$(".nota", caixa).forEach((n) => (n.onclick = () => { inp.value = valorCampo(Number(n.dataset.v)); pintar(); }));
        inp.placeholder = valorCampo(t);
        pintar();
      },
    };
  }

  /* Janela "Receber em dinheiro" para as outras telas (aprovar pedido, Recebi, inadimplência).
     O valor recebido é opcional: serve só para calcular o troco. Devolve true/false. */
  async function troco(total, titulo, texto) {
    let ctl = null;
    const p = U.modal(titulo || "Receber em dinheiro", `${texto ? `<p>${texto}</p>` : ""}
      <div class="total-receber"><span>Total</span><b class="num">${C.dinheiro(total)}</b></div>${trocoHtml("trc", total)}`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Confirmar recebimento", valor: true, antes: () => {
        const e = ctl.estado();
        if (!e.ok) { U.aviso(e.msg || `O valor recebido é menor que o total. Faltam ${C.dinheiro(e.falta)}.`, "erro"); return false; }
        return true;
      } },
    ]);
    ctl = ligarTroco(document, "trc", total);
    const r = await p;
    return r === true;
  }

  /* ---------- a tela do balcão ---------- */
  async function abrir() {
    if (A().leitura()) return U.aviso("O painel está só para consulta. Fale com o suporte para renovar.", "erro");
    const id = A().b().id;
    try {
      [cats, itens, dados] = await Promise.all([
        A().S.rest(`categorias?barbearia_id=eq.${id}&select=*&order=ordem.asc,criado_em.asc`),
        A().S.rest(`itens?barbearia_id=eq.${id}&select=*&order=ordem.asc,criado_em.asc`),
        A().S.rpc("balcao_dados"),
      ]);
    } catch (err) { return U.aviso(err.message, "erro"); }
    if (!cats.some((c) => c.id === atual)) atual = (cats.find((c) => itens.some((i) => i.categoria_id === c.id)) || cats[0] || {}).id || null;
    busca = "";
    tela = document.createElement("div");
    tela.className = "pdv";
    tela.setAttribute("role", "dialog"); tela.setAttribute("aria-modal", "true"); tela.setAttribute("aria-label", "Informar pagamentos");
    tela.innerHTML = `
      <header class="pdv-topo"><div class="pdv-barra">
        <h1>Informar pagamentos</h1>
        <button class="fechar pdv-fechar" id="pdv-fechar" aria-label="Fechar">${U.icone("fechar")}</button></div>
        <p class="pdv-sub">Para quem pagou no balcão sem usar o app. Toque nos cortes e produtos e feche a comanda.</p>
        <div class="busca-linha pdv-busca"><input id="pdv-busca" type="search" placeholder="Buscar corte, barba ou produto…" aria-label="Buscar" autocomplete="off"></div>
        <nav class="barra-cat" id="pdv-cats" aria-label="Categorias"></nav>
      </header>
      <main class="pdv-corpo" id="pdv-lista"></main>
      <div class="pdv-comanda" id="pdv-comanda"></div>`;
    document.body.appendChild(tela);
    document.body.classList.add("pdv-aberto");
    $("#pdv-fechar", tela).onclick = fechar;
    $("#pdv-busca", tela).oninput = (e) => { busca = e.target.value.trim(); desenharLista(); };
    document.addEventListener("keydown", teclaEsc);
    // o chip da categoria que está na tela fica marcado enquanto rola
    const lista = $("#pdv-lista", tela); let quadro = 0;
    lista.addEventListener("scroll", () => {
      if (busca || quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        const secs = $$(".pdv-secao", lista);
        let vis = null;
        if (lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 4) vis = secs.length ? secs[secs.length - 1].id.replace("pdv-cat-", "") : null;
        else secs.forEach((sec) => { if (sec.offsetTop - lista.offsetTop <= lista.scrollTop + lista.clientHeight * 0.35) vis = sec.id.replace("pdv-cat-", ""); });
        if (vis && vis !== atual) { atual = vis; $$("#pdv-cats .chip", tela).forEach((ch) => ch.setAttribute("aria-pressed", String(ch.dataset.cat === atual))); }
      });
    }, { passive: true });
    desenharCats(); desenharLista(); desenharComanda();
  }
  function teclaEsc(e) { if (e.key === "Escape" && tela && !$(".modal-fundo")) fechar(); }
  async function fechar() {
    if (comanda.length && !(await U.confirmar("Fechar", "A comanda tem itens que ainda não foram pagos. Fechar mesmo assim? Ela fica guardada até você voltar.", "Fechar"))) return;
    document.removeEventListener("keydown", teclaEsc);
    if (tela) tela.remove();
    tela = null;
    document.body.classList.remove("pdv-aberto");
  }

  function desenharCats() {
    const comItens = cats.filter((c) => itens.some((i) => i.categoria_id === c.id));
    $("#pdv-cats", tela).innerHTML = comItens.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${!busca && c.id === atual}">${c.icone ? `<span aria-hidden="true">${esc(c.icone)}</span>` : ""}${esc(c.nome)}</button>`).join("");
    $$("#pdv-cats .chip", tela).forEach((ch) => (ch.onclick = () => {
      atual = ch.dataset.cat;
      if (busca) { busca = ""; $("#pdv-busca", tela).value = ""; desenharLista(); }
      desenharCats();
      const sec = $(`#pdv-cat-${CSS.escape(atual)}`, tela), lista = $("#pdv-lista", tela);
      if (sec) lista.scrollTo({ top: sec.offsetTop - lista.offsetTop - 8, behavior: "smooth" });
    }));
  }

  function acao(it) {
    if (it.esgotado) return `<button class="btn sec" disabled>Esgotado</button>`;
    const x = comanda.find((c) => c.item.id === it.id);
    const rot = ehServico(it) ? "Informar serviço" : "Informar compra";
    return `<button class="btn${x ? " sec" : ""}" data-a="add">${x ? `${rot} · ${x.qtd}` : rot}</button>`;
  }

  function desenharLista() {
    const alvo = $("#pdv-lista", tela);
    let lista, titulo;
    if (busca) {
      const q = norm(busca);
      lista = itens.filter((i) => norm(i.nome).includes(q) || norm((cats.find((c) => c.id === i.categoria_id) || {}).nome).includes(q));
      titulo = `Resultados para “${esc(busca)}”`;
    }
    desenharCats();
    if (busca) {
      alvo.innerHTML = `<h2 class="titulo-lista">${titulo}</h2>` + (lista.length
        ? `<div class="grade-itens">${lista.map((it) => C.cartao(it, tipoDe(it), { acoes: acao(it) })).join("")}</div>`
        : `<div class="vazio-cardapio">Nada encontrado.</div>`);
    } else {
      // todas as categorias, uma embaixo da outra; os chips levam até cada uma
      const comItens = cats.filter((c) => itens.some((i) => i.categoria_id === c.id));
      alvo.innerHTML = comItens.length ? comItens.map((c) => `<section class="pdv-secao" id="pdv-cat-${esc(c.id)}">
          <h2 class="titulo-lista">${c.icone ? esc(c.icone) + " " : ""}${esc(c.nome)}</h2>
          <div class="grade-itens">${itens.filter((i) => i.categoria_id === c.id).map((it) => C.cartao(it, tipoDe(it), { acoes: acao(it) })).join("")}</div></section>`).join("")
        : `<div class="vazio-cardapio">Cadastre os cortes e produtos em <b>Serviços &amp; Produtos</b> para informar pagamentos aqui.</div>`;
    }
    $$("[data-a=add]", alvo).forEach((bt) => (bt.onclick = () => {
      const it = itens.find((x) => x.id === bt.closest(".item-card").dataset.id);
      adicionar(it);
    }));
  }

  function adicionar(it) {
    const x = comanda.find((c) => c.item.id === it.id);
    if (x) x.qtd = Math.min(20, x.qtd + 1); else comanda.push({ item: it, qtd: 1 });
    const rol = $("#pdv-lista", tela).scrollTop;
    desenharLista(); desenharComanda();
    $("#pdv-lista", tela).scrollTop = rol;
    const card = $(`#pdv-lista .item-card[data-id="${CSS.escape(String(it.id))}"]`, tela);
    if (card) card.classList.add("balanca");
  }

  function desenharComanda() {
    const el = $("#pdv-comanda", tela);
    const n = qtdComanda();
    el.classList.toggle("vazia", !n);
    el.innerHTML = n
      ? `<button class="pdv-resumo" id="pdv-ver" aria-label="Ver a comanda"><span class="pdv-qtd num">${n}</span>
           <span class="pdv-txt"><small>Comanda · ${n} ${n === 1 ? "item" : "itens"}</small><b class="num">${C.dinheiro(totalComanda())}</b></span></button>
         <button class="btn pdv-fechar-conta" id="pdv-receber">Fechar e receber</button>`
      : `<p class="pequeno pdv-dica">Toque em <b>Informar serviço</b> ou <b>Informar compra</b> para montar a comanda.</p>`;
    if (n) { $("#pdv-ver", el).onclick = receber; $("#pdv-receber", el).onclick = receber; }
  }

  /* ---------- fechar a comanda ---------- */
  function receber() {
    if (!comanda.length) return;
    const temServico = comanda.some((x) => ehServico(x.item));
    const barbeiros = dados.barbeiros || [];
    const formas = [["pix", "Pix"], ["dinheiro", "Dinheiro"], ["misto", "Pix + Dinheiro"]].concat(dados.aceita_prazo ? [["prazo", "À prazo"]] : []);
    const st = { forma: "dinheiro", barbeiro: dados.papel === "associado" ? dados.equipe_id : (barbeiros[0] ? barbeiros[0].id : null) };
    const hoje = dados.hoje;
    const maxData = new Date(new Date(hoje + "T12:00:00Z").getTime() + dados.prazo_dias * 86400000).toISOString().slice(0, 10);
    let troco = null, trocoMisto = null;

    const corpo = `
      <div class="cmd-itens" id="cmd-itens"></div>
      <div class="total-receber"><span>Total</span><b class="num" id="cmd-total"></b></div>
      ${temServico && dados.papel !== "associado" && barbeiros.length > 1 ? `<fieldset class="grupo"><legend>Quem fez o corte?</legend>
        <div class="chips-linha" id="cmd-barbeiro">${barbeiros.map((br) => `<button type="button" class="chip" data-id="${br.id || ""}" aria-pressed="${(br.id || null) === st.barbeiro}">${esc(br.nome)}</button>`).join("")}</div></fieldset>` : ""}
      <fieldset class="grupo"><legend>Forma de pagamento</legend>
        <div class="formas-seg" id="cmd-formas" role="radiogroup">${formas.map(([id, t]) => `<button type="button" class="forma-seg" role="radio" data-f="${id}" aria-checked="${id === st.forma}">${formaIcone(id)}<span>${t}</span></button>`).join("")}</div></fieldset>
      <div id="cmd-forma"></div>`;
    const espera = U.modal("Fechar comanda", corpo, [
      { rotulo: "Voltar", classe: "sec", valor: false },
      { rotulo: "Confirmar", valor: true, antes: confirmar },
    ]);
    const m = [...document.querySelectorAll(".modal-fundo")].pop();
    m.classList.add("modal-comanda");
    const botaoOk = $(".modal-rodape .btn:not(.sec)", m);

    function pintarItens() {
      $("#cmd-itens", m).innerHTML = comanda.map((x, i) => `<div class="linha-item cmd-linha" data-i="${i}">
        <img src="${esc(C.foto(x.item, tipoDe(x.item)))}" alt="">
        <div><b>${esc(x.item.nome)}</b><div class="pequeno suave">${C.dinheiro(C.final(x.item))}${x.qtd > 1 ? " cada" : ""}</div></div>
        <div class="qtd"><button type="button" class="btn mini sec" data-q="-1" aria-label="Menos">−</button><b class="num">${x.qtd}</b><button type="button" class="btn mini sec" data-q="1" aria-label="Mais">+</button></div></div>`).join("");
      $$("[data-q]", m).forEach((bt) => (bt.onclick = () => {
        const i = Number(bt.closest("[data-i]").dataset.i), x = comanda[i];
        x.qtd += Number(bt.dataset.q);
        if (x.qtd <= 0) comanda.splice(i, 1);
        if (x.qtd > 20) x.qtd = 20;
        desenharLista(); desenharComanda();
        if (!comanda.length) { $(".modal-rodape .btn.sec", m).click(); return; }
        pintarItens(); pintarTotal();
      }));
    }
    function pintarTotal() {
      const t = totalComanda();
      $("#cmd-total", m).textContent = C.dinheiro(t);
      botaoOk.textContent = `Confirmar · ${C.dinheiro(t)}`;
      if (st.forma === "dinheiro" && troco) troco.novoTotal(t);
      if (st.forma === "misto") recalcularMisto("pix");
    }
    function pintarForma() {
      const t = totalComanda(), alvo = $("#cmd-forma", m);
      troco = trocoMisto = null;
      if (st.forma === "pix") {
        alvo.innerHTML = `<p class="aviso-pix pequeno">Confira o Pix de <b id="cmd-pixv">${C.dinheiro(t)}</b> no seu banco antes de confirmar.</p>${campoNome()}`;
      } else if (st.forma === "dinheiro") {
        alvo.innerHTML = trocoHtml("cmd-troco", t) + campoNome();
        troco = ligarTroco(m, "cmd-troco", t);
      } else if (st.forma === "misto") {
        alvo.innerHTML = `
          <div class="divisao" aria-hidden="true"><i class="d-pix"></i><i class="d-din"></i></div>
          <div class="misto">
            <div><label for="cmd-pix">No Pix</label><div class="troco-linha"><span class="troco-rs" aria-hidden="true">R$</span><input id="cmd-pix" inputmode="decimal" autocomplete="off"></div></div>
            <div><label for="cmd-din">Em dinheiro</label><div class="troco-linha"><span class="troco-rs" aria-hidden="true">R$</span><input id="cmd-din" inputmode="decimal" autocomplete="off"></div></div>
          </div>
          <p class="pequeno suave">Digite um dos valores: o outro completa o total sozinho.</p>
          <div class="notas" role="group" aria-label="Dividir"><button type="button" class="chip" id="cmd-metade">Metade / metade</button></div>
          <div id="cmd-misto-erro" class="troco-res falta oculto" aria-live="polite"></div>
          <div id="cmd-misto-troco"></div>${campoNome()}`;
        const pix = $("#cmd-pix", m), din = $("#cmd-din", m);
        pix.oninput = () => recalcularMisto("pix");
        din.oninput = () => recalcularMisto("din");
        [pix, din].forEach((c) => (c.onblur = () => { const v = lerValor(c.value); if (c.value.trim() && !isNaN(v)) c.value = valorCampo(v); }));
        $("#cmd-metade", m).onclick = () => { pix.value = valorCampo(Math.floor(t * 50) / 100); recalcularMisto("pix"); };
        recalcularMisto("pix");
      } else {
        alvo.innerHTML = `<div class="campo"><label for="cmd-nome">Nome do cliente</label><input id="cmd-nome" maxlength="60" autocomplete="off"></div>
          <div class="campo"><label for="cmd-zap">WhatsApp com DDD</label><input id="cmd-zap" type="tel" inputmode="tel" placeholder="(91) 98888-7777" autocomplete="off"></div>
          <div class="campo"><label for="cmd-data">Paga até</label><input id="cmd-data" type="date" min="${hoje}" max="${maxData}" value="${maxData}"></div>
          <p class="pequeno suave">Fica em <b>Caixa → Inadimplência</b> até ser pago, com o botão de cobrança no WhatsApp.</p>`;
      }
    }
    function campoNome() {
      return `<div class="campo cmd-nome-op"><label for="cmd-nome">Nome do cliente (opcional)</label><input id="cmd-nome" maxlength="60" placeholder="Cliente no balcão" autocomplete="off"></div>`;
    }
    function recalcularMisto(origem) {
      const t = totalComanda(), pix = $("#cmd-pix", m), din = $("#cmd-din", m);
      if (!pix) return;
      if (origem === "pix" || origem === "din") {
        const de = origem === "pix" ? pix : din, para = origem === "pix" ? din : pix;
        const v = de.value.trim() ? lerValor(de.value) : NaN;
        if (!isNaN(v)) para.value = v < t ? valorCampo((centavos(t) - centavos(v)) / 100) : "";
      }
      const p = lerValor(pix.value), d = lerValor(din.value);
      const erro = $("#cmd-misto-erro", m);
      const valido = !isNaN(p) && !isNaN(d) && p > 0 && d > 0 && centavos(p) + centavos(d) === centavos(t);
      erro.classList.toggle("oculto", valido || (!pix.value.trim() && !din.value.trim()));
      erro.textContent = valido ? "" : "As duas partes precisam ser maiores que zero e somar o total.";
      const fp = valido ? p / t : 0.5;
      $(".d-pix", m).style.flexGrow = String(fp); $(".d-din", m).style.flexGrow = String(1 - fp);
      const alvoTroco = $("#cmd-misto-troco", m);
      if (valido) {
        if (!trocoMisto) { alvoTroco.innerHTML = trocoHtml("cmd-troco2", d, "Recebido em dinheiro (para o troco)"); trocoMisto = ligarTroco(m, "cmd-troco2", d); }
        else trocoMisto.novoTotal(d);
      } else { alvoTroco.innerHTML = ""; trocoMisto = null; }
      return valido ? { pix: p, din: d } : null;
    }
    async function confirmar() {
      const nome = ($("#cmd-nome", m) || {}).value || "";
      const corpoRpc = { p_itens: comanda.map((x) => ({ id: x.item.id, qtd: x.qtd })), p_barbeiro: st.barbeiro || null, p_forma: st.forma,
        p_pix: null, p_nome: nome.trim(), p_whatsapp: null, p_prazo_data: null };
      let trocoFinal = null;
      if (st.forma === "dinheiro") {
        const e = troco.estado();
        if (!e.ok) { U.aviso(e.msg || `O valor recebido é menor que o total. Faltam ${C.dinheiro(e.falta)}.`, "erro"); return false; }
        if (e.troco) trocoFinal = e.troco;
      }
      if (st.forma === "misto") {
        const r = recalcularMisto("conferir");
        if (!r) { U.aviso("Informe quanto foi no Pix e quanto em dinheiro. As duas partes somam o total.", "erro"); return false; }
        if (trocoMisto) { const e = trocoMisto.estado(); if (!e.ok) { U.aviso(e.msg || `O dinheiro recebido é menor que a parte em dinheiro. Faltam ${C.dinheiro(e.falta)}.`, "erro"); return false; } if (e.troco) trocoFinal = e.troco; }
        corpoRpc.p_pix = r.pix;
      }
      if (st.forma === "prazo") {
        corpoRpc.p_whatsapp = $("#cmd-zap", m).value;
        corpoRpc.p_prazo_data = $("#cmd-data", m).value || null;
      }
      const r = await A().S.rpc("balcao_registrar", corpoRpc);
      comanda = [];
      if (tela) { desenharLista(); desenharComanda(); }
      U.aviso(`Pagamento informado: ${C.dinheiro(r.total)}${trocoFinal ? ` · troco ${C.dinheiro(trocoFinal)}` : ""}.`);
      if (window.APP && window.APP.aoInformar) window.APP.aoInformar();
      return true;
    }

    pintarItens(); pintarForma(); pintarTotal();
    $$("#cmd-formas .forma-seg", m).forEach((bt) => (bt.onclick = () => {
      st.forma = bt.dataset.f;
      $$("#cmd-formas .forma-seg", m).forEach((o) => o.setAttribute("aria-checked", String(o === bt)));
      pintarForma(); pintarTotal();
    }));
    $$("#cmd-barbeiro .chip", m).forEach((bt) => (bt.onclick = () => {
      st.barbeiro = bt.dataset.id || null;
      $$("#cmd-barbeiro .chip", m).forEach((o) => o.setAttribute("aria-pressed", String(o === bt)));
    }));
    return espera;
  }

  function formaIcone(f) {
    return U.icone({ pix: "pix", dinheiro: "dinheiro", misto: "dividir", prazo: "calendario" }[f]);
  }

  window.BALCAO = { abrir, troco };
})();
