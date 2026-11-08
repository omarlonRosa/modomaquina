// Rotas extras de racha para a carreira, montadas pelas ruas do mapa na hora (rede do trânsito):
// só andam no sentido permitido (mão única do OSM), preferem avenidas e a PA-160 e não fazem
// meia-volta nos pontos de passagem. Cada rota sai no formato que o racha.js usa ({ rota, pontos }).

// peso por classe de rua (1 = rua de bairro ... 5 = rodovia): avenidas "custam" menos
const PESO = { 1: 2.6, 2: 1.0, 3: 0.75, 4: 0.6, 5: 0.6 };

// waypoints em metros (x = leste, z = sul, origem na Lock-Up)
export const ROTAS = {
  bairro: { nome: 'Volta das Avenidas', via: [[-1000, 30], [-270, 20], [-270, -520], [-1000, -520]] },
  cidade: { nome: 'Cidade Nova', via: [[364, 91], [780, -91], [572, -780], [78, -806]] },
  pa: { nome: 'PA-160 de ponta a ponta', via: [[280, 900], [40, -1100]] },
};

function dijkstra(rede, de, para, proibido) {
  const dist = new Map([[de.id, 0]]), ant = new Map(), fila = [[0, de]];
  let passos = 0;
  while (fila.length && passos++ < 20000) {
    let k = 0; for (let i = 1; i < fila.length; i++) if (fila[i][0] < fila[k][0]) k = i;
    const [d, n] = fila[k]; fila[k] = fila[fila.length - 1]; fila.pop();
    if (n === para) break;
    if (d > (dist.get(n.id) ?? Infinity)) continue;
    for (const e of n.saidas) {
      if (e.rua.t === 'service' || e.rua.t === 'track') continue;
      if (n === de && proibido && e.b === proibido) continue;          // sem meia-volta no ponto de passagem
      const nd = d + e.L * (PESO[e.rua.c] || 1.2);
      if (nd < (dist.get(e.b.id) ?? Infinity)) { dist.set(e.b.id, nd); ant.set(e.b.id, n); fila.push([nd, e.b]); }
    }
  }
  if (!ant.has(para.id)) return null;
  const out = [para]; let n = para;
  while (n !== de) { n = ant.get(n.id); out.push(n); }
  return out.reverse();
}

// nó mais perto que tenha saída (em rua que dá para seguir)
function noCom(rede, x, z) {
  let m = null, dm = Infinity;
  for (const n of rede.lista) {
    if (!n.saidas.some(e => e.rua.t !== 'service' && e.rua.t !== 'track')) continue;
    const d = Math.hypot(n.p[0] - x, n.p[1] - z); if (d < dm) { dm = d; m = n; }
  }
  return m;
}

export function montarRota(rede, id) {
  const def = ROTAS[id];
  const nos = def.via.map(([x, z]) => noCom(rede, x, z));
  let cam = [nos[0]];
  for (let i = 1; i < nos.length; i++) {
    const anterior = cam.length > 1 ? cam[cam.length - 2] : null;
    const trecho = dijkstra(rede, cam[cam.length - 1], nos[i], anterior);
    if (!trecho) { console.warn('rota sem caminho', id, i); break; }
    cam = cam.concat(trecho.slice(1));
  }
  const rota = cam.map(n => [n.p[0], n.p[1]]);
  // pontos de controle a cada ~160 m pela rota, e a chegada
  const pontos = []; let acc = 0;
  for (let i = 1; i < rota.length; i++) {
    acc += Math.hypot(rota[i][0] - rota[i - 1][0], rota[i][1] - rota[i - 1][1]);
    if (acc >= 160 && i < rota.length - 3) { pontos.push(rota[i]); acc = 0; }
  }
  pontos.push(rota[rota.length - 1]);
  let metros = 0; for (let i = 1; i < rota.length; i++) metros += Math.hypot(rota[i][0] - rota[i - 1][0], rota[i][1] - rota[i - 1][1]);
  return { id, nome: def.nome, saida: rota[0], pontos, rota, metros: Math.round(metros) };
}
