/* app.js — app do barbeiro (dono), do barbeiro associado e do caixa.
   Fase 1: entrada (senha, primeiro acesso, esqueci a senha, código da equipe),
   equipe e configurações (link e QR Code do cliente). */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const S = SUPA.criar("bs_sessao_app");
  const raiz = $("#raiz");
  const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let perfil = null;          // resposta de meu_perfil()
  let aba = "inicio";
  let equipe = [];

  U.registrarSW("sw.js");
  const linkApp = () => new URL("./", location.href).href;
  const linkCliente = () => new URL("../c/?b=" + encodeURIComponent(perfil.barbearia.slug), location.href).href;
  const ehDono = () => perfil && perfil.papel === "dono";
  const leitura = () => perfil && !perfil.licenca_ok;
  const NOME_PAPEL = { dono: "Administrador", associado: "Barbeiro associado", caixa: "Caixa" };

  function gerarCodigo() {
    const b = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(b, (x) => ALFABETO[x % ALFABETO.length]).join("");
  }

  /* =================== telas de entrada =================== */
  function moldura(titulo, sub, corpo, voltar) {
    raiz.innerHTML = `<main class="entrada"><div class="cartao">
      ${voltar ? `<div class="passo-titulo"><button id="voltar" aria-label="Voltar">←</button><h1 style="margin:0">${esc(titulo)}</h1></div>`
               : `<img class="marca" src="icones/icone-192.png" alt=""><h1>${esc(titulo)}</h1>`}
      ${sub ? `<p class="sub"${voltar ? ' style="text-align:left"' : ""}>${sub}</p>` : ""}
      ${S.configurado() ? "" : `<div class="aviso-config">Sistema ainda não configurado (config.js vazio).</div>`}
      ${corpo}</div></main>`;
    if (voltar) $("#voltar").onclick = telaLogin;
  }
  const botaoInstalar = () => (U.instalado() ? "" : `<button class="btn sec bloco instalar-fixo" id="instalar" type="button">📲 Instalar o app no celular</button>`);
  function ligarInstalar() { const b = $("#instalar"); if (b) b.onclick = () => U.instalar(); }

  function telaLogin() {
    moldura("Painel da Barbearia", "Entre para gerenciar sua barbearia", `
      <form id="f" novalidate>
        <div class="campo"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" inputmode="email"></div>
        <div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="current-password"></div>
        <div class="campo"><label class="linha-check"><input id="manter" type="checkbox" checked> Manter-me conectado</label></div>
        <button class="btn bloco" type="submit">Entrar</button>
        <div class="centro"><button class="link" type="button" id="esqueci">Esqueci a senha</button></div>
      </form>
      <div class="separador">ou</div>
      <div class="acoes-entrada">
        <button class="btn sec bloco" id="primeiro" type="button">Primeiro acesso (tenho um código)</button>
        <button class="btn sec bloco" id="equipe" type="button">Sou da equipe (barbeiro ou caixa)</button>
      </div>${botaoInstalar()}`);
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const email = $("#email").value.trim(), senha = $("#senha").value;
      if (!email || !senha) return U.aviso("Preencha e-mail e senha.", "erro");
      await U.ocupado($("#f button[type=submit]"), async () => {
        try { await S.entrar(email, senha, $("#manter").checked); await abrir(); }
        catch (err) { U.aviso(err.message, "erro"); }
      });
    };
    $("#esqueci").onclick = () => telaEsqueci($("#email").value.trim());
    $("#primeiro").onclick = telaPrimeiro;
    $("#equipe").onclick = telaEquipe;
    ligarInstalar();
  }

  function telaPrimeiro() {
    moldura("Primeiro acesso", "Use o código que você recebeu e crie sua senha.", `
      <form id="f" novalidate>
        <div class="campo"><label for="email">E-mail de acesso</label><input id="email" type="email" autocomplete="username" inputmode="email"></div>
        <div class="campo"><label for="codigo">Código de acesso</label><input id="codigo" class="codigo-input" maxlength="8" autocomplete="one-time-code" autocapitalize="characters"></div>
        <div class="campo"><label for="senha">Crie uma senha</label><input id="senha" type="password" autocomplete="new-password" minlength="6"></div>
        <div class="campo"><label for="senha2">Confirme a senha</label><input id="senha2" type="password" autocomplete="new-password"></div>
        <button class="btn bloco" type="submit">Criar senha e entrar</button>
      </form>`, true);
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const email = $("#email").value.trim(), codigo = $("#codigo").value, senha = $("#senha").value;
      if (!email || !codigo) return U.aviso("Preencha o e-mail e o código.", "erro");
      if (senha.length < 6) return U.aviso("A senha precisa ter pelo menos 6 caracteres.", "erro");
      if (senha !== $("#senha2").value) return U.aviso("As duas senhas não são iguais.", "erro");
      await U.ocupado($("#f button"), async () => {
        try {
          await S.fn("acesso", { acao: "primeiro_acesso", email, codigo, senha });
          await S.entrar(email, senha, true);
          U.aviso("Senha criada! Bem-vindo.");
          await abrir();
        } catch (err) { U.aviso(err.message, "erro"); }
      });
    };
  }

  function telaEsqueci(emailInicial) {
    moldura("Esqueci a senha", "Vamos enviar um código para o seu e-mail.", `
      <form id="f1" novalidate>
        <div class="campo"><label for="email">E-mail de acesso</label><input id="email" type="email" autocomplete="username" inputmode="email" value="${esc(emailInicial || "")}"></div>
        <button class="btn bloco" type="submit">Enviar código</button>
      </form>
      <form id="f2" class="oculto" novalidate>
        <p class="pequeno">Enviamos um código para <b id="para"></b>. Confira também a caixa de spam.</p>
        <div class="campo"><label for="codigo">Código do e-mail</label><input id="codigo" class="codigo-input" inputmode="numeric" maxlength="10" autocomplete="one-time-code"></div>
        <div class="campo"><label for="senha">Nova senha</label><input id="senha" type="password" autocomplete="new-password"></div>
        <div class="campo"><label for="senha2">Confirme a nova senha</label><input id="senha2" type="password" autocomplete="new-password"></div>
        <button class="btn bloco" type="submit">Salvar nova senha</button>
        <div class="centro"><button class="link" type="button" id="reenviar">Não chegou? Enviar de novo</button></div>
      </form>`, true);
    const enviar = async (btn) => {
      const email = $("#email").value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return U.aviso("Informe um e-mail válido.", "erro");
      await U.ocupado(btn, async () => {
        try {
          await S.recuperar(email);
          $("#para").textContent = email; $("#f1").classList.add("oculto"); $("#f2").classList.remove("oculto");
          $("#codigo").focus();
        } catch (err) { U.aviso(err.message, "erro"); }
      });
    };
    $("#f1").onsubmit = (e) => { e.preventDefault(); enviar($("#f1 button")); };
    $("#reenviar").onclick = (e) => enviar(e.target);
    $("#f2").onsubmit = async (e) => {
      e.preventDefault();
      const senha = $("#senha").value;
      if (senha.length < 6) return U.aviso("A senha precisa ter pelo menos 6 caracteres.", "erro");
      if (senha !== $("#senha2").value) return U.aviso("As duas senhas não são iguais.", "erro");
      await U.ocupado($("#f2 button[type=submit]"), async () => {
        try {
          await S.verificarRecuperacao($("#email").value.trim(), $("#codigo").value, true);
          await S.trocarSenha(senha);
          U.aviso("Senha alterada!");
          await abrir();
        } catch (err) { U.aviso(err.message, "erro"); }
      });
    };
  }

  function telaEquipe() {
    moldura("Entrar com código", "Barbeiro associado ou caixa: digite o código que o dono da barbearia te passou.", `
      <form id="f" novalidate>
        <div class="campo"><label for="codigo">Código de acesso</label><input id="codigo" class="codigo-input" maxlength="9" autocomplete="off" autocapitalize="characters" placeholder="ABCD2345"></div>
        <div class="campo"><label class="linha-check"><input id="manter" type="checkbox" checked> Manter-me conectado</label></div>
        <button class="btn bloco" type="submit">Entrar</button>
      </form>`, true);
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const codigo = $("#codigo").value.toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (codigo.length !== 8) return U.aviso("O código tem 8 letras e números.", "erro");
      await U.ocupado($("#f button"), async () => {
        try {
          const r = await S.fn("acesso", { acao: "entrar_codigo", codigo });
          S.guardarSessao(r.sessao, $("#manter").checked);
          await abrir();
        } catch (err) { U.aviso(err.message, "erro"); }
      });
    };
  }

  /* =================== depois de entrar =================== */
  async function abrir() {
    try {
      perfil = await S.rpc("meu_perfil");
    } catch (err) {
      if (err.status === 401) { S.esquecer(); return telaLogin(); }
      raiz.innerHTML = `<main class="entrada"><div class="cartao centro"><h1>Sem conexão</h1><p class="suave">${esc(err.message)}</p><button class="btn" id="tentar">Tentar de novo</button></div></main>`;
      $("#tentar").onclick = abrir;
      return;
    }
    if (!perfil) {
      await S.sair();
      telaLogin();
      U.aviso("Esta conta não está ligada a nenhuma barbearia.", "erro");
      return;
    }
    document.title = perfil.barbearia.nome + " — Painel";
    desenharCasca();
  }

  function abasDoPapel() {
    if (ehDono()) return [["inicio", "Início"], ["equipe", "Equipe"], ["config", "Configurações"]];
    return [["inicio", "Início"], ["config", "Configurações"]];
  }

  function desenharCasca() {
    const b = perfil.barbearia;
    raiz.innerHTML = `
      ${leitura() ? `<div class="faixa-leitura">${b.ativo ? "Plano vencido" : "Acesso inativado"} — o painel está só para consulta. Fale com o suporte para renovar.</div>` : ""}
      <header class="topo-app"><div class="barra">
        <img class="logo" src="${esc(b.logo192_url || "icones/icone-192.png")}" alt="">
        <div><div class="nome">${esc(b.nome)}</div><div class="papel">${esc(perfil.papel === "dono" ? NOME_PAPEL.dono : perfil.nome + " · " + NOME_PAPEL[perfil.papel])}</div></div>
      </div>
      <nav class="abas" role="tablist">${abasDoPapel().map(([id, t]) => `<button role="tab" data-aba="${id}" aria-selected="${id === aba}">${t}</button>`).join("")}</nav>
      </header>
      <main class="corpo-app" id="corpo"></main>`;
    $$(".abas button").forEach((bt) => (bt.onclick = () => { aba = bt.dataset.aba; desenharCasca(); }));
    if (!abasDoPapel().some(([id]) => id === aba)) aba = "inicio";
    ({ inicio: telaInicio, equipe: telaEquipeDono, config: telaConfig })[aba]();
  }

  function telaInicio() {
    const b = perfil.barbearia;
    const proximos = ehDono()
      ? ["Cardápio: categorias, cortes, barba e produtos (Fase 2)", "Horário de funcionamento, temas e status aberto/fechado (Fase 2)", "Fila, agendamentos, pedidos e pagamento (Fase 3)", "Caixa, gráficos e relatórios (Fase 4)"]
      : perfil.papel === "associado" ? ["Sua fila e os pedidos dos clientes aparecem aqui (Fase 3)"]
      : ["Aprovar pedidos e organizar a fila (Fase 3)", "Caixa e relatórios (Fase 4)"];
    const d = U.diasAte(b.expira_em);
    $("#corpo").innerHTML = `
      <section class="cartao boas-vindas"><img src="${esc(b.logo192_url || "icones/icone-192.png")}" alt="">
        <div><h1 style="margin:0">Olá${ehDono() ? "" : ", " + esc(perfil.nome.split(" ")[0])}!</h1>
        <p class="suave" style="margin:0">${ehDono() ? (b.expira_em ? `Plano ativo até <b>${U.data(b.expira_em)}</b>${d !== null && d <= 5 && d > 0 ? ` — faltam ${d} dia(s)` : ""}.` : "Plano vitalício.") : esc(NOME_PAPEL[perfil.papel]) + " da " + esc(b.nome)}</p></div></section>
      <section class="cartao"><h2>Em construção</h2><p class="pequeno suave">Estas partes chegam nas próximas atualizações:</p>
        <ul class="em-breve">${proximos.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`;
  }

  /* ---------- equipe (só dono) ---------- */
  async function telaEquipeDono() {
    $("#corpo").innerHTML = `
      <section class="cartao"><h2>Cadastrar na equipe</h2>
        <p class="pequeno suave">O barbeiro associado só vê a fila dele e os pedidos de corte e barba. O caixa vê o caixa e ajuda a organizar a fila. Nenhum dos dois edita o seu site.</p>
        <form id="f-eq" class="form-equipe" novalidate>
          <div class="campo"><label for="eq-papel">Função</label><select id="eq-papel"><option value="associado">Barbeiro associado</option><option value="caixa">Caixa</option></select></div>
          <div class="campo"><label for="eq-nome">Nome</label><input id="eq-nome" maxlength="60"></div>
          <div class="campo"><label for="eq-tel" id="eq-tel-rot">Telefone / WhatsApp (opcional)</label><input id="eq-tel" type="tel" inputmode="tel" placeholder="(91) 98888-7777"></div>
          <div class="campo" id="eq-foto-campo"><label for="eq-foto">Foto (opcional)</label><input id="eq-foto" type="file" accept="image/*"></div>
          <div><button class="btn" type="submit"${leitura() ? " disabled" : ""}>Salvar e gerar código</button></div>
        </form></section>
      <div class="grade-2" style="margin-top:1rem">
        <section class="cartao"><h2>Barbeiros associados</h2><div class="membros" id="l-associado"><p class="suave pequeno">Carregando…</p></div></section>
        <section class="cartao"><h2>Caixa</h2><div class="membros" id="l-caixa"><p class="suave pequeno">Carregando…</p></div></section>
      </div>`;
    const ajustar = () => {
      const caixa = $("#eq-papel").value === "caixa";
      $("#eq-tel-rot").textContent = caixa ? "Telefone / WhatsApp" : "Telefone / WhatsApp (opcional)";
      $("#eq-foto-campo").classList.toggle("oculto", caixa);
    };
    $("#eq-papel").onchange = ajustar; ajustar();
    $("#f-eq").onsubmit = salvarMembro;
    await carregarEquipe();
  }

  async function carregarEquipe() {
    try {
      equipe = await S.rest("equipe?select=*&order=criado_em.asc");
      desenharEquipe();
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  function mensagemEquipe(m) {
    return `Olá, ${m.nome}! Seu acesso à *${perfil.barbearia.nome}* (${m.papel === "caixa" ? "caixa" : "barbeiro"}):\n\n` +
      `1. Abra: ${linkApp()}\n2. Toque em *Sou da equipe*\n3. Digite o código: *${m.codigo}*\n\nDica: instale o app no celular para receber os pedidos.`;
  }

  function desenharEquipe() {
    ["associado", "caixa"].forEach((papel) => {
      const l = equipe.filter((m) => m.papel === papel);
      const alvo = $("#l-" + papel);
      if (!alvo) return;
      alvo.innerHTML = l.length ? l.map((m) => `<div class="membro" data-id="${m.id}">
          ${m.foto_url ? `<img class="foto" src="${esc(m.foto_url)}" alt="">` : `<div class="foto">${esc(m.nome.trim()[0] || "?").toUpperCase()}</div>`}
          <div><b>${esc(m.nome)}</b><div class="pequeno suave">${m.telefone ? esc(m.telefone) + " · " : ""}Código: <span class="codigo">${esc(m.codigo)}</span></div></div>
          <div class="acoes">
            <button class="btn mini" data-a="copiar">Copiar código</button>
            <button class="btn mini sec" data-a="whats">Enviar</button>
            <button class="btn mini sec" data-a="novo"${leitura() ? " disabled" : ""}>Novo código</button>
            <button class="btn mini sec" data-a="editar"${leitura() ? " disabled" : ""}>Editar</button>
            <button class="btn mini perigo" data-a="excluir"${leitura() ? " disabled" : ""}>Excluir</button>
          </div></div>`).join("")
        : `<p class="suave pequeno">Ninguém cadastrado.</p>`;
    });
    $$(".membro [data-a]").forEach((bt) => {
      bt.onclick = () => {
        const m = equipe.find((x) => x.id === bt.closest(".membro").dataset.id);
        ({ copiar: () => U.copiar(m.codigo), whats: () => U.whatsapp(mensagemEquipe(m), m.telefone),
           novo: () => novoCodigoMembro(m), editar: () => editarMembro(m), excluir: () => excluirMembro(m) })[bt.dataset.a]();
      };
    });
  }

  async function enviarFoto(arquivo) {
    const img = await U.lerImagem(arquivo);
    const blob = await U.recorteQuadrado(img, 320);
    return S.enviarArquivo("fotos", `${perfil.barbearia.id}/equipe-${Date.now()}.webp`, blob);
  }

  async function inserirComCodigo(dados) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await S.rest("equipe", { method: "POST", prefer: "return=representation", body: Object.assign({}, dados, { codigo: gerarCodigo() }) });
        return r[0];
      } catch (err) {
        if (!/duplicate|unique|23505/i.test(err.original || err.message)) throw err;
      }
    }
    throw new Error("Não foi possível gerar um código. Tente de novo.");
  }

  async function salvarMembro(e) {
    e.preventDefault();
    const papel = $("#eq-papel").value, nome = $("#eq-nome").value.trim(), tel = $("#eq-tel").value.trim();
    if (!nome) return U.aviso("Informe o nome.", "erro");
    if (papel === "caixa" && tel.replace(/\D/g, "").length < 8) return U.aviso("Informe o telefone do caixa.", "erro");
    await U.ocupado($("#f-eq button"), async () => {
      try {
        const foto = papel === "associado" && $("#eq-foto").files[0] ? await enviarFoto($("#eq-foto").files[0]) : null;
        const m = await inserirComCodigo({ barbearia_id: perfil.barbearia.id, papel, nome, telefone: tel || null, foto_url: foto });
        equipe.push(m); desenharEquipe(); $("#f-eq").reset();
        $("#eq-papel").dispatchEvent(new Event("change"));
        mostrarCodigo(m, "Cadastrado!");
      } catch (err) { U.aviso(err.message, "erro"); }
    });
  }

  function mostrarCodigo(m, titulo) {
    return U.modal(titulo, `<p>Código de acesso de <b>${esc(m.nome)}</b>:</p><div class="codigo-grande">${esc(m.codigo)}</div>
      <p class="pequeno suave">No app, a pessoa toca em “Sou da equipe” e digita esse código.</p>`, [
      { rotulo: "Enviar por WhatsApp", classe: "sec", fica: true, antes: () => { U.whatsapp(mensagemEquipe(m), m.telefone); } },
      { rotulo: "Copiar código", fica: true, antes: () => U.copiar(m.codigo) },
    ]);
  }

  async function novoCodigoMembro(m) {
    const ok = await U.confirmar("Novo código", `Gerar um novo código para <b>${esc(m.nome)}</b>? O código antigo para de funcionar e a pessoa sai de todos os aparelhos.`, "Gerar novo código");
    if (!ok) return;
    try {
      let r = null;
      for (let i = 0; i < 4 && !r; i++) {
        try { r = (await S.rest(`equipe?id=eq.${m.id}`, { method: "PATCH", prefer: "return=representation", body: { codigo: gerarCodigo() } }))[0]; }
        catch (err) { if (!/duplicate|unique|23505/i.test(err.original || err.message)) throw err; }
      }
      if (!r) throw new Error("Tente de novo.");
      Object.assign(m, r); desenharEquipe(); mostrarCodigo(m, "Novo código");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  async function editarMembro(m) {
    const aberto = U.modal("Editar", `
      <div class="campo"><label for="ed-nome">Nome</label><input id="ed-nome" maxlength="60" value="${esc(m.nome)}"></div>
      <div class="campo"><label for="ed-tel">Telefone / WhatsApp${m.papel === "caixa" ? "" : " (opcional)"}</label><input id="ed-tel" type="tel" value="${esc(m.telefone || "")}"></div>
      ${m.papel === "associado" ? `<div class="campo"><label for="ed-foto">Trocar foto (opcional)</label><input id="ed-foto" type="file" accept="image/*"></div>` : ""}`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: async (f) => {
        const nome = $("#ed-nome", f).value.trim(), tel = $("#ed-tel", f).value.trim();
        if (!nome) { U.aviso("Informe o nome.", "erro"); return false; }
        if (m.papel === "caixa" && tel.replace(/\D/g, "").length < 8) { U.aviso("Informe o telefone do caixa.", "erro"); return false; }
        const muda = { nome, telefone: tel || null };
        const arq = $("#ed-foto", f) && $("#ed-foto", f).files[0];
        if (arq) muda.foto_url = await enviarFoto(arq);
        const r = await S.rest(`equipe?id=eq.${m.id}`, { method: "PATCH", prefer: "return=representation", body: muda });
        Object.assign(m, r[0]); desenharEquipe(); U.aviso("Salvo.");
      } },
    ]);
    await aberto;
  }

  async function excluirMembro(m) {
    const ok = await U.confirmar("Excluir", `Excluir <b>${esc(m.nome)}</b> da equipe? O acesso dele acaba na hora.`, "Excluir", true);
    if (!ok) return;
    try {
      await S.rest(`equipe?id=eq.${m.id}`, { method: "DELETE" });
      if (m.foto_url) {
        const caminho = m.foto_url.split("/object/public/fotos/")[1];
        if (caminho) S.apagarArquivo("fotos", caminho.split("?")[0]).catch(() => {});
      }
      equipe = equipe.filter((x) => x.id !== m.id); desenharEquipe(); U.aviso("Excluído.");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  /* ---------- configurações ---------- */
  function telaConfig() {
    const b = perfil.barbearia, link = linkCliente();
    $("#corpo").innerHTML = `
      <section class="cartao" id="cfg-cliente"><h2>Link do cliente</h2>
        <p class="pequeno suave">Seus clientes abrem este link ou leem o QR Code para ver cortes, produtos e a fila — e podem instalar o app da <b>${esc(b.nome)}</b> no celular ou no computador, com o seu logo.</p>
        <div id="qr-cliente">${U.qrSvg(link, 220)}</div>
        <p class="link-texto" id="link-cliente">${esc(link)}</p>
        <div class="linha-acoes">
          <button class="btn" id="c-copiar">Copiar link</button>
          <button class="btn sec" id="c-qr">Baixar QR Code</button>
          <button class="btn sec" id="c-whats">Enviar no WhatsApp</button>
          <a class="btn sec" href="${esc(link)}" target="_blank" rel="noopener">Abrir</a>
        </div></section>
      <div class="grade-2" style="margin-top:1rem">
        <section class="cartao"><h2>Este painel no celular</h2>
          <p class="pequeno suave">Instale o painel para abrir direto pela tela inicial${ehDono() ? " e, na próxima fase, receber os avisos de pedidos" : ""}.</p>
          ${U.instalado() ? `<span class="selo ok">Instalado</span>` : `<button class="btn sec" id="instalar">📲 Instalar o painel</button>`}</section>
        <section class="cartao"><h2>Conta</h2>
          ${ehDono() ? `<p class="pequeno">Plano: <b>${esc(U.nomePlano(b.plano))}</b> · ${b.expira_em ? "até " + U.data(b.expira_em) : "sem vencimento"}</p>
            <p class="pequeno suave">${esc((S.sessao() && S.sessao().user && S.sessao().user.email) || "")}</p>
            <button class="btn sec" id="trocar-senha">Trocar senha</button>` : `<p class="pequeno">${esc(perfil.nome)} · ${esc(NOME_PAPEL[perfil.papel])}</p>`}
          <button class="btn sec" id="sair" style="margin-left:.25rem">Sair</button></section>
      </div>`;
    $("#c-copiar").onclick = () => U.copiar(link);
    $("#c-whats").onclick = () => U.whatsapp(`Agora a *${b.nome}* tem app! Veja cortes, produtos e a fila, e peça seu corte por aqui: ${link}`);
    $("#c-qr").onclick = () => {
      const img = new Image(); img.crossOrigin = "anonymous";
      const fim = () => U.baixar(U.qrPng(link, b.nome, img.naturalWidth ? img : null) || U.qrPng(link, b.nome), `qrcode-${b.slug}.png`);
      img.onload = fim; img.onerror = fim;
      if (b.logo192_url) img.src = b.logo192_url; else fim();
    };
    ligarInstalar();
    $("#sair").onclick = async () => { await S.sair(); perfil = null; aba = "inicio"; telaLogin(); };
    if ($("#trocar-senha")) $("#trocar-senha").onclick = trocarSenha;
  }

  async function trocarSenha() {
    await U.modal("Trocar senha", `
      <div class="campo"><label for="ns1">Nova senha</label><input id="ns1" type="password" autocomplete="new-password"></div>
      <div class="campo"><label for="ns2">Confirme a nova senha</label><input id="ns2" type="password" autocomplete="new-password"></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: async (f) => {
        const s1 = $("#ns1", f).value;
        if (s1.length < 6) { U.aviso("A senha precisa ter pelo menos 6 caracteres.", "erro"); return false; }
        if (s1 !== $("#ns2", f).value) { U.aviso("As duas senhas não são iguais.", "erro"); return false; }
        await S.trocarSenha(s1); U.aviso("Senha alterada.");
      } },
    ]);
  }

  /* =================== início =================== */
  if (S.sessao()) abrir(); else telaLogin();
})();
