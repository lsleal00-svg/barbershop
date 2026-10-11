/* cliente.js — página do cliente de cada barbearia (?b=apelido-da-barbearia).
   Fase 1: carrega nome e logo, deixa instalar o app da barbearia e mostra
   "temporariamente indisponível" quando o plano vence ou o link é inativado. */
(function () {
  "use strict";
  const { $, esc } = U;
  const S = SUPA.criar("bs_sessao_cliente");
  const raiz = $("#raiz");
  const slug = (new URLSearchParams(location.search).get("b") || "").toLowerCase().replace(/[^a-z0-9-]/g, "");

  U.registrarSW("sw.js");

  function trocarIdentidade(b) {
    document.title = b.nome;
    $("#apple-titulo").setAttribute("content", b.nome.slice(0, 20));
    if (b.logo192_url) {
      $("#favicon").href = b.logo192_url;
      $("#apple-icon").href = b.logo_url || b.logo192_url;
    }
  }

  function telaSimples(titulo, texto, logo) {
    raiz.innerHTML = `<main class="indisponivel"><div>
      ${logo ? `<img src="${esc(logo)}" alt="">` : ""}
      <h1>${esc(titulo)}</h1><p class="suave">${texto}</p></div></main>`;
  }

  function telaBarbearia(b) {
    raiz.innerHTML = `
      <header class="cabeca"><div class="barra">
        <img src="${esc(b.logo192_url || "")}" alt="">
        <h1>${esc(b.nome)}</h1>
        ${U.instalado() ? "" : `<button class="btn mini" id="instalar">Instalar app</button>`}
      </div></header>
      <main class="corpo-cli">
        <section class="capa">
          <img src="${esc(b.logo_url || b.logo192_url || "")}" alt="Logo da ${esc(b.nome)}">
          <h2>Bem-vindo à ${esc(b.nome)}!</h2>
          <p>Em breve, aqui você verá os cortes, os produtos e a fila, e poderá pedir ou agendar seu corte.</p>
          ${U.instalado() ? "" : `<button class="btn" id="instalar2">📲 Instalar o app da ${esc(b.nome)}</button>`}
        </section>
      </main>`;
    ["#instalar", "#instalar2"].forEach((s) => { const el = $(s); if (el) el.onclick = () => U.instalar(); });
  }

  (async function () {
    if (!S.configurado()) return telaSimples("Em configuração", "Este sistema ainda não foi configurado.");
    if (!slug) return telaSimples("Barbearia não encontrada", "Confira o link que você recebeu.");
    let b;
    try {
      b = await S.rpc("barbearia_publica", { p_slug: slug });
    } catch (err) {
      return telaSimples("Sem conexão", esc(err.message));
    }
    if (!b) return telaSimples("Barbearia não encontrada", "Confira o link que você recebeu.");
    trocarIdentidade(b);
    if (!b.disponivel) return telaSimples(b.nome, "Temporariamente indisponível. Tente novamente mais tarde.", b.logo192_url);
    telaBarbearia(b);
  })();
})();
