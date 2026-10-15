/* controle.js — Controle de Usuários do Wilson: cadastra empreendedores de todos os tipos
   (barbearia, loja de variedades…), com plano, tema, estilo e fonte, códigos de acesso e links. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const S = SUPA.criar("bs_sessao_controle");
  const raiz = $("#raiz");
  let barbearias = [];
  let logoNovo = null;            // { l512, l192 }
  let tipos = [];                 // tabela tipos_negocio (vem do banco pela função admin)
  let filtroTipo = "";
  const visualNovo = { tema: "claro", estilo: "comum", fonte: "inter" };
  const TIPOS_PADRAO = [{ id: "barbearia", nome: "Barbearia", ativo: true }, { id: "loja", nome: "Loja de Variedades", ativo: true }, { id: "lanchonete", nome: "Lanchonete", ativo: false }];
  const nomeTipo = (id) => ((tipos.length ? tipos : TIPOS_PADRAO).find((t) => t.id === (id || "barbearia")) || {}).nome || "Barbearia";
  const opcoesTipo = (atual) => (tipos.length ? tipos : TIPOS_PADRAO).map((t) => `<option value="${t.id}"${t.id === (atual || "barbearia") ? " selected" : ""}${t.ativo ? "" : " disabled"}>${esc(t.nome)}${t.ativo ? "" : " (em breve)"}</option>`).join("");
  // a página do Wilson tem o próprio visual: preto e dourado, como o logo do aperto de mãos
  U.aparencia({ tema: "escuro", estilo: "elegante", fonte: "inter" });

  const linkApp = () => new URL("../app/", location.href).href;
  const linkCliente = (slug) => new URL("../c/?b=" + encodeURIComponent(slug), location.href).href;

  function situacao(b) {
    if (!b.ativo) return { txt: "Inativo", cls: "erro" };
    const d = U.diasAte(b.expira_em);
    if (d !== null && d <= 0) return { txt: "Vencido", cls: "erro" };
    if (d !== null && d <= 5) return { txt: `Vence em ${d} dia${d > 1 ? "s" : ""}`, cls: "alerta" };
    return { txt: "Ativo", cls: "ok" };
  }
  const codigoDe = (b) => {
    const c = Array.isArray(b.codigos_acesso) ? b.codigos_acesso[0] : b.codigos_acesso;
    return c && c.codigo ? c : null;
  };

  function mensagemAcesso(b) {
    const c = codigoDe(b);
    const linhas = [
      `Olá! O sistema da *${b.nome}* está pronto.${(b.tipo || "barbearia") === "barbearia" ? " ✂️" : ""}`,
      "",
      `*Seu painel:* ${linkApp()}`,
      `*E-mail:* ${b.email}`,
    ];
    if (c) {
      linhas.push(`*Código de primeiro acesso:* ${c.codigo} (vale até ${U.data(c.expira_em)})`, "",
        "No painel, toque em *Primeiro acesso*, digite o e-mail, o código e crie sua senha.");
    } else {
      linhas.push("", "Entre com seu e-mail e senha. Se esquecer a senha, toque em *Esqueci a senha*.");
    }
    linhas.push("", `*Link para seus clientes:* ${linkCliente(b.slug)}`, "",
      "Para instalar como aplicativo: no Android, menu ⋮ → Instalar app. No iPhone, abra no Safari → Compartilhar → Adicionar à Tela de Início.");
    return linhas.join("\n");
  }

  /* =================== login =================== */
  function telaLogin() {
    raiz.innerHTML = `<main class="entrada"><div class="cartao">
      <img class="marca" src="icones/icone-192.png" alt="">
      <h1>Controle de Usuários</h1>
      <p class="sub">Acesso do administrador</p>
      ${S.configurado() ? "" : `<div class="aviso-config">Preencha o arquivo <b>config.js</b> com a URL e a chave pública do Supabase.</div>`}
      <form id="f-login" novalidate>
        <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password" required></div>
        <div class="campo"><label class="linha-check"><input id="manter" type="checkbox" checked> Manter-me conectado</label></div>
        <button class="btn bloco" type="submit">Entrar</button>
      </form></div></main>`;
    $("#f-login").onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("#f-login button[type=submit]");
      await U.ocupado(btn, async () => {
        try {
          await S.entrar($("#email").value, $("#senha").value, $("#manter").checked);
          await S.fn("admin", { acao: "ping" });
          telaPainel();
        } catch (err) {
          if (err.status === 403) await S.sair();
          U.aviso(err.message, "erro");
        }
      });
    };
  }

  /* =================== painel =================== */
  function telaPainel() {
    raiz.innerHTML = `
      <header class="topo-ctrl"><div class="topo-ctrl-in"><img class="marca-ctrl" src="icones/icone-192.png" alt=""><div class="topo-ctrl-txt"><h1>Controle de Usuários</h1><div class="rotulo">Empreendedores, planos e acessos</div></div>
        <button class="btn sec mini" id="sair">${U.icone("sair")}Sair</button></div></header>
      <main class="conteudo">
        <section class="cartao">
          <h2>Cadastrar empreendedor</h2>
          <form id="f-nova" novalidate>
            <div class="grade-form">
              <div class="campo"><label for="n-tipo">Tipo de negócio</label><select id="n-tipo">${opcoesTipo("barbearia")}</select></div>
              <div class="campo"><label for="n-nome">Nome do negócio</label><input id="n-nome" maxlength="80" placeholder="Ex.: Barbearia do Zé"></div>
              <div class="campo"><label for="n-email">E-mail de acesso do dono</label><input id="n-email" type="email" placeholder="dono@gmail.com"></div>
              <div class="campo"><label for="n-plano">Plano</label><select id="n-plano">${U.PLANOS.map(([v, t]) => `<option value="${v}"${v === "30" ? " selected" : ""}>${t}</option>`).join("")}</select></div>
              <div class="campo largo"><label for="n-logo">Logo do negócio</label>
                <div class="logo-escolha"><div class="logo-previa" id="n-previa">sem logo</div>
                <input id="n-logo" type="file" accept="image/png,image/jpeg,image/webp"></div></div>
            </div>
            <div class="ap-cadastro">
              <div id="n-aparencia">${U.aparenciaHtml(visualNovo)}</div>
              <div class="previa-lado"><div class="rotulo-previa">Prévia do app do cliente</div><div id="n-previa-app"></div></div>
            </div>
            <div class="linha-acoes" style="margin-top:1rem"><button class="btn" type="submit">Cadastrar e gerar link</button></div>
          </form>
        </section>
        <section class="cartao">
          <h2>Negócios cadastrados</h2>
          <div class="barra-lista"><input id="busca" type="search" placeholder="Buscar por nome ou e-mail…" aria-label="Buscar">
            <div class="chips-linha filtro-tipo" id="filtro-tipo" role="group" aria-label="Filtrar por tipo"></div>
            <button class="btn sec mini" id="atualizar">${U.icone("rolar")}Atualizar</button><span class="contador" id="contador"></span></div>
          <div class="lista" id="lista"><p class="vazio">Carregando…</p></div>
        </section>
      </main>`;
    $("#sair").onclick = async () => { await S.sair(); telaLogin(); };
    $("#n-logo").onchange = async (e) => {
      try {
        const img = await U.lerImagem(e.target.files[0]);
        const gerar = await U.recortarCirculo(img);
        if (!gerar) { if (!logoNovo) e.target.value = ""; return; }
        logoNovo = { l512: gerar(512), l192: gerar(192) };
        const p = $("#n-previa"); p.textContent = ""; p.style.backgroundImage = `url(${logoNovo.l192})`;
        pintarPrevia();
      } catch (err) { logoNovo = null; e.target.value = ""; U.aviso(err.message, "erro"); }
    };
    $("#f-nova").onsubmit = cadastrar;
    U.ligarAparencia($("#n-aparencia"), (campo, valor) => { visualNovo[campo] = valor; pintarPrevia(); });
    $("#n-tipo").onchange = pintarPrevia; $("#n-nome").oninput = pintarPrevia;
    pintarPrevia();
    $("#busca").oninput = desenharLista;
    $("#atualizar").onclick = carregar;
    carregar();
  }

  /* prévia: um pedaço do app do cliente desenhado com a cor, o estilo e a fonte escolhidos */
  function previaHtml(v, nome, tipo, logo) {
    const loja = (tipo || "barbearia") !== "barbearia";
    const itens = loja ? [["Boné aba reta", "R$ 49,90"], ["Garrafa térmica", "R$ 35,00"]] : [["Corte degradê", "R$ 35,00"], ["Barba completa", "R$ 20,00"]];
    return `<div class="previa-ap">
      <div class="cabeca"><div class="barra">${logo ? `<img src="${esc(logo)}" alt="">` : `<span class="logo-vazio">${esc((nome || "N").trim()[0] || "N").toUpperCase()}</span>`}
        <div class="cab-textos"><h1>${esc(nome || "Nome do negócio")}</h1><span class="status-pill aberto">Aberto agora</span></div></div></div>
      <div class="barra-cat"><span class="chip" aria-pressed="true">${loja ? "Bonés" : "Cortes"}</span><span class="chip">${loja ? "Utilidades" : "Barba"}</span></div>
      <div class="previa-corpo"><div class="grade-itens">${itens.map(([n, p]) => `<article class="item-card sem-foto"><div class="etiqueta-corpo">
        <div class="item-foto"><img src="${CARD_IMG(loja)}" alt=""></div><div class="item-info"><h3>${n}</h3><span class="preco"><b>${p}</b></span></div>
        <div class="item-acoes"><span class="btn">${loja ? "Adicionar" : "Solicitar"}</span></div></div></article>`).join("")}</div></div></div>`;
  }
  const CARD_IMG = (loja) => "data:image/svg+xml," + encodeURIComponent(loja
    ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#1d1b18" stroke-width="5" stroke-linejoin="round"><path d="M30 44 h60 l-6 52 h-48 z"/><path d="M46 44 v-8 a14 14 0 0 1 28 0 v8"/></g></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="none" stroke="#1d1b18" stroke-width="5" stroke-linecap="round"><circle cx="34" cy="86" r="11"/><circle cx="58" cy="94" r="11"/><path d="M41 77 L82 22"/><path d="M52 84 L70 28"/></g></svg>');
  /* a prévia roda numa moldura própria (iframe), para o estilo desta página não se misturar com o escolhido */
  function pintarPrevia() {
    const alvo = $("#n-previa-app");
    if (!alvo) return;
    const v = visualNovo, base = new URL("../", location.href).href;
    const doc = `<!doctype html><html lang="pt-BR" data-tema="${esc(v.tema)}" data-estilo="${esc(v.estilo)}" data-fonte="${esc(v.fonte)}"><head><meta charset="utf-8"><base href="${esc(base)}">
      <link rel="stylesheet" href="css/base.css"><link rel="stylesheet" href="css/fontes.css"><link rel="stylesheet" href="css/cardapio.css">
      <link rel="stylesheet" href="c/cliente.css"><link rel="stylesheet" href="controle/controle.css"><link rel="stylesheet" href="css/elegante.css">
      <style>html,body{min-height:100%}body{margin:0;min-height:100vh}</style></head><body>${previaHtml(v, $("#n-nome").value.trim(), $("#n-tipo").value, logoNovo && logoNovo.l192)}</body></html>`;
    let f = $("iframe", alvo);
    if (!f) { alvo.innerHTML = `<iframe class="previa-frame" title="Prévia do app do cliente" tabindex="-1" loading="lazy"></iframe>`; f = $("iframe", alvo); }
    f.srcdoc = doc;
  }

  async function carregar() {
    try {
      const [lista, ts] = await Promise.all([S.fn("admin", { acao: "listar" }), S.fn("admin", { acao: "tipos" }).catch(() => null)]);
      if (Array.isArray(ts) && ts.length) tipos = ts;
      barbearias = lista || [];
      desenharLista();
    } catch (err) {
      if (err.status === 401) { S.esquecer(); return telaLogin(); }
      $("#lista").innerHTML = `<p class="vazio">${esc(err.message)}</p>`;
    }
  }

  async function cadastrar(e) {
    e.preventDefault();
    const nome = $("#n-nome").value.trim(), email = $("#n-email").value.trim();
    if (!nome) return U.aviso("Informe o nome do negócio.", "erro");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return U.aviso("Informe um e-mail válido.", "erro");
    if (!logoNovo) return U.aviso("Escolha o logo do negócio.", "erro");
    await U.ocupado($("#f-nova button"), async () => {
      try {
        const b = await S.fn("admin", { acao: "criar", nome, email, plano: $("#n-plano").value, logo: logoNovo.l512, logo192: logoNovo.l192,
          tipo: $("#n-tipo").value, tema: visualNovo.tema, estilo: visualNovo.estilo, fonte: visualNovo.fonte });
        barbearias.unshift(b);
        $("#f-nova").reset(); logoNovo = null;
        const p = $("#n-previa"); p.style.backgroundImage = ""; p.textContent = "sem logo";
        pintarPrevia(); desenharLista();
        U.aviso(`${nomeTipo(b.tipo)} cadastrada!`);
        mostrarAcesso(b, "Acesso criado");
      } catch (err) { U.aviso(err.message, "erro"); }
    });
  }

  function desenharLista() {
    const q = $("#busca").value.trim().toLowerCase();
    const presentes = [...new Set(barbearias.map((b) => b.tipo || "barbearia"))];
    if (filtroTipo && !presentes.includes(filtroTipo)) filtroTipo = "";
    $("#filtro-tipo").innerHTML = presentes.length > 1 ? [["", "Todos"]].concat(presentes.map((t) => [t, nomeTipo(t)])).map(([id, rot]) =>
      `<button type="button" class="chip" data-tipo="${id}" aria-pressed="${id === filtroTipo}">${esc(rot)} <span class="num">${id ? barbearias.filter((b) => (b.tipo || "barbearia") === id).length : barbearias.length}</span></button>`).join("") : "";
    $$("#filtro-tipo .chip").forEach((c) => (c.onclick = () => { filtroTipo = c.dataset.tipo; desenharLista(); }));
    const lista = barbearias.filter((b) => (!filtroTipo || (b.tipo || "barbearia") === filtroTipo) && (!q || b.nome.toLowerCase().includes(q) || b.email.toLowerCase().includes(q)));
    $("#contador").textContent = `${lista.length} de ${barbearias.length} negócio(s)`;
    if (!lista.length) {
      $("#lista").innerHTML = `<p class="vazio">${barbearias.length ? "Nada encontrado." : "Nenhum negócio cadastrado ainda."}</p>`;
      return;
    }
    $("#lista").innerHTML = lista.map((b) => {
      const s = situacao(b), c = codigoDe(b);
      return `<article class="item" data-id="${b.id}">
        <img src="${esc(b.logo192_url || "icones/icone-192.png")}" alt="" loading="lazy">
        <div>
          <h3>${esc(b.nome)}</h3>
          <div class="pequeno suave">${esc(b.email)}</div>
          <div class="meta"><span>Plano: <b>${esc(U.nomePlano(b.plano))}</b></span><span>Expira: <b>${b.expira_em ? U.data(b.expira_em) : "nunca"}</b></span>
            <span class="meta-ap"><i class="ponto-tema" data-tema="${esc(b.tema || "claro")}"></i>${esc(((U.TEMAS.find((t) => t[0] === (b.tema || "claro")) || [])[1]) || "")} · ${esc(((U.ESTILOS.find((t) => t[0] === (b.estilo || "comum")) || [])[1]) || "")} · ${esc(((U.FONTES.find((t) => t[0] === (b.fonte || "barlow")) || [])[1]) || "")}</span></div>
          <div class="selos"><span class="selo tipo-selo">${esc(nomeTipo(b.tipo))}</span><span class="selo ${s.cls}">${s.txt}</span>
            ${c ? `<span class="selo alerta">Aguardando acesso</span> <span class="codigo" title="Código de acesso">${esc(c.codigo)}</span>` : `<span class="selo ok">Senha criada</span>`}</div>
        </div>
        <div class="acoes">
          <button class="btn mini" data-a="acesso">Copiar acesso</button>
          <button class="btn mini sec" data-a="whats">WhatsApp</button>
          <button class="btn mini sec" data-a="cliente">Link do cliente</button>
          <button class="btn mini sec" data-a="renovar">Renovar</button>
          <button class="btn mini sec" data-a="codigo">Novo código</button>
          <button class="btn mini sec" data-a="editar">Editar</button>
          <button class="btn mini sec" data-a="ativar">${b.ativo ? "Inativar" : "Ativar"}</button>
          <button class="btn mini perigo" data-a="excluir">Excluir</button>
        </div></article>`;
    }).join("");
    $$("#lista [data-a]").forEach((bt) => {
      bt.onclick = () => {
        const b = barbearias.find((x) => x.id === bt.closest(".item").dataset.id);
        ({ acesso: () => U.copiar(mensagemAcesso(b)), whats: () => U.whatsapp(mensagemAcesso(b)), cliente: () => mostrarCliente(b),
           renovar: () => renovar(b), codigo: () => novoCodigo(b), editar: () => editar(b), ativar: () => alternar(b, bt), excluir: () => excluir(b) })[bt.dataset.a]();
      };
    });
  }

  function trocar(b) {
    const i = barbearias.findIndex((x) => x.id === b.id);
    if (i >= 0) barbearias[i] = b;
    desenharLista();
  }

  function mostrarAcesso(b, titulo) {
    return U.modal(titulo || "Mensagem de acesso", `<p>Envie esta mensagem para o dono:</p><div class="mensagem">${esc(mensagemAcesso(b))}</div>`, [
      { rotulo: "WhatsApp", classe: "sec", fica: true, antes: () => { U.whatsapp(mensagemAcesso(b)); } },
      { rotulo: "Copiar mensagem", fica: true, antes: () => U.copiar(mensagemAcesso(b)) },
    ]);
  }

  function mostrarCliente(b) {
    const link = linkCliente(b.slug);
    const barbearia = (b.tipo || "barbearia") === "barbearia";
    U.modal("Link do cliente", `<p class="pequeno suave">${esc(b.nome)} — este é o link que os clientes usam para ${barbearia ? "ver cortes, produtos e a fila" : "ver os produtos e fazer pedidos"}, e para instalar o app.</p>
      ${U.qrSvg(link, 220)}<p class="centro pequeno" style="word-break:break-all;margin-top:.75rem">${esc(link)}</p>`, [
      { rotulo: "Baixar QR Code", classe: "sec", fica: true, antes: () => baixarQr(b, link) },
      { rotulo: "Copiar link", fica: true, antes: () => U.copiar(link) },
    ]);
  }
  function baixarQr(b, link) {
    return new Promise((ok) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      const fim = () => { const png = U.qrPng(link, b.nome, img.naturalWidth ? img : null, U.FRASE_QR) || U.qrPng(link, b.nome, null, U.FRASE_QR); U.baixar(png, `qrcode-${b.slug}.png`); ok(); };
      img.onload = fim; img.onerror = () => { img.removeAttribute("src"); fim(); };
      img.src = b.logo192_url || "";
      if (!b.logo192_url) fim();
    });
  }

  async function renovar(b) {
    const opc = U.PLANOS.map(([v, t]) => `<option value="${v}"${v === b.plano ? " selected" : ""}>${t}</option>`).join("");
    const aberto = U.modal("Renovar plano", `<p><b>${esc(b.nome)}</b><br><span class="pequeno suave">Hoje expira: ${b.expira_em ? U.data(b.expira_em) : "nunca (vitalício)"}. O novo plano soma ao tempo que ainda falta.</span></p>
      <div class="campo"><label for="r-plano">Plano</label><select id="r-plano">${opc}</select></div><p class="pequeno" id="r-previa"></p>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Renovar", antes: async (m) => {
        const nova = await S.fn("admin", { acao: "renovar", id: b.id, plano: $("#r-plano", m).value });
        trocar(nova); U.aviso("Plano renovado até " + (nova.expira_em ? U.data(nova.expira_em) : "sempre") + ".");
      } },
    ]);
    const sel = $("#r-plano");
    const previa = () => {
      const v = sel.value, dias = v === "vitalicio" ? null : Number(v);
      const base = b.expira_em && new Date(b.expira_em) > new Date() ? new Date(b.expira_em) : new Date();
      $("#r-previa").textContent = dias === null ? "Novo vencimento: nunca (vitalício)."
        : "Novo vencimento: " + new Date(base.getTime() + dias * 86400000).toLocaleDateString("pt-BR") + ".";
    };
    sel.onchange = previa; previa();
    await aberto;
  }

  async function novoCodigo(b) {
    const ok = await U.confirmar("Novo código de acesso",
      `Gerar um novo código para <b>${esc(b.nome)}</b>?<br><br>A senha atual do dono <b>deixa de funcionar</b>. Ele vai usar o código em “Primeiro acesso” para criar uma senha nova.`, "Gerar código");
    if (!ok) return;
    try {
      const nova = await S.fn("admin", { acao: "novo_codigo", id: b.id });
      trocar(nova); mostrarAcesso(nova, "Novo código gerado");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  async function editar(b) {
    let logo = null;
    const visual = { tema: b.tema || "claro", estilo: b.estilo || "comum", fonte: b.fonte || "barlow" };
    const fundo = U.modal("Editar negócio", `
      <div class="campo"><label for="e-tipo">Tipo de negócio</label><select id="e-tipo">${opcoesTipo(b.tipo)}</select>
        <p class="pequeno suave" style="margin-top:.35rem">Trocar o tipo muda o que aparece no painel e no app do cliente (ex.: a loja não tem fila nem serviços).</p></div>
      <div class="campo"><label for="e-nome">Nome</label><input id="e-nome" maxlength="80" value="${esc(b.nome)}"></div>
      <div class="campo"><label for="e-email">E-mail de acesso</label><input id="e-email" type="email" value="${esc(b.email)}"></div>
      <div class="campo"><label for="e-logo">Trocar logo (opcional)</label>
        <div class="logo-escolha"><div class="logo-previa" id="e-previa" style="background-image:url('${esc(b.logo192_url || "")}')"></div>
        <input id="e-logo" type="file" accept="image/png,image/jpeg,image/webp"></div>
        ${b.logo_url ? `<button class="btn sec pequeno" id="e-arredondar" type="button" style="margin-top:.5rem">◯ Ajustar o recorte do logo atual</button>` : ""}</div>
      <div id="e-aparencia">${U.aparenciaHtml(visual)}</div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: async (m) => {
        const corpo = { acao: "editar", id: b.id, nome: $("#e-nome", m).value, email: $("#e-email", m).value, tipo: $("#e-tipo", m).value,
          tema: visual.tema, estilo: visual.estilo, fonte: visual.fonte };
        if (logo) { corpo.logo = logo.l512; corpo.logo192 = logo.l192; }
        const nova = await S.fn("admin", corpo);
        trocar(nova); U.aviso("Alterações salvas.");
      } },
    ]);
    U.ligarAparencia($("#e-aparencia"), (campo, valor) => { visual[campo] = valor; });
    const arred = $("#e-arredondar");
    if (arred) arred.onclick = () => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = async () => {
        try {
          const gerar = await U.recortarCirculo(img);
          if (!gerar) return;
          logo = { l512: gerar(512), l192: gerar(192) };
          $("#e-previa").style.backgroundImage = `url(${logo.l192})`;
          arred.textContent = "✓ Recorte pronto — toque em Salvar";
        } catch (err) { U.aviso("Não foi possível ler o logo atual. Escolha o arquivo do logo de novo.", "erro"); }
      };
      img.onerror = () => U.aviso("Não foi possível abrir o logo atual. Escolha o arquivo do logo de novo.", "erro");
      img.src = b.logo_url;
    };
    $("#e-logo").onchange = async (e) => {
      try {
        const img = await U.lerImagem(e.target.files[0]);
        const gerar = await U.recortarCirculo(img);
        if (!gerar) { e.target.value = ""; return; }
        logo = { l512: gerar(512), l192: gerar(192) };
        $("#e-previa").style.backgroundImage = `url(${logo.l192})`;
      } catch (err) { logo = null; U.aviso(err.message, "erro"); }
    };
    await fundo;
  }

  async function alternar(b, bt) {
    if (b.ativo) {
      const ok = await U.confirmar("Inativar link", `Inativar <b>${esc(b.nome)}</b>? O site dos clientes mostra “temporariamente indisponível” e o painel do dono fica só para consulta.`, "Inativar", true);
      if (!ok) return;
    }
    await U.ocupado(bt, async () => {
      try {
        const nova = await S.fn("admin", { acao: "ativar", id: b.id, ativo: !b.ativo });
        trocar(nova); U.aviso(nova.ativo ? "Link ativado." : "Link inativado.");
      } catch (err) { U.aviso(err.message, "erro"); }
    });
  }

  async function excluir(b) {
    await U.modal("Excluir negócio", `<p>Isso apaga <b>${esc(b.nome)}</b> para sempre: conta do dono, equipe, logo e todos os dados. Não dá para desfazer.</p>
      <div class="campo"><label for="x-conf">Para confirmar, digite EXCLUIR</label><input id="x-conf" autocomplete="off"></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Excluir para sempre", classe: "perigo", antes: async (m) => {
        if ($("#x-conf", m).value.trim().toUpperCase() !== "EXCLUIR") { U.aviso("Digite EXCLUIR para confirmar.", "erro"); return false; }
        await S.fn("admin", { acao: "excluir", id: b.id });
        barbearias = barbearias.filter((x) => x.id !== b.id); desenharLista(); U.aviso("Negócio excluído.");
      } },
    ]);
  }

  /* =================== início =================== */
  (async function () {
    if (!S.sessao()) return telaLogin();
    try { await S.fn("admin", { acao: "ping" }); telaPainel(); }
    catch (err) { if (err.status === 401 || err.status === 403) S.esquecer(); telaLogin(); if (err.status !== 401) U.aviso(err.message, "erro"); }
  })();
})();
