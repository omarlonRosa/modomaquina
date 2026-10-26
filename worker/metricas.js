// Métricas do site, sem cookie e sem IP: cada página manda POST /api/v com o caminho e (na entrada) o referrer.
// Guarda só contagens por dia + página + origem (tabela visitas). Leitura em /api/metricas (JSON) ou ?formato=html.
// "entradas" = primeira página vista numa aba (sessionStorage), ou seja, visitas; "views" = páginas vistas.

const SCHEMA = `CREATE TABLE IF NOT EXISTS visitas (dia TEXT NOT NULL, caminho TEXT NOT NULL, origem TEXT NOT NULL, views INTEGER NOT NULL DEFAULT 0, entradas INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (dia, caminho, origem))`;
const ROBO = /bot|crawl|spider|slurp|preview|facebookexternalhit|lighthouse|headless|python|curl|wget|monitor/i;

const diaSP = (d = new Date()) => new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10);

function origemDe(ref) {
  if (!ref) return 'direto';
  let host;
  try { host = new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'outro'; }
  if (/(^|\.)modomaquina\.com\.br$|workers\.dev$/.test(host)) return 'interno';
  const mapa = [[/google\./, 'google'], [/instagram\.com$/, 'instagram'], [/threads\.(net|com)$/, 'threads'], [/(facebook|fb)\.com$/, 'facebook'],
    [/^(x|twitter)\.com$|^t\.co$/, 'x'], [/tiktok\.com$/, 'tiktok'], [/bing\.com$/, 'bing'], [/duckduckgo\.com$/, 'duckduckgo'], [/yahoo\./, 'yahoo'],
    [/whatsapp|wa\.me/, 'whatsapp'], [/linktr\.ee$/, 'linktree']];
  for (const [re, nome] of mapa) if (re.test(host)) return nome;
  return host.slice(0, 60);
}

export async function registrarVisita(req, env, origensOk) {
  const vazio = new Response(null, { status: 204 });
  if (!env.DB || ROBO.test(req.headers.get('User-Agent') || '')) return vazio;
  if (!origensOk.includes(req.headers.get('Origin') || '')) return vazio;
  let d;
  try { d = JSON.parse((await req.text()).slice(0, 2000)); } catch { return vazio; }
  const caminho = String(d.p || '').split(/[?#]/)[0].slice(0, 200);
  if (!caminho.startsWith('/') || caminho.startsWith('/api/')) return vazio;
  const entrada = d.e ? 1 : 0;
  const origem = entrada ? origemDe(String(d.r || '')) : 'interno';
  await env.DB.exec(SCHEMA);
  await env.DB.prepare(`INSERT INTO visitas (dia, caminho, origem, views, entradas) VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(dia, caminho, origem) DO UPDATE SET views = views + 1, entradas = entradas + excluded.entradas`)
    .bind(diaSP(), caminho, origem, entrada).run();
  return vazio;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// GET /api/metricas?dias=7&formato=html
export async function paginaMetricas(url, env) {
  if (!env.DB) return { json: { erro: 'sem banco' } };
  await env.DB.exec(SCHEMA);
  const dias = Math.min(90, Math.max(1, Number(url.searchParams.get('dias')) || 7));
  const desde = diaSP(new Date(Date.now() - (dias - 1) * 86400000));
  const q = (sql) => env.DB.prepare(sql).bind(desde).all().then((r) => r.results || []);
  const [porDia, paginas, origens] = await Promise.all([
    q('SELECT dia, SUM(views) AS views, SUM(entradas) AS visitas FROM visitas WHERE dia >= ? GROUP BY dia ORDER BY dia'),
    q('SELECT caminho, SUM(views) AS views, SUM(entradas) AS visitas FROM visitas WHERE dia >= ? GROUP BY caminho ORDER BY views DESC LIMIT 30'),
    q("SELECT origem, SUM(entradas) AS visitas FROM visitas WHERE dia >= ? AND origem != 'interno' GROUP BY origem ORDER BY visitas DESC LIMIT 20"),
  ]);
  const total = porDia.reduce((a, r) => ({ views: a.views + r.views, visitas: a.visitas + r.visitas }), { views: 0, visitas: 0 });
  const dados = { dias, desde, total, porDia, paginas, origens };
  if (url.searchParams.get('formato') !== 'html') return { json: dados };
  const tabela = (cab, linhas) => `<table><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr>${linhas.map((l) => `<tr>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  return { html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Métricas · Modo Máquina</title><style>body{margin:0;background:#0E0E10;color:#FAFAFA;font-family:system-ui,sans-serif;padding:20px;max-width:900px;margin:auto}h1{text-transform:uppercase}h1 b{color:#FF5A1F}h2{color:#2DA6FF;text-transform:uppercase;font-size:18px;margin-top:28px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #222}th{color:#888;font-weight:600}.big{font-size:40px;font-weight:900}.big small{font-size:14px;color:#888;margin-left:6px}</style></head><body><h1>Métricas <b>Modo Máquina</b></h1><p>Últimos ${dias} dias (desde ${desde}). Sem cookie e sem IP: só contagens.</p><p class=big>${total.visitas}<small>visitas</small> &nbsp; ${total.views}<small>páginas vistas</small></p><h2>Por dia</h2>${tabela(['Dia', 'Visitas', 'Páginas vistas'], porDia.map((r) => [r.dia, r.visitas, r.views]))}<h2>De onde vieram</h2>${tabela(['Origem', 'Visitas'], origens.map((r) => [r.origem, r.visitas]))}<h2>Páginas mais vistas</h2>${tabela(['Página', 'Vistas', 'Entradas'], paginas.map((r) => [r.caminho, r.views, r.visitas]))}</body></html>` };
}
