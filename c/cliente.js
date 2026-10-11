/* cliente.js — página do cliente de cada barbearia (?b=apelido-da-barbearia).
   Fase 2: cardápio (categorias, destaques, itens), status aberto/fechado, tema.
   Pedidos, fila e agendamento entram na Fase 3. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO, H = HORARIO;
  const S = SUPA.criar("bs_sessao_cliente");
  const raiz = $("#raiz");
  const slug = (new URLSearchParams(location.search).get("b") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
  let b = null, cats = [], itens = [], atual = null, busca = "";

  U.registrarSW("sw.js");

  function trocarIdentidade() {
    document.title = b.nome;
    $("#apple-titulo").setAttribute("content", b.nome.slice(0, 20));
    if (b.logo192_url) { $("#favicon").href = b.logo192_url; $("#apple-icon").href = b.logo_url || b.logo192_url; }
    document.documentElement.dataset.tema = b.tema || "claro";
    if (b.cor_barra) {
      const n = parseInt(b.cor_barra.slice(1), 16), luz = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      document.documentElement.style.setProperty("--cor-barra", b.cor_barra);
      document.documentElement.style.setProperty("--cor-barra-texto", luz > 160 ? "#1d1b18" : "#ffffff");
    }
  }

  function telaSimples(titulo, texto, logo) {
    raiz.innerHTML = `<main class="indisponivel"><div>
      ${logo ? `<img src="${esc(logo)}" alt="">` : ""}
      <h1>${esc(titulo)}</h1><p class="suave">${texto}</p></div></main>`;
  }

  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const tipoDe = (it) => (cats.find((c) => c.id === it.categoria_id) || {}).tipo;
  const visiveis = () => itens.filter((i) => !i.esgotado);

  function statusHtml() {
    const st = H.situacao(b);
    return `<span class="status-pill ${st.aberto ? "aberto" : st.motivo === "almoco" ? "almoco" : "fechado"}" id="status">${esc(H.texto(st))}</span>`;
  }

  function telaBarbearia() {
    raiz.innerHTML = `
      <div class="fixo">
        <header class="cabeca"><div class="barra">
          <img src="${esc(b.logo192_url || "")}" alt="">
          <div class="cab-textos"><h1>${esc(b.nome)}</h1>${statusHtml()}</div>
          ${U.instalado() ? "" : `<button class="btn mini" id="instalar">Instalar app</button>`}
        </div>
        <div class="busca-linha"><input id="busca" type="search" placeholder="Buscar corte, barba ou produto…" aria-label="Buscar" autocomplete="off"></div>
        </header>
        <nav class="barra-cat" id="cats" aria-label="Categorias"></nav>
      </div>
      <main class="corpo-cli">
        <section class="destaques oculto" id="destaques"></section>
        <section class="fila-cli cartao" id="fila"><h2>Fila online</h2>
          <p class="pequeno suave">Em breve você poderá ver a fila de cada barbeiro, pedir seu corte e agendar por aqui.</p></section>
        <section id="lista"></section>
      </main>`;
    if ($("#instalar")) $("#instalar").onclick = () => U.instalar();
    $("#busca").oninput = (e) => { busca = e.target.value.trim(); desenharLista(); };
    desenharCats();
    C.carrossel($("#destaques"), visiveis().filter((i) => i.destaque), tipoDe);
    desenharLista();
  }

  function desenharCats() {
    const comItens = cats.filter((c) => visiveis().some((i) => i.categoria_id === c.id));
    if (!comItens.some((c) => c.id === atual)) atual = comItens[0] ? comItens[0].id : null;
    $("#cats").classList.toggle("oculto", !comItens.length);
    $("#cats").innerHTML = comItens.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === atual}">${c.icone ? `<span aria-hidden="true">${esc(c.icone)}</span>` : ""}${esc(c.nome)}</button>`).join("");
    $$("#cats .chip").forEach((ch) => (ch.onclick = () => {
      atual = ch.dataset.cat; busca = ""; $("#busca").value = "";
      desenharCats(); desenharLista();
      const alvo = $("#lista"); const topo = alvo.getBoundingClientRect().top + window.scrollY - $(".fixo").offsetHeight - 8;
      if (window.scrollY > topo) window.scrollTo({ top: topo, behavior: "smooth" });
    }));
  }

  function desenharLista() {
    const alvo = $("#lista");
    if (busca) {
      const q = norm(busca);
      const achados = visiveis().filter((i) => norm(i.nome).includes(q) || norm((cats.find((c) => c.id === i.categoria_id) || {}).nome).includes(q));
      alvo.innerHTML = `<h2 class="titulo-lista">Resultados para “${esc(busca)}”</h2>` + (achados.length
        ? `<div class="grade-itens">${achados.map((it) => C.cartao(it, tipoDe(it))).join("")}</div>`
        : `<div class="vazio-cardapio">Nada encontrado.</div>`);
      $$("#cats .chip").forEach((ch) => ch.setAttribute("aria-pressed", "false"));
      return;
    }
    $$("#cats .chip").forEach((ch) => ch.setAttribute("aria-pressed", String(ch.dataset.cat === atual)));
    const cat = cats.find((c) => c.id === atual);
    if (!cat) { alvo.innerHTML = `<div class="vazio-cardapio">O cardápio ainda está sendo montado.</div>`; return; }
    const lista = visiveis().filter((i) => i.categoria_id === cat.id);
    alvo.innerHTML = `<h2 class="titulo-lista">${cat.icone ? esc(cat.icone) + " " : ""}${esc(cat.nome)}</h2>
      <div class="grade-itens">${lista.map((it) => C.cartao(it, cat.tipo)).join("")}</div>`;
  }

  /* "Ver movimentação": avisa a cada minuto que este aparelho está no site. */
  function idVisitante() {
    let id = null;
    try { id = localStorage.getItem("bs_visitante"); } catch (e) { /* sem armazenamento */ }
    if (!id) {
      id = "v-" + Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, "0")).join("");
      try { localStorage.setItem("bs_visitante", id); } catch (e) { /* só nesta visita */ }
    }
    return id;
  }
  function presenca() {
    if (!b.ver_movimentacao) return;
    const id = idVisitante();
    const avisar = () => { if (document.visibilityState === "visible") S.rpc("registrar_visita", { p_barbearia: b.id, p_visitante: id }).catch(() => {}); };
    avisar(); setInterval(avisar, 60000);
    document.addEventListener("visibilitychange", avisar);
  }

  (async function () {
    if (!S.configurado()) return telaSimples("Em configuração", "Este sistema ainda não foi configurado.");
    if (!slug) return telaSimples("Barbearia não encontrada", "Confira o link que você recebeu.");
    try {
      b = await S.rpc("barbearia_publica", { p_slug: slug });
    } catch (err) { return telaSimples("Sem conexão", esc(err.message)); }
    if (!b) return telaSimples("Barbearia não encontrada", "Confira o link que você recebeu.");
    trocarIdentidade();
    if (!b.disponivel) return telaSimples(b.nome, "Temporariamente indisponível. Tente novamente mais tarde.", b.logo192_url);
    try {
      [cats, itens] = await Promise.all([
        S.rest(`categorias?barbearia_id=eq.${b.id}&select=id,tipo,nome,icone,ordem&order=ordem.asc,criado_em.asc`),
        S.rest(`itens?barbearia_id=eq.${b.id}&select=id,categoria_id,nome,preco,foto_url,desconto,destaque,esgotado,ordem&order=ordem.asc,criado_em.asc`),
      ]);
    } catch (err) { cats = []; itens = []; }
    telaBarbearia();
    presenca();
    setInterval(() => { const el = $("#status"); if (el) el.outerHTML = statusHtml(); }, 60000);
  })();
})();
