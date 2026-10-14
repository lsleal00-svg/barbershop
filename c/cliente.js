/* cliente.js — página do cliente de cada barbearia (?b=apelido-da-barbearia).
   Cardápio, fila por barbeiro, pedir/agendar corte, carrinho de produtos,
   pagamento (Pix com valor, dinheiro, à prazo) e acompanhamento do pedido. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO, H = HORARIO;
  const S = SUPA.criar("bs_sessao_cliente");
  const raiz = $("#raiz");
  const slug = (new URLSearchParams(location.search).get("b") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  let b = null, cats = [], itens = [], atual = null, busca = "";
  let barbeiros = [], meus = [], servicos = [], carrinho = [];
  const statusAntigo = {};

  U.registrarSW("sw.js");

  /* ---------- utilidades ---------- */
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tipoDe = (it) => (cats.find((c) => c.id === it.categoria_id) || {}).tipo;
  const visiveis = () => itens.filter((i) => !i.esgotado);
  const aberta = () => H.situacao(b).aberto;
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } };
  const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) || padrao; } catch (e) { return padrao; } };
  const chaveSacola = () => "bs_sacola_" + slug;
  function salvarSacola() { guardar(chaveSacola(), { s: servicos.map((x) => [x.item.id, x.qtd]), c: carrinho.map((x) => [x.item.id, x.qtd]) }); }
  function lerSacola() {
    const g = ler(chaveSacola(), { s: [], c: [] });
    // formato antigo: lista de ids; novo: [id, qtd]
    servicos = (g.s || []).map((x) => (Array.isArray(x) ? x : [x, 1])).map(([id, q]) => ({ item: itens.find((i) => i.id === id && !i.esgotado), qtd: q })).filter((x) => x.item);
    carrinho = (g.c || []).map(([id, q]) => ({ item: itens.find((i) => i.id === id && !i.esgotado), qtd: q })).filter((x) => x.item);
  }
  function aparelho() {
    let id = ler("bs_visitante", null);
    if (!id) {
      id = "v-" + Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, "0")).join("");
      guardar("bs_visitante", id);
    }
    return id;
  }
  const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: b.fuso || "America/Sao_Paulo" });
  const iniciais = (n) => String(n || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  function trocarIdentidade() {
    document.title = b.nome;
    $("#apple-titulo").setAttribute("content", b.nome.slice(0, 20));
    if (b.logo192_url) { $("#favicon").href = b.logo192_url; $("#apple-icon").href = b.logo_url || b.logo192_url; }
    document.documentElement.dataset.tema = b.tema || "claro";
    U.corDaBarra();
    if (b.cor_barra) {
      const n = parseInt(b.cor_barra.slice(1), 16), luz = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      document.documentElement.style.setProperty("--cor-barra", b.cor_barra);
      document.documentElement.style.setProperty("--cor-barra-texto", luz > 160 ? "#1d1b18" : "#ffffff");
    }
  }
  function telaSimples(titulo, texto, logo) {
    raiz.innerHTML = `<main class="indisponivel"><div>${logo ? `<img src="${esc(logo)}" alt="">` : ""}
      <h1>${esc(titulo)}</h1><p class="suave">${texto}</p></div></main>`;
  }
  function statusHtml() {
    const st = H.situacao(b);
    return `<span class="status-pill ${st.aberto ? "aberto" : st.motivo === "almoco" ? "almoco" : "fechado"}" id="status">${esc(H.texto(st))}</span>`;
  }

  /* ---------- tela ---------- */
  function telaBarbearia() {
    raiz.innerHTML = `
      <div class="fixo">
        <header class="cabeca"><div class="barra">
          ${b.logo192_url ? `<img src="${esc(b.logo192_url)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'logo-vazio',textContent:'${esc(iniciais(b.nome))}'}))">` : `<span class="logo-vazio">${esc(iniciais(b.nome))}</span>`}
          <div class="cab-textos"><h1>${esc(b.nome)}</h1>${statusHtml()}</div>
          ${U.instalado() ? "" : `<button class="btn mini" id="instalar">${U.icone("baixar")}Instalar app</button>`}
        </div>
        <div class="busca-linha"><input id="busca" type="search" placeholder="Buscar serviço ou produto…" aria-label="Buscar" autocomplete="off"></div>
        </header>
        <nav class="barra-cat" id="cats" aria-label="Categorias"></nav>
      </div>
      <main class="corpo-cli">
        <section class="destaques oculto" id="destaques"></section>
        <section class="fila-cli" id="fila" aria-label="Fila"></section>
        <section id="lista"></section>
      </main>
      <div class="barra-pedido oculto" id="barra-pedido"></div>`;
    if ($("#instalar")) $("#instalar").onclick = () => U.instalar();
    $("#busca").oninput = (e) => { busca = e.target.value.trim(); desenharLista(); };
    desenharCats();
    C.carrossel($("#destaques"), visiveis().filter((i) => i.destaque), tipoDe);
    desenharFila();
    desenharLista();
    desenharBarra();
  }

  function desenharCats() {
    const comItens = cats.filter((c) => visiveis().some((i) => i.categoria_id === c.id));
    if (!comItens.some((c) => c.id === atual)) atual = comItens[0] ? comItens[0].id : null;
    $("#cats").classList.toggle("oculto", !comItens.length);
    $("#cats").innerHTML = comItens.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === atual}">${c.icone ? `<span aria-hidden="true">${esc(c.icone)}</span>` : ""}${esc(c.nome)}</button>`).join("");
    $$("#cats .chip").forEach((ch) => (ch.onclick = () => {
      atual = ch.dataset.cat; busca = ""; $("#busca").value = "";
      desenharCats(); desenharLista();
      const topo = $("#lista").getBoundingClientRect().top + window.scrollY - $(".fixo").offsetHeight - 8;
      if (window.scrollY > topo) window.scrollTo({ top: topo, behavior: "smooth" });
    }));
  }

  function acoesItem(it) {
    const t = tipoDe(it);
    if (t === "outros") {
      const qtd = (carrinho.find((x) => x.item.id === it.id) || {}).qtd;
      return aberta() ? `<button class="btn" data-a="carrinho">${qtd ? `No carrinho (${qtd}) ＋` : "Adicionar ao carrinho"}</button>`
        : `<button class="btn sec" disabled>Fechado agora</button>`;
    }
    const qtd = (servicos.find((x) => x.item.id === it.id) || {}).qtd;
    return `<button class="btn" data-a="servico">${qtd ? `Solicitado (${qtd}) ＋` : "Solicitar serviço"}</button>`;
  }

  function desenharLista() {
    const alvo = $("#lista");
    let lista, titulo;
    if (busca) {
      const q = norm(busca);
      lista = visiveis().filter((i) => norm(i.nome).includes(q) || norm((cats.find((c) => c.id === i.categoria_id) || {}).nome).includes(q));
      titulo = `Resultados para “${esc(busca)}”`;
      $$("#cats .chip").forEach((ch) => ch.setAttribute("aria-pressed", "false"));
    } else {
      $$("#cats .chip").forEach((ch) => ch.setAttribute("aria-pressed", String(ch.dataset.cat === atual)));
      const cat = cats.find((c) => c.id === atual);
      if (!cat) { alvo.innerHTML = `<div class="vazio-cardapio">Os serviços e produtos ainda estão sendo cadastrados.</div>`; return; }
      lista = visiveis().filter((i) => i.categoria_id === cat.id);
      titulo = `${cat.icone ? esc(cat.icone) + " " : ""}${esc(cat.nome)}`;
    }
    alvo.innerHTML = `<h2 class="titulo-lista">${titulo}</h2>` + (lista.length
      ? `<div class="grade-itens">${lista.map((it) => C.cartao(it, tipoDe(it), { acoes: acoesItem(it) })).join("")}</div>`
      : `<div class="vazio-cardapio">Nada encontrado.</div>`);
    $$("#lista [data-a]").forEach((bt) => (bt.onclick = () => {
      const it = itens.find((x) => x.id === bt.closest(".item-card").dataset.id);
      if (bt.dataset.a === "carrinho") porNoCarrinho(it); else solicitarServico(it);
    }));
  }

  /* ---------- fila ---------- */
  function desenharFila() {
    const alvo = $("#fila");
    if (!alvo) return;
    alvo.classList.toggle("oculto", !!b.esconder_fila);   // o dono escolheu esconder a fila
    if (b.esconder_fila) { alvo.innerHTML = ""; return; }
    const temServico = visiveis().some((i) => tipoDe(i) !== "outros");
    if (!barbeiros.length) {
      alvo.innerHTML = `<div class="cartao"><h2>Fila online</h2><p class="pequeno suave">Nenhum barbeiro atendendo pelo app no momento.</p></div>`;
      return;
    }
    const ab = aberta();
    const topoAntes = $(".fila-lista", alvo) ? $(".fila-lista", alvo).scrollTop : 0;
    alvo.innerHTML = `<div class="cartao fila-cartao"><h2>Fila online</h2><div class="fila-lista">${barbeiros.map((br, i) => {
      const fila = br.fila || [];
      let n = 0;
      return `<div class="fila-barbeiro" data-i="${i}">
        <div class="fila-acoes">
          <button class="btn mini" data-a="pedir"${!ab || !temServico ? " disabled" : ""}>Pedir corte</button>
          <button class="btn mini sec" data-a="agendar"${!temServico ? " disabled" : ""}>Agendar corte</button>
          <span class="pequeno suave">Fila para ${esc(br.nome)}</span></div>
        <div class="fila-linha">
          <div class="bloco-barbeiro">${br.foto ? `<img src="${esc(br.foto)}" alt="">` : `<span class="avatar">${esc(iniciais(br.nome))}</span>`}<b>${esc(br.nome)}</b></div>
          ${fila.length ? fila.map((p) => {
            const atendendo = p.status === "atendimento";
            if (!atendendo) n++;
            return `<div class="bloco-cliente${atendendo ? " atendendo" : ""}${p.agendado ? " agendado" : ""}">
              ${atendendo ? "" : `<span class="pos">${n}º</span>`}<b>${esc(p.nome)}</b>
              <small>${atendendo ? "Em atendimento" : p.agendado ? "Agendado · aguardando" : "Aguardando"}</small></div>`;
          }).join("") : `<div class="bloco-vazio">Ninguém na fila</div>`}
        </div>
        ${br.agendados_hoje && br.agendados_hoje.length ? `<p class="pequeno suave agendados-hoje">Agendados hoje: ${br.agendados_hoje.map(esc).join(", ")}</p>` : ""}
      </div>`;
    }).join("")}</div>${barbeiros.length > 2 ? `<p class="pequeno suave dica-rolar">${U.icone("rolar")}Role para ver os outros barbeiros (${barbeiros.length}).</p>` : ""}${!ab ? `<p class="pequeno suave">A barbearia está fechada agora, mas você pode agendar.</p>` : ""}</div>`;
    limitarFila(alvo, topoAntes);
    $$("#fila [data-a]").forEach((bt) => (bt.onclick = () => {
      const br = barbeiros[Number(bt.closest(".fila-barbeiro").dataset.i)];
      escolherServicos(br, bt.dataset.a === "agendar" ? "agendar" : "agora");
    }));
  }

  /* Até 2 barbeiros à vista; com 3 ou mais, a lista ganha rolagem vertical. */
  function limitarFila(alvo, topo) {
    const lista = $(".fila-lista", alvo);
    const blocos = $$(".fila-barbeiro", lista);
    if (blocos.length <= 2) { lista.classList.remove("rolando"); lista.style.maxHeight = ""; return; }
    lista.classList.add("rolando");
    lista.style.maxHeight = (blocos[0].offsetHeight + blocos[1].offsetHeight + 2) + "px";
    lista.scrollTop = topo || 0;
  }

  /* ---------- serviços e carrinho ---------- */
  const MAX_SERV = 10;
  /* − n ＋ e lixeira (carrinho e serviços solicitados) */
  const controleQtd = (x) => `<div class="qtd"><button class="btn mini sec" data-q="-1" data-id="${x.item.id}" aria-label="Menos">−</button><b>${x.qtd}</b><button class="btn mini sec" data-q="1" data-id="${x.item.id}" aria-label="Mais">＋</button><button class="btn mini sec tirar" data-tirar="${x.item.id}" aria-label="Tirar ${esc(x.item.nome)}" title="Tirar">${U.icone("lixeira")}</button></div>`;
  function solicitarServico(it) {
    const x = servicos.find((c) => c.item.id === it.id);
    if (x && x.qtd >= MAX_SERV) return U.aviso(`No máximo ${MAX_SERV} de cada serviço.`, "erro");
    if (x) x.qtd += 1; else servicos.push({ item: it, qtd: 1 });
    salvarSacola(); desenharLista(); desenharBarra(); balancar(it);
    U.aviso(x ? `${it.nome}: ${x.qtd} em serviços solicitados.` : `${it.nome} em serviços solicitados.`);
  }
  function porNoCarrinho(it) {
    const x = carrinho.find((c) => c.item.id === it.id);
    if (x) x.qtd = Math.min(20, x.qtd + 1); else carrinho.push({ item: it, qtd: 1 });
    salvarSacola(); desenharLista(); desenharBarra(); balancar(it); U.aviso(`${it.nome} no carrinho.`);
  }
  /* A etiqueta balança no ilhós quando o cliente toca no canhoto. */
  function balancar(it) {
    const card = $(`#lista .item-card[data-id="${CSS.escape(String(it.id))}"]`);
    if (card) card.classList.add("balanca");
  }

  function desenharBarra() {
    const el = $("#barra-pedido");
    if (!el) return;
    const ativos = meus.filter((p) => p.status === "pendente" || p.status === "aprovado");
    const nCar = carrinho.reduce((s, x) => s + x.qtd, 0);
    const nServ = servicos.reduce((s, x) => s + x.qtd, 0);
    el.classList.toggle("oculto", !servicos.length && !nCar && !ativos.length);
    el.innerHTML = `
      ${servicos.length ? `<button class="btn" id="ver-servicos">${U.icone("tesoura")}Serviços solicitados (${nServ})</button>` : ""}
      ${nCar ? `<button class="btn" id="ver-carrinho">${U.icone("sacola")}Carrinho (${nCar})</button>` : ""}
      ${ativos.length ? `<button class="btn sec" id="ver-meus">${U.icone("lista")}Meus pedidos (${ativos.length})</button>` : ""}`;
    if ($("#ver-servicos")) $("#ver-servicos").onclick = verServicos;
    if ($("#ver-carrinho")) $("#ver-carrinho").onclick = verCarrinho;
    if ($("#ver-meus")) $("#ver-meus").onclick = verMeus;
    document.body.classList.toggle("com-barra", !el.classList.contains("oculto"));
  }

  /* Janela própria do assistente (troca o conteúdo a cada passo). */
  function janela(titulo) {
    const fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-topo"><h2></h2><button class="fechar" aria-label="Fechar">×</button></div>
      <div class="modal-corpo"></div><div class="modal-rodape"></div></div>`;
    document.body.appendChild(fundo);
    const j = {
      el: fundo,
      fechar: () => fundo.remove(),
      mostrar(t, corpo, botoes) {
        $("h2", fundo).textContent = t;
        $(".modal-corpo", fundo).innerHTML = corpo;
        const rod = $(".modal-rodape", fundo); rod.innerHTML = "";
        (botoes || []).forEach((bt) => {
          const e = document.createElement("button");
          e.className = "btn " + (bt.classe || ""); e.textContent = bt.rotulo; e.disabled = !!bt.desligado;
          e.onclick = async () => { e.disabled = true; try { await bt.acao(); } catch (err) { U.aviso(err.message, "erro"); } finally { if (document.body.contains(e)) e.disabled = false; } };
          rod.appendChild(e);
        });
        $(".modal-corpo", fundo).scrollTop = 0;
      },
    };
    $(".fechar", fundo).onclick = j.fechar;
    fundo.addEventListener("click", (e) => { if (e.target === fundo) j.fechar(); });
    j.mostrar(titulo, "", []);
    return j;
  }

  function linhaItem(it, extra) {
    return `<div class="linha-item"><img src="${esc(C.foto(it, tipoDe(it)))}" alt=""><div><b>${esc(it.nome)}</b><br>${C.precoHtml(it)}</div>${extra || ""}</div>`;
  }

  function verServicos() {
    const j = janela("Serviços solicitados");
    const desenhar = () => {
      if (!servicos.length) { j.fechar(); desenharBarra(); return; }
      const total = servicos.reduce((s, x) => s + C.final(x.item) * x.qtd, 0);
      j.mostrar("Serviços solicitados", servicos.map((x) => linhaItem(x.item, controleQtd(x))).join("") +
        `<p class="total-linha">Total: <b>${C.dinheiro(total)}</b></p>`, [
        { rotulo: "Adicionar um novo serviço", classe: "sec", acao: () => { j.fechar(); irParaServicos(); } },
        { rotulo: "Finalizar", acao: () => { j.fechar(); assistente({ tipo: "servico", itens: servicos.map((x) => ({ item: x.item, qtd: x.qtd })) }); } },
      ]);
      $$("[data-q]", j.el).forEach((bt) => (bt.onclick = () => {
        const x = servicos.find((c) => c.item.id === bt.dataset.id);
        x.qtd = Math.min(MAX_SERV, x.qtd + Number(bt.dataset.q));
        if (x.qtd <= 0) servicos = servicos.filter((c) => c !== x);
        salvarSacola(); desenharLista(); desenharBarra(); desenhar();
      }));
      $$("[data-tirar]", j.el).forEach((bt) => (bt.onclick = () => { servicos = servicos.filter((c) => c.item.id !== bt.dataset.tirar); salvarSacola(); desenharLista(); desenharBarra(); desenhar(); }));
    };
    desenhar();
  }
  function irParaServicos() {
    const c = cats.find((x) => !C.ehProduto(x.tipo) && visiveis().some((i) => i.categoria_id === x.id));
    if (c) { atual = c.id; busca = ""; $("#busca").value = ""; desenharCats(); desenharLista(); }
    $("#lista").scrollIntoView({ behavior: "smooth" });
  }

  function verCarrinho() {
    const j = janela("Carrinho");
    const desenhar = () => {
      if (!carrinho.length) { j.fechar(); desenharBarra(); desenharLista(); return; }
      const total = carrinho.reduce((s, x) => s + C.final(x.item) * x.qtd, 0);
      j.mostrar("Carrinho", carrinho.map((x) => linhaItem(x.item, controleQtd(x))).join("") +
        `<p class="total-linha">Total: <b>${C.dinheiro(total)}</b></p>`, [
        { rotulo: "Continuar comprando", classe: "sec", acao: () => j.fechar() },
        { rotulo: "Finalizar compra", desligado: !aberta(), acao: () => { j.fechar(); assistente({ tipo: "produto", itens: carrinho.map((x) => ({ item: x.item, qtd: x.qtd })) }); } },
      ]);
      $$("[data-q]", j.el).forEach((bt) => (bt.onclick = () => {
        const x = carrinho.find((c) => c.item.id === bt.dataset.id);
        x.qtd += Number(bt.dataset.q);
        if (x.qtd <= 0) carrinho = carrinho.filter((c) => c !== x);
        if (x.qtd > 20) x.qtd = 20;
        salvarSacola(); desenharBarra(); desenhar();
      }));
      $$("[data-tirar]", j.el).forEach((bt) => (bt.onclick = () => {
        carrinho = carrinho.filter((c) => c.item.id !== bt.dataset.tirar);
        salvarSacola(); desenharBarra(); desenhar();
      }));
    };
    desenhar();
    if (!aberta()) U.aviso("A barbearia está fechada: produtos só podem ser pedidos com ela aberta.", "erro");
  }

  /* "Pedir corte" / "Agendar corte" a partir da fila de um barbeiro. */
  function escolherServicos(br, modo) {
    const j = janela(modo === "agendar" ? "Agendar corte" : "Pedir corte");
    const lista = () => visiveis().filter((i) => !C.ehProduto(tipoDe(i)));
    let q = "";
    const escolha = new Map(servicos.map((x) => [x.item.id, x.qtd]));   // id → quantidade
    const nEsc = () => [...escolha.values()].reduce((s, n) => s + n, 0);
    const ctrl = (it) => {
      const q = escolha.get(it.id) || 0;
      return q ? `<div class="qtd"><button class="btn mini sec" data-esc="${it.id}" data-d="-1" aria-label="Menos">−</button><b>${q}</b><button class="btn mini sec" data-esc="${it.id}" data-d="1" aria-label="Mais">＋</button></div>`
        : `<button class="btn mini sec" data-esc="${it.id}" data-d="1">Escolher</button>`;
    };
    const desenhar = () => {
      const l = lista().filter((i) => !q || norm(i.nome).includes(norm(q)));
      j.mostrar(`${modo === "agendar" ? "Agendar" : "Pedir corte"} · ${br.nome}`, `
        <div class="servicos-cab"><b>Serviços</b><span class="pequeno suave" id="n-esc">${nEsc() ? `${nEsc()} escolhido${nEsc() > 1 ? "s" : ""}` : "Nenhum escolhido"}</span></div>
        <input id="q-serv" type="search" placeholder="Buscar serviço…" value="${esc(q)}" aria-label="Buscar serviço" style="margin-bottom:.5rem">
        <div class="escolhas lista-rolagem">${l.map((it) => linhaItem(it, ctrl(it))).join("") || `<p class="suave pequeno">Nada encontrado.</p>`}</div>
        <p class="pequeno suave">Escolha quantos serviços quiser. Ex.: 2 cortes, se vier com outra pessoa.</p>`, [
        { rotulo: "Continuar", desligado: !escolha.size, acao: () => {
          j.fechar();
          const sel = [...escolha].map(([id, qtd]) => ({ item: itens.find((i) => i.id === id), qtd })).filter((x) => x.item);
          assistente({ tipo: "servico", itens: sel, barbeiro: br, quando: modo });
        } },
      ]);
      const campo = $("#q-serv", j.el);
      campo.oninput = (e) => { q = e.target.value; const pos = e.target.selectionStart; desenhar(); const c2 = $("#q-serv", j.el); c2.focus(); c2.setSelectionRange(pos, pos); };
      $$("[data-esc]", j.el).forEach((bt) => (bt.onclick = () => {
        const id = bt.dataset.esc, q = Math.min(MAX_SERV, (escolha.get(id) || 0) + Number(bt.dataset.d));
        if (q > 0) escolha.set(id, q); else escolha.delete(id);
        const lr = $(".lista-rolagem", j.el), corpo = $(".modal-corpo", j.el), t1 = lr.scrollTop, t2 = corpo.scrollTop;
        desenhar();
        $(".lista-rolagem", j.el).scrollTop = t1; $(".modal-corpo", j.el).scrollTop = t2;
      }));
    };
    desenhar();
  }

  /* ---------- assistente do pedido ---------- */
  const FORMAS = { pix: "Pix", dinheiro: "Dinheiro em espécie", prazo: "À prazo", debito: "Cartão de débito", credito: "Cartão de crédito", misto: "Várias formas", aberto: "Paga na hora" };
  function totalDe(e) { return e.itens.reduce((s, x) => s + C.final(x.item) * x.qtd, 0); }

  function assistente(e) {
    const j = janela("Finalizar");
    e.nome = e.nome || ler("bs_nome", ""); e.whatsapp = e.whatsapp || ler("bs_whats", "");
    const precisaZap = () => e.forma === "prazo" || e.quando === "agendar";
    const passo = () => {
      if (e.tipo === "servico" && !e.quando) return pQuando();
      if (!e.forma) return pForma();
      if (!e.dadosOk) return pDados();
      if (e.tipo === "servico" && e.barbeiro === undefined) return pBarbeiro();
      if (e.quando === "agendar" && !e.horario) return pHorario();
      return pResumo();
    };
    const voltar = (campo) => ({ rotulo: "Voltar", classe: "sec", acao: () => { delete e[campo]; passo(); } });

    function pQuando() {
      const ab = aberta();
      j.mostrar("O corte é agora ou agendado?", `<div class="opcoes">
          <button class="opcao" data-q="agora"${ab ? "" : " disabled"}><b>Agora</b><small>${ab ? "Entrar na fila de hoje" : "A barbearia está fechada agora"}</small></button>
          <button class="opcao" data-q="agendar"><b>Agendar</b><small>Escolher dia e horário</small></button></div>`, []);
      $$("[data-q]", j.el).forEach((bt) => (bt.onclick = () => { e.quando = bt.dataset.q; passo(); }));
    }
    function pForma() {
      const formas = ["pix", "dinheiro", "debito", "credito", "prazo"].filter((f) => b["aceita_" + f] && !(f === "prazo" && e.tipo === "produto"));
      const hoje = new Date();
      const max = new Date(hoje.getTime() + (b.prazo_dias || 7) * 86400000);
      const ymd = (d) => d.toLocaleDateString("en-CA", { timeZone: b.fuso || "America/Sao_Paulo" });
      j.mostrar("Como vai pagar?", `<p class="total-linha">Total: <b>${C.dinheiro(totalDe(e))}</b></p><div class="opcoes">
        ${formas.map((f) => `<button class="opcao" data-f="${f}"><b>${FORMAS[f]}</b><small>${f === "pix" ? "QR Code com o valor certo" : f === "dinheiro" ? "Pague no balcão" : f === "debito" || f === "credito" ? "Pague na maquininha, no balcão" : `Pague até ${b.prazo_dias} dias depois`}</small></button>`).join("")}</div>
        <div class="campo oculto" id="prazo-data" style="margin-top:.75rem"><label for="pd">Data em que vai pagar</label><input id="pd" type="date" min="${ymd(hoje)}" max="${ymd(max)}"></div>`,
        [...(e.tipo === "servico" && !e.quandoFixo ? [voltar("quando")] : [])]);
      $$("[data-f]", j.el).forEach((bt) => (bt.onclick = () => {
        if (bt.dataset.f === "prazo") {
          $("#prazo-data", j.el).classList.remove("oculto");
          const conf = document.createElement("button"); conf.className = "btn"; conf.textContent = "Confirmar data";
          conf.onclick = () => {
            const v = $("#pd", j.el).value;
            if (!v || v < ymd(hoje) || v > ymd(max)) return U.aviso(`Escolha uma data até ${max.toLocaleDateString("pt-BR")}.`, "erro");
            e.forma = "prazo"; e.prazo_data = v; passo();
          };
          const rod = $(".modal-rodape", j.el); if (!$(".btn:not(.sec)", rod)) rod.appendChild(conf);
          return;
        }
        e.forma = bt.dataset.f; e.prazo_data = null; passo();
      }));
      if (!formas.length) $(".modal-corpo", j.el).insertAdjacentHTML("beforeend", `<p class="suave">Nenhuma forma de pagamento disponível. Fale com a barbearia.</p>`);
    }
    function pDados() {
      j.mostrar("Seus dados", `
        <div class="campo"><label for="d-nome">Seu nome</label><input id="d-nome" maxlength="60" autocomplete="name" value="${esc(e.nome)}"></div>
        ${precisaZap() ? `<div class="campo"><label for="d-zap">WhatsApp com DDD</label><input id="d-zap" type="tel" inputmode="tel" autocomplete="tel" placeholder="(91) 98888-7777" value="${esc(e.whatsapp)}">
          <p class="pequeno suave">${e.forma === "prazo" ? "Para a barbearia combinar o pagamento com você." : "Para a barbearia avisar sobre o seu horário."}</p></div>` : ""}`, [
        { rotulo: "Voltar", classe: "sec", acao: () => { delete e.forma; passo(); } },
        { rotulo: "Continuar", acao: () => {
          const nome = $("#d-nome", j.el).value.trim();
          if (nome.length < 2) return U.aviso("Digite o seu nome.", "erro");
          e.nome = nome; guardar("bs_nome", nome);
          if (precisaZap()) {
            const z = $("#d-zap", j.el).value.trim();
            if (z.replace(/\D/g, "").length < 10) return U.aviso("Informe seu WhatsApp com DDD.", "erro");
            e.whatsapp = z; guardar("bs_whats", z);
          }
          e.dadosOk = true; passo();
        } },
      ]);
      $("#d-nome", j.el).focus();
    }
    function pBarbeiro() {
      j.mostrar("Selecione o barbeiro", `<div class="opcoes">${barbeiros.map((br, i) => `<button class="opcao barbeiro-op" data-i="${i}">
          ${br.foto ? `<img src="${esc(br.foto)}" alt="">` : `<span class="avatar">${esc(iniciais(br.nome))}</span>`}
          <span><b>${esc(br.nome)}</b><small>${(br.fila || []).length ? `${br.fila.length} na fila` : "Sem fila"}</small></span></button>`).join("")}</div>`,
        [{ rotulo: "Voltar", classe: "sec", acao: () => { e.dadosOk = false; passo(); } }]);
      $$("[data-i]", j.el).forEach((bt) => (bt.onclick = () => { e.barbeiro = barbeiros[Number(bt.dataset.i)]; passo(); }));
    }
    async function pHorario() {
      const dias = [];
      for (let k = 0; k < 21; k++) {
        const d = new Date(Date.now() + k * 86400000);
        const ymd = d.toLocaleDateString("en-CA", { timeZone: b.fuso || "America/Sao_Paulo" });
        const dow = new Date(ymd + "T12:00:00").getDay();
        if (!H.temHorario(b.horarios) || (b.horarios && b.horarios[String(dow)])) dias.push({ ymd, dow, rot: k === 0 ? "Hoje" : k === 1 ? "Amanhã" : H.DIAS_CURTOS[dow] + " " + ymd.slice(8, 10) + "/" + ymd.slice(5, 7) });
      }
      e.dia = e.dia || (dias[0] && dias[0].ymd);
      const desenharDia = async () => {
        j.mostrar(`Escolha o horário · ${e.barbeiro.nome}`, `<div class="dias-chips">${dias.map((d) => `<button class="chip" data-d="${d.ymd}" aria-pressed="${d.ymd === e.dia}">${esc(d.rot)}</button>`).join("")}</div>
          <div id="slots" class="slots"><p class="suave pequeno">Carregando horários…</p></div>`,
          [{ rotulo: "Voltar", classe: "sec", acao: () => { delete e.barbeiro; if (e.barbeiroFixo) { delete e.quando; e.barbeiro = e.barbeiroFixo; } passo(); } }]);
        $$("[data-d]", j.el).forEach((bt) => (bt.onclick = () => { e.dia = bt.dataset.d; desenharDia(); }));
        try {
          const r = await S.rpc("horarios_livres", { p_barbearia: b.id, p_barbeiro: e.barbeiro.id, p_data: e.dia });
          const alvo = $("#slots", j.el);
          if (!alvo) return;
          if (r && r.livre) {
            alvo.innerHTML = `<div class="campo"><label for="hora-livre">Horário</label><input id="hora-livre" type="time"></div><button class="btn" id="hora-ok">Usar este horário</button>`;
            $("#hora-ok", j.el).onclick = () => { const h = $("#hora-livre", j.el).value; if (!h) return U.aviso("Escolha o horário.", "erro"); e.horario = h; passo(); };
          } else if (r && r.slots && r.slots.length) {
            alvo.innerHTML = r.slots.map((h) => `<button class="chip" data-h="${h}">${h}</button>`).join("");
            $$("[data-h]", alvo).forEach((bt) => (bt.onclick = () => { e.horario = bt.dataset.h; passo(); }));
          } else alvo.innerHTML = `<p class="suave pequeno">Sem horários livres neste dia. Escolha outro.</p>`;
        } catch (err) { const alvo = $("#slots", j.el); if (alvo) alvo.innerHTML = `<p class="suave pequeno">${esc(err.message)}</p>`; }
      };
      desenharDia();
    }
    function quandoIso() {
      if (e.quando !== "agendar") return null;
      // dia/hora no relógio da barbearia → instante exato (fuso fixo do Brasil)
      const r = H.relogio(b.fuso);
      const meiaNoiteLocal = Date.UTC(...e.dia.split("-").map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))));
      return new Date(meiaNoiteLocal + H.paraMin(e.horario) * 60000 - r.desvio * 60000).toISOString();
    }
    function pResumo() {
      const linhas = e.itens.map((x) => `${x.qtd > 1 ? x.qtd + " × " : ""}${esc(x.item.nome)} — ${C.dinheiro(C.final(x.item) * x.qtd)}`);
      j.mostrar("Confira o pedido", `<ul class="resumo">${linhas.map((l) => `<li>${l}</li>`).join("")}</ul>
        <p class="total-linha">Total: <b>${C.dinheiro(totalDe(e))}</b></p>
        <dl class="resumo-dados">
          ${e.tipo === "servico" ? `<dt>Barbeiro</dt><dd>${esc(e.barbeiro.nome)}</dd><dt>Quando</dt><dd>${e.quando === "agendar" ? esc(quando(quandoIso())) : "Agora (entrar na fila)"}</dd>` : ""}
          <dt>Pagamento</dt><dd>${FORMAS[e.forma]}${e.forma === "prazo" ? " · até " + new Date(e.prazo_data + "T12:00").toLocaleDateString("pt-BR") : ""}</dd>
          <dt>Nome</dt><dd>${esc(e.nome)}</dd></dl>`, [
        { rotulo: "Voltar", classe: "sec", acao: () => { if (e.quando === "agendar") delete e.horario; else if (e.tipo === "servico" && !e.barbeiroFixo) delete e.barbeiro; else e.dadosOk = false; passo(); } },
        { rotulo: "Enviar pedido", acao: enviar },
      ]);
    }
    async function enviar() {
      const corpo = {
        p_barbearia: b.id, p_dispositivo: aparelho(), p_tipo: e.tipo,
        p_itens: e.itens.map((x) => ({ id: x.item.id, qtd: x.qtd })),
        p_barbeiro: e.tipo === "servico" ? (e.barbeiro.id || null) : null,
        p_nome: e.nome, p_whatsapp: precisaZap() ? e.whatsapp : null, p_forma: e.forma,
        p_prazo_data: e.forma === "prazo" ? e.prazo_data : null, p_agendado_para: quandoIso(),
      };
      const r = await S.rpc("criar_pedido", corpo);
      S.fn("notificar", { pedido: r.id }).catch(() => {});
      if (e.tipo === "produto") carrinho = []; else servicos = [];
      salvarSacola(); desenharLista();
      statusAntigo[r.id] = "pendente/";
      await atualizar();
      const pix = r.pix ? PIX.copiaECola(Object.assign({}, r.pix, { valor: r.total, txid: "BS" + r.id.replace(/-/g, "").slice(0, 20) })) : null;
      j.mostrar("Pedido enviado!", `<p>Seu pedido foi enviado para ${e.tipo === "servico" ? `<b>${esc(e.barbeiro.nome)}</b>` : "a barbearia"}. Aguarde a aprovação: você acompanha em <b>Meus pedidos</b>.</p>
        ${pix ? `<div class="pix-pagar"><p><b>Pague ${C.dinheiro(r.total)} com Pix</b></p>${U.qrSvg(pix, 220)}
          <p class="pequeno">Para: ${esc(r.pix.titular)} · ${esc(PIX.NOMES[r.pix.tipo])}: ${esc(PIX.mostrarChave(r.pix.tipo, r.pix.chave))}</p>
          <p class="pequeno suave">Depois de pagar, mostre o comprovante. O barbeiro confirma e aprova o seu pedido.</p></div>` : ""}
        ${["dinheiro", "debito", "credito"].includes(e.forma) && e.quando !== "agendar" ? `<p class="pequeno suave">Pague no balcão: depois que o pagamento for confirmado você entra na fila.</p>` : ""}
        ${e.quando === "agendar" ? `<p class="pequeno suave">Quando o barbeiro aprovar, seu horário fica reservado. No dia, você entra na fila na hora marcada.</p>` : ""}`, [
        ...(pix ? [{ rotulo: "Copiar Pix copia e cola", classe: "sec", acao: () => U.copiar(pix) }] : []),
        { rotulo: "Ver meus pedidos", acao: () => { j.fechar(); verMeus(); } },
      ]);
    }
    if (e.barbeiro) e.barbeiroFixo = e.barbeiro;
    if (e.quando) e.quandoFixo = true;
    if (e.tipo === "servico" && e.quando === "agora" && !aberta()) { e.quando = undefined; e.quandoFixo = false; }
    if (e.tipo === "servico" && e.barbeiro === undefined && barbeiros.length === 1) e.barbeiro = barbeiros[0];
    passo();
  }

  /* ---------- meus pedidos ---------- */
  function textoStatus(p) {
    if (p.status === "pendente") return { t: "Aguardando aprovação", c: "alerta" };
    if (p.status === "recusado") return { t: "Recusado — faça uma nova solicitação", c: "erro" };
    if (p.status === "cancelado") return { t: "Cancelado", c: "" };
    if (p.status === "concluido") return { t: p.tipo === "produto" ? "Compra confirmada" : "Atendimento concluído", c: "ok" };
    if (p.fila_status === "atendimento") return { t: "Em atendimento agora", c: "ok" };
    if (p.fila_status === "aguardando") return { t: `Na fila: você é o ${p.posicao}º`, c: "ok" };
    if (p.agendado_para) return { t: "Horário reservado", c: "ok" };
    return { t: "Aprovado", c: "ok" };
  }
  function verMeus() {
    const j = janela("Meus pedidos");
    const desenhar = () => {
      j.mostrar("Meus pedidos", meus.length ? meus.map((p) => {
        const st = textoStatus(p);
        const pode = (p.status === "pendente" || p.status === "aprovado") && p.fila_status !== "atendimento";
        return `<div class="meu-pedido"><div class="mp-topo"><span class="selo ${st.c}">${esc(st.t)}</span><b>${C.dinheiro(p.total)}</b></div>
          <div class="pequeno">${(p.itens || []).map((i) => `${i.qtd > 1 ? i.qtd + " × " : ""}${esc(i.nome)}`).join(", ")}</div>
          <div class="pequeno suave">${p.tipo === "servico" ? "Com " + esc(p.barbeiro) + " · " : ""}${p.agendado_para ? "Agendado para " + esc(quando(p.agendado_para)) : "Pedido " + esc(quando(p.criado_em))} · ${FORMAS[p.forma]}</div>
          ${pode ? `<button class="btn mini sec" data-cancelar="${p.id}">Cancelar</button>` : ""}</div>`;
      }).join("") : `<p class="suave">Nenhum pedido recente.</p>`, [{ rotulo: "Fechar", classe: "sec", acao: () => j.fechar() }]);
      $$("[data-cancelar]", j.el).forEach((bt) => (bt.onclick = async () => {
        if (!(await U.confirmar("Cancelar pedido", "Quer mesmo cancelar este pedido?", "Cancelar pedido", true))) return;
        try { await S.rpc("cancelar_pedido", { p_id: bt.dataset.cancelar, p_dispositivo: aparelho() }); await atualizar(); desenhar(); U.aviso("Pedido cancelado."); }
        catch (err) { U.aviso(err.message, "erro"); }
      }));
    };
    desenhar();
  }

  /* ---------- atualização a cada 15 s ---------- */
  async function atualizar() {
    try {
      const [f, m] = await Promise.all([
        S.rpc("fila_publica", { p_barbearia: b.id }),
        S.rpc("meus_pedidos", { p_barbearia: b.id, p_dispositivo: aparelho() }),
      ]);
      barbeiros = f || []; meus = m || [];
      meus.forEach((p) => {
        const antes = statusAntigo[p.id], agora = p.status + "/" + (p.fila_status || "");
        if (antes && antes !== agora) {
          if (p.status === "recusado") U.aviso("Seu pedido foi recusado. Faça uma nova solicitação.", "erro");
          else if (p.status === "aprovado" && p.fila_status) U.aviso(`Pedido aprovado! ${textoStatus(p).t}.`);
          else if (p.status === "aprovado") U.aviso("Agendamento confirmado!");
          else if (p.fila_status === "atendimento") U.aviso("É a sua vez!");
        }
        statusAntigo[p.id] = agora;
      });
      desenharFila(); desenharBarra();
      const el = $("#status"); if (el) el.outerHTML = statusHtml();
    } catch (err) { /* sem internet: tenta de novo no próximo ciclo */ }
  }

  /* "Ver movimentação": avisa a cada minuto que este aparelho está no site. */
  function presenca() {
    if (!b.ver_movimentacao) return;
    const avisar = () => { if (document.visibilityState === "visible") S.rpc("registrar_visita", { p_barbearia: b.id, p_visitante: aparelho() }).catch(() => {}); };
    avisar(); setInterval(avisar, 60000);
    document.addEventListener("visibilitychange", avisar);
  }

  (async function () {
    if (!S.configurado()) return telaSimples("Em configuração", "Este sistema ainda não foi configurado.");
    if (!slug) return telaSimples("Barbearia não encontrada", "Confira o link que você recebeu.");
    try { b = await S.rpc("barbearia_publica", { p_slug: slug }); }
    catch (err) { return telaSimples("Sem conexão", esc(err.message)); }
    if (!b) return telaSimples("Barbearia não encontrada", "Confira o link que você recebeu.");
    trocarIdentidade();
    if (!b.disponivel) return telaSimples(b.nome, "Temporariamente indisponível. Tente novamente mais tarde.", b.logo192_url);
    try {
      [cats, itens] = await Promise.all([
        S.rest(`categorias?barbearia_id=eq.${b.id}&select=id,tipo,nome,icone,ordem&order=ordem.asc,criado_em.asc`),
        S.rest(`itens?barbearia_id=eq.${b.id}&select=id,categoria_id,nome,preco,foto_url,desconto,destaque,esgotado,ordem&order=ordem.asc,criado_em.asc`),
      ]);
    } catch (err) { cats = []; itens = []; }
    lerSacola();
    try { [barbeiros, meus] = await Promise.all([S.rpc("fila_publica", { p_barbearia: b.id }), S.rpc("meus_pedidos", { p_barbearia: b.id, p_dispositivo: aparelho() })]); }
    catch (err) { barbeiros = []; meus = []; }
    barbeiros = barbeiros || []; meus = meus || [];
    meus.forEach((p) => (statusAntigo[p.id] = p.status + "/" + (p.fila_status || "")));
    telaBarbearia();
    presenca();
    setInterval(() => { if (document.visibilityState === "visible") atualizar(); }, 15000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") atualizar(); });
  })();
})();
