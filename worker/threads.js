// Publicação no Threads pela API oficial da Meta. Mesmo esquema do Instagram (worker/instagram.js):
// fila em fila/threads.json, cron a cada 5 min, registro no D1 (th_publicados) e renovação do token.
// Cada item: { id, publicar_em, posts: [ { texto, midias? }, ... ] }. O 1º post pode ter 1 imagem
// ou um carrossel (2 a 20); os seguintes saem como respostas encadeadas (uma thread, como no X).
// Segredos no Cloudflare: THREADS_USER_ID e THREADS_ACCESS_TOKEN.
import FILA from '../fila/threads.json';

const API = 'https://graph.threads.net/v1.0';
const ATRASO_MAX_H = 6;
const TENTATIVAS_MAX = 3;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS th_publicados (id TEXT PRIMARY KEY, status TEXT NOT NULL, tentativas INTEGER NOT NULL DEFAULT 0, media_id TEXT, erro TEXT, atualizado_em TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS th_config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL)`,
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(caminho, params, metodo = 'POST') {
  const corpo = new URLSearchParams(params);
  const res = metodo === 'GET' ? await fetch(`${API}/${caminho}?${corpo}`) : await fetch(`${API}/${caminho}`, { method: 'POST', body: corpo });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados.error) throw new Error((dados.error && dados.error.message) || `HTTP ${res.status}`);
  return dados;
}

async function token(env) {
  const salvo = await env.DB.prepare("SELECT valor, atualizado_em FROM th_config WHERE chave = 'token'").first();
  let atual = salvo ? salvo.valor : env.THREADS_ACCESS_TOKEN;
  const idade = salvo ? Date.now() - Date.parse(salvo.atualizado_em) : Infinity;
  if (atual && idade > 7 * 24 * 3600 * 1000) {
    try {
      const r = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(atual)}`);
      const d = await r.json();
      if (d.access_token) {
        atual = d.access_token;
        await env.DB.prepare("INSERT INTO th_config (chave, valor, atualizado_em) VALUES ('token', ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em")
          .bind(atual, new Date().toISOString()).run();
      } else console.error('threads: renovação do token falhou', d.error && d.error.message);
    } catch (e) { console.error('threads: renovação do token falhou', e.message); }
  }
  return atual;
}

async function pronto(id, tk) {
  for (let i = 0; i < 20; i++) {
    const d = await chamar(id, { fields: 'status,error_message', access_token: tk }, 'GET');
    if (d.status === 'FINISHED') return;
    if (d.status === 'ERROR' || d.status === 'EXPIRED') throw new Error(`container ${d.status}: ${d.error_message || ''}`);
    await espera(3000);
  }
  throw new Error('container demorou demais');
}

// Cria e publica um post; devolve o id publicado.
async function postar(post, env, tk, respostaA) {
  const uid = env.THREADS_USER_ID;
  const base = { access_token: tk, ...(respostaA ? { reply_to_id: respostaA } : {}) };
  const midias = post.midias || [];
  let c;
  if (midias.length > 1) {
    const filhos = [];
    for (const url of midias.slice(0, 20)) {
      const f = await chamar(`${uid}/threads`, { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true', access_token: tk });
      await pronto(f.id, tk);
      filhos.push(f.id);
    }
    c = await chamar(`${uid}/threads`, { ...base, media_type: 'CAROUSEL', children: filhos.join(','), text: post.texto || '' });
  } else if (midias.length === 1) {
    c = await chamar(`${uid}/threads`, { ...base, media_type: 'IMAGE', image_url: midias[0], text: post.texto || '' });
  } else {
    c = await chamar(`${uid}/threads`, { ...base, media_type: 'TEXT', text: post.texto });
  }
  await pronto(c.id, tk);
  const pub = await chamar(`${uid}/threads_publish`, { creation_id: c.id, access_token: tk });
  return pub.id;
}

async function marcar(env, id, status, tentativas, mediaId, erro) {
  await env.DB.prepare(
    `INSERT INTO th_publicados (id, status, tentativas, media_id, erro, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, tentativas = excluded.tentativas, media_id = excluded.media_id, erro = excluded.erro, atualizado_em = excluded.atualizado_em`
  ).bind(id, status, tentativas, mediaId, erro, new Date().toISOString()).run();
}

export async function rodarFilaThreads(env) {
  if (!env.DB || !env.THREADS_USER_ID || !env.THREADS_ACCESS_TOKEN) return;
  for (const s of SCHEMA) await env.DB.exec(s);
  const agora = Date.now();
  const vencidos = FILA.filter((p) => Date.parse(p.publicar_em) <= agora);
  if (!vencidos.length) return;
  const tk = await token(env);
  for (const item of vencidos) {
    const reg = await env.DB.prepare('SELECT status, tentativas, media_id FROM th_publicados WHERE id = ?').bind(item.id).first();
    if (reg && (reg.status === 'publicado' || reg.status === 'expirado' || reg.tentativas >= TENTATIVAS_MAX)) continue;
    // Se a thread já começou (1º post saiu), não recomeça: evita post duplicado.
    if (reg && reg.media_id) { await marcar(env, item.id, 'erro', reg.tentativas, reg.media_id, 'thread parou no meio; conferir no Threads'); continue; }
    if (agora - Date.parse(item.publicar_em) > ATRASO_MAX_H * 3600 * 1000) { await marcar(env, item.id, 'expirado', reg ? reg.tentativas : 0, null, 'passou da hora'); continue; }
    const tentativas = (reg ? reg.tentativas : 0) + 1;
    let primeiro = null;
    try {
      let anterior = null;
      for (const post of item.posts) {
        anterior = await postar(post, env, tk, anterior);
        if (!primeiro) { primeiro = anterior; await marcar(env, item.id, 'publicando', tentativas, primeiro, null); }
      }
      await marcar(env, item.id, 'publicado', tentativas, primeiro, null);
      console.log('threads: publicado', item.id, primeiro);
    } catch (e) {
      const status = primeiro ? 'erro' : (tentativas >= TENTATIVAS_MAX ? 'erro' : 'pendente');
      await marcar(env, item.id, status, tentativas, primeiro, String(e.message).slice(0, 300));
      console.error('threads: falhou', item.id, e.message);
    }
  }
}

// Situação da fila (sem dados sensíveis): GET /api/threads/fila
export async function situacaoThreads(env) {
  const configurado = Boolean(env.THREADS_USER_ID && env.THREADS_ACCESS_TOKEN);
  let regs = [];
  let conta = null;
  if (env.DB) {
    for (const s of SCHEMA) await env.DB.exec(s);
    regs = (await env.DB.prepare('SELECT id, status, tentativas, erro FROM th_publicados').all()).results || [];
    if (configurado) {
      try { const d = await chamar('me', { fields: 'username', access_token: await token(env) }, 'GET'); conta = { usuario: d.username }; }
      catch (e) { conta = { erro: String(e.message).slice(0, 200) }; }
    }
  }
  const mapa = Object.fromEntries(regs.map((r) => [r.id, r]));
  return {
    configurado,
    conta,
    fila: FILA.map((p) => ({ id: p.id, posts: p.posts.length, publicar_em: p.publicar_em, ...(mapa[p.id] ? { status: mapa[p.id].status, tentativas: mapa[p.id].tentativas, erro: mapa[p.id].erro } : { status: 'aguardando' }) })),
  };
}
