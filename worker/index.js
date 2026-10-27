// Modo Máquina: Worker do site.
// Serve as páginas estáticas (pasta out/), a API da newsletter, o contador de visitas (sem cookie), as filas do Instagram, do Threads e do X e o radar de manchetes (crons).
// A lista de inscritos fica no banco D1 do próprio Cloudflare (binding DB).

import { rodarFila, situacao } from './instagram.js';
import { rodarFilaThreads, situacaoThreads } from './threads.js';
import { rodarFilaX, situacaoX } from './x.js';
import { rodarRadar, paginaRadar } from './radar.js';
import { registrarVisita, paginaMetricas } from './metricas.js';

const ORIGENS = ['https://modomaquina.com.br', 'https://www.modomaquina.com.br', 'https://modomaquina.marlon-assinaturas.workers.dev'];
const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Cache-Control': 'no-store',
};

const SCHEMA = `CREATE TABLE IF NOT EXISTS inscritos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ativo',
  origem TEXT,
  consentimento TEXT NOT NULL,
  token TEXT NOT NULL,
  ip_hash TEXT,
  criado_em TEXT NOT NULL,
  saiu_em TEXT
)`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...SEGURANCA, 'Content-Type': 'application/json; charset=utf-8' } });

const pagina = (titulo, texto, status = 200) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${titulo} · Modo Máquina</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0E0E10;color:#FAFAFA;font-family:system-ui,sans-serif;padding:24px}main{max-width:460px}h1{font-size:28px;text-transform:uppercase;margin:0 0 12px}b{color:#FF5A1F}a{color:#2DA6FF}</style></head><body><main><p>MODO <b>MÁQUINA</b></p><h1>${titulo}</h1><p>${texto}</p><p><a href="https://modomaquina.com.br">Voltar pro site</a></p></main></body></html>`,
    { status, headers: { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" } }
  );

async function sha256(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const EMAIL_OK = /^[^\s@<>"']{1,64}@[^\s@<>"']+\.[a-z]{2,}$/i;

async function inscrever(req, env) {
  const origem = req.headers.get('Origin');
  if (!origem || !ORIGENS.includes(origem)) return json({ ok: false, erro: 'origem' }, 403);
  if (!(req.headers.get('Content-Type') || '').includes('application/json')) return json({ ok: false, erro: 'formato' }, 415);
  if (Number(req.headers.get('Content-Length') || 0) > 2048) return json({ ok: false, erro: 'tamanho' }, 413);

  let dados;
  try { dados = await req.json(); } catch { return json({ ok: false, erro: 'formato' }, 400); }
  const email = String(dados.email || '').trim().toLowerCase();
  const lugar = String(dados.origem || 'site').slice(0, 80);

  // Robôs: campo escondido preenchido ou envio rápido demais. Respondemos "ok" sem salvar.
  if (dados.site || Number(dados.ms || 0) < 2500) return json({ ok: true });
  if (email.length > 254 || !EMAIL_OK.test(email)) return json({ ok: false, erro: 'email' }, 400);
  if (dados.aceite !== true) return json({ ok: false, erro: 'aceite' }, 400);
  if (!env.DB) return json({ ok: false, erro: 'indisponivel' }, 503);

  await env.DB.exec(SCHEMA.replace(/\n\s*/g, ' '));
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const ipHash = (await sha256(ip + '|' + new Date().toISOString().slice(0, 10) + '|modomaquina')).slice(0, 32);

  // Limite simples: no máximo 5 inscrições por IP a cada 10 minutos.
  const recente = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM inscritos WHERE ip_hash = ? AND criado_em > ?').bind(ipHash, recente).first();
  if (n >= 5) return json({ ok: false, erro: 'limite' }, 429);

  const agora = new Date().toISOString();
  const token = crypto.randomUUID().replace(/-/g, '');
  await env.DB.prepare(
    `INSERT INTO inscritos (email, status, origem, consentimento, token, ip_hash, criado_em)
     VALUES (?, 'ativo', ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET status = 'ativo', saiu_em = NULL, consentimento = excluded.consentimento`
  ).bind(email, lugar, agora, token, ipHash, agora).run();
  return json({ ok: true });
}

const SCHEMA_CONTATO = `CREATE TABLE IF NOT EXISTS contatos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, email TEXT NOT NULL, assunto TEXT, mensagem TEXT NOT NULL, ip_hash TEXT, criado_em TEXT NOT NULL, respondido INTEGER NOT NULL DEFAULT 0)`;

// Formulário da página /contato. Mensagens ficam no D1 (tabela contatos): ver no painel D1 → Console.
async function contato(req, env) {
  const origem = req.headers.get('Origin');
  if (!origem || !ORIGENS.includes(origem)) return json({ ok: false, erro: 'origem' }, 403);
  if (!(req.headers.get('Content-Type') || '').includes('application/json')) return json({ ok: false, erro: 'formato' }, 415);
  if (Number(req.headers.get('Content-Length') || 0) > 8192) return json({ ok: false, erro: 'tamanho' }, 413);
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, erro: 'formato' }, 400); }
  if (d.site || Number(d.ms || 0) < 3000) return json({ ok: true }); // robô: finge que deu certo
  const nome = String(d.nome || '').trim().slice(0, 80);
  const email = String(d.email || '').trim().toLowerCase();
  const assunto = String(d.assunto || '').trim().slice(0, 60);
  const mensagem = String(d.mensagem || '').trim().slice(0, 3000);
  if (!nome) return json({ ok: false, erro: 'nome' }, 400);
  if (email.length > 254 || !EMAIL_OK.test(email)) return json({ ok: false, erro: 'email' }, 400);
  if (mensagem.length < 10) return json({ ok: false, erro: 'mensagem' }, 400);
  if (d.aceite !== true) return json({ ok: false, erro: 'aceite' }, 400);
  if (!env.DB) return json({ ok: false, erro: 'indisponivel' }, 503);
  await env.DB.exec(SCHEMA_CONTATO);
  const ipHash = (await sha256((req.headers.get('CF-Connecting-IP') || '') + '|' + new Date().toISOString().slice(0, 10) + '|modomaquina')).slice(0, 32);
  const recente = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM contatos WHERE ip_hash = ? AND criado_em > ?').bind(ipHash, recente).first();
  if (n >= 3) return json({ ok: false, erro: 'limite' }, 429);
  await env.DB.prepare('INSERT INTO contatos (nome, email, assunto, mensagem, ip_hash, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(nome, email, assunto, mensagem, ipHash, new Date().toISOString()).run();
  return json({ ok: true });
}

async function sair(url, env) {
  const token = (url.searchParams.get('t') || '').replace(/[^a-f0-9]/g, '');
  if (!env.DB || token.length !== 32) return pagina('Link inválido', 'Esse link de descadastro não é válido. Se quiser sair da lista, responda qualquer e-mail nosso pedindo.', 400);
  await env.DB.exec(SCHEMA.replace(/\n\s*/g, ' '));
  const r = await env.DB.prepare("UPDATE inscritos SET status = 'saiu', saiu_em = ? WHERE token = ?").bind(new Date().toISOString(), token).run();
  if (!r.meta.changes) return pagina('Link inválido', 'Não encontramos esse cadastro. Talvez você já tenha saído da lista.', 404);
  return pagina('Pronto, você saiu', 'Você não vai mais receber a newsletter do Modo Máquina. Se mudar de ideia, é só se inscrever de novo no site.');
}

// Vídeos grandes no R2 (bucket modomaquina-midia): GET/HEAD /m/<chave>, com suporte a Range (Instagram e TikTok baixam em partes).
async function midia(req, env, url) {
  if (!env.MIDIA || !['GET', 'HEAD'].includes(req.method)) return new Response('não encontrado', { status: 404 });
  const chave = decodeURIComponent(url.pathname.slice(3));
  if (!/^[\w\-/.]+$/.test(chave) || chave.includes('..')) return new Response('não encontrado', { status: 404 });
  const obj = req.method === 'HEAD' ? await env.MIDIA.head(chave) : await env.MIDIA.get(chave, { range: req.headers, onlyIf: req.headers });
  if (!obj) return new Response('não encontrado', { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('Accept-Ranges', 'bytes');
  h.set('Cache-Control', 'public, max-age=86400');
  h.set('X-Content-Type-Options', 'nosniff');
  if (req.method === 'HEAD' || !('body' in obj)) { h.set('Content-Length', String(obj.size)); return new Response(null, { status: req.method === 'HEAD' ? 200 : 304, headers: h }); }
  if (obj.range && req.headers.get('Range')) {
    const ini = obj.range.offset ?? (obj.size - obj.range.suffix);
    const tam = obj.range.length ?? (obj.size - ini);
    h.set('Content-Range', `bytes ${ini}-${ini + tam - 1}/${obj.size}`);
    h.set('Content-Length', String(tam));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers: h });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/m/')) return midia(req, env, url);
    try {
      if (url.pathname === '/api/newsletter') {
        if (req.method === 'POST') return await inscrever(req, env);
        return json({ ok: false, erro: 'metodo' }, 405);
      }
      if (url.pathname === '/api/newsletter/sair') return await sair(url, env);
      if (url.pathname === '/api/contato') {
        if (req.method === 'POST') return await contato(req, env);
        return json({ ok: false, erro: 'metodo' }, 405);
      }
      if (url.pathname === '/api/v') {
        if (req.method === 'POST') return await registrarVisita(req, env, ORIGENS);
        return json({ ok: false, erro: 'metodo' }, 405);
      }
      if (url.pathname === '/api/metricas') {
        const r = await paginaMetricas(url, env);
        if (r.html) return new Response(r.html, { headers: { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" } });
        return json(r.json);
      }
      if (url.pathname === '/api/ig/fila') return json(await situacao(env));
      if (url.pathname === '/api/threads/fila') return json(await situacaoThreads(env));
      if (url.pathname === '/api/x/fila') return json(await situacaoX(env));
      if (url.pathname === '/api/radar') {
        // Primeira vez (banco vazio): busca as manchetes na hora.
        try { const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM radar_itens").first(); if (!c.n) await rodarRadar(env); } catch { await rodarRadar(env); }
        const r = await paginaRadar(url, env);
        if (r.html) return new Response(r.html, { headers: { ...SEGURANCA, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" } });
        return json(r.json);
      }
      if (url.pathname.startsWith('/api/')) return json({ ok: false, erro: 'nao-encontrado' }, 404);
    } catch (e) {
      console.error('api', e && e.message);
      return json({ ok: false, erro: 'interno' }, 500);
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(evento, env, ctx) {
    // Cron de hora em hora (minuto 7): só o radar de manchetes. Os outros (a cada 5 min): as filas.
    if (evento.cron === '7 * * * *') { ctx.waitUntil(rodarRadar(env).catch((e) => console.error('radar', e && e.message))); return; }
    ctx.waitUntil(Promise.all([
      rodarFila(env).catch((e) => console.error('instagram', e && e.message)),
      rodarFilaThreads(env).catch((e) => console.error('threads', e && e.message)),
      rodarFilaX(env).catch((e) => console.error('x', e && e.message)),
    ]));
  },
};
