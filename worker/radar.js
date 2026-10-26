// Radar de manchetes: lê feeds RSS/Atom de hora em hora (cron próprio) e guarda no D1 (tabela radar_itens).
// Sem IA, sem custo. Ver em /api/radar (JSON) ou /api/radar?formato=html. Fontes testadas em 25/10/2026.
// Pra incluir uma fonte: acrescente em FONTES (nome, categoria, url do feed).

export const FONTES = [
  // Brasil: notícias e lançamentos
  ['Quatro Rodas', 'brasil', 'https://quatrorodas.abril.com.br/feed/'],
  ['Motor1 Brasil', 'brasil', 'https://motor1.uol.com.br/rss/news/all/'],
  ['AutoPapo', 'brasil', 'https://autopapo.com.br/feed/'],
  ['Notícias Automotivas', 'brasil', 'https://www.noticiasautomotivas.com.br/feed/'],
  ['Garagem 360', 'brasil', 'https://garagem360.com.br/feed/'],
  ['Google Notícias: lançamentos no Brasil', 'brasil', 'https://news.google.com/rss/search?q=lan%C3%A7amento%20carro%20Brasil%20when%3A1d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'],
  // Cultura de garagem: clássicos, tuning, leilões
  ['FlatOut!', 'cultura', 'https://www.flatout.com.br/feed/'],
  ['Hagerty Media', 'cultura', 'https://www.hagerty.com/media/feed/'],
  ['Bring a Trailer (leilões)', 'cultura', 'https://bringatrailer.com/feed/'],
  ['Jalopnik', 'cultura', 'https://jalopnik.com/rss'],
  // Internacional: lançamentos
  ['Carscoops', 'mundo', 'https://www.carscoops.com/feed/'],
  ['Motor1', 'mundo', 'https://www.motor1.com/rss/news/all/'],
  ['The Drive', 'mundo', 'https://www.thedrive.com/feed'],
  ['Road & Track', 'mundo', 'https://www.roadandtrack.com/rss/all.xml/'],
  ['Car and Driver', 'mundo', 'https://www.caranddriver.com/rss/all.xml/'],
  ['Autocar', 'mundo', 'https://www.autocar.co.uk/rss'],
  // Superesportivos
  ['Motor1: Porsche', 'superesportivos', 'https://www.motor1.com/rss/make/porsche/'],
  ['Motor1: Ferrari', 'superesportivos', 'https://www.motor1.com/rss/make/ferrari/'],
  ['Motor1: Lamborghini', 'superesportivos', 'https://www.motor1.com/rss/make/lamborghini/'],
  ['Motor1: Bugatti', 'superesportivos', 'https://www.motor1.com/rss/make/bugatti/'],
  ['Motor1: Aston Martin', 'superesportivos', 'https://www.motor1.com/rss/make/aston-martin/'],
  ['Motor1: McLaren', 'superesportivos', 'https://www.motor1.com/rss/make/mclaren/'],
  ['Supercar Blondie', 'superesportivos', 'https://www.supercarblondie.com/feed/'],
  ['Google Notícias: superesportivos', 'superesportivos', 'https://news.google.com/rss/search?q=Porsche%20OR%20Ferrari%20OR%20Lamborghini%20OR%20Bugatti%20OR%20%22Aston%20Martin%22%20OR%20McLaren%20-eleitoral%20-zona%20-escola%20-vota%C3%A7%C3%A3o%20when%3A2d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'],
  // Elétricos e China
  ['Electrek', 'eletricos', 'https://electrek.co/feed/'],
  ['InsideEVs', 'eletricos', 'https://insideevs.com/rss/news/all/'],
  ['CnEVPost', 'eletricos', 'https://cnevpost.com/feed/'],
  ['CarNewsChina', 'eletricos', 'https://carnewschina.com/feed/'],
  // Automobilismo
  ['Motorsport.com Brasil: F1', 'automobilismo', 'https://motorsport.uol.com.br/rss/f1/news/'],
  ['The Race', 'automobilismo', 'https://the-race.com/feed/'],
  ['Autosport: F1', 'automobilismo', 'https://www.autosport.com/rss/f1/news/'],
  // YouTube
  ['Acelerados (YouTube)', 'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCGBIIPnw0AYM3BFsmTsjeAw'],
  ['Doug DeMuro (YouTube)', 'youtube', 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsqjHFMB_JYTaEnf_vmTNqg'],
];

const CATEGORIAS = { brasil: 'Brasil', cultura: 'Cultura de garagem', mundo: 'Mundo', superesportivos: 'Superesportivos', eletricos: 'Elétricos e China', automobilismo: 'Automobilismo', youtube: 'YouTube' };
const SCHEMA = `CREATE TABLE IF NOT EXISTS radar_itens (link TEXT PRIMARY KEY, titulo TEXT NOT NULL, fonte TEXT NOT NULL, categoria TEXT NOT NULL, publicado_em TEXT NOT NULL, visto_em TEXT NOT NULL)`;
const MAX_POR_FEED = 15;

const limpa = (s) => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();

const tag = (bloco, nome) => { const m = bloco.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i')); return m ? limpa(m[1]) : ''; };

function itens(xml) {
  const blocos = xml.match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocos.slice(0, MAX_POR_FEED).map((b) => {
    let link = tag(b, 'link');
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ''; }
    const data = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const t = Date.parse(data);
    return { titulo: tag(b, 'title'), link: link.trim(), publicado: Number.isNaN(t) ? null : new Date(t).toISOString() };
  }).filter((i) => i.titulo && /^https?:\/\//.test(i.link));
}

export async function rodarRadar(env) {
  if (!env.DB) return;
  await env.DB.exec(SCHEMA);
  const agora = new Date().toISOString();
  const resultados = await Promise.allSettled(FONTES.map(async ([fonte, categoria, url]) => {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ModoMaquinaRadar/1.0; +https://modomaquina.com.br)', Accept: 'application/rss+xml,application/atom+xml,application/xml,text/xml' } });
    if (!r.ok) throw new Error(`${fonte}: HTTP ${r.status}`);
    return { fonte, categoria, lista: itens(await r.text()) };
  }));
  const stmts = [];
  for (const res of resultados) {
    if (res.status !== 'fulfilled') { console.error('radar', res.reason && res.reason.message); continue; }
    for (const i of res.value.lista) {
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO radar_itens (link, titulo, fonte, categoria, publicado_em, visto_em) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(i.link, i.titulo.slice(0, 300), res.value.fonte, res.value.categoria, i.publicado || agora, agora));
    }
  }
  for (let k = 0; k < stmts.length; k += 50) await env.DB.batch(stmts.slice(k, k + 50));
  // Guarda só os últimos 4 dias.
  await env.DB.prepare('DELETE FROM radar_itens WHERE publicado_em < ?').bind(new Date(Date.now() - 4 * 86400000).toISOString()).run();
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// GET /api/radar?horas=36&cat=superesportivos&formato=html
export async function paginaRadar(url, env) {
  if (!env.DB) return { json: { erro: 'sem banco' } };
  await env.DB.exec(SCHEMA);
  const horas = Math.min(96, Math.max(1, Number(url.searchParams.get('horas')) || 36));
  const cat = url.searchParams.get('cat');
  const desde = new Date(Date.now() - horas * 3600000).toISOString();
  const q = cat ? env.DB.prepare('SELECT titulo, link, fonte, categoria, publicado_em FROM radar_itens WHERE publicado_em >= ? AND categoria = ? ORDER BY publicado_em DESC LIMIT 400').bind(desde, cat)
    : env.DB.prepare('SELECT titulo, link, fonte, categoria, publicado_em FROM radar_itens WHERE publicado_em >= ? ORDER BY publicado_em DESC LIMIT 600').bind(desde);
  const lista = (await q.all()).results || [];
  if (url.searchParams.get('formato') !== 'html') return { json: { horas, total: lista.length, itens: lista } };
  const grupos = Object.keys(CATEGORIAS).map((c) => {
    const its = lista.filter((i) => i.categoria === c);
    if (!its.length) return '';
    return `<h2>${CATEGORIAS[c]} <small>(${its.length})</small></h2><ul>` + its.map((i) => {
      const h = new Date(i.publicado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return `<li><a href="${esc(i.link)}" target="_blank" rel="noopener">${esc(i.titulo)}</a><span>${esc(i.fonte)} · ${h}</span></li>`;
    }).join('') + '</ul>';
  }).join('');
  return { html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Radar · Modo Máquina</title><style>body{margin:0;background:#0E0E10;color:#FAFAFA;font-family:system-ui,sans-serif;padding:20px;max-width:900px;margin:auto}h1{text-transform:uppercase}h1 b{color:#FF5A1F}h2{color:#2DA6FF;text-transform:uppercase;font-size:18px;margin-top:28px}small{color:#888}ul{list-style:none;padding:0}li{padding:8px 0;border-bottom:1px solid #222}a{color:#FAFAFA;text-decoration:none;font-weight:600}a:hover{color:#FF5A1F}li span{display:block;color:#888;font-size:13px;margin-top:2px}</style></head><body><h1>Radar <b>Modo Máquina</b></h1><p>Manchetes das últimas ${horas} h (${lista.length}). Atualiza de hora em hora.</p>${grupos}</body></html>` };
}
