/* pix.js — monta o "Pix Copia e Cola" (BR Code estático do Banco Central)
   a partir da chave, do nome e da cidade. O valor é opcional (entra na Fase 3). */
(function () {
  "use strict";
  const P = {};

  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const limpo = (s, max) => semAcento(s).replace(/[^A-Za-z0-9 .\-]/g, "").replace(/\s+/g, " ").trim().slice(0, max).toUpperCase();
  const campo = (id, valor) => id + String(valor.length).padStart(2, "0") + valor;

  function crc16(txt) {
    let crc = 0xffff;
    for (let i = 0; i < txt.length; i++) {
      crc ^= txt.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  P.crc16 = crc16;

  /* Deixa a chave no formato que os bancos esperam. */
  P.normalizarChave = function (tipo, chave) {
    const c = String(chave || "").trim();
    if (tipo === "cpf" || tipo === "cnpj") return c.replace(/\D/g, "");
    if (tipo === "email") return c.toLowerCase();
    if (tipo === "telefone") {
      let d = c.replace(/\D/g, "");
      if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
      return "+55" + d;
    }
    return c.toLowerCase();
  };

  P.validarChave = function (tipo, chave) {
    const c = P.normalizarChave(tipo, chave);
    if (tipo === "cpf") return /^\d{11}$/.test(c) ? null : "CPF precisa ter 11 números.";
    if (tipo === "cnpj") return /^\d{14}$/.test(c) ? null : "CNPJ precisa ter 14 números.";
    if (tipo === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && c.length <= 77 ? null : "E-mail inválido.";
    if (tipo === "telefone") return /^\+55\d{10,11}$/.test(c) ? null : "Telefone com DDD, ex.: (91) 98888-7777.";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(c) ? null : "Chave aleatória tem o formato 0000aaaa-00aa-00aa-00aa-000000aaaaaa.";
  };

  P.copiaECola = function ({ tipo, chave, titular, cidade, valor, txid }) {
    const conta = campo("00", "br.gov.bcb.pix") + campo("01", P.normalizarChave(tipo, chave));
    let s = campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986");
    if (valor && Number(valor) > 0) s += campo("54", Number(valor).toFixed(2));
    s += campo("58", "BR") + campo("59", limpo(titular, 25) || "RECEBEDOR") + campo("60", limpo(cidade, 15) || "BRASIL");
    s += campo("62", campo("05", (txid || "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***"));
    s += "6304";
    return s + crc16(s);
  };

  P.NOMES = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone", aleatoria: "Chave aleatória" };
  P.mostrarChave = function (tipo, chave) {
    const c = P.normalizarChave(tipo, chave);
    if (tipo === "cpf") return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (tipo === "cnpj") return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    if (tipo === "telefone") return c.replace(/^\+55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3");
    return c;
  };

  if (typeof module !== "undefined") module.exports = P; else window.PIX = P;
})();
