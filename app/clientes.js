/* clientes.js — clientes salvos (nome e WhatsApp de quem compra no balcão ou é agendado
   pelo painel). Lista com busca + sugestões enquanto digita o nome. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const A = () => window.APP;
  let cache = null, quando = 0;
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const zapTxt = (z) => { const d = String(z || "").replace(/\D/g, ""); return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : ""; };

  async function lista(forcar) {
    if (!cache || forcar || Date.now() - quando > 60000) {
      try {
        cache = await A().S.rest(`clientes?barbearia_id=eq.${A().b().id}&select=id,nome,whatsapp,vezes,ultimo_em&order=ultimo_em.desc&limit=2000`);
        quando = Date.now();
      } catch (e) { cache = cache || []; }
    }
    return cache;
  }
  const filtrar = (l, q) => { const n = norm(q), d = String(q || "").replace(/\D/g, ""); return !n ? l : l.filter((c) => norm(c.nome).includes(n) || (d.length >= 3 && String(c.whatsapp || "").includes(d))); };
  const linhaHtml = (c) => `<button type="button" class="cli-op" data-id="${c.id}"><span class="cli-av" aria-hidden="true">${esc((c.nome.trim()[0] || "?").toUpperCase())}</span>
      <span class="cli-txt"><b>${esc(c.nome)}</b><small>${c.whatsapp ? esc(zapTxt(c.whatsapp)) + " · " : ""}${c.vezes} visita${c.vezes === 1 ? "" : "s"}</small></span></button>`;

  /* Janela com busca e lista. Devolve o cliente escolhido (ou null). */
  async function escolher(textoInicial) {
    const todos = await lista(true);
    const espera = U.modal("Clientes salvos", `
      <input id="cli-busca" type="search" placeholder="Buscar pelo nome ou WhatsApp…" aria-label="Buscar cliente" autocomplete="off" value="${esc(textoInicial || "")}">
      <div class="cli-lista lista-rolagem" id="cli-lista" role="list"></div>
      <p class="pequeno suave" id="cli-conta"></p>`, [{ rotulo: "Fechar", classe: "sec", valor: null }]);
    const m = [...document.querySelectorAll(".modal-fundo")].pop();
    m.classList.add("modal-clientes");
    const desenhar = () => {
      const l = filtrar(todos, $("#cli-busca", m).value);
      $("#cli-lista", m).innerHTML = l.length ? l.slice(0, 300).map(linhaHtml).join("")
        : `<div class="vazio-cardapio">${todos.length ? "Ninguém com esse nome." : "Ainda não há clientes salvos. Eles entram aqui a cada venda ou agendamento com nome."}</div>`;
      const q = $("#cli-busca", m).value.trim();
      $("#cli-conta", m).textContent = !todos.length ? "" : q ? `${l.length} de ${todos.length} clientes salvos.` : `${todos.length} cliente${todos.length === 1 ? "" : "s"} salvo${todos.length === 1 ? "" : "s"}, do mais recente para o mais antigo.`;
      $$(".cli-op", m).forEach((bt) => (bt.onclick = () => m.fecharCom(todos.find((c) => c.id === bt.dataset.id))));
    };
    $("#cli-busca", m).oninput = desenhar;
    desenhar();
    return espera;
  }

  /* Liga um campo de nome (e o de WhatsApp, se houver): botão "Clientes salvos" e sugestões ao digitar. */
  function ligar(raiz, nomeSel, zapSel) {
    const campoNome = $(nomeSel, raiz);
    if (!campoNome || campoNome.dataset.cliLigado) return;
    campoNome.dataset.cliLigado = "1";
    const bloco = campoNome.closest(".campo") || campoNome.parentElement;
    const rotulo = $("label", bloco);
    if (rotulo) {
      const bt = document.createElement("button");
      bt.type = "button"; bt.className = "link cli-abrir"; bt.innerHTML = `${U.icone("lista")}Clientes salvos`;
      rotulo.classList.add("rotulo-com-acao"); rotulo.appendChild(bt);
      bt.onclick = async (e) => { e.preventDefault(); const c = await escolher(""); if (c) preencher(c); };
    }
    const sug = document.createElement("div");
    sug.className = "cli-sugestoes oculto"; sug.setAttribute("role", "listbox");
    campoNome.insertAdjacentElement("afterend", sug);
    const preencher = (c) => {
      campoNome.value = c.nome;
      const z = zapSel && $(zapSel, raiz);
      if (z && c.whatsapp) z.value = zapTxt(c.whatsapp) || c.whatsapp;
      ultimoEscolhido = c.nome;
      campoNome.dispatchEvent(new Event("input", { bubbles: true }));
      sug.classList.add("oculto");
    };
    let ultimoEscolhido = "";
    campoNome.addEventListener("input", async () => {
      const q = campoNome.value;
      if (q.trim().length < 2 || q === ultimoEscolhido) { sug.classList.add("oculto"); return; }
      const l = filtrar(await lista(), q).filter((c) => norm(c.nome) !== norm(q)).slice(0, 4);
      if (campoNome.value !== q) return;
      sug.innerHTML = l.map(linhaHtml).join("");
      sug.classList.toggle("oculto", !l.length);
      $$(".cli-op", sug).forEach((bt) => (bt.onmousedown = (e) => e.preventDefault()));
      $$(".cli-op", sug).forEach((bt) => (bt.onclick = () => { const c = l.find((x) => x.id === bt.dataset.id); ultimoEscolhido = c.nome; preencher(c); }));
    });
    campoNome.addEventListener("blur", () => setTimeout(() => sug.classList.add("oculto"), 150));
    lista();   // já deixa a lista carregada
  }

  window.CLIENTES = { ligar, escolher, lista, esquecer: () => { cache = null; } };
})();
