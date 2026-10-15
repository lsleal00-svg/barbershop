/* horario-admin.js — aba "Horário": horário por dia da semana e intervalo dos agendamentos. */
(function () {
  "use strict";
  const { $, $$, esc } = U;
  const H = HORARIO;
  const A = () => window.APP;
  const dis = () => (A().leitura() ? " disabled" : "");
  const ORDEM = [1, 2, 3, 4, 5, 6, 0];          // começa na segunda

  function tela(corpo) {
    const b = A().b(), hs = b.horarios || {};
    const comIntervalo = A().modulos().intervalo, v = A().vocab();
    corpo.innerHTML = `
      <section class="cartao"><h2>Horário de funcionamento</h2>
        <p class="pequeno suave">Marque os dias em que ${v.a} ${v.negocio} abre. O status <b>aberto/fechado</b> passa a seguir este horário sozinho${A().modulos().agendamento ? ", e o agendamento só oferece horários dentro dele" : ""}. O almoço é opcional: durante ele ${v.a} ${v.negocio} aparece como “Em almoço”.</p>
        <div class="dias">${ORDEM.map((d) => linhaDia(d, hs[String(d)])).join("")}</div>
        <div class="linha-acoes">
          <button class="btn" id="h-salvar"${dis()}>Salvar horário</button>
          <button class="btn sec" id="h-copiar"${dis()}>Copiar o 1º dia marcado para os outros</button>
          ${H.temHorario(b.horarios) ? `<button class="btn sec" id="h-apagar"${dis()}>Apagar horário</button>` : ""}
        </div>
        ${H.temHorario(b.horarios) ? "" : `<p class="pequeno suave" style="margin-top:.6rem">Sem horário cadastrado, você abre e fecha manualmente em Configurações${comIntervalo ? ", e o agendamento aceita qualquer dia e hora" : ""}.</p>`}
      </section>
      ${!comIntervalo ? "" : `<section class="cartao" style="margin-top:1rem"><h2>Intervalo entre agendamentos</h2>
        <p class="pequeno suave">Tempo mínimo entre um agendamento e o próximo. Ao agendar, o cliente só vê horários com pelo menos esse espaço.</p>
        <div class="linha-intervalo"><input id="h-intervalo" type="number" inputmode="numeric" min="5" max="240" value="${b.intervalo_min || 35}" aria-label="Minutos"><span>minutos</span>
          <button class="btn sec" id="h-int-salvar"${dis()}>Salvar</button></div>
      </section>`}`;
    $$(".dia [data-abre]").forEach((cb) => (cb.onchange = () => ligarDia(cb.closest(".dia"))));
    $$(".dia [data-almoco]").forEach((cb) => (cb.onchange = () => ligarDia(cb.closest(".dia"))));
    $$(".dia").forEach(ligarDia);
    $("#h-salvar").onclick = salvar;
    $("#h-copiar").onclick = copiar;
    if ($("#h-apagar")) $("#h-apagar").onclick = apagar;
    if ($("#h-int-salvar")) $("#h-int-salvar").onclick = async () => {
      const v = Math.round(Number($("#h-intervalo").value));
      if (!(v >= 5 && v <= 240)) return U.aviso("Use de 5 a 240 minutos.", "erro");
      try { await A().salvarBarbearia({ intervalo_min: v }); U.aviso("Intervalo salvo."); } catch (err) { U.aviso(err.message, "erro"); }
    };
  }

  function linhaDia(d, h) {
    const aberto = !!(h && h.abre), almoco = !!(h && h.almoco_ini);
    return `<div class="dia" data-dia="${d}">
      <label class="linha-check dia-nome"><input type="checkbox" data-abre${aberto ? " checked" : ""}${dis()}> ${H.DIAS[d]}</label>
      <div class="dia-campos">
        <label>Abre<input type="time" data-c="abre" value="${esc((h && h.abre) || "08:00")}"${dis()}></label>
        <label>Fecha<input type="time" data-c="fecha" value="${esc((h && h.fecha) || "19:00")}"${dis()}></label>
        <label class="linha-check almoco-check"><input type="checkbox" data-almoco${almoco ? " checked" : ""}${dis()}> Almoço</label>
        <label class="almoco">Início<input type="time" data-c="almoco_ini" value="${esc((h && h.almoco_ini) || "12:00")}"${dis()}></label>
        <label class="almoco">Volta<input type="time" data-c="almoco_fim" value="${esc((h && h.almoco_fim) || "13:00")}"${dis()}></label>
      </div><span class="dia-folga">Fechado</span></div>`;
  }
  function ligarDia(el) {
    const aberto = $("[data-abre]", el).checked, almoco = $("[data-almoco]", el).checked;
    el.classList.toggle("fechado", !aberto);
    $$(".almoco", el).forEach((x) => x.classList.toggle("oculto", !almoco));
  }

  function lerDias() {
    const hs = {};
    for (const el of $$(".dia")) {
      if (!$("[data-abre]", el).checked) continue;
      const v = (c) => $(`[data-c=${c}]`, el).value;
      const d = { abre: v("abre"), fecha: v("fecha") };
      if ($("[data-almoco]", el).checked) { d.almoco_ini = v("almoco_ini"); d.almoco_fim = v("almoco_fim"); }
      const erro = H.validarDia(d);
      if (erro) throw new Error(`${H.DIAS[el.dataset.dia]}: ${erro}.`);
      hs[el.dataset.dia] = d;
    }
    return hs;
  }

  async function salvar() {
    try {
      const hs = lerDias();
      const tem = Object.keys(hs).length > 0;
      // horário novo: o status volta a seguir o horário
      await A().salvarBarbearia({ horarios: tem ? hs : null, status_manual: null, status_ate: null });
      U.aviso(tem ? "Horário salvo. O status agora segue este horário." : "Nenhum dia marcado: horário apagado.");
      tela($("#corpo"));
    } catch (err) { U.aviso(err.message, "erro"); }
  }

  function copiar() {
    const dias = $$(".dia").filter((el) => $("[data-abre]", el).checked);
    if (!dias.length) return U.aviso("Marque pelo menos um dia primeiro.", "erro");
    const base = dias[0];
    $$(".dia").forEach((el) => {
      if (el === base || !$("[data-abre]", el).checked) return;
      $$("[data-c]", base).forEach((inp) => ($(`[data-c=${inp.dataset.c}]`, el).value = inp.value));
      $("[data-almoco]", el).checked = $("[data-almoco]", base).checked;
      ligarDia(el);
    });
    U.aviso(`Horário de ${H.DIAS[base.dataset.dia]} copiado. Confira e toque em Salvar.`);
  }

  async function apagar() {
    const ok = await U.confirmar("Apagar horário", "Apagar o horário de funcionamento? Você passará a abrir e fechar a barbearia manualmente em Configurações.", "Apagar", true);
    if (!ok) return;
    try { await A().salvarBarbearia({ horarios: null, status_manual: null, status_ate: null }); U.aviso("Horário apagado."); tela($("#corpo")); }
    catch (err) { U.aviso(err.message, "erro"); }
  }

  window.APP_ABAS = Object.assign(window.APP_ABAS || {}, { horario: tela });
})();
