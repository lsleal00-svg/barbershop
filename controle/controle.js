/* controle.js — painel de controle do Wilson (barbearias, planos e links). */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const S = SUPA.criar("bs_sessao_controle");
  const raiz = $("#raiz");
  let barbearias = [];
  let logoNovo = null;            // { l512, l192 }

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
      `Olá! O sistema da *${b.nome}* está pronto. ✂️`,
      "",
      `*Seu painel (barbeiro):* ${linkApp()}`,
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
      <img class="marca" src="../app/icones/icone-192.png" alt="">
      <h1>Controle de Barbearias</h1>
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
      <header class="topo-ctrl"><div><div class="rotulo">Painel de administração</div><h1>Controle de Barbearias</h1></div>
        <button class="btn sec mini" id="sair">Sair</button></header>
      <main class="conteudo">
        <section class="cartao">
          <h2>Cadastrar barbearia</h2>
          <form id="f-nova" class="grade-form" novalidate>
            <div class="campo"><label for="n-nome">Nome da barbearia</label><input id="n-nome" maxlength="80" placeholder="Ex.: Barbearia do Zé"></div>
            <div class="campo"><label for="n-email">E-mail de acesso do barbeiro</label><input id="n-email" type="email" placeholder="barbeiro@gmail.com"></div>
            <div class="campo"><label for="n-plano">Plano</label><select id="n-plano">${U.PLANOS.map(([v, t]) => `<option value="${v}"${v === "30" ? " selected" : ""}>${t}</option>`).join("")}</select></div>
            <div class="campo largo"><label for="n-logo">Logo da barbearia</label>
              <div class="logo-escolha"><div class="logo-previa" id="n-previa">sem logo</div>
              <input id="n-logo" type="file" accept="image/png,image/jpeg,image/webp"></div></div>
            <div class="largo"><button class="btn" type="submit">Cadastrar e gerar link</button></div>
          </form>
        </section>
        <section class="cartao">
          <h2>Barbearias cadastradas</h2>
          <div class="barra-lista"><input id="busca" type="search" placeholder="Buscar por nome ou e-mail…" aria-label="Buscar">
            <button class="btn sec mini" id="atualizar">↻ Atualizar</button><span class="contador" id="contador"></span></div>
          <div class="lista" id="lista"><p class="vazio">Carregando…</p></div>
        </section>
      </main>`;
    $("#sair").onclick = async () => { await S.sair(); telaLogin(); };
    $("#n-logo").onchange = async (e) => {
      try {
        const img = await U.lerImagem(e.target.files[0]);
        logoNovo = { l512: U.quadrado(img, 512), l192: U.quadrado(img, 192) };
        const p = $("#n-previa"); p.textContent = ""; p.style.backgroundImage = `url(${logoNovo.l192})`;
      } catch (err) { logoNovo = null; e.target.value = ""; U.aviso(err.message, "erro"); }
    };
    $("#f-nova").onsubmit = cadastrar;
    $("#busca").oninput = desenharLista;
    $("#atualizar").onclick = carregar;
    carregar();
  }

  async function carregar() {
    try {
      barbearias = await S.fn("admin", { acao: "listar" }) || [];
      desenharLista();
    } catch (err) {
      if (err.status === 401) { S.esquecer(); return telaLogin(); }
      $("#lista").innerHTML = `<p class="vazio">${esc(err.message)}</p>`;
    }
  }

  async function cadastrar(e) {
    e.preventDefault();
    const nome = $("#n-nome").value.trim(), email = $("#n-email").value.trim();
    if (!nome) return U.aviso("Informe o nome da barbearia.", "erro");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return U.aviso("Informe um e-mail válido.", "erro");
    if (!logoNovo) return U.aviso("Escolha o logo da barbearia.", "erro");
    await U.ocupado($("#f-nova button"), async () => {
      try {
        const b = await S.fn("admin", { acao: "criar", nome, email, plano: $("#n-plano").value, logo: logoNovo.l512, logo192: logoNovo.l192 });
        barbearias.unshift(b);
        $("#f-nova").reset(); logoNovo = null;
        const p = $("#n-previa"); p.style.backgroundImage = ""; p.textContent = "sem logo";
        desenharLista();
        U.aviso("Barbearia cadastrada!");
        mostrarAcesso(b, "Acesso criado");
      } catch (err) { U.aviso(err.message, "erro"); }
    });
  }

  function desenharLista() {
    const q = $("#busca").value.trim().toLowerCase();
    const lista = barbearias.filter((b) => !q || b.nome.toLowerCase().includes(q) || b.email.toLowerCase().includes(q));
    $("#contador").textContent = `${lista.length} de ${barbearias.length} barbearia(s)`;
    if (!lista.length) {
      $("#lista").innerHTML = `<p class="vazio">${barbearias.length ? "Nada encontrado." : "Nenhuma barbearia cadastrada ainda."}</p>`;
      return;
    }
    $("#lista").innerHTML = lista.map((b) => {
      const s = situacao(b), c = codigoDe(b);
      return `<article class="item" data-id="${b.id}">
        <img src="${esc(b.logo192_url || "../app/icones/icone-192.png")}" alt="" loading="lazy">
        <div>
          <h3>${esc(b.nome)}</h3>
          <div class="pequeno suave">${esc(b.email)}</div>
          <div class="meta"><span>Plano: <b>${esc(U.nomePlano(b.plano))}</b></span><span>Expira: <b>${b.expira_em ? U.data(b.expira_em) : "nunca"}</b></span></div>
          <div class="selos"><span class="selo ${s.cls}">${s.txt}</span>
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
    return U.modal(titulo || "Mensagem de acesso", `<p>Envie esta mensagem para o barbeiro:</p><div class="mensagem">${esc(mensagemAcesso(b))}</div>`, [
      { rotulo: "WhatsApp", classe: "sec", fica: true, antes: () => { U.whatsapp(mensagemAcesso(b)); } },
      { rotulo: "Copiar mensagem", fica: true, antes: () => U.copiar(mensagemAcesso(b)) },
    ]);
  }

  function mostrarCliente(b) {
    const link = linkCliente(b.slug);
    U.modal("Link do cliente", `<p class="pequeno suave">${esc(b.nome)} — este é o link que os clientes usam para ver cortes, produtos e a fila, e para instalar o app da barbearia.</p>
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
      `Gerar um novo código para <b>${esc(b.nome)}</b>?<br><br>A senha atual do barbeiro <b>deixa de funcionar</b>. Ele vai usar o código em “Primeiro acesso” para criar uma senha nova.`, "Gerar código");
    if (!ok) return;
    try {
      const nova = await S.fn("admin", { acao: "novo_codigo", id: b.id });
      trocar(nova); mostrarAcesso(nova, "Novo código gerado");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  async function editar(b) {
    let logo = null;
    const fundo = U.modal("Editar barbearia", `
      <div class="campo"><label for="e-nome">Nome</label><input id="e-nome" maxlength="80" value="${esc(b.nome)}"></div>
      <div class="campo"><label for="e-email">E-mail de acesso</label><input id="e-email" type="email" value="${esc(b.email)}"></div>
      <div class="campo"><label for="e-logo">Trocar logo (opcional)</label>
        <div class="logo-escolha"><div class="logo-previa" id="e-previa" style="background-image:url('${esc(b.logo192_url || "")}')"></div>
        <input id="e-logo" type="file" accept="image/png,image/jpeg,image/webp"></div></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: async (m) => {
        const corpo = { acao: "editar", id: b.id, nome: $("#e-nome", m).value, email: $("#e-email", m).value };
        if (logo) { corpo.logo = logo.l512; corpo.logo192 = logo.l192; }
        const nova = await S.fn("admin", corpo);
        trocar(nova); U.aviso("Alterações salvas.");
      } },
    ]);
    $("#e-logo").onchange = async (e) => {
      try {
        const img = await U.lerImagem(e.target.files[0]);
        logo = { l512: U.quadrado(img, 512), l192: U.quadrado(img, 192) };
        $("#e-previa").style.backgroundImage = `url(${logo.l192})`;
      } catch (err) { logo = null; U.aviso(err.message, "erro"); }
    };
    await fundo;
  }

  async function alternar(b, bt) {
    if (b.ativo) {
      const ok = await U.confirmar("Inativar link", `Inativar <b>${esc(b.nome)}</b>? O site dos clientes mostra “temporariamente indisponível” e o painel do barbeiro fica só para consulta.`, "Inativar", true);
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
    await U.modal("Excluir barbearia", `<p>Isso apaga <b>${esc(b.nome)}</b> para sempre: conta do barbeiro, equipe, logo e todos os dados. Não dá para desfazer.</p>
      <div class="campo"><label for="x-conf">Para confirmar, digite EXCLUIR</label><input id="x-conf" autocomplete="off"></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Excluir para sempre", classe: "perigo", antes: async (m) => {
        if ($("#x-conf", m).value.trim().toUpperCase() !== "EXCLUIR") { U.aviso("Digite EXCLUIR para confirmar.", "erro"); return false; }
        await S.fn("admin", { acao: "excluir", id: b.id });
        barbearias = barbearias.filter((x) => x.id !== b.id); desenharLista(); U.aviso("Barbearia excluída.");
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
