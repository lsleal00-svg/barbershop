/* pagamento.js — aba "Pagamento": formas aceitas e chaves Pix (QR Code e PDF). */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const A = () => window.APP;
  const dis = () => (A().leitura() ? " disabled" : "");
  let chaves = [], associados = [];

  const donoNome = () => A().b().nome + " (dono)";
  const nomeDe = (ch) => ch.equipe_id ? ((associados.find((a) => a.id === ch.equipe_id) || {}).nome || "Barbeiro") : donoNome();

  async function tela(corpo) {
    corpo.innerHTML = `<p class="suave">Carregando…</p>`;
    try {
      const id = A().b().id;
      [chaves, associados] = await Promise.all([
        A().S.rest(`chaves_pix?barbearia_id=eq.${id}&select=*&order=criado_em.asc`),
        A().S.rest(`equipe?barbearia_id=eq.${id}&papel=eq.associado&select=id,nome&order=criado_em.asc`),
      ]);
    } catch (err) { corpo.innerHTML = `<p class="suave">${esc(err.message)}</p>`; return; }
    desenhar(corpo);
  }

  function desenhar(corpo) {
    corpo = corpo || $("#corpo");
    const b = A().b();
    const livres = [{ id: "", nome: donoNome() }].concat(associados).filter((p) => !chaves.some((c) => (c.equipe_id || "") === p.id));
    corpo.innerHTML = `
      <section class="cartao"><h2>Formas de pagamento</h2>
        <div class="chaves-forma">
          <label class="forma"><input type="checkbox" id="f-pix"${b.aceita_pix ? " checked" : ""}${dis()}><span><b>Pix</b><br><small>${chaves.length ? "Clientes pagam pela chave cadastrada abaixo." : "Cadastre a chave Pix abaixo."}</small></span></label>
          <label class="forma"><input type="checkbox" id="f-dinheiro"${b.aceita_dinheiro ? " checked" : ""}${dis()}><span><b>Dinheiro em espécie</b><br><small>Nada para cadastrar.</small></span></label>
          <label class="forma"><input type="checkbox" id="f-prazo"${b.aceita_prazo ? " checked" : ""}${dis()}><span><b>À prazo</b><br><small>Só para cortes e barba (não vale para produtos).</small></span></label>
          <div class="forma-cartao"><label class="forma"><input type="checkbox" id="f-debito"${b.aceita_debito ? " checked" : ""}${dis()}><span><b>Cartão de débito</b><br><small>Na maquininha, no balcão.</small></span></label>
            <div class="taxa-campo${b.aceita_debito ? "" : " oculto"}" id="taxa-debito-campo"><label for="f-taxa-debito">Taxa do banco (%)</label>
              <div class="taxa-linha"><input id="f-taxa-debito" inputmode="decimal" placeholder="1,99" value="${b.taxa_debito != null ? String(b.taxa_debito).replace(".", ",") : ""}"${dis()}><span aria-hidden="true">%</span></div><small class="suave">Opcional</small></div></div>
          <div class="forma-cartao"><label class="forma"><input type="checkbox" id="f-credito"${b.aceita_credito ? " checked" : ""}${dis()}><span><b>Cartão de crédito</b><br><small>Na maquininha, no balcão.</small></span></label>
            <div class="taxa-campo${b.aceita_credito ? "" : " oculto"}" id="taxa-credito-campo"><label for="f-taxa-credito">Taxa do banco (%)</label>
              <div class="taxa-linha"><input id="f-taxa-credito" inputmode="decimal" placeholder="4,99" value="${b.taxa_credito != null ? String(b.taxa_credito).replace(".", ",") : ""}"${dis()}><span aria-hidden="true">%</span></div><small class="suave">Opcional</small></div></div>
        </div>
        <p class="pequeno suave${b.aceita_debito || b.aceita_credito ? "" : " oculto"}" id="taxa-dica">Se informar a taxa do banco, o Caixa, os gráficos e os relatórios mostram quanto a maquininha descontou e o valor que sobra (líquido).</p>
        <div class="campo${b.aceita_prazo ? "" : " oculto"}" id="prazo-campo" style="margin-top:.75rem;max-width:320px">
          <label for="f-dias">Prazo máximo para pagar (dias)</label><input id="f-dias" type="number" inputmode="numeric" min="1" max="30" value="${b.prazo_dias || 7}"${dis()}>
          <p class="pequeno suave">Depois disso, o cliente vira inadimplente. Máximo de 30 dias.</p></div>
        <button class="btn" id="f-salvar"${dis()}>Salvar formas de pagamento</button>
      </section>

      <section class="cartao" style="margin-top:1rem"><h2>Chaves Pix</h2>
        ${livres.length ? `<form id="f-chave" class="form-chave" novalidate>
          <div class="campo"><label for="pk-tipo">Tipo de chave</label><select id="pk-tipo">${Object.entries(PIX.NOMES).map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></div>
          <div class="campo"><label for="pk-chave">Chave Pix</label><input id="pk-chave" autocomplete="off"></div>
          <div class="campo"><label for="pk-titular">Nome do proprietário da conta</label><input id="pk-titular" maxlength="60"></div>
          <div class="campo"><label for="pk-cidade">Cidade</label><input id="pk-cidade" maxlength="40" placeholder="Ex.: Castanhal"></div>
          <div class="campo"><label for="pk-quem">Atribuir a</label><select id="pk-quem">${livres.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join("")}</select>
            <p class="pequeno suave">A chave atribuída a um barbeiro associado recebe os cortes dele. Quem não tem chave usa a do dono, e os produtos sempre usam a do dono.</p></div>
          <div><button class="btn" type="submit"${dis()}>Salvar chave</button></div>
        </form>` : `<p class="pequeno suave">Todos já têm chave cadastrada. Para trocar, edite ou exclua uma chave abaixo.</p>`}
        <div class="chaves-lista">${chaves.length ? chaves.map((c) => `<div class="chave-item" data-id="${c.id}">
            <div><b>${esc(nomeDe(c))}</b><div class="pequeno">${esc(PIX.NOMES[c.tipo])}: <span class="mono">${esc(PIX.mostrarChave(c.tipo, c.chave))}</span></div>
              <div class="pequeno suave">${esc(c.titular)} · ${esc(c.cidade)}</div></div>
            <div class="acoes"><button class="btn mini" data-a="qr">Gerar QR Code</button><button class="btn mini sec" data-a="editar"${dis()}>Editar</button><button class="btn mini perigo" data-a="excluir"${dis()}>Excluir</button></div>
          </div>`).join("") : `<p class="pequeno suave">Nenhuma chave cadastrada.</p>`}</div>
        <p class="pequeno suave" style="margin-top:.75rem">Por enquanto o pagamento por Pix é confirmado por você (ou pelo caixa) ao ver o dinheiro no banco. A confirmação automática pelo banco vem depois.</p>
      </section>`;
    $("#f-prazo").onchange = (e) => $("#prazo-campo").classList.toggle("oculto", !e.target.checked);
    const cartoes = () => {
      $("#taxa-debito-campo").classList.toggle("oculto", !$("#f-debito").checked);
      $("#taxa-credito-campo").classList.toggle("oculto", !$("#f-credito").checked);
      $("#taxa-dica").classList.toggle("oculto", !$("#f-debito").checked && !$("#f-credito").checked);
    };
    $("#f-debito").onchange = cartoes; $("#f-credito").onchange = cartoes;
    $("#f-salvar").onclick = salvarFormas;
    if ($("#f-chave")) {
      $("#pk-tipo").onchange = () => dicaChave(); dicaChave();
      $("#pk-titular").value = "";
      $("#f-chave").onsubmit = (e) => { e.preventDefault(); salvarChave(null, $("#f-chave"), $("#f-chave button")); };
    }
    $$(".chave-item [data-a]").forEach((bt) => (bt.onclick = () => {
      const c = chaves.find((x) => x.id === bt.closest(".chave-item").dataset.id);
      ({ qr: () => mostrarQr(c), editar: () => editar(c), excluir: () => excluir(c) })[bt.dataset.a]();
    }));
  }

  function dicaChave(raiz) {
    const t = $("#pk-tipo", raiz).value, inp = $("#pk-chave", raiz);
    inp.placeholder = { cpf: "000.000.000-00", cnpj: "00.000.000/0000-00", email: "nome@gmail.com", telefone: "(91) 98888-7777", aleatoria: "0000aaaa-00aa-00aa-00aa-000000aaaaaa" }[t];
    inp.inputMode = t === "cpf" || t === "cnpj" || t === "telefone" ? "numeric" : t === "email" ? "email" : "text";
  }

  async function salvarFormas() {
    const pix = $("#f-pix").checked, din = $("#f-dinheiro").checked, prazo = $("#f-prazo").checked;
    const deb = $("#f-debito").checked, cred = $("#f-credito").checked;
    const dias = Math.round(Number($("#f-dias").value));
    const lerTaxa = (id, nome) => {
      const t = $(id).value.trim();
      if (!t) return null;
      const n = Number(t.replace("%", "").replace(",", "."));
      if (!(n >= 0 && n <= 30)) throw new Error(`A taxa do ${nome} precisa ser de 0 a 30%.`);
      return Math.round(n * 100) / 100;
    };
    let tDeb, tCred;
    try { tDeb = lerTaxa("#f-taxa-debito", "débito"); tCred = lerTaxa("#f-taxa-credito", "crédito"); } catch (err) { return U.aviso(err.message, "erro"); }
    if (!pix && !din && !prazo && !deb && !cred) return U.aviso("Deixe pelo menos uma forma de pagamento ligada.", "erro");
    if (pix && !chaves.length) return U.aviso("Para ligar o Pix, cadastre antes uma chave Pix abaixo.", "erro");
    if (prazo && !(dias >= 1 && dias <= 30)) return U.aviso("O prazo precisa ser de 1 a 30 dias.", "erro");
    try {
      await A().salvarBarbearia({ aceita_pix: pix, aceita_dinheiro: din, aceita_prazo: prazo, prazo_dias: prazo ? dias : A().b().prazo_dias,
        aceita_debito: deb, aceita_credito: cred, taxa_debito: deb ? tDeb : A().b().taxa_debito, taxa_credito: cred ? tCred : A().b().taxa_credito });
      U.aviso("Formas de pagamento salvas.");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  function lerChave(raiz) {
    const tipo = $("#pk-tipo", raiz).value, chave = $("#pk-chave", raiz).value;
    const titular = $("#pk-titular", raiz).value.trim(), cidade = $("#pk-cidade", raiz).value.trim();
    const erro = PIX.validarChave(tipo, chave);
    if (!chave.trim()) throw new Error("Informe a chave Pix.");
    if (erro) throw new Error(erro);
    if (titular.length < 2) throw new Error("Informe o nome do proprietário da conta.");
    if (cidade.length < 2) throw new Error("Informe a cidade (exigência do Pix).");
    return { tipo, chave: PIX.normalizarChave(tipo, chave), titular, cidade };
  }

  async function salvarChave(c, raiz, botao) {
    let dados;
    try { dados = lerChave(raiz); } catch (err) { U.aviso(err.message, "erro"); return false; }
    const fazer = async () => {
      if (c) {
        const r = await A().S.rest(`chaves_pix?id=eq.${c.id}`, { method: "PATCH", prefer: "return=representation", body: dados });
        Object.assign(c, r[0]);
      } else {
        dados.barbearia_id = A().b().id;
        dados.equipe_id = $("#pk-quem", raiz).value || null;
        const r = await A().S.rest("chaves_pix", { method: "POST", prefer: "return=representation", body: dados });
        chaves.push(r[0]);
        if (!A().b().aceita_pix && chaves.length === 1) await A().salvarBarbearia({ aceita_pix: true }).catch(() => {});
      }
      desenhar(); U.aviso(c ? "Chave atualizada." : "Chave salva.");
    };
    try { if (botao) await U.ocupado(botao, fazer); else await fazer(); }
    catch (err) { U.aviso(err.message, "erro"); return false; }
  }

  function editar(c) {
    const aberto = U.modal("Editar chave Pix", `<p class="pequeno suave">Atribuída a <b>${esc(nomeDe(c))}</b></p>
      <div class="campo"><label for="pk-tipo">Tipo de chave</label><select id="pk-tipo">${Object.entries(PIX.NOMES).map(([v, t]) => `<option value="${v}"${v === c.tipo ? " selected" : ""}>${t}</option>`).join("")}</select></div>
      <div class="campo"><label for="pk-chave">Chave Pix</label><input id="pk-chave" value="${esc(PIX.mostrarChave(c.tipo, c.chave))}"></div>
      <div class="campo"><label for="pk-titular">Nome do proprietário</label><input id="pk-titular" maxlength="60" value="${esc(c.titular)}"></div>
      <div class="campo"><label for="pk-cidade">Cidade</label><input id="pk-cidade" maxlength="40" value="${esc(c.cidade)}"></div>`, [
      { rotulo: "Cancelar", classe: "sec", valor: false },
      { rotulo: "Salvar", antes: (m) => salvarChave(c, m) },
    ]);
    const m = $(".modal");
    $("#pk-tipo", m).onchange = () => dicaChave(m);
    return aberto;
  }

  async function excluir(c) {
    const ok = await U.confirmar("Excluir chave", `Excluir a chave Pix de <b>${esc(nomeDe(c))}</b>?`, "Excluir", true);
    if (!ok) return;
    try {
      await A().S.rest(`chaves_pix?id=eq.${c.id}`, { method: "DELETE" });
      chaves = chaves.filter((x) => x !== c);
      if (!chaves.length && A().b().aceita_pix) await A().salvarBarbearia({ aceita_pix: false }).catch(() => {});
      desenhar(); U.aviso("Chave excluída.");
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  /* ---------- QR Code e PDF ---------- */
  const codigo = (c) => PIX.copiaECola(c);

  function mostrarQr(c) {
    const cc = codigo(c);
    return U.modal("QR Code Pix", `<p class="centro"><b>${esc(A().b().nome)}</b><br><span class="pequeno">${esc(c.titular)}</span></p>
      ${U.qrSvg(cc, 240)}
      <p class="centro pequeno" style="margin-top:.6rem">${esc(PIX.NOMES[c.tipo])}: <b>${esc(PIX.mostrarChave(c.tipo, c.chave))}</b></p>
      <p class="pequeno suave centro">O cliente lê o QR no app do banco e digita o valor.</p>`, [
      { rotulo: "Copiar Pix copia e cola", classe: "sec", fica: true, antes: () => U.copiar(cc) },
      { rotulo: "Gerar arquivo PDF", fica: true, antes: () => gerarPdf(c) },
    ]);
  }

  async function imagemComoDataUrl(url) {
    try {
      const r = await fetch(url, { mode: "cors" });
      const blob = await r.blob();
      return await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
    } catch (e) { return null; }
  }

  async function gerarPdf(c) {
    const b = A().b();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const L = 210, centro = L / 2;
    pdf.setFillColor(29, 27, 24); pdf.rect(0, 0, L, 12, "F");
    let logo = b.logo_url ? await imagemComoDataUrl(b.logo_url) : null;
    if (logo) logo = await new Promise((ok) => { const im = new Image(); im.onload = () => { try { ok(U.circular(im, 400)); } catch (e) { ok(logo); } }; im.onerror = () => ok(logo); im.src = logo; });
    let y = 22;
    if (logo) { try { pdf.addImage(logo, "PNG", centro - 22, y, 44, 44); y += 50; } catch (e) { /* segue sem logo */ } }
    pdf.setTextColor(29, 27, 24); pdf.setFont("helvetica", "bold"); pdf.setFontSize(24);
    pdf.text(b.nome, centro, y + 6, { align: "center", maxWidth: 180 }); y += 16;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(14); pdf.setTextColor(109, 103, 94);
    pdf.text("Pague com Pix", centro, y, { align: "center" }); y += 6;
    // QR desenhado em vetor (nítido na impressão)
    const qr = window.qrcode(0, "M"); qr.addData(codigo(c)); qr.make();
    const n = qr.getModuleCount(), lado = 110, cel = lado / n, x0 = centro - lado / 2;
    pdf.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) pdf.rect(x0 + k * cel, y + r * cel, cel + 0.02, cel + 0.02, "F");
    y += lado + 12;
    pdf.setTextColor(29, 27, 24); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16);
    pdf.text(c.titular, centro, y, { align: "center" }); y += 9;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(13);
    pdf.text(`Chave Pix (${PIX.NOMES[c.tipo]}): ${PIX.mostrarChave(c.tipo, c.chave)}`, centro, y, { align: "center", maxWidth: 180 }); y += 12;
    pdf.setFontSize(10); pdf.setTextColor(109, 103, 94);
    pdf.text("Abra o app do seu banco, escolha Pix > Ler QR Code e digite o valor.", centro, y, { align: "center" });
    pdf.save(`pix-${b.slug}-${(c.titular || "chave").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.pdf`);
  }

  window.APP_ABAS = Object.assign(window.APP_ABAS || {}, { pagamento: tela });
})();
