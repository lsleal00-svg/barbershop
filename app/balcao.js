/* balcao.js — "Informar pagamentos": a equipe registra no balcão os cortes e
   produtos de quem não usou o app. Monta uma comanda, escolhe o barbeiro e a
   forma (dinheiro com troco, Pix, cartão, várias formas juntas ou à prazo) e o pedido vai
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

  /* ---------- pagamento em uma ou várias formas (como nas maquininhas/PDV) ----------
     Toque numa forma: ela entra com o valor que falta. Para dividir, diminua o valor
     e toque em outra forma. Dinheiro mostra o troco; cartão mostra a taxa. */
  const NOMES_FORMA = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };
  const ICONE_FORMA = { dinheiro: "dinheiro", pix: "pix", debito: "cartao", credito: "cartao", prazo: "calendario" };
  const formaIcone = (f) => U.icone(ICONE_FORMA[f] || "dinheiro");

  /* config: { aceita_debito, aceita_credito, taxa_debito, taxa_credito } */
  function formasDisponiveis(cfg) {
    return ["dinheiro", "pix"].concat(cfg.aceita_debito ? ["debito"] : [], cfg.aceita_credito ? ["credito"] : []);
  }
  function pagadorHtml(id, cfg, extras) {
    const fs = formasDisponiveis(cfg);
    return `<div class="pagador" id="${id}">
      <div class="formas-seg formas-n${fs.length}" role="group" aria-label="Formas de pagamento">${fs.map((f) =>
        `<button type="button" class="forma-seg" data-f="${f}" aria-pressed="false">${formaIcone(f)}<span>${NOMES_FORMA[f]}</span></button>`).join("")}</div>${extras || ""}
      <div class="pg-linhas" aria-live="polite"></div>
      <div class="pg-situacao"></div>
      <p class="pequeno suave pg-dica">Toque na forma de pagamento. Para dividir em duas ou mais formas, diminua o valor e toque na próxima.</p>
      <div class="pg-troco"></div></div>`;
  }
  function ligarPagador(raiz, id, totalInicial, cfg, inicial) {
    const el = $("#" + id, raiz);
    let total = totalInicial, linhas = [], troco = null;
    const taxaDe = (f) => (f === "debito" ? Number(cfg.taxa_debito || 0) : f === "credito" ? Number(cfg.taxa_credito || 0) : 0);
    const soma = () => linhas.reduce((s, l) => s + centavos(isNaN(l.v) ? 0 : l.v), 0) / 100;
    const falta = () => (centavos(total) - centavos(soma())) / 100;
    function pintarLinhas(foco) {
      $(".pg-linhas", el).innerHTML = linhas.map((l, i) => {
        const tx = taxaDe(l.f), desc = tx && !isNaN(l.v) ? Math.round(l.v * tx) / 100 : 0;
        return `<div class="pg-linha" data-i="${i}">
          <span class="pg-forma">${formaIcone(l.f)}<b>${NOMES_FORMA[l.f]}</b></span>
          <div class="troco-linha"><span class="troco-rs" aria-hidden="true">R$</span><input class="pg-valor" inputmode="decimal" autocomplete="off" aria-label="Valor no ${NOMES_FORMA[l.f]}" value="${isNaN(l.v) ? "" : valorCampo(l.v)}"></div>
          <button type="button" class="pg-remover" aria-label="Remover ${NOMES_FORMA[l.f]}">${U.icone("fechar")}</button>
          ${tx ? `<span class="pg-taxa pequeno">Taxa da maquininha ${String(tx).replace(".", ",")}%${desc ? ` · −${C.dinheiro(desc)}` : ""}</span>` : ""}</div>`;
      }).join("");
      $$(".pg-linha", el).forEach((row) => {
        const i = Number(row.dataset.i), inp = $(".pg-valor", row);
        inp.oninput = () => { linhas[i].v = inp.value.trim() ? lerValor(inp.value) : NaN; pintarSituacao(); pintarTaxa(row, i); };
        inp.onblur = () => { if (!isNaN(linhas[i].v)) inp.value = valorCampo(linhas[i].v); };
        inp.onfocus = () => inp.select();
        $(".pg-remover", row).onclick = () => { linhas.splice(i, 1); pintarTudo(); };
      });
      if (foco != null) { const f = $(`.pg-linha[data-i="${foco}"] .pg-valor`, el); if (f) f.focus(); }
    }
    function pintarTaxa(row, i) {
      const t = $(".pg-taxa", row); if (!t) return;
      const tx = taxaDe(linhas[i].f), v = linhas[i].v, desc = !isNaN(v) ? Math.round(v * tx) / 100 : 0;
      t.textContent = `Taxa da maquininha ${String(tx).replace(".", ",")}%${desc ? ` · −${C.dinheiro(desc)}` : ""}`;
    }
    function pintarSituacao() {
      const rec = soma(), f = falta();
      const s = $(".pg-situacao", el);
      s.className = "pg-situacao" + (!linhas.length ? " vazio" : f === 0 ? " ok" : f < 0 ? " erro" : " falta");
      s.innerHTML = !linhas.length ? "" : `<div><span>Total recebido</span><b class="num">${C.dinheiro(rec)}</b></div>
        <div><span>${f < 0 ? "Passou do total" : "Falta receber"}</span><b class="num">${C.dinheiro(Math.abs(f))}</b></div>`;
      $$(".forma-seg[data-f]", el).forEach((b) => b.setAttribute("aria-pressed", String(linhas.some((l) => l.f === b.dataset.f))));
      $(".pg-dica", el).classList.toggle("oculto", linhas.length > 1);
      // troco: só quando há dinheiro
      const din = linhas.filter((l) => l.f === "dinheiro").reduce((s, l) => s + centavos(isNaN(l.v) ? 0 : l.v), 0) / 100;
      const alvo = $(".pg-troco", el);
      if (din > 0) {
        const rot = "Recebido em dinheiro (para o troco)";
        if (!troco) { alvo.innerHTML = trocoHtml(id + "-troco", din, rot); troco = ligarTroco(el, id + "-troco", din); }
        else { $("label", alvo).textContent = rot; troco.novoTotal(din); }
      } else { alvo.innerHTML = ""; troco = null; }
    }
    function pintarTudo(foco) { pintarLinhas(foco); pintarSituacao(); }
    function tocar(f) {
      const fl = falta();
      if (!linhas.length) linhas.push({ f, v: total });
      else if (fl > 0) linhas.push({ f, v: fl });
      else if (linhas.length === 1 && linhas[0].f !== f) linhas[0].f = f;      // trocou de ideia
      else if (linhas.some((l) => l.f === f)) return pintarTudo(linhas.findIndex((l) => l.f === f));
      else return U.aviso("O total já foi recebido. Para dividir, diminua o valor de uma forma e toque em outra.", "erro");
      pintarTudo(linhas.length > 1 ? linhas.length - 1 : null);
    }
    $$(".forma-seg[data-f]", el).forEach((b) => (b.onclick = () => tocar(b.dataset.f)));
    if (inicial && formasDisponiveis(cfg).includes(inicial)) linhas.push({ f: inicial, v: total });
    pintarTudo();
    return {
      estado() {
        if (!linhas.length) return { ok: false, msg: "Toque na forma de pagamento." };
        if (linhas.some((l) => isNaN(l.v) || l.v <= 0)) return { ok: false, msg: "Cada forma precisa de um valor maior que zero (ou remova a que não usou)." };
        const f = falta();
        if (f > 0) return { ok: false, msg: `Falta receber ${C.dinheiro(f)}. Toque em outra forma ou ajuste os valores.` };
        if (f < 0) return { ok: false, msg: `Os valores passaram ${C.dinheiro(-f)} do total. Ajuste os valores.` };
        let trocoV = 0;
        if (troco) { const e = troco.estado(); if (!e.ok) return { ok: false, msg: e.msg || `O dinheiro recebido é menor que a parte em dinheiro. Faltam ${C.dinheiro(e.falta)}.` }; trocoV = e.troco || 0; }
        const junta = {};
        linhas.forEach((l) => { junta[l.f] = (junta[l.f] || 0) + centavos(l.v); });
        return { ok: true, pagamentos: Object.entries(junta).map(([f, c]) => ({ f, v: c / 100 })), troco: trocoV };
      },
      novoTotal(t) {
        total = t;
        if (linhas.length === 1) linhas[0].v = t;
        pintarTudo();
      },
      vazio: () => !linhas.length,
    };
  }

  /* Receber um pedido que ainda não foi pago (fila, agendado pelo painel, à prazo).
     Devolve a lista de pagamentos ou null se cancelar. */
  async function receberPedido(total, titulo, texto, cfg, inicial) {
    let ctl = null, resp = null;
    const p = U.modal(titulo || "Receber pagamento", `${texto ? `<p>${texto}</p>` : ""}
      <div class="total-receber"><span>Total</span><b class="num">${C.dinheiro(total)}</b></div>${pagadorHtml("rcb", cfg)}`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Confirmar recebimento", valor: true, antes: () => {
        const e = ctl.estado();
        if (!e.ok) { U.aviso(e.msg, "erro"); return false; }
        resp = e; return true;
      } },
    ]);
    [...document.querySelectorAll(".modal-fundo")].pop().classList.add("modal-comanda");
    ctl = ligarPagador(document, "rcb", total, cfg, inicial);
    const ok = await p;
    return ok === true && resp ? resp : null;
  }

  /* ---------- fechar a comanda ---------- */
  function receber() {
    if (!comanda.length) return;
    const temServico = comanda.some((x) => ehServico(x.item));
    const barbeiros = dados.barbeiros || [];
    const st = { prazo: false, barbeiro: dados.papel === "associado" ? dados.equipe_id : (barbeiros[0] ? barbeiros[0].id : null) };
    const hoje = dados.hoje;
    const maxData = new Date(new Date(hoje + "T12:00:00Z").getTime() + dados.prazo_dias * 86400000).toISOString().slice(0, 10);
    let pg = null;

    const corpo = `
      <div class="cmd-itens" id="cmd-itens"></div>
      <div class="total-receber"><span>Total</span><b class="num" id="cmd-total"></b></div>
      ${temServico && dados.papel !== "associado" && barbeiros.length > 1 ? `<fieldset class="grupo"><legend>Quem fez o corte?</legend>
        <div class="chips-linha" id="cmd-barbeiro">${barbeiros.map((br) => `<button type="button" class="chip" data-id="${br.id || ""}" aria-pressed="${(br.id || null) === st.barbeiro}">${esc(br.nome)}</button>`).join("")}</div></fieldset>` : ""}
      <fieldset class="grupo"><legend>Forma de pagamento</legend>
        ${pagadorHtml("cmd-pg", dados, dados.aceita_prazo ? `<button type="button" class="btn sec prazo-alternar" id="cmd-prazo" aria-pressed="false">${formaIcone("prazo")}<span>Vai pagar depois (à prazo)</span></button>` : "")}
        <div id="cmd-prazo-campos" class="oculto">
          <div class="campo"><label for="cmd-nome-p">Nome do cliente</label><input id="cmd-nome-p" maxlength="60" autocomplete="off"></div>
          <div class="campo"><label for="cmd-zap">WhatsApp com DDD</label><input id="cmd-zap" type="tel" inputmode="tel" placeholder="(91) 98888-7777" autocomplete="off"></div>
          <div class="campo"><label for="cmd-data">Paga até</label><input id="cmd-data" type="date" min="${hoje}" max="${maxData}" value="${maxData}"></div>
          <p class="pequeno suave">Fica em <b>Caixa → Inadimplência</b> até ser pago, com o botão de cobrança no WhatsApp. <button type="button" class="link" id="cmd-prazo-sair">Voltar às outras formas</button></p>
        </div></fieldset>
      <div class="campo cmd-nome-op" id="cmd-nome-campo"><label for="cmd-nome">Nome do cliente (opcional)</label><input id="cmd-nome" maxlength="60" placeholder="Cliente no balcão" autocomplete="off"></div>`;
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
      if (pg) pg.novoTotal(t);
    }
    function modoPrazo(sim) {
      st.prazo = sim;
      $("#cmd-prazo-campos", m).classList.toggle("oculto", !sim);
      $("#cmd-nome-campo", m).classList.toggle("oculto", sim);
      $$("#cmd-pg .pg-linhas, #cmd-pg .pg-situacao, #cmd-pg .pg-dica, #cmd-pg .pg-troco", m).forEach((x) => x.classList.toggle("oculto", sim));
      $$("#cmd-pg .forma-seg[data-f]", m).forEach((b) => (b.disabled = sim));
      $("#cmd-prazo", m).setAttribute("aria-pressed", String(sim));
      if (sim) $("#cmd-nome-p", m).focus();
    }
    async function confirmar() {
      const corpoRpc = { p_itens: comanda.map((x) => ({ id: x.item.id, qtd: x.qtd })), p_barbeiro: st.barbeiro || null,
        p_pagamentos: null, p_nome: "", p_whatsapp: null, p_prazo_data: null };
      let trocoFinal = 0;
      if (st.prazo) {
        corpoRpc.p_nome = $("#cmd-nome-p", m).value.trim();
        corpoRpc.p_whatsapp = $("#cmd-zap", m).value;
        corpoRpc.p_prazo_data = $("#cmd-data", m).value || null;
        if (!corpoRpc.p_prazo_data) { U.aviso("Escolha a data em que o cliente vai pagar.", "erro"); return false; }
      } else {
        const e = pg.estado();
        if (!e.ok) { U.aviso(e.msg, "erro"); return false; }
        corpoRpc.p_pagamentos = e.pagamentos; trocoFinal = e.troco;
        corpoRpc.p_nome = $("#cmd-nome", m).value.trim();
      }
      const r = await A().S.rpc("balcao_registrar", corpoRpc);
      comanda = [];
      if (tela) { desenharLista(); desenharComanda(); }
      U.aviso(`Pagamento informado: ${C.dinheiro(r.total)}${trocoFinal ? ` · troco ${C.dinheiro(trocoFinal)}` : ""}.`);
      if (window.APP && window.APP.aoInformar) window.APP.aoInformar();
      return true;
    }

    pintarItens();
    pg = ligarPagador(m, "cmd-pg", totalComanda(), dados);
    pintarTotal();
    if ($("#cmd-prazo", m)) {
      $("#cmd-prazo", m).onclick = () => modoPrazo(!st.prazo);
      $("#cmd-prazo-sair", m).onclick = () => modoPrazo(false);
    }
    $$("#cmd-barbeiro .chip", m).forEach((bt) => (bt.onclick = () => {
      st.barbeiro = bt.dataset.id || null;
      $$("#cmd-barbeiro .chip", m).forEach((o) => o.setAttribute("aria-pressed", String(o === bt)));
    }));
    return espera;
  }

  /* Configuração de cartões/taxas para as outras telas (vem de barbearias). */
  const cfgDaBarbearia = (b) => ({ aceita_debito: !!b.aceita_debito, aceita_credito: !!b.aceita_credito, taxa_debito: b.taxa_debito, taxa_credito: b.taxa_credito });

  window.BALCAO = { abrir, troco, receberPedido, cfgDaBarbearia, NOMES_FORMA };
})();
