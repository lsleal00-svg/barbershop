/* horario.js — aberto/fechado a partir do horário por dia da semana.
   horarios = { "0": {abre, almoco_ini?, almoco_fim?, fecha}, ... }  (0 = domingo; dia ausente = folga)
   Usado pelo app do barbeiro e pela tela do cliente. */
(function () {
  "use strict";
  const H = {};
  H.DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  H.DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

  const paraMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + m; };
  const paraHora = (min) => String(Math.floor(min / 60) % 24).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
  H.paraMin = paraMin; H.paraHora = paraHora;

  H.temHorario = (hs) => !!hs && Object.keys(hs).some((k) => hs[k] && hs[k].abre && hs[k].fecha);

  /* Relógio da barbearia: dia da semana e minutos desde a meia-noite no fuso dela. */
  H.relogio = function (fuso, agora) {
    agora = agora || new Date();
    const p = {};
    new Intl.DateTimeFormat("en-US", { timeZone: fuso || "America/Sao_Paulo", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(agora).forEach((x) => (p[x.type] = x.value));
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
    const min = Number(p.hour) * 60 + Number(p.minute);
    // diferença entre o relógio local da barbearia e o UTC, em minutos
    const localComoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
    const desvio = Math.round((localComoUtc - Math.floor(agora.getTime() / 60000) * 60000) / 60000);
    return { dia, min, desvio, meiaNoiteUtc: localComoUtc - min * 60000 - desvio * 60000 };
  };

  /* Trechos abertos do dia, em minutos: [[abre, almoco_ini], [almoco_fim, fecha]] */
  function trechos(d) {
    if (!d || !d.abre || !d.fecha) return [];
    const a = paraMin(d.abre), f = paraMin(d.fecha);
    if (d.almoco_ini && d.almoco_fim) return [[a, paraMin(d.almoco_ini)], [paraMin(d.almoco_fim), f]];
    return [[a, f]];
  }
  H.trechos = trechos;

  /* Situação pelo horário: { aberto, motivo: 'aberto'|'almoco'|'fechado'|'folga', ate, volta, proximo } */
  H.automatico = function (hs, fuso, agora) {
    const r = H.relogio(fuso, agora);
    const hoje = hs[String(r.dia)];
    const t = trechos(hoje);
    for (let i = 0; i < t.length; i++) {
      const [ini, fim] = t[i];
      if (r.min >= ini && r.min < fim) return { aberto: true, motivo: "aberto", ate: paraHora(fim), almocoAs: t.length === 2 && i === 0 };
    }
    if (t.length === 2 && r.min >= t[0][1] && r.min < t[1][0]) return { aberto: false, motivo: "almoco", volta: paraHora(t[1][0]) };
    // próxima abertura
    for (let k = 0; k < 8; k++) {
      const dia = (r.dia + k) % 7, tt = trechos(hs[String(dia)]);
      for (const [ini] of tt) if (k > 0 || ini > r.min) {
        return { aberto: false, motivo: t.length ? "fechado" : "folga", proximo: { dias: k, dia, hora: paraHora(ini) } };
      }
    }
    return { aberto: false, motivo: "fechado" };
  };

  /* Próximo momento em que o horário muda (abre, almoço, volta, fecha), como Date. */
  H.proximaMudanca = function (hs, fuso, agora) {
    agora = agora || new Date();
    if (!H.temHorario(hs)) return null;
    const r = H.relogio(fuso, agora);
    for (let k = 0; k < 8; k++) {
      const dia = (r.dia + k) % 7;
      const marcos = trechos(hs[String(dia)]).flat().sort((a, b) => a - b);
      for (const m of marcos) if (k > 0 || m > r.min) return new Date(r.meiaNoiteUtc + (k * 1440 + m) * 60000);
    }
    return null;
  };

  /* Situação final, considerando o status manual (vale até o próximo horário, ou para sempre sem horário). */
  H.situacao = function (b, agora) {
    agora = agora || new Date();
    const hs = b.horarios || {};
    const manualValendo = b.status_manual && (!b.status_ate || agora < new Date(b.status_ate));
    if (manualValendo) {
      return { aberto: b.status_manual === "aberto", motivo: "manual", manual: true,
               ate: b.status_ate ? new Date(b.status_ate) : null };
    }
    if (!H.temHorario(hs)) return { aberto: true, motivo: "aberto", semHorario: true };
    return H.automatico(hs, b.fuso, agora);
  };

  H.texto = function (s) {
    if (s.motivo === "manual") return s.aberto ? "Aberto agora" : "Fechado agora";
    if (s.motivo === "aberto") return s.ate ? (s.almocoAs ? `Aberto · almoço às ${s.ate}` : `Aberto · fecha às ${s.ate}`) : "Aberto";
    if (s.motivo === "almoco") return `Em almoço · volta às ${s.volta}`;
    if (s.proximo) {
      const quando = s.proximo.dias === 0 ? "hoje" : s.proximo.dias === 1 ? "amanhã" : H.DIAS_CURTOS[s.proximo.dia];
      return `Fechado · abre ${quando} às ${s.proximo.hora}`;
    }
    return "Fechado";
  };

  H.textoCurto = (s) => (s.aberto ? "Aberto" : s.motivo === "almoco" ? "Em almoço" : "Fechado");

  /* Confere um dia: abre < almoço < volta < fecha. Devolve mensagem de erro ou null. */
  H.validarDia = function (d) {
    if (!d.abre || !d.fecha) return "informe abertura e fechamento";
    const a = paraMin(d.abre), f = paraMin(d.fecha);
    if (f <= a) return "o fechamento precisa ser depois da abertura";
    if (d.almoco_ini || d.almoco_fim) {
      if (!d.almoco_ini || !d.almoco_fim) return "informe início e fim do almoço";
      const i = paraMin(d.almoco_ini), v = paraMin(d.almoco_fim);
      if (!(a < i && i < v && v < f)) return "o almoço precisa ficar dentro do expediente";
    }
    return null;
  };

  if (typeof module !== "undefined") module.exports = H; else window.HORARIO = H;
})();
