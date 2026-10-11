/* =====================================================================
   supa.js — conversa com o Supabase sem biblioteca externa.
   SUPA.criar("chave") devolve um cliente com sessão própria, assim o
   painel de controle e o app do barbeiro não misturam logins.
   ===================================================================== */
(function () {
  "use strict";
  const C = window.CONFIG || {};
  const URL_ = String(C.SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/(rest|auth|functions|storage)\/v1$/, "");
  const ANON = String(C.SUPABASE_ANON_KEY || "");

  const TRADUCOES = [
    [/invalid login credentials/i, "E-mail ou senha incorretos."],
    [/email not confirmed/i, "E-mail ainda não confirmado."],
    [/token has expired or is invalid|otp.*(expired|invalid)/i, "Código incorreto ou vencido. Peça um novo."],
    [/only request this after (\d+) seconds?/i, (m) => `Aguarde ${m[1]} segundos antes de pedir outro código.`],
    [/rate limit/i, "Muitas tentativas seguidas. Espere alguns minutos e tente de novo."],
    [/password should be at least (\d+)/i, (m) => `A senha precisa ter pelo menos ${m[1]} caracteres.`],
    [/should be different from the old password/i, "A nova senha precisa ser diferente da atual."],
    [/user not found/i, "Conta não encontrada."],
    [/failed to fetch|networkerror|load failed/i, "Sem conexão com a internet. Confira e tente de novo."],
    [/jwt expired|invalid jwt/i, "Sua sessão expirou. Entre novamente."],
    [/permission denied|row-level security/i, "Você não tem permissão para fazer isso."],
  ];
  function traduzir(msg) {
    const s = String(msg || "Erro inesperado.");
    for (const [re, txt] of TRADUCOES) {
      const m = s.match(re);
      if (m) return typeof txt === "function" ? txt(m) : txt;
    }
    return s;
  }

  async function lerResposta(r) {
    const txt = await r.text();
    let d = null;
    try { d = txt ? JSON.parse(txt) : null; } catch (e) { d = txt; }
    if (!r.ok) {
      const msg = (d && (d.erro || d.msg || d.message || d.error_description || d.error)) || txt || r.statusText;
      const err = new Error(traduzir(msg));
      err.status = r.status; err.original = msg;
      throw err;
    }
    return d;
  }

  function criar(chave) {
    let sessao = ler();
    let renovando = null;

    function ler() {
      try { return JSON.parse(localStorage.getItem(chave) || sessionStorage.getItem(chave) || "null"); }
      catch (e) { return null; }
    }
    function gravar(s) {
      sessao = s;
      try {
        localStorage.removeItem(chave); sessionStorage.removeItem(chave);
        if (s) (s.manter ? localStorage : sessionStorage).setItem(chave, JSON.stringify(s));
      } catch (e) { /* modo privado: fica só na memória */ }
    }
    function guardarSessao(d, manter) {
      if (!d || !d.access_token) throw new Error("Resposta de login inválida.");
      gravar({
        access_token: d.access_token,
        refresh_token: d.refresh_token,
        expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
        user: d.user ? { id: d.user.id, email: d.user.email } : (sessao && sessao.user),
        manter: !!manter,
      });
      return sessao;
    }
    function cab(token, extra) {
      const h = Object.assign({ apikey: ANON, "Content-Type": "application/json" }, extra || {});
      if (token) h.Authorization = "Bearer " + token;
      else if (ANON.startsWith("eyJ")) h.Authorization = "Bearer " + ANON;
      return h;
    }

    async function token() {
      if (!sessao) return null;
      const agora = Math.floor(Date.now() / 1000);
      if (sessao.expires_at - 60 > agora) return sessao.access_token;
      if (!renovando) {
        renovando = (async () => {
          try {
            const r = await fetch(URL_ + "/auth/v1/token?grant_type=refresh_token", {
              method: "POST", headers: cab(null), body: JSON.stringify({ refresh_token: sessao.refresh_token }),
            });
            const d = await lerResposta(r);
            guardarSessao(d, sessao.manter);
            return sessao.access_token;
          } catch (e) {
            if (e.status && e.status < 500) gravar(null);   // refresh recusado: sai
            throw e;
          } finally { renovando = null; }
        })();
      }
      return renovando;
    }

    async function auth(caminho, corpo, metodo, comToken) {
      const t = comToken ? await token() : null;
      const r = await fetch(URL_ + "/auth/v1/" + caminho, {
        method: metodo || "POST", headers: cab(t), body: corpo ? JSON.stringify(corpo) : undefined,
      });
      return lerResposta(r);
    }

    return {
      configurado: () => !!(URL_ && ANON),
      url: URL_,
      sessao: () => sessao,
      traduzir,
      guardarSessao,
      token,
      async entrar(email, senha, manter) {
        const d = await auth("token?grant_type=password", { email: String(email).trim().toLowerCase(), password: senha });
        return guardarSessao(d, manter);
      },
      async sair() {
        try { if (sessao) await auth("logout", null, "POST", true); } catch (e) { /* sai mesmo assim */ }
        gravar(null);
      },
      esquecer() { gravar(null); },
      recuperar: (email) => auth("recover", { email: String(email).trim().toLowerCase() }),
      async verificarRecuperacao(email, codigo, manter) {
        const d = await auth("verify", { type: "recovery", email: String(email).trim().toLowerCase(), token: String(codigo).trim() });
        return guardarSessao(d, manter);
      },
      trocarSenha: (senha) => auth("user", { password: senha }, "PUT", true),

      async rest(caminho, op) {
        op = op || {};
        const t = await token();
        const extra = {};
        if (op.prefer) extra.Prefer = op.prefer;
        const r = await fetch(URL_ + "/rest/v1/" + caminho, {
          method: op.method || "GET", headers: cab(t, extra),
          body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
        });
        return lerResposta(r);
      },
      async rpc(nome, args) {
        const t = await token();
        const r = await fetch(URL_ + "/rest/v1/rpc/" + nome, {
          method: "POST", headers: cab(t), body: JSON.stringify(args || {}),
        });
        return lerResposta(r);
      },
      async fn(nome, corpo) {
        const t = await token();
        const r = await fetch(URL_ + "/functions/v1/" + nome, {
          method: "POST", headers: cab(t), body: JSON.stringify(corpo || {}),
        });
        return lerResposta(r);
      },
      async enviarArquivo(bucket, caminho, blob) {
        const t = await token();
        const h = cab(t, { "Content-Type": blob.type || "application/octet-stream", "x-upsert": "true" });
        const r = await fetch(URL_ + "/storage/v1/object/" + bucket + "/" + caminho, { method: "POST", headers: h, body: blob });
        await lerResposta(r);
        return URL_ + "/storage/v1/object/public/" + bucket + "/" + caminho + "?v=" + Date.now();
      },
      async apagarArquivo(bucket, caminho) {
        const t = await token();
        const r = await fetch(URL_ + "/storage/v1/object/" + bucket, {
          method: "DELETE", headers: cab(t), body: JSON.stringify({ prefixes: [caminho] }),
        });
        return lerResposta(r);
      },
    };
  }

  window.SUPA = { criar, traduzir };
})();
