/* fila.js — aba "Fila" (dono, barbeiro associado e caixa):
   pedidos para aprovar, fila de cada barbeiro, agendamentos e avisos no celular. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO;
  const A = () => window.APP;
  const FORMAS = { pix: "Pix", dinheiro: "Dinheiro", prazo: "À prazo" };
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
    corpo.innerHTML = `<p class="suave">Carregando a fila…</p>`;
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
    corpo.innerHTML = `<div class="fila-painel">
      ${blocoAvisos()}
      <section class="cartao"><h2>Pedidos para aprovar ${pend.length ? `<span class="contador-pend">${pend.length}</span>` : ""}</h2>
        ${pend.length ? pend.map((p) => cartaoPendente(p, ver, dis)).join("") : `<p class="suave pequeno">Nenhum pedido esperando. Quando chegar, toca um aviso.</p>`}
      </section>
      ${(dados.filas || []).map((f) => `<section class="cartao fila-de"><h2>Fila de ${esc(f.nome)}</h2>
        ${f.fila.length ? f.fila.map((p, i) => cartaoFila(p, i, f.fila, dis)).join("") : `<p class="suave pequeno">Ninguém na fila.</p>`}</section>`).join("")}
      <section class="cartao"><h2>Próximos agendamentos</h2>
        ${dados.agendamentos.length ? dados.agendamentos.map((p) => `<div class="pedido-linha" data-id="${p.id}">
          <div><b>${esc(quando(p.agendado_para))}</b> · ${esc(p.cliente_nome)} ${zapLink(p.cliente_whatsapp)}
            <div class="pequeno suave">${itensTxt(p)} · ${C.dinheiro(p.total)} · ${FORMAS[p.forma]}${ver ? " · com " + esc(nomeBarbeiro(p.barbeiro_id)) : ""}</div></div>
          <button class="btn mini sec" data-a="remover"${dis}>Cancelar</button></div>`).join("") : `<p class="suave pequeno">Nenhum agendamento.</p>`}
      </section></div>`;
    $$("[data-a]", corpo).forEach((bt) => (bt.onclick = () => agir(bt.dataset.a, bt.closest("[data-id]").dataset.id, bt)));
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
      const pedido = dados.pendentes.concat(dados.filas.flatMap((f) => f.fila)).find((x) => x.id === id);
      const recebeDinheiro = pedido && pedido.forma === "dinheiro" && !pedido.pago &&
        ((acao === "aprovar" && !pedido.agendado_para) || acao === "pago" || acao === "finalizar");
      if (recebeDinheiro) {
        if (!(await window.BALCAO.troco(Number(pedido.total), "Receber em dinheiro", `<b>${esc(pedido.cliente_nome)}</b> · ${itensTxt(pedido)}`))) return;
      } else if (acao === "finalizar") {
        const p = pedido;
        if (p && !p.pago && p.forma !== "prazo" && !(await U.confirmar("Corte finalizado", `O pagamento de <b>${C.dinheiro(p.total)}</b> (${FORMAS[p.forma]}) ainda não foi marcado. Confirmar que recebeu e finalizar?`, "Recebi e finalizar"))) return;
      }
      await U.ocupado(bt, async () => {
        if (acao === "aprovar" || acao === "recusar" || acao === "bloquear") await S.rpc("pedido_decidir", { p_id: id, p_acao: acao });
        else if (acao === "subir" || acao === "descer") await S.rpc("fila_mover", { p_id: id, p_direcao: acao === "subir" ? -1 : 1 });
        else if (acao === "finalizar") await S.rpc("fila_finalizar", { p_id: id });
        else if (acao === "pago") await S.rpc("pagamento_confirmar", { p_id: id });
        else if (acao === "remover") await S.rpc("pedido_remover", { p_id: id });
      });
      await carregar(); desenhar();
      const msg = { aprovar: "Aprovado.", recusar: "Pedido recusado.", bloquear: "Recusado e bloqueado por 30 min.", finalizar: "Corte finalizado. Próximo!", pago: "Pagamento confirmado.", remover: "Removido." }[acao];
      if (msg) U.aviso(msg);
    } catch (err) { U.aviso(err.message, "erro"); try { await carregar(); desenhar(); } catch (e) { /* */ } }
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
