// Publicação no X pela API oficial (pago por uso), autenticação OAuth 1.0a (chaves que não expiram).
// Mesmo esquema das outras filas: fila/x.json, cron a cada 5 min, registro no D1 (x_publicados).
// Cada item: { id, publicar_em, posts: ["texto 1", "texto 2", ...] } → thread encadeada (até 280 caracteres cada).
// Custo: post com link sai bem mais caro na API do X; preferir threads sem link (link da matéria na bio).
// Segredos no Cloudflare: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.
import FILA from '../fila/x.json';

const URL_POST = 'https://api.x.com/2/tweets';
const ATRASO_MAX_H = 6;
const TENTATIVAS_MAX = 3;
const SCHEMA = `CREATE TABLE IF NOT EXISTS x_publicados (id TEXT PRIMARY KEY, status TEXT NOT NULL, tentativas INTEGER NOT NULL DEFAULT 0, post_id TEXT, erro TEXT, atualizado_em TEXT NOT NULL)`;

const pct = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmacSha1(chave, texto) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// Cabeçalho OAuth 1.0a. Corpo em JSON não entra na assinatura.
async function autorizacao(env, metodo, url) {
  const p = {
    oauth_consumer_key: env.X_API_KEY,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const params = Object.keys(p).sort().map((k) => `${pct(k)}=${pct(p[k])}`).join('&');
  const base = [metodo, pct(url), pct(params)].join('&');
  p.oauth_signature = await hmacSha1(`${pct(env.X_API_SECRET)}&${pct(env.X_ACCESS_SECRET)}`, base);
  return 'OAuth ' + Object.keys(p).sort().map((k) => `${pct(k)}="${pct(p[k])}"`).join(', ');
}

async function postar(env, texto, respostaA) {
  const corpo = { text: texto, ...(respostaA ? { reply: { in_reply_to_tweet_id: respostaA } } : {}) };
  const res = await fetch(URL_POST, {
    method: 'POST',
    headers: { Authorization: await autorizacao(env, 'POST', URL_POST), 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.data) throw new Error(d.detail || d.title || (d.errors && d.errors[0] && d.errors[0].message) || `HTTP ${res.status}`);
  return d.data.id;
}

async function marcar(env, id, status, tentativas, postId, erro) {
  await env.DB.prepare(
    `INSERT INTO x_publicados (id, status, tentativas, post_id, erro, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, tentativas = excluded.tentativas, post_id = excluded.post_id, erro = excluded.erro, atualizado_em = excluded.atualizado_em`
  ).bind(id, status, tentativas, postId, erro, new Date().toISOString()).run();
}

const configuradoX = (env) => Boolean(env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_SECRET);

export async function rodarFilaX(env) {
  if (!env.DB || !configuradoX(env)) return;
  await env.DB.exec(SCHEMA);
  const agora = Date.now();
  for (const item of FILA.filter((p) => Date.parse(p.publicar_em) <= agora)) {
    const reg = await env.DB.prepare('SELECT status, tentativas, post_id FROM x_publicados WHERE id = ?').bind(item.id).first();
    if (reg && (reg.status === 'publicado' || reg.status === 'expirado' || reg.tentativas >= TENTATIVAS_MAX)) continue;
    if (reg && reg.post_id) { await marcar(env, item.id, 'erro', reg.tentativas, reg.post_id, 'thread parou no meio; conferir no X'); continue; }
    if (agora - Date.parse(item.publicar_em) > ATRASO_MAX_H * 3600 * 1000) { await marcar(env, item.id, 'expirado', reg ? reg.tentativas : 0, null, 'passou da hora'); continue; }
    const tentativas = (reg ? reg.tentativas : 0) + 1;
    let primeiro = null;
    try {
      let anterior = null;
      for (const texto of item.posts) {
        anterior = await postar(env, texto, anterior);
        if (!primeiro) { primeiro = anterior; await marcar(env, item.id, 'publicando', tentativas, primeiro, null); }
      }
      await marcar(env, item.id, 'publicado', tentativas, primeiro, null);
      console.log('x: publicado', item.id, primeiro);
    } catch (e) {
      await marcar(env, item.id, primeiro || tentativas >= TENTATIVAS_MAX ? 'erro' : 'pendente', tentativas, primeiro, String(e.message).slice(0, 300));
      console.error('x: falhou', item.id, e.message);
    }
  }
}

// Formato das chaves, sem mostrar valor: Consumer Key ~25 caracteres, Consumer Secret ~50,
// Access Token "números-letras" ~50, Access Secret ~45. Client ID/Secret do OAuth 2.0 têm outro formato.
function formatoChaves(env) {
  const f = (v) => (v ? { tamanho: v.length, espaco_sobrando: v !== v.trim() || /\s/.test(v) } : 'faltando');
  return {
    X_API_KEY: f(env.X_API_KEY), X_API_SECRET: f(env.X_API_SECRET),
    X_ACCESS_TOKEN: { ...f(env.X_ACCESS_TOKEN), ...(env.X_ACCESS_TOKEN ? { formato_numero_traco: /^\d+-\w+$/.test(env.X_ACCESS_TOKEN.trim()) } : {}) },
    X_ACCESS_SECRET: f(env.X_ACCESS_SECRET),
  };
}

// Situação da fila (sem dados sensíveis): GET /api/x/fila. Não chama a API do X (cada chamada custa).
export async function situacaoX(env) {
  let regs = [];
  if (env.DB) { await env.DB.exec(SCHEMA); regs = (await env.DB.prepare('SELECT id, status, tentativas, erro FROM x_publicados').all()).results || []; }
  const mapa = Object.fromEntries(regs.map((r) => [r.id, r]));
  return {
    configurado: configuradoX(env),
    chaves: formatoChaves(env),
    fila: FILA.map((p) => ({ id: p.id, posts: p.posts.length, publicar_em: p.publicar_em, ...(mapa[p.id] ? { status: mapa[p.id].status, tentativas: mapa[p.id].tentativas, erro: mapa[p.id].erro } : { status: 'aguardando' }) })),
  };
}
