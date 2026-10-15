/* fila.js — aba "Fila" (dono, barbeiro associado e caixa):
   pedidos para aprovar, fila de cada barbeiro, agendamentos e avisos no celular. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO;
  const A = () => window.APP;
  const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", prazo: "À prazo", debito: "Débito", credito: "Crédito", misto: "Várias formas", aberto: "Paga na hora" };
  let dados = null, timer = null, conhecidos = null, corpoAtual = null;

  const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dataBr = (d) => new Date(d + "T12:00").toLocaleDateString("pt-BR");
  const somLigado = () => { try { return localStorage.getItem("bs_som") !== "0"; } catch (e) { return true; } };
  const nomeBarbeiro = (id) => ((dados.filas || []).find((f) => (f.id || null) === (id || null)) || {}).nome || (id ? "Barbeiro" : A().b().nome);
  const zapLink = (n) => n ? `<a class="link-zap" href="https://wa.me/55${esc(String(n).replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""))}" target="_blank" rel="noopener">WhatsApp</a>` : "";
  const itensTxt = (p) => (p.itens || []).map((i) => `${i.qtd > 1 ? i.qtd + " × " : ""}${esc(i.nome)}`).join(", ");

  const bip = () => { if (somLigado()) U.bip(); };

  async function carregar() {
    dados = await A().S.rpc("painel_fila");
    const ids = new Set(dados.pendentes.map((p) => p.id));
    if (conhecidos) {
      const novos = dados.pendentes.filter((p) => !conhecidos.has(p.id));
      if (novos.length) { bip(); U.aviso(novos.length === 1 ? `Novo pedido de ${novos[0].cliente_nome}!` : `${novos.length} pedidos novos!`); }
    }
    conhecidos = ids;
    if (A().marcarPendentes) A().marcarPendentes(ids.size);
  }

  async function tela(corpo) {
    corpoAtual = corpo;
    corpo.innerHTML = `<p class="suave">${A().modulos().fila ? "Carregando a fila…" : "Carregando os pedidos…"}</p>`;
    try { await carregar(); } catch (err) { corpo.innerHTML = `<p class="suave">${esc(err.message)}</p>`; return; }
    desenhar();
    clearInterval(timer);
    timer = setInterval(async () => {
      if (!document.body.contains(corpo) || !$(".fila-painel", corpo)) { clearInterval(timer); return; }
      if (document.visibilityState !== "visible" || $(".modal-fundo")) return;
      try { await carregar(); desenhar(); } catch (e) { /* tenta de novo */ }
    }, 8000);
  }

  function desenhar() {
    const corpo = corpoAtual;
    if (!corpo || !document.body.contains(corpo)) return;
    const ro = A().leitura();
    const dis = ro ? " disabled" : "";
    const pend = dados.pendentes, ver = dados.papel !== "associado";
    const nAg = dados.agendamentos.length;
    const mod = A().modulos();   // sem fila (ex.: loja): a aba vira só "Pedidos para aprovar"
    corpo.innerHTML = `<div class="fila-painel">
      ${!mod.agendamento ? "" : `<div class="fila-ferramentas">
        <button class="btn" id="agendar-corte"${dis}>${U.icone("calendario")}Agendar um corte</button>
        <button class="btn sec" id="ver-agendados">${U.icone("lista")}Ver cortes agendados${nAg ? ` <span class="contador-pend contador-neutro">${nAg}</span>` : ""}</button>
      </div>`}
      ${blocoAvisos()}
      <section class="cartao"><h2>Pedidos para aprovar ${pend.length ? `<span class="contador-pend">${pend.length}</span>` : ""}</h2>
        ${pend.length ? pend.map((p) => cartaoPendente(p, ver, dis)).join("") : `<p class="suave pequeno">Nenhum pedido esperando. Quando chegar, toca um aviso.</p>`}
      </section>
      ${!mod.fila ? "" : (dados.filas || []).map((f) => `<section class="cartao fila-de"><h2>Fila de ${esc(f.nome)}</h2>
        ${f.fila.length ? f.fila.map((p, i) => cartaoFila(p, i, f.fila, dis)).join("") : `<p class="suave pequeno">Ninguém na fila.</p>`}</section>`).join("")}
      ${!mod.agendamento ? "" : `<section class="cartao" id="proximos-agendamentos"><h2>Próximos agendamentos</h2>
        ${dados.agendamentos.length ? dados.agendamentos.map((p) => `<div class="pedido-linha" data-id="${p.id}">
          <div><b>${esc(quando(p.agendado_para))}</b> · ${esc(p.cliente_nome)} ${zapLink(p.cliente_whatsapp)}
            <div class="pequeno suave">${itensTxt(p)} · ${C.dinheiro(p.total)} · ${FORMAS[p.forma]}${ver ? " · com " + esc(nomeBarbeiro(p.barbeiro_id)) : ""}</div></div>
          <button class="btn mini sec" data-a="remover"${dis}>Cancelar</button></div>`).join("") : `<p class="suave pequeno">Nenhum agendamento.</p>`}
      </section>`}</div>`;
    $$("[data-a]", corpo).forEach((bt) => (bt.onclick = () => agir(bt.dataset.a, bt.closest("[data-id]").dataset.id, bt)));
    if ($("#agendar-corte", corpo)) $("#agendar-corte", corpo).onclick = () => agendarCorte();
    if ($("#ver-agendados", corpo)) $("#ver-agendados", corpo).onclick = () => verAgendados();
    ligarAvisos();
  }

  function cartaoPendente(p, ver, dis) {
    const rotulo = p.tipo === "produto" ? "Confirmar pagamento e venda"
      : p.agendado_para ? "Aprovar agendamento"
      : p.forma === "prazo" ? "Aprovar à prazo" : "Pagamento recebido · aprovar";
    return `<div class="pendente" data-id="${p.id}">
      <div class="pend-topo"><b>${esc(p.cliente_nome)}</b> ${zapLink(p.cliente_whatsapp)}<span class="selo ${p.tipo === "produto" ? "" : "ok"}">${p.tipo === "produto" ? "Produtos" : p.agendado_para ? "Agendamento" : "Corte agora"}</span></div>
      <div>${itensTxt(p)} — <b>${C.dinheiro(p.total)}</b></div>
      <div class="pequeno suave">${FORMAS[p.forma]}${p.forma === "prazo" && p.prazo_data ? " · paga até " + dataBr(p.prazo_data) : ""}
        ${p.agendado_para ? " · para " + esc(quando(p.agendado_para)) : ""}${ver && p.tipo === "servico" ? " · com " + esc(nomeBarbeiro(p.barbeiro_id)) : ""} · chegou ${esc(new Date(p.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</div>
      ${p.forma === "pix" && !p.agendado_para ? `<div class="pequeno aviso-pix">Confira o Pix de ${C.dinheiro(p.total)} no seu banco antes de aprovar.</div>` : ""}
      <div class="pend-acoes"><button class="btn" data-a="aprovar"${dis}>${rotulo}</button>
        <button class="btn sec" data-a="recusar"${dis}>Recusar</button><button class="btn sec" data-a="bloquear"${dis}>Bloquear</button></div></div>`;
  }

  function cartaoFila(p, i, fila, dis) {
    const at = p.fila_status === "atendimento";
    const pos = fila.filter((x) => x.fila_status === "aguardando").indexOf(p) + 1;
    const ultimo = i === fila.length - 1, primeiroAg = !at && fila[i - 1] && fila[i - 1].fila_status === "atendimento";
    return `<div class="fila-item${at ? " atendendo" : ""}${p.agendado_para ? " agendado" : ""}" data-id="${p.id}">
      <div class="fi-pos">${at ? U.icone("tesoura") : pos + "º"}</div>
      <div class="fi-info"><b>${esc(p.cliente_nome)}</b> ${zapLink(p.cliente_whatsapp)}
        <div class="pequeno">${itensTxt(p)} · ${C.dinheiro(p.total)}</div>
        <div class="pequeno"><span class="selo ${p.pago ? "ok" : p.forma === "prazo" ? "alerta" : "erro"}">${p.pago ? "Pago · " + FORMAS[p.forma] : p.forma === "prazo" ? "À prazo" : "A receber · " + FORMAS[p.forma]}</span>
          ${at ? `<span class="selo ok">Em atendimento</span>` : `<span class="selo">Aguardando</span>`}${p.agendado_para ? ` <span class="selo roxo">Agendado ${esc(new Date(p.agendado_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</span>` : ""}</div></div>
      <div class="fi-acoes">
        ${at ? `<button class="btn" data-a="finalizar"${dis}>Corte finalizado</button>` : `
          <button class="btn mini sec seta-fila" data-a="subir" aria-label="Passar para frente"${dis}${primeiroAg ? " disabled" : ""}>▲</button>
          <button class="btn mini sec seta-fila" data-a="descer" aria-label="Passar para trás"${dis}${ultimo ? " disabled" : ""}>▼</button>`}
        ${!p.pago && p.forma !== "prazo" ? `<button class="btn mini sec" data-a="pago"${dis}>Recebi</button>` : ""}
        <button class="btn mini sec" data-a="remover"${dis}>Remover</button>
      </div></div>`;
  }

  async function agir(acao, id, bt) {
    const S = A().S;
    try {
      if (acao === "bloquear" && !(await U.confirmar("Bloquear", "Recusar e bloquear este aparelho por 30 minutos? Ele não consegue fazer novos pedidos nesse tempo.", "Bloquear", true))) return;
      if (acao === "remover" && !(await U.confirmar("Remover", "Remover este cliente da fila / cancelar o agendamento?", "Remover", true))) return;
      const pedido = dados.pendentes.concat(dados.filas.flatMap((f) => f.fila), dados.agendamentos).find((x) => x.id === id);
      let pagamentos = null;
      if (pedido && !pedido.pago && pedido.forma !== "prazo" && (acao === "pago" || acao === "finalizar")) {
        // na hora de receber, o barbeiro informa como foi pago (pode dividir em várias formas, com troco)
        const r = await window.BALCAO.receberPedido(Number(pedido.total), acao === "finalizar" ? "Receber e finalizar" : "Receber pagamento",
          `<b>${esc(pedido.cliente_nome)}</b> · ${itensTxt(pedido)}`, window.BALCAO.cfgDaBarbearia(A().b()), pedido.forma);
        if (!r) return;
        pagamentos = r.pagamentos;
        if (r.troco) setTimeout(() => U.aviso(`Troco: ${C.dinheiro(r.troco)}.`), 400);
      } else if (acao === "aprovar" && pedido && pedido.forma === "dinheiro" && !pedido.agendado_para) {
        if (!(await window.BALCAO.troco(Number(pedido.total), "Receber em dinheiro", `<b>${esc(pedido.cliente_nome)}</b> · ${itensTxt(pedido)}`))) return;
      }
      await U.ocupado(bt, async () => {
        if (pagamentos) await S.rpc("pedido_pagar", { p_id: id, p_pagamentos: pagamentos });
        if (acao === "aprovar" || acao === "recusar" || acao === "bloquear") await S.rpc("pedido_decidir", { p_id: id, p_acao: acao });
        else if (acao === "subir" || acao === "descer") await S.rpc("fila_mover", { p_id: id, p_direcao: acao === "subir" ? -1 : 1 });
        else if (acao === "finalizar") await S.rpc("fila_finalizar", { p_id: id });
        else if (acao === "remover") await S.rpc("pedido_remover", { p_id: id });
      });
      await carregar(); desenhar();
      const msg = { aprovar: "Aprovado.", recusar: "Pedido recusado.", bloquear: "Recusado e bloqueado por 30 min.", finalizar: "Corte finalizado. Próximo!", pago: "Pagamento confirmado.", remover: "Removido." }[acao];
      if (msg) U.aviso(msg);
    } catch (err) { U.aviso(err.message, "erro"); try { await carregar(); desenhar(); } catch (e) { /* */ } }
  }

  /* ---------- agendar um corte pelo painel (cliente sem app) ---------- */
  const ymdNoFuso = (d, fuso) => d.toLocaleDateString("en-CA", { timeZone: fuso });
  async function agendarCorte() {
    const S = A().S, bid = A().b().id;
    let cats, itens, cfg;
    try {
      [cats, itens, cfg] = await Promise.all([
        S.rest(`categorias?barbearia_id=eq.${bid}&select=*&order=ordem.asc,criado_em.asc`),
        S.rest(`itens?barbearia_id=eq.${bid}&esgotado=eq.false&select=*&order=ordem.asc,criado_em.asc`),
        S.rpc("balcao_dados"),
      ]);
    } catch (err) { return U.aviso(err.message, "erro"); }
    const tipo = (it) => (cats.find((c) => c.id === it.categoria_id) || {}).tipo;
    const servicos = itens.filter((i) => tipo(i) && !C.ehProduto(tipo(i)));
    if (!servicos.length) return U.aviso("Cadastre os serviços em Serviços & Produtos antes de agendar.", "erro");
    const fuso = cfg.fuso || "America/Sao_Paulo";
    const barbeiros = cfg.barbeiros || [];
    const st = { esc: new Map(), q: "", barbeiro: cfg.papel === "associado" ? cfg.equipe_id : (barbeiros[0] ? barbeiros[0].id : null),
      dia: cfg.hoje, h: 9, mi: 0, agenda: null };
    const dias = Array.from({ length: 21 }, (_, i) => ymdNoFuso(new Date(Date.now() + i * 86400000), fuso));
    const rotDia = (y, i) => i === 0 ? "Hoje" : i === 1 ? "Amanhã" : new Date(y + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
    const HORAS = Array.from({ length: 24 }, (_, i) => i), MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);
    const dd = (n) => String(n).padStart(2, "0");
    const roda = (id, valores, rot) => `<div class="roda" id="${id}" tabindex="0" role="listbox" aria-label="${rot}">
      <div class="roda-pad"></div>${valores.map((v) => `<div class="roda-op" role="option" data-v="${v}">${dd(v)}</div>`).join("")}<div class="roda-pad"></div></div>`;

    const espera = U.modal("Agendar um corte", `
      <div class="campo"><label for="ag-nome">Nome do cliente</label><input id="ag-nome" maxlength="60" autocomplete="off"></div>
      <div class="campo"><label for="ag-zap">WhatsApp com DDD (opcional)</label><input id="ag-zap" type="tel" inputmode="tel" placeholder="(91) 98888-7777" autocomplete="off"></div>
      ${cfg.papel !== "associado" && barbeiros.length > 1 ? `<fieldset class="grupo"><legend>Barbeiro</legend><div class="chips-linha" id="ag-barbeiro">${barbeiros.map((br) =>
        `<button type="button" class="chip" data-id="${br.id || ""}" aria-pressed="${(br.id || null) === st.barbeiro}">${esc(br.nome)}</button>`).join("")}</div></fieldset>` : ""}
      <fieldset class="grupo"><legend class="legenda-com-info">Serviços <span class="pequeno suave" id="ag-n">Nenhum escolhido</span></legend>
        <input id="ag-busca" type="search" placeholder="Buscar serviço…" aria-label="Buscar serviço" autocomplete="off">
        <div class="lista-rolagem ag-servicos" id="ag-servicos"></div></fieldset>
      <fieldset class="grupo"><legend>Dia</legend><div class="dias-chips" id="ag-dias">${dias.map((d, i) => `<button type="button" class="chip" data-dia="${d}" aria-pressed="${d === st.dia}">${rotDia(d, i)}</button>`).join("")}</div></fieldset>
      <fieldset class="grupo"><legend class="legenda-com-info">Horário <button type="button" class="link ag-ver" id="ag-ver">${U.icone("calendario")}Ver agendamentos</button></legend>
        <div class="relogio">
          <div class="rodas">${roda("ag-h", HORAS, "Hora")}<span class="rodas-sep" aria-hidden="true">:</span>${roda("ag-m", MINUTOS, "Minutos")}<div class="rodas-faixa" aria-hidden="true"></div></div>
          <div class="relogio-info"><b class="relogio-hora num" id="ag-hora-txt">--:--</b><div class="ag-estado" id="ag-estado" role="status"></div>
            <div class="pequeno suave" id="ag-expediente"></div></div>
        </div>
        <div class="ag-marcados" id="ag-marcados"></div></fieldset>
      <div class="ag-resumo" id="ag-resumo"></div>
      <p class="pequeno suave">O cliente paga na hora: quando terminar, toque em <b>Corte finalizado</b> e informe como ele pagou.</p>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Agendar", valor: true, antes: async (m) => {
        const nome = $("#ag-nome", m).value.trim();
        if (nome.length < 2) { U.aviso("Digite o nome do cliente.", "erro"); return false; }
        if (!st.esc.size) { U.aviso("Escolha pelo menos um serviço.", "erro"); return false; }
        const e = estado();
        if (e.tipo === "erro") { U.aviso(e.msg, "erro"); return false; }
        let forcar = false;
        if (e.tipo === "fora") {
          forcar = await U.confirmar("Fora do horário de funcionamento", `<b>${esc(horaTxt())}</b> está fora do horário de funcionamento${e.exp ? ` (${esc(e.exp)})` : ""}.<br>Quer agendar mesmo assim?`, "Agendar mesmo assim");
          if (!forcar) return false;
        }
        const quandoIso = horaParaIso(st.dia, horaTxt(), fuso);
        try {
          await S.rpc("agenda_criar", { p_itens: [...st.esc].map(([id, qtd]) => ({ id, qtd })), p_barbeiro: st.barbeiro || null,
            p_nome: nome, p_whatsapp: $("#ag-zap", m).value, p_agendado_para: quandoIso, p_forcar: forcar });
        } catch (err) { await carregarAgenda(); throw new Error(String(err.message).replace(/^FORA_DO_EXPEDIENTE:\s*/, "")); }
        if (window.CLIENTES) window.CLIENTES.esquecer();
        U.aviso(`Agendado: ${nome} · ${new Date(quandoIso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: fuso })}.`);
        return true;
      } },
    ]);
    const m = [...document.querySelectorAll(".modal-fundo")].pop();
    m.classList.add("modal-comanda", "modal-agendar");
    if (window.CLIENTES) window.CLIENTES.ligar(m, "#ag-nome", "#ag-zap");

    const horaTxt = () => `${dd(st.h)}:${dd(st.mi)}`;
    const minDia = () => st.h * 60 + st.mi;
    const paraMin = (t) => { const [a, b] = String(t).split(":").map(Number); return a * 60 + b; };
    const expTxt = (d) => !d || !d.abre ? "fechado neste dia" : d.almoco_ini && d.almoco_fim ? `${d.abre}–${d.almoco_ini} e ${d.almoco_fim}–${d.fecha}` : `${d.abre}–${d.fecha}`;
    const dentro = (d, x) => !!(d && d.abre && d.fecha) && (d.almoco_ini && d.almoco_fim
      ? (x >= paraMin(d.abre) && x < paraMin(d.almoco_ini)) || (x >= paraMin(d.almoco_fim) && x < paraMin(d.fecha))
      : x >= paraMin(d.abre) && x < paraMin(d.fecha));
    const horaLocal = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso });

    /* situação do horário escolhido: livre, ocupado (mesmo minuto ou fila) ou fora do expediente */
    function estado() {
      const a = st.agenda;
      if (!a) return { tipo: "carregando", msg: "Conferindo a agenda…" };
      const ts = new Date(horaParaIso(st.dia, horaTxt(), fuso));
      if (ts.getTime() < Math.floor(Date.now() / 60000) * 60000) return { tipo: "erro", msg: "Esse horário já passou. Escolha outro." };
      const outro = (a.agendados || []).find((x) => x.hora === horaTxt());
      if (outro) return { tipo: "erro", msg: `Horário não disponível: ${outro.nome} já está agendado(a) às ${outro.hora}.` };
      if (a.fila_ate && ts < new Date(a.fila_ate)) return { tipo: "erro", msg: `Horário não disponível: tem ${a.fila_n} pessoa${a.fila_n > 1 ? "s" : ""} na fila esperando (previsão até ${horaLocal(a.fila_ate)}).` };
      if (a.tem_horario && !dentro(a.expediente, minDia())) return { tipo: "fora", exp: expTxt(a.expediente), msg: `Fora do horário de funcionamento (${expTxt(a.expediente)}). Dá para agendar mesmo assim.` };
      return { tipo: "ok", msg: "Horário livre" };
    }
    function pintarEstado() {
      $("#ag-hora-txt", m).textContent = horaTxt();
      const e = estado(), el = $("#ag-estado", m);
      el.className = "ag-estado " + e.tipo;
      el.innerHTML = `${e.tipo === "ok" ? "✓ " : e.tipo === "erro" ? "✕ " : e.tipo === "fora" ? "! " : ""}${esc(e.msg)}`;
      resumo();
    }
    async function carregarAgenda() {
      st.agenda = null; pintarEstado();
      try { st.agenda = await S.rpc("agenda_dia", { p_barbeiro: st.barbeiro || null, p_dia: st.dia }); }
      catch (err) { $("#ag-estado", m).textContent = err.message; return; }
      const a = st.agenda;
      $("#ag-expediente", m).textContent = a.tem_horario ? `Funcionamento: ${expTxt(a.expediente)}` : "";
      $("#ag-marcados", m).innerHTML = (a.agendados || []).length
        ? `<span class="pequeno suave">Já marcados neste dia:</span> ${a.agendados.map((x) => `<button type="button" class="chip mini-chip" data-hora="${x.hora}">${esc(x.hora)} · ${esc(x.nome.split(" ")[0])}</button>`).join("")}`
        : `<span class="pequeno suave">Nenhum agendamento neste dia${a.fila_n ? ` · ${a.fila_n} na fila agora` : ""}.</span>`;
      $$("[data-hora]", m).forEach((bt) => (bt.onclick = () => { const [h, mi] = bt.dataset.hora.split(":").map(Number); irPara(h, mi - (mi % 5)); }));
      pintarEstado();
    }

    /* ---------- rodinhas ---------- */
    const ALT = 40;
    const rodaH = $("#ag-h", m), rodaM = $("#ag-m", m);
    function marcar(rodaEl, v) { $$(".roda-op", rodaEl).forEach((o) => o.classList.toggle("sel", Number(o.dataset.v) === v)); }
    function irPara(h, mi, suave) {
      st.h = h; st.mi = mi;
      rodaH.scrollTo({ top: HORAS.indexOf(h) * ALT, behavior: suave === false ? "auto" : "smooth" });
      rodaM.scrollTo({ top: MINUTOS.indexOf(mi) * ALT, behavior: suave === false ? "auto" : "smooth" });
      marcar(rodaH, h); marcar(rodaM, mi); pintarEstado();
    }
    function ligarRoda(rodaEl, valores, campo) {
      let t = null;
      rodaEl.addEventListener("scroll", () => {
        const i = Math.max(0, Math.min(valores.length - 1, Math.round(rodaEl.scrollTop / ALT)));
        if (st[campo] !== valores[i]) { st[campo] = valores[i]; marcar(rodaEl, valores[i]); pintarEstado(); }
        clearTimeout(t); t = setTimeout(() => { if (Math.abs(rodaEl.scrollTop - i * ALT) > 1) rodaEl.scrollTo({ top: i * ALT, behavior: "smooth" }); }, 120);
      }, { passive: true });
      $$(".roda-op", rodaEl).forEach((o) => (o.onclick = () => rodaEl.scrollTo({ top: valores.indexOf(Number(o.dataset.v)) * ALT, behavior: "smooth" })));
      rodaEl.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const i = valores.indexOf(st[campo]) + (e.key === "ArrowDown" ? 1 : -1);
        if (i >= 0 && i < valores.length) rodaEl.scrollTo({ top: i * ALT, behavior: "smooth" });
      });
    }
    ligarRoda(rodaH, HORAS, "h"); ligarRoda(rodaM, MINUTOS, "mi");
    function horaInicial() {
      if (st.dia === cfg.hoje) {
        const agora = new Date(Date.now() + 10 * 60000);
        const [h, mi] = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: fuso }).split(":").map(Number);
        const t = Math.ceil((h * 60 + mi) / 5) * 5;
        return t >= 24 * 60 ? [23, 55] : [Math.floor(t / 60), t % 60];
      }
      const d = A().b().horarios && A().b().horarios[String(new Date(st.dia + "T12:00:00").getDay())];
      return d && d.abre ? [Number(d.abre.slice(0, 2)), Number(d.abre.slice(3, 5)) - (Number(d.abre.slice(3, 5)) % 5)] : [9, 0];
    }

    /* ---------- serviços com busca e quantidade ---------- */
    const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    function pintarServicos() {
      const alvo = $("#ag-servicos", m), topo = alvo.scrollTop;
      const l = servicos.filter((i) => !st.q || norm(i.nome).includes(norm(st.q)));
      alvo.innerHTML = l.length ? l.map((it) => {
        const q = st.esc.get(it.id) || 0;
        return `<div class="ag-serv${q ? " escolhido" : ""}" data-id="${it.id}"><span class="ag-serv-nome"><b>${esc(it.nome)}</b><small>${C.dinheiro(C.final(it))}</small></span>
          ${q ? `<div class="qtd"><button type="button" class="btn mini sec" data-d="-1" aria-label="Menos">−</button><b class="num">${q}</b><button type="button" class="btn mini sec" data-d="1" aria-label="Mais">+</button></div>`
            : `<button type="button" class="btn mini sec" data-d="1">Escolher</button>`}</div>`;
      }).join("") : `<p class="suave pequeno" style="padding:.6rem">Nenhum serviço com esse nome.</p>`;
      alvo.scrollTop = topo;
      const n = [...st.esc.values()].reduce((a, b) => a + b, 0);
      $("#ag-n", m).textContent = n ? `${n} escolhido${n > 1 ? "s" : ""}` : "Nenhum escolhido";
      $$("[data-d]", alvo).forEach((bt) => (bt.onclick = () => {
        const id = bt.closest(".ag-serv").dataset.id, q = Math.min(10, (st.esc.get(id) || 0) + Number(bt.dataset.d));
        if (q > 0) st.esc.set(id, q); else st.esc.delete(id);
        pintarServicos(); resumo();
      }));
    }
    $("#ag-busca", m).oninput = (e) => { st.q = e.target.value; pintarServicos(); };

    const resumo = () => {
      const sel = [...st.esc].map(([id, q]) => ({ it: itens.find((i) => i.id === id), q })).filter((x) => x.it);
      const total = sel.reduce((s2, x) => s2 + C.final(x.it) * x.q, 0);
      $("#ag-resumo", m).innerHTML = sel.length ? `<div class="total-receber"><span>${sel.map((x) => (x.q > 1 ? x.q + " × " : "") + esc(x.it.nome)).join(" + ")} · ${esc(horaTxt())}</span><b class="num">${C.dinheiro(total)}</b></div>` : "";
    };

    $$("#ag-barbeiro .chip", m).forEach((bt) => (bt.onclick = () => {
      st.barbeiro = bt.dataset.id || null;
      $$("#ag-barbeiro .chip", m).forEach((o) => o.setAttribute("aria-pressed", String(o === bt)));
      carregarAgenda();
    }));
    $$("#ag-dias .chip", m).forEach((bt) => (bt.onclick = () => {
      st.dia = bt.dataset.dia; $$("#ag-dias .chip", m).forEach((o) => o.setAttribute("aria-pressed", String(o === bt)));
      const [h, mi] = horaInicial(); irPara(h, mi); carregarAgenda();
    }));
    $("#ag-ver", m).onclick = async () => { await verAgendados(); carregarAgenda(); };

    pintarServicos();
    const [h0, m0] = horaInicial();
    requestAnimationFrame(() => irPara(h0, m0, false));
    carregarAgenda();
    if (await espera) { await carregar(); desenhar(); }
  }
  /* "2026-10-14" + "14:30" no fuso da barbearia → ISO em UTC */
  function horaParaIso(dia, hora, fuso) {
    const [y, mo, d] = dia.split("-").map(Number), [h, mi] = hora.split(":").map(Number);
    const palpite = Date.UTC(y, mo - 1, d, h, mi);
    const noFuso = new Date(new Date(palpite).toLocaleString("en-US", { timeZone: fuso }));
    const utc = new Date(new Date(palpite).toLocaleString("en-US", { timeZone: "UTC" }));
    return new Date(palpite + (utc - noFuso)).toISOString();
  }

  /* ---------- ver os cortes agendados, por dia ---------- */
  async function verAgendados() {
    try { await carregar(); } catch (e) { /* mostra o que tem */ }
    const lista = dados.agendamentos.slice().sort((a, b) => new Date(a.agendado_para) - new Date(b.agendado_para));
    const ver = dados.papel !== "associado";
    const grupos = new Map();
    lista.forEach((p) => {
      const d = new Date(p.agendado_para), chave = d.toLocaleDateString("en-CA");
      if (!grupos.has(chave)) grupos.set(chave, { rot: d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }), itens: [] });
      grupos.get(chave).itens.push(p);
    });
    const ro = A().leitura() ? " disabled" : "";
    const fundo = U.modal("Cortes agendados", lista.length ? [...grupos.values()].map((g) => `<section class="ag-dia"><h3>${esc(g.rot)}</h3>
        ${g.itens.map((p) => `<div class="ag-item" data-id="${p.id}">
          <b class="ag-hora num">${esc(new Date(p.agendado_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }))}</b>
          <div class="ag-info"><b>${esc(p.cliente_nome)}</b> ${zapLink(p.cliente_whatsapp)}
            <div class="pequeno suave">${itensTxt(p)} · ${C.dinheiro(p.total)} · ${FORMAS[p.forma]}${ver ? " · com " + esc(nomeBarbeiro(p.barbeiro_id)) : ""}</div></div>
          <button class="btn mini sec" data-cancelar${ro}>Cancelar</button></div>`).join("")}</section>`).join("")
      : `<div class="vazio-cardapio">Nenhum corte agendado. Toque em <b>Agendar um corte</b> para marcar um horário.</div>`, [{ rotulo: "Fechar", valor: null }]);
    const m = [...document.querySelectorAll(".modal-fundo")].pop();
    m.classList.add("modal-comanda");
    $$("[data-cancelar]", m).forEach((bt) => (bt.onclick = async () => {
      const item = bt.closest(".ag-item");
      if (!(await U.confirmar("Cancelar agendamento", "Cancelar este horário? Ele fica livre para outro cliente.", "Cancelar agendamento", true))) return;
      try { await U.ocupado(bt, () => A().S.rpc("pedido_remover", { p_id: item.dataset.id })); item.remove(); U.aviso("Agendamento cancelado."); }
      catch (err) { U.aviso(err.message, "erro"); }
    }));
    await fundo;
    try { await carregar(); desenhar(); } catch (e) { /* */ }
  }

  /* ---------- avisos no celular ---------- */
  function suportaPush() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function blocoAvisos() {
    const perm = "Notification" in window ? Notification.permission : "indisponivel";
    let guardado = false; try { guardado = localStorage.getItem("bs_push_ok") === "1"; } catch (e) { /* */ }
    const ativo = perm === "granted" && guardado;
    return `<section class="cartao avisos-cartao">
      <div><b>Avisos de pedido</b><div class="pequeno suave">${ativo ? "Este celular recebe aviso mesmo com o app fechado."
        : U.ehIphone() && !U.instalado() ? "No iPhone, instale o painel na tela inicial (Safari → Compartilhar) para receber avisos."
        : "Com o painel aberto, toca um som a cada pedido novo."}</div></div>
      <div class="avisos-acoes">
        ${!ativo && suportaPush() && window.CONFIG.VAPID_PUBLICA ? `<button class="btn mini" id="ativar-push">${U.icone("sino")}Ativar avisos no celular</button>` : ""}
        <label class="linha-check pequeno"><input type="checkbox" id="som"${somLigado() ? " checked" : ""}> Som</label>
      </div></section>`;
  }
  function ligarAvisos() {
    const s = $("#som"); if (s) s.onchange = () => { try { localStorage.setItem("bs_som", s.checked ? "1" : "0"); } catch (e) { /* */ } if (s.checked) U.bip(); };
    const bt = $("#ativar-push"); if (bt) bt.onclick = () => U.ocupado(bt, ativarPush);
  }
  const u8 = (b64) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4)), (c) => c.charCodeAt(0));
  async function ativarPush() {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return U.aviso("Os avisos foram bloqueados. Libere nas configurações do navegador.", "erro");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(window.CONFIG.VAPID_PUBLICA) }));
      const j = sub.toJSON();
      await A().S.rest("push_inscricoes?on_conflict=endpoint", { method: "POST", prefer: "resolution=merge-duplicates",
        body: { endpoint: j.endpoint, user_id: A().S.sessao().user.id, barbearia_id: A().b().id, p256dh: j.keys && j.keys.p256dh, auth: j.keys && j.keys.auth } });
      try { localStorage.setItem("bs_push_ok", "1"); } catch (e) { /* */ }
      U.aviso("Pronto! Este celular vai receber os avisos de pedido.");
      desenhar();
    } catch (err) { U.aviso("Não foi possível ativar os avisos: " + err.message, "erro"); }
  }

  window.APP_ABAS = Object.assign(window.APP_ABAS || {}, { fila: tela });
})();
