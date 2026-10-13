/* cardapio-admin.js — aba "Cardápio" do dono: categorias, cortes, barba e produtos. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const C = CARDAPIO;
  let cats = [], itens = [], atual = null;

  const A = () => window.APP;
  const b = () => A().b();
  const ro = () => A().leitura();
  const dis = () => (ro() ? " disabled" : "");

  async function carregar() {
    const id = b().id;
    [cats, itens] = await Promise.all([
      A().S.rest(`categorias?barbearia_id=eq.${id}&select=*&order=ordem.asc,criado_em.asc`),
      A().S.rest(`itens?barbearia_id=eq.${id}&select=*&order=ordem.asc,criado_em.asc`),
    ]);
    if (!cats.some((c) => c.id === atual)) atual = cats[0] ? cats[0].id : null;
  }

  async function tela(corpo) {
    corpo.innerHTML = `<p class="suave">Carregando serviços e produtos…</p>`;
    try { await carregar(); } catch (err) { corpo.innerHTML = `<p class="suave">${esc(err.message)}</p>`; return; }
    desenhar(corpo);
  }

  function desenhar(corpo) {
    corpo = corpo || $("#corpo");
    const cat = cats.find((c) => c.id === atual);
    const lista = cat ? itens.filter((i) => i.categoria_id === cat.id) : [];
    const destaques = itens.filter((i) => i.destaque && !i.esgotado);
    corpo.innerHTML = `
      <div class="cardapio-admin">
        <div class="barra-cat barra-fixa" role="toolbar" aria-label="Categorias">
          ${cats.map((c) => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === atual}">${c.icone ? `<span aria-hidden="true">${esc(c.icone)}</span>` : ""}${esc(c.nome)}</button>`).join("")}
        </div>
        ${cats.length ? `<div class="cats-ferramentas" role="toolbar" aria-label="Categorias">
          <button class="btn mini sec" id="nova-cat"${dis()}>${U.icone("mais")}Nova categoria</button>
          <button class="btn mini sec" id="editar-cats"${dis()}>${U.icone("lapis")}Editar ou excluir categorias</button>
          ${A().ehDono() ? `<button class="btn mini sec" id="cor-barra"${dis()}>${U.icone("paleta")}Cor da barra</button>` : ""}</div>` : ""}
        ${destaques.length ? `<section class="destaques" id="destaques" style="margin:1rem 0"></section>` : ""}
        ${!cats.length ? `<div class="vazio-cardapio" style="margin-top:1rem"><p><b>Comece criando uma categoria.</b></p>
            <p class="pequeno">Ex.: “Cortes” (tipo Corte de cabelo), “Barba” (tipo Barba) e “Bonés” (tipo Outros). Sem categoria não dá para cadastrar itens.</p>
            <button class="btn" id="nova-cat-2"${dis()}>Criar categoria</button></div>`
        : `<div class="cab-cat"><h2>${cat.icone ? esc(cat.icone) + " " : ""}${esc(cat.nome)} <span class="selo">${esc(C.TIPOS[cat.tipo])}</span></h2>
            <button class="btn" id="novo-item"${dis()}>＋ ${esc(C.NOVO[cat.tipo])}</button></div>
          ${lista.length ? `<div class="grade-itens">${lista.map((it) => C.cartao(it, cat.tipo, { admin: true, acoes: acoesItem(it) })).join("")}</div>`
            : `<div class="vazio-cardapio">Nada cadastrado em “${esc(cat.nome)}” ainda.</div>`}`}
      </div>`;
    $$(".chip[data-cat]", corpo).forEach((ch) => (ch.onclick = () => { atual = ch.dataset.cat; desenhar(); }));
    [$("#nova-cat"), $("#nova-cat-2")].forEach((bt) => bt && (bt.onclick = novaCategoria));
    if ($("#cor-barra")) $("#cor-barra").onclick = corDaBarra;
    if ($("#editar-cats")) $("#editar-cats").onclick = editarCategorias;
    if ($("#novo-item")) $("#novo-item").onclick = () => formItem(null, cat);
    if (destaques.length) C.carrossel($("#destaques"), destaques, tipoDoItem);
    $$(".item-card [data-a]", corpo).forEach((bt) => (bt.onclick = () => {
      const it = itens.find((x) => x.id === bt.closest(".item-card").dataset.id);
      ({ editar: () => formItem(it, cats.find((c) => c.id === it.categoria_id)), desconto: () => desconto(it),
         destaque: () => alternar(it, "destaque"), esgotado: () => alternar(it, "esgotado"), excluir: () => excluirItem(it) })[bt.dataset.a]();
    }));
  }
  const tipoDoItem = (it) => (cats.find((c) => c.id === it.categoria_id) || {}).tipo;

  function acoesItem(it) {
    return `<button class="btn sec" data-a="editar"${dis()}>Editar</button>
      <button class="btn sec" data-a="desconto"${dis()}>${it.desconto ? `-${it.desconto}%` : "Desconto"}</button>
      <button class="btn sec" data-a="destaque"${dis()} title="${it.destaque ? "Remover do destaque" : "Inserir na lista de destaque"}">${it.destaque ? U.icone("estrelaCheia") + "Remover destaque" : U.icone("estrela") + "Destacar"}</button>
      <button class="btn sec" data-a="esgotado"${dis()}>${it.esgotado ? "Disponível" : "Esgotado"}</button>
      <button class="btn perigo" data-a="excluir"${dis()} aria-label="Excluir">Excluir</button>`;
  }

  /* ---------- categorias ---------- */
  function novaCategoria() {
    const usado = (t) => cats.some((c) => c.tipo === t);
    const padrao = !usado("cabelo") ? "cabelo" : !usado("barba") ? "barba" : "outros";
    let icone = null;
    const aberto = U.modal("Nova categoria", `
      <div class="campo"><label for="cat-nome">Nome da categoria</label><input id="cat-nome" maxlength="40" placeholder="Ex.: Cortes, Barba, Bonés"></div>
      <div class="campo"><label>Tipo</label><div class="tipos-cat">
        ${["cabelo", "barba", "outros"].map((t) => `<label class="tipo-op${t !== "outros" && usado(t) ? " usado" : ""}"><input type="radio" name="cat-tipo" value="${t}"${t !== "outros" && usado(t) ? " disabled" : ""}${t === padrao ? " checked" : ""}>
          <span>${C.TIPOS[t]}${t !== "outros" && usado(t) ? " <small>(já existe)</small>" : ""}</span></label>`).join("")}</div>
        <p class="pequeno suave" style="margin-top:.4rem">Corte de cabelo e Barba só podem existir uma vez. “Outros” é para os produtos e pode ter quantas quiser.</p></div>
      <div class="campo"><label>Ícone (opcional)</label><div class="icones">${C.ICONES.map((ic) => `<button type="button" class="icone-op" data-ic="${ic}" aria-pressed="false">${ic}</button>`).join("")}</div></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: async (m) => {
        const nome = $("#cat-nome", m).value.trim(), tipo = ($("input[name=cat-tipo]:checked", m) || {}).value;
        if (!nome) { U.aviso("Informe o nome da categoria.", "erro"); return false; }
        if (!tipo) { U.aviso("Escolha o tipo.", "erro"); return false; }
        const r = await A().S.rest("categorias", { method: "POST", prefer: "return=representation",
          body: { barbearia_id: b().id, tipo, nome, icone: icone, ordem: cats.length } }).catch((e) => {
          throw new Error(/categorias_tipo_unico|duplicate/i.test(e.original || e.message) ? "Já existe uma categoria desse tipo." : e.message);
        });
        cats.push(r[0]); atual = r[0].id; desenhar(); U.aviso("Categoria criada.");
      } },
    ]);
    $$(".icone-op").forEach((bt) => (bt.onclick = () => {
      const ja = bt.getAttribute("aria-pressed") === "true";
      $$(".icone-op").forEach((x) => x.setAttribute("aria-pressed", "false"));
      bt.setAttribute("aria-pressed", String(!ja)); icone = ja ? null : bt.dataset.ic;
    }));
    return aberto;
  }

  function corDaBarra() {
    let cor = b().cor_barra || "#1d1b18";
    const aberto = U.modal("Cor da barra de categorias", `
      <div class="cores">${C.CORES.map((c) => `<button type="button" class="cor-op" data-cor="${c}" style="background:${c}" aria-label="${c}" aria-pressed="${c === b().cor_barra}"></button>`).join("")}</div>
      <div class="campo" style="margin-top:1rem"><label for="cor-livre">Outra cor</label><input id="cor-livre" type="color" value="${cor}"></div>
      <div class="barra-cat previa-barra" id="previa-barra" style="border-radius:10px"><span class="chip" aria-pressed="true">Cortes</span><span class="chip">Barba</span><span class="chip">Bonés</span></div>`, [
      { rotulo: "Usar cor do tema", classe: "sec", antes: async () => { await A().salvarBarbearia({ cor_barra: null }); desenhar(); U.aviso("Barra com a cor do tema."); } },
      { rotulo: "Salvar cor", antes: async () => { await A().salvarBarbearia({ cor_barra: cor }); desenhar(); U.aviso("Cor salva."); } },
    ]);
    const previa = () => {
      const p = $("#previa-barra"); p.style.setProperty("--cor-barra", cor);
      const n = parseInt(cor.slice(1), 16), luz = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
      p.style.setProperty("--cor-barra-texto", luz > 160 ? "#1d1b18" : "#ffffff");
    };
    $$(".cor-op").forEach((bt) => (bt.onclick = () => { cor = bt.dataset.cor; $("#cor-livre").value = cor; $$(".cor-op").forEach((x) => x.setAttribute("aria-pressed", String(x === bt))); previa(); }));
    $("#cor-livre").oninput = (e) => { cor = e.target.value; previa(); };
    previa();
    return aberto;
  }

  function editarCategorias() {
    const linha = (c) => {
      const n = itens.filter((i) => i.categoria_id === c.id).length;
      return `<div class="cat-linha" data-id="${c.id}"><span class="cat-ic">${esc(c.icone || "•")}</span>
        <input value="${esc(c.nome)}" maxlength="40" aria-label="Nome da categoria">
        <span class="pequeno suave">${esc(C.TIPOS[c.tipo])} · ${n} ite${n === 1 ? "m" : "ns"}</span>
        <button class="btn mini sec" data-a="salvar">Salvar</button><button class="btn mini perigo" data-a="excluir">Excluir</button></div>`;
    };
    const aberto = U.modal("Editar categorias", `<div class="cats-lista">${cats.map(linha).join("")}</div>`, [{ rotulo: "Fechar", valor: null }]);
    $$(".cat-linha [data-a]").forEach((bt) => (bt.onclick = async () => {
      const el = bt.closest(".cat-linha"), c = cats.find((x) => x.id === el.dataset.id);
      if (bt.dataset.a === "salvar") {
        const nome = $("input", el).value.trim();
        if (!nome) return U.aviso("O nome não pode ficar vazio.", "erro");
        try { const r = await A().S.rest(`categorias?id=eq.${c.id}`, { method: "PATCH", prefer: "return=representation", body: { nome } }); Object.assign(c, r[0]); desenhar(); U.aviso("Nome salvo."); }
        catch (err) { U.aviso(err.message, "erro"); }
        return;
      }
      const n = itens.filter((i) => i.categoria_id === c.id);
      const ok = await U.confirmar("Excluir categoria", `Excluir <b>${esc(c.nome)}</b>?${n.length ? ` Os <b>${n.length} itens</b> dela também serão excluídos.` : ""}`, "Excluir", true);
      if (!ok) return;
      try {
        await A().S.rest(`categorias?id=eq.${c.id}`, { method: "DELETE" });
        n.forEach(apagarFoto);
        cats = cats.filter((x) => x !== c); itens = itens.filter((i) => i.categoria_id !== c.id);
        if (atual === c.id) atual = cats[0] ? cats[0].id : null;
        el.remove(); desenhar(); U.aviso("Categoria excluída.");
      } catch (err) { U.aviso(err.message, "erro"); }
    }));
    return aberto;
  }

  /* ---------- itens ---------- */
  function apagarFoto(it) {
    const caminho = it && it.foto_url && it.foto_url.split("/object/public/fotos/")[1];
    if (caminho) A().S.apagarArquivo("fotos", caminho.split("?")[0]).catch(() => {});
  }

  function formItem(it, cat) {
    let arquivo = null, tirarFoto = false;
    const novo = !it;
    const aberto = U.modal(novo ? C.NOVO[cat.tipo] : "Editar " + (cat.tipo === "outros" ? "produto" : "corte"), `
      <div class="foto-escolha"><img id="it-previa" src="${esc(it ? C.foto(it, cat.tipo) : C.imagemPadrao(cat.tipo))}" alt="">
        <div><label for="it-foto">Foto (opcional)</label><input id="it-foto" type="file" accept="image/*">
        ${it && it.foto_url ? `<button type="button" class="link" id="it-sem-foto">Remover a foto</button>` : ""}
        <p class="pequeno suave">${cat.tipo === "outros" ? "Sem foto, aparece um desenho de sacola." : "Sem foto, aparece o desenho de tesoura e pente."}</p></div></div>
      <div class="campo"><label for="it-nome">Nome</label><input id="it-nome" maxlength="60" value="${esc(it ? it.nome : "")}" placeholder="${cat.tipo === "outros" ? "Ex.: Boné preto" : cat.tipo === "barba" ? "Ex.: Barba completa" : "Ex.: Degradê"}"></div>
      <div class="campo"><label for="it-preco">Preço (R$)</label><input id="it-preco" inputmode="decimal" value="${it ? String(it.preco).replace(".", ",") : ""}" placeholder="35,00"></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: async (m) => {
        const nome = $("#it-nome", m).value.trim(), preco = C.lerPreco($("#it-preco", m).value);
        if (!nome) { U.aviso("Informe o nome.", "erro"); return false; }
        if (!(preco >= 0) || isNaN(preco)) { U.aviso("Informe o preço.", "erro"); return false; }
        const dados = { nome, preco };
        if (arquivo) {
          const img = await U.lerImagem(arquivo);
          const blob = await U.recorteQuadrado(img, 600);
          dados.foto_url = await A().S.enviarArquivo("fotos", `${b().id}/itens/${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.webp`, blob);
        } else if (tirarFoto) dados.foto_url = null;
        if (novo) {
          const r = await A().S.rest("itens", { method: "POST", prefer: "return=representation",
            body: Object.assign({ barbearia_id: b().id, categoria_id: cat.id, ordem: itens.length }, dados) });
          itens.push(r[0]);
        } else {
          const r = await A().S.rest(`itens?id=eq.${it.id}`, { method: "PATCH", prefer: "return=representation", body: dados });
          if ((arquivo || tirarFoto) && it.foto_url) apagarFoto(it);
          Object.assign(it, r[0]);
        }
        desenhar(); U.aviso(novo ? "Cadastrado!" : "Salvo.");
      } },
    ]);
    $("#it-foto").onchange = async (e) => {
      try { const img = await U.lerImagem(e.target.files[0]); arquivo = e.target.files[0]; tirarFoto = false; $("#it-previa").src = img.src; }
      catch (err) { e.target.value = ""; arquivo = null; U.aviso(err.message, "erro"); }
    };
    if ($("#it-sem-foto")) $("#it-sem-foto").onclick = () => { tirarFoto = true; arquivo = null; $("#it-foto").value = ""; $("#it-previa").src = C.imagemPadrao(cat.tipo); };
    return aberto;
  }

  function desconto(it) {
    const aberto = U.modal("Informar desconto", `<p><b>${esc(it.nome)}</b> — ${C.dinheiro(it.preco)}</p>
      <div class="campo"><label for="ds-pct">Desconto (%)</label><input id="ds-pct" type="number" inputmode="numeric" min="1" max="90" value="${it.desconto || ""}" placeholder="Ex.: 10"></div>
      <p class="previa-desconto" id="ds-previa"></p>`, [
      ...(it.desconto ? [{ rotulo: "Remover desconto", classe: "sec", antes: async () => salvarCampo(it, { desconto: 0 }, "Desconto removido.") }] : []),
      { rotulo: "Confirmar", antes: async (m) => {
        const p = Math.round(Number($("#ds-pct", m).value));
        if (!(p >= 1 && p <= 90)) { U.aviso("Informe um desconto entre 1% e 90%.", "erro"); return false; }
        await salvarCampo(it, { desconto: p }, "Desconto aplicado.");
      } },
    ]);
    const prev = () => {
      const p = Math.round(Number($("#ds-pct").value));
      $("#ds-previa").innerHTML = p >= 1 && p <= 90
        ? `De <s>${C.dinheiro(it.preco)}</s> por <b>${C.dinheiro(C.final({ preco: it.preco, desconto: p }))}</b>`
        : `<span class="suave">Digite de 1 a 90.</span>`;
    };
    $("#ds-pct").oninput = prev; prev();
    return aberto;
  }

  async function salvarCampo(it, muda, msg) {
    const r = await A().S.rest(`itens?id=eq.${it.id}`, { method: "PATCH", prefer: "return=representation", body: muda });
    if (!r.length) throw new Error("Não foi possível salvar.");
    Object.assign(it, r[0]); desenhar(); if (msg) U.aviso(msg);
  }
  async function alternar(it, campo) {
    try {
      await salvarCampo(it, { [campo]: !it[campo] },
        campo === "destaque" ? (it.destaque ? "Removido do destaque." : "Inserido na lista de destaque.") : (it.esgotado ? "Marcado como disponível." : "Marcado como esgotado: some para os clientes."));
    } catch (err) { U.aviso(err.message, "erro"); }
  }
  async function excluirItem(it) {
    const ok = await U.confirmar("Excluir", `Excluir <b>${esc(it.nome)}</b>?`, "Excluir", true);
    if (!ok) return;
    try {
      await A().S.rest(`itens?id=eq.${it.id}`, { method: "DELETE" });
      apagarFoto(it); itens = itens.filter((x) => x !== it); desenhar(); U.aviso("Excluído.");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  window.APP_ABAS = Object.assign(window.APP_ABAS || {}, { cardapio: tela });
})();
