// Publicação no Instagram pela API oficial da Meta (Instagram API com login do Instagram).
// A fila fica em fila/instagram.json (vai junto no deploy). A cada 5 minutos o cron do Worker
// publica o que já passou da hora e anota no D1 (tabela ig_publicados) pra não repetir.
// Segredos no Cloudflare: IG_USER_ID e IG_ACCESS_TOKEN (token de 60 dias; o Worker renova sozinho).
// REELS: o vídeo leva minutos pra processar, então o container fica "processando" no D1 e é publicado num ciclo seguinte do cron.
import FILA from '../fila/instagram.json';

const API = 'https://graph.instagram.com';
const VERSAO = 'v23.0';
const ATRASO_MAX_H = 6; // post que passou mais que isso da hora não sai mais (fica "expirado")
const TENTATIVAS_MAX = 3;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS ig_publicados (id TEXT PRIMARY KEY, status TEXT NOT NULL, tentativas INTEGER NOT NULL DEFAULT 0, media_id TEXT, erro TEXT, atualizado_em TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ig_config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL)`,
];

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function chamar(caminho, params, metodo = 'POST') {
  const url = new URL(`${API}/${VERSAO}/${caminho}`);
  const corpo = new URLSearchParams(params);
  const res = metodo === 'GET'
    ? await fetch(`${url}?${corpo}`)
    : await fetch(url, { method: 'POST', body: corpo });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || dados.error) throw new Error((dados.error && dados.error.message) || `HTTP ${res.status}`);
  return dados;
}

async function guardar(env, chave, valor) {
  await env.DB.prepare("INSERT INTO ig_config (chave, valor, atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em")
    .bind(chave, valor, new Date().toISOString()).run();
}

// Token recusado ou acesso bloqueado pela Meta (senha trocada, sessão invalidada, app bloqueado): não é culpa do post, então não gasta tentativa.
export const tokenRecusado = (msg) => /access token|session has been invalidated|OAuthException|API access blocked/i.test(String(msg));

async function token(env) {
  // Secret novo gravado no Cloudflare (ex.: depois de a Meta invalidar a sessão): passa a valer ele, no lugar do renovado no D1.
  const origem = String(env.IG_ACCESS_TOKEN || '').slice(-16);
  const anotada = await env.DB.prepare("SELECT valor FROM ig_config WHERE chave = 'origem'").first();
  if (!anotada || anotada.valor !== origem) {
    await guardar(env, 'token', env.IG_ACCESS_TOKEN);
    await guardar(env, 'origem', origem);
    console.log('instagram: usando o token novo do Cloudflare');
  }
  const salvo = await env.DB.prepare("SELECT valor, atualizado_em FROM ig_config WHERE chave = 'token'").first();
  let atual = salvo ? salvo.valor : env.IG_ACCESS_TOKEN;
  // Renova o token de 60 dias uma vez por semana.
  const idade = salvo ? Date.now() - Date.parse(salvo.atualizado_em) : Infinity;
  if (atual && idade > 7 * 24 * 3600 * 1000) {
    try {
      const r = await fetch(`${API}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(atual)}`);
      const d = await r.json();
      if (d.access_token) {
        atual = d.access_token;
        await env.DB.prepare("INSERT INTO ig_config (chave, valor, atualizado_em) VALUES ('token', ?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em")
          .bind(atual, new Date().toISOString()).run();
      } else console.error('instagram: renovação do token falhou', d.error && d.error.message);
    } catch (e) { console.error('instagram: renovação do token falhou', e.message); }
  }
  return atual;
}

async function pronto(id, tk) {
  for (let i = 0; i < 15; i++) {
    const d = await chamar(id, { fields: 'status_code', access_token: tk }, 'GET');
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') throw new Error(`container ${d.status_code}`);
    await espera(3000);
  }
  throw new Error('container demorou demais');
}

async function publicar(post, env, tk) {
  const ig = env.IG_USER_ID;
  let criacao;
  if (post.tipo === 'CARROSSEL') {
    const filhos = [];
    for (const url of post.midias.slice(0, 10)) {
      const c = await chamar(`${ig}/media`, { image_url: url, is_carousel_item: 'true', access_token: tk });
      await pronto(c.id, tk);
      filhos.push(c.id);
    }
    criacao = await chamar(`${ig}/media`, { media_type: 'CAROUSEL', children: filhos.join(','), caption: post.legenda || '', access_token: tk });
  } else if (post.tipo === 'REELS') {
    // Não espera o processamento aqui: devolve o container pra ser publicado num ciclo seguinte do cron.
    const c = await chamar(`${ig}/media`, { media_type: 'REELS', video_url: post.midias[0], ...(post.capa ? { cover_url: post.capa } : {}), caption: post.legenda || '', share_to_feed: 'true', access_token: tk });
    return { processando: c.id };
  } else if (post.tipo === 'STORY') {
    criacao = await chamar(`${ig}/media`, { media_type: 'STORIES', image_url: post.midias[0], access_token: tk });
  } else {
    criacao = await chamar(`${ig}/media`, { image_url: post.midias[0], caption: post.legenda || '', access_token: tk });
  }
  await pronto(criacao.id, tk);
  const pub = await chamar(`${ig}/media_publish`, { creation_id: criacao.id, access_token: tk });
  return pub.id;
}

async function marcar(env, id, status, tentativas, mediaId, erro) {
  await env.DB.prepare(
    `INSERT INTO ig_publicados (id, status, tentativas, media_id, erro, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status, tentativas = excluded.tentativas, media_id = excluded.media_id, erro = excluded.erro, atualizado_em = excluded.atualizado_em`
  ).bind(id, status, tentativas, mediaId, erro, new Date().toISOString()).run();
}

// Reel enviado num ciclo anterior: publica quando o Instagram terminar de processar o vídeo.
async function conferirReel(env, post, reg, tk) {
  try {
    const d = await chamar(reg.media_id, { fields: 'status_code', access_token: tk }, 'GET');
    if (d.status_code === 'FINISHED') {
      const pub = await chamar(`${env.IG_USER_ID}/media_publish`, { creation_id: reg.media_id, access_token: tk });
      await marcar(env, post.id, 'publicado', reg.tentativas, pub.id, null);
      console.log('instagram: reel publicado', post.id, pub.id);
    } else if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') {
      await marcar(env, post.id, reg.tentativas >= TENTATIVAS_MAX ? 'erro' : 'pendente', reg.tentativas, null, `vídeo ${d.status_code}`);
    } else if (Date.now() - Date.parse(post.publicar_em) > ATRASO_MAX_H * 3600 * 1000) {
      await marcar(env, post.id, 'erro', reg.tentativas, null, 'vídeo não terminou de processar');
    }
  } catch (e) {
    if (tokenRecusado(e.message)) return; // segue "processando" até o token voltar (ou passar da hora)
    await marcar(env, post.id, reg.tentativas >= TENTATIVAS_MAX ? 'erro' : 'pendente', reg.tentativas, null, String(e.message).slice(0, 300));
  }
}

export async function rodarFila(env) {
  if (!env.DB || !env.IG_USER_ID || !env.IG_ACCESS_TOKEN) return; // ainda não configurado
  for (const s of SCHEMA) await env.DB.exec(s);
  const agora = Date.now();
  const vencidos = FILA.filter((p) => Date.parse(p.publicar_em) <= agora);
  if (!vencidos.length) return;
  const tk = await token(env);
  for (const post of vencidos) {
    const reg = await env.DB.prepare('SELECT status, tentativas, media_id FROM ig_publicados WHERE id = ?').bind(post.id).first();
    if (reg && reg.status === 'processando') { await conferirReel(env, post, reg, tk); continue; }
    if (reg && (reg.status === 'publicado' || reg.status === 'expirado' || reg.tentativas >= TENTATIVAS_MAX)) continue;
    if (agora - Date.parse(post.publicar_em) > ATRASO_MAX_H * 3600 * 1000) { await marcar(env, post.id, 'expirado', reg ? reg.tentativas : 0, null, 'passou da hora'); continue; }
    const tentativas = (reg ? reg.tentativas : 0) + 1;
    try {
      const mediaId = await publicar(post, env, tk);
      if (mediaId && mediaId.processando) { await marcar(env, post.id, 'processando', tentativas, mediaId.processando, null); continue; }
      await marcar(env, post.id, 'publicado', tentativas, mediaId, null);
      console.log('instagram: publicado', post.id, mediaId);
    } catch (e) {
      const t = tokenRecusado(e.message) ? tentativas - 1 : tentativas;
      await marcar(env, post.id, t >= TENTATIVAS_MAX ? 'erro' : 'pendente', t, null, String(e.message).slice(0, 300));
      console.error('instagram: falhou', post.id, e.message);
    }
  }
}

// Situação da fila (sem dados sensíveis): GET /api/ig/fila
export async function situacao(env) {
  const configurado = Boolean(env.IG_USER_ID && env.IG_ACCESS_TOKEN);
  let regs = [];
  if (env.DB) {
    for (const s of SCHEMA) await env.DB.exec(s);
    regs = (await env.DB.prepare('SELECT id, status, tentativas, erro, atualizado_em FROM ig_publicados').all()).results || [];
  }
  const mapa = Object.fromEntries(regs.map((r) => [r.id, r]));
  let conta = null;
  if (configurado && env.DB) {
    try {
      const d = await chamar('me', { fields: 'username,account_type', access_token: await token(env) }, 'GET');
      conta = { usuario: d.username, tipo: d.account_type };
    } catch (e) { conta = { erro: String(e.message).slice(0, 200) }; }
  }
  return {
    configurado,
    conta,
    fila: FILA.map((p) => ({ id: p.id, tipo: p.tipo, publicar_em: p.publicar_em, ...(mapa[p.id] ? { status: mapa[p.id].status, tentativas: mapa[p.id].tentativas, erro: mapa[p.id].erro } : { status: 'aguardando' }) })),
  };
}
