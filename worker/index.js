// Modo Máquina: Worker do site.
// Serve as páginas estáticas (pasta out/) e cuida só da API da newsletter.
// A lista de inscritos fica no banco D1 do próprio Cloudflare (binding DB).

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

async function sair(url, env) {
  const token = (url.searchParams.get('t') || '').replace(/[^a-f0-9]/g, '');
  if (!env.DB || token.length !== 32) return pagina('Link inválido', 'Esse link de descadastro não é válido. Se quiser sair da lista, responda qualquer e-mail nosso pedindo.', 400);
  await env.DB.exec(SCHEMA.replace(/\n\s*/g, ' '));
  const r = await env.DB.prepare("UPDATE inscritos SET status = 'saiu', saiu_em = ? WHERE token = ?").bind(new Date().toISOString(), token).run();
  if (!r.meta.changes) return pagina('Link inválido', 'Não encontramos esse cadastro. Talvez você já tenha saído da lista.', 404);
  return pagina('Pronto, você saiu', 'Você não vai mais receber a newsletter do Modo Máquina. Se mudar de ideia, é só se inscrever de novo no site.');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/newsletter') {
        if (req.method === 'POST') return await inscrever(req, env);
        return json({ ok: false, erro: 'metodo' }, 405);
      }
      if (url.pathname === '/api/newsletter/sair') return await sair(url, env);
      if (url.pathname.startsWith('/api/')) return json({ ok: false, erro: 'nao-encontrado' }, 404);
    } catch (e) {
      console.error('newsletter', e && e.message);
      return json({ ok: false, erro: 'interno' }, 500);
    }
    return env.ASSETS.fetch(req);
  },
};
