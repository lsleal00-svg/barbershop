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
  let barb = null;            // linha completa da barbearia (configurações)
  let aba = null;
  let relogioStatus = null;
  let vigia = null, pendentesConhecidos = null;
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
  const botaoInstalar = () => (U.instalado() ? "" : `<button class="btn sec bloco instalar-fixo" id="instalar" type="button">${U.icone("baixar")}Instalar o app no celular</button>`);
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
      await U.ocupado($("#f button[type=submit]"), async () => {
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
      await U.ocupado($("#f button[type=submit]"), async () => {
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
    try {
      barb = (await S.rest(`barbearias?id=eq.${perfil.barbearia.id}&select=*`))[0] || perfil.barbearia;
    } catch (err) { barb = perfil.barbearia; }
    aplicarTema(barb);
    document.title = perfil.barbearia.nome + " — Painel";
    if (!aba) aba = "fila";
    desenharCasca();
  }

  function aplicarTema(b) {
    document.documentElement.dataset.tema = (b && b.tema) || "claro";
    const raizCss = document.documentElement.style;
    if (b && b.cor_barra) {
      raizCss.setProperty("--cor-barra", b.cor_barra);
      raizCss.setProperty("--cor-barra-texto", textoSobre(b.cor_barra));
    } else { raizCss.removeProperty("--cor-barra"); raizCss.removeProperty("--cor-barra-texto"); }
    U.corDaBarra();
  }
  function textoSobre(hex) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, bl = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * bl) > 160 ? "#1d1b18" : "#ffffff";
  }

  async function salvarBarbearia(muda) {
    const r = await S.rest(`barbearias?id=eq.${barb.id}`, { method: "PATCH", prefer: "return=representation", body: muda });
    if (!r || !r.length) throw new Error(leitura() ? "Plano vencido: o painel está só para consulta." : "Não foi possível salvar.");
    barb = r[0];
    aplicarTema(barb);
    pintarStatus();
    return barb;
  }

  function pintarStatus() {
    const el = $("#status-topo");
    if (!el || !barb || !window.HORARIO) return;
    const st = HORARIO.situacao(barb);
    el.className = "status-pill " + (st.aberto ? "aberto" : st.motivo === "almoco" ? "almoco" : "fechado");
    el.textContent = window.innerWidth < 520 ? HORARIO.textoCurto(st) : HORARIO.texto(st);
    el.title = HORARIO.texto(st);
  }

  async function pintarOnline() {
    const el = $("#online-topo");
    if (!el) return;
    if (!barb || !barb.ver_movimentacao) { el.classList.add("oculto"); return; }
    try {
      const n = await S.rpc("pessoas_online");
      el.textContent = `👁 ${n} no site agora`; el.classList.remove("oculto");
    } catch (e) { el.classList.add("oculto"); }
  }

  function abasDoPapel() {
    if (ehDono()) return [["fila", "Fila"], ["caixa", "Caixa"], ["cardapio", "Serviços & Produtos"], ["horario", "Horário"], ["equipe", "Equipe"], ["pagamento", "Pagamento"], ["config", "Configurações"]];
    if (perfil.papel === "caixa") return [["fila", "Fila"], ["caixa", "Caixa"], ["config", "Configurações"]];
    return [["fila", "Fila"], ["config", "Configurações"]];
  }

  function desenharCasca() {
    const b = perfil.barbearia;
    raiz.innerHTML = `
      ${leitura() ? `<div class="faixa-leitura">${b.ativo ? "Plano vencido" : "Acesso inativado"} — o painel está só para consulta. Fale com o suporte para renovar.</div>` : ""}
      <header class="topo-app"><div class="barra">
        <img class="logo" src="${esc(b.logo192_url || "icones/icone-192.png")}" alt="">
        <div class="topo-textos"><div class="nome">${esc(b.nome)}</div><div class="papel">${esc(perfil.papel === "dono" ? NOME_PAPEL.dono : perfil.nome + " · " + NOME_PAPEL[perfil.papel])}</div></div>
        <div class="topo-direita"><span id="status-topo" class="status-pill"></span><span id="online-topo" class="online oculto"></span></div>
        <button class="btn mini btn-informar" id="informar-pag"${leitura() ? " disabled" : ""}>${U.icone("recibo")}Informar pagamentos</button>
        <button class="btn mini sec sair-topo" id="sair-topo" aria-label="Sair">${U.icone("sair")}Sair</button>
      </div>
      <nav class="abas" role="tablist">${abasDoPapel().map(([id, t]) => `<button role="tab" data-aba="${id}" aria-selected="${id === aba}">${t}</button>`).join("")}</nav>
      </header>
      <main class="corpo-app" id="corpo"></main>`;
    $$(".abas button").forEach((bt) => (bt.onclick = () => { aba = bt.dataset.aba; desenharCasca(); }));
    if (!abasDoPapel().some(([id]) => id === aba)) aba = abasDoPapel()[0][0];
    pintarStatus(); pintarOnline();
    clearInterval(relogioStatus);
    relogioStatus = setInterval(() => { pintarStatus(); pintarOnline(); }, 30000);
    $("#sair-topo").onclick = sair;
    $("#informar-pag").onclick = () => window.BALCAO.abrir();
    marcarPendentes();
    iniciarVigia();
    const telas = Object.assign({ inicio: telaInicio, equipe: telaEquipeDono, config: telaConfig }, window.APP_ABAS || {});
    telas[aba]($("#corpo"));
  }

  function telaInicio() {
    const b = perfil.barbearia;
    const proximos = ehDono()
      ? ["Fila, agendamentos, pedidos e pagamento (Fase 3)", "Caixa, gráficos e relatórios (Fase 4)"]
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
      <section class="cartao" id="perfil-dono"><h2>Você também atende?</h2>
        <label class="linha-check"><input type="checkbox" id="pd-atende"${barb.dono_atende !== false ? " checked" : ""}${leitura() ? " disabled" : ""}> Sim, eu também corto: quero ter a minha fila</label>
        <div class="form-equipe" style="margin-top:.75rem">
          <div class="campo"><label for="pd-nome">Seu nome na fila</label><input id="pd-nome" maxlength="40" value="${esc(barb.dono_nome || "")}" placeholder="${esc(barb.nome)}"${leitura() ? " disabled" : ""}></div>
          <div class="campo"><label for="pd-foto">Sua foto (opcional)</label><div class="logo-escolha">${barb.dono_foto_url ? `<img class="foto-mini" src="${esc(barb.dono_foto_url)}" alt="">` : ""}<input id="pd-foto" type="file" accept="image/*"${leitura() ? " disabled" : ""}></div></div>
        </div>
        <button class="btn sec" id="pd-salvar"${leitura() ? " disabled" : ""}>Salvar</button></section>
      <section class="cartao" style="margin-top:1rem"><h2>Cadastrar na equipe</h2>
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
    $("#pd-salvar").onclick = (e) => U.ocupado(e.target, async () => {
      try {
        const muda = { dono_atende: $("#pd-atende").checked, dono_nome: $("#pd-nome").value.trim() || null };
        const arq = $("#pd-foto").files[0];
        if (arq) muda.dono_foto_url = await enviarFoto(arq);
        await salvarBarbearia(muda); U.aviso("Perfil salvo."); telaEquipeDono();
      } catch (err) { U.aviso(err.message, "erro"); }
    });
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
      ${ehDono() ? blocoConfigDono() : ""}
      <section class="cartao" id="cfg-cliente"><h2>Link do cliente</h2>
        <p class="pequeno suave">Seus clientes abrem este link ou leem o QR Code para ver cortes, produtos e a fila — e podem instalar o app da <b>${esc(b.nome)}</b> no celular ou no computador, com o seu logo.</p>
        <div id="qr-cliente">${U.qrSvg(link, 220)}</div>
        <p class="link-texto" id="link-cliente">${esc(link)}</p>
        <div class="linha-acoes">
          <button class="btn" id="c-copiar">Copiar link</button>
          <a class="btn sec" id="c-abrir" href="${esc(link)}" target="_blank" rel="noopener" title="Abre a tela do cliente numa nova janela">${U.icone("abrir")}Abrir link</a>
          <button class="btn sec" id="c-qr">Baixar QR Code</button>
          <button class="btn sec" id="c-whats">Enviar no WhatsApp</button>
        </div></section>
      <div class="grade-2" style="margin-top:1rem">
        <section class="cartao"><h2>Este painel no celular</h2>
          <p class="pequeno suave">Instale o painel para abrir direto pela tela inicial${ehDono() ? " e, na próxima fase, receber os avisos de pedidos" : ""}.</p>
          ${U.instalado() ? `<span class="selo ok">Instalado</span>` : `<button class="btn sec" id="instalar">${U.icone("baixar")}Instalar o painel</button>`}</section>
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
      const fim = () => U.baixar(U.qrPng(link, b.nome, img.naturalWidth ? img : null, U.FRASE_QR) || U.qrPng(link, b.nome, null, U.FRASE_QR), `qrcode-${b.slug}.png`);
      img.onload = fim; img.onerror = fim;
      if (b.logo192_url) img.src = b.logo192_url; else fim();
    };
    ligarInstalar();
    if (ehDono()) ligarConfigDono();
    $("#sair").onclick = sair;
    if ($("#trocar-senha")) $("#trocar-senha").onclick = trocarSenha;
  }

  const TEMAS = [["claro", "Claro", "#e8f2fc", "#1e6fbf"], ["escuro", "Escuro", "#141311", "#c9a96a"], ["vermelho", "Vermelho", "#ffe8ea", "#d00018"], ["verde", "Verde", "#f2f7f3", "#2f6e47"], ["amarelo", "Amarelo", "#fdf8ea", "#d9a521"]];

  function blocoConfigDono() {
    const st = HORARIO.situacao(barb), tem = HORARIO.temHorario(barb.horarios);
    const prox = tem ? HORARIO.proximaMudanca(barb.horarios, barb.fuso) : null;
    return `<section class="cartao" id="cfg-status"><h2>Status da barbearia</h2>
        <p><span class="status-pill ${st.aberto ? "aberto" : st.motivo === "almoco" ? "almoco" : "fechado"}">${esc(HORARIO.texto(st))}</span></p>
        <p class="pequeno suave">${st.manual
          ? (st.ate ? `Você mudou manualmente. Volta ao automático em <b>${st.ate.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</b>.` : "Você mudou manualmente. Fica assim até você mudar de novo.")
          : tem ? "Seguindo o horário de funcionamento." : "Sem horário cadastrado: fica assim até você mudar."}</p>
        <div class="linha-acoes">
          <button class="btn${st.aberto ? " sec" : ""}" id="st-abrir"${leitura() ? " disabled" : ""}>Abrir agora</button>
          <button class="btn${st.aberto ? "" : " sec"}" id="st-fechar"${leitura() ? " disabled" : ""}>Fechar agora</button>
          ${st.manual && tem ? `<button class="btn sec" id="st-auto"${leitura() ? " disabled" : ""}>Voltar ao automático</button>` : ""}
        </div>
        ${!st.manual && tem && prox ? `<p class="pequeno suave" style="margin-top:.6rem">Se mudar agora, volta ao automático em ${prox.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}.</p>` : ""}
      </section>
      <div class="grade-2" style="margin:1rem 0">
        <section class="cartao"><h2>Tema</h2>
          <div class="temas">${TEMAS.map(([id, nome, f, d]) => `<button class="tema-op" data-tema="${id}" aria-pressed="${barb.tema === id}"${leitura() ? " disabled" : ""}>
            <span class="amostra" aria-hidden="true"><i></i><b></b></span>${nome}</button>`).join("")}</div></section>
        <section class="cartao"><h2>Ver movimentação</h2>
          <label class="linha-check"><input type="checkbox" id="cfg-mov"${barb.ver_movimentacao ? " checked" : ""}${leitura() ? " disabled" : ""}> Mostrar quantas pessoas estão no site agora</label>
          <p class="pequeno suave" style="margin-top:.5rem">O número aparece no topo do painel e se atualiza a cada 30 segundos.</p></section>
        <section class="cartao"><h2>Fila no app do cliente</h2>
          <label class="linha-check"><input type="checkbox" id="cfg-fila"${barb.esconder_fila ? " checked" : ""}${leitura() ? " disabled" : ""}> Esconder a fila dos clientes</label>
          <p class="pequeno suave" style="margin-top:.5rem">Com a fila escondida, o cliente vê só os destaques, os cortes e os produtos. Ele continua podendo pedir e agendar, e você continua vendo a fila aqui no painel.</p></section>
      </div>`;
  }

  function ligarConfigDono() {
    const mudarStatus = async (status) => {
      try {
        const prox = HORARIO.proximaMudanca(barb.horarios, barb.fuso);
        await salvarBarbearia({ status_manual: status, status_ate: status && prox ? prox.toISOString() : null });
        U.aviso(status ? (status === "aberto" ? "Barbearia aberta." : "Barbearia fechada.") : "Seguindo o horário de novo.");
        telaConfig();
      } catch (err) { U.aviso(err.message, "erro"); }
    };
    $("#st-abrir").onclick = () => mudarStatus("aberto");
    $("#st-fechar").onclick = () => mudarStatus("fechado");
    if ($("#st-auto")) $("#st-auto").onclick = () => mudarStatus(null);
    $$(".tema-op").forEach((bt) => (bt.onclick = async () => {
      try { await salvarBarbearia({ tema: bt.dataset.tema }); telaConfig(); U.aviso("Tema aplicado no painel e no site dos clientes."); }
      catch (err) { U.aviso(err.message, "erro"); }
    }));
    $("#cfg-fila").onchange = async (e) => {
      try { await salvarBarbearia({ esconder_fila: e.target.checked }); U.aviso(e.target.checked ? "Fila escondida na tela do cliente." : "Fila visível na tela do cliente."); }
      catch (err) { e.target.checked = !e.target.checked; U.aviso(err.message, "erro"); }
    };
    $("#cfg-mov").onchange = async (e) => {
      try { await salvarBarbearia({ ver_movimentacao: e.target.checked }); pintarOnline(); }
      catch (err) { e.target.checked = !e.target.checked; U.aviso(err.message, "erro"); }
    };
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

  /* =================== peças para os outros arquivos do painel =================== */
  async function sair() {
    const ok = await U.confirmar("Sair", "Quer sair do painel neste aparelho?", "Sair");
    if (!ok) return;
    await S.sair(); perfil = null; barb = null; aba = null; pendentesConhecidos = null;
    clearInterval(relogioStatus); clearInterval(vigia);
    document.documentElement.dataset.tema = "claro"; document.documentElement.style.cssText = "";
    telaLogin();
  }

  /* ---------- pedido novo: a tela se atualiza sozinha em qualquer aba ---------- */
  function marcarPendentes(n) {
    const bt = $('.abas [data-aba="fila"]');
    if (!bt) return;
    if (n === undefined) n = bt.dataset.n ? Number(bt.dataset.n) : 0;
    bt.dataset.n = n;
    bt.innerHTML = "Fila" + (n ? ` <span class="contador-pend">${n}</span>` : "");
  }
  async function verificarPedidos(veioDoAviso) {
    if (!perfil || document.visibilityState !== "visible") return;
    try {
      const d = await S.rpc("painel_fila");
      const ids = d.pendentes.map((p) => p.id);
      const novos = pendentesConhecidos ? ids.filter((id) => !pendentesConhecidos.has(id)) : [];
      pendentesConhecidos = new Set(ids);
      marcarPendentes(ids.length);
      if (aba === "fila") {
        // a própria aba Fila toca o som; aqui só redesenha na hora
        if (veioDoAviso || novos.length) { if (!$(".modal-fundo")) window.APP_ABAS.fila($("#corpo")); }
        return;
      }
      if (novos.length) {
        U.bip();
        U.aviso(novos.length === 1 ? "Novo pedido! Abra a aba Fila." : `${novos.length} pedidos novos! Abra a aba Fila.`);
        if (aba === "caixa" && !$(".modal-fundo")) window.APP_ABAS.caixa($("#corpo"));
      }
    } catch (e) { /* sem internet: tenta de novo */ }
  }
  function iniciarVigia() {
    clearInterval(vigia);
    verificarPedidos();
    vigia = setInterval(() => { if (aba !== "fila") verificarPedidos(); }, 10000);
  }
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.tipo === "pedido") verificarPedidos(true); });
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && perfil) verificarPedidos(true); });

  window.APP = {
    S, esc,
    perfil: () => perfil,
    b: () => barb,
    leitura, ehDono,
    salvarBarbearia,
    redesenhar: () => desenharCasca(),
    aoInformar: () => { if (aba === "caixa" || aba === "fila") desenharCasca(); },
    marcarPendentes,
    linkCliente,
  };

  /* =================== início =================== */
  if (S.sessao()) abrir(); else telaLogin();
})();
