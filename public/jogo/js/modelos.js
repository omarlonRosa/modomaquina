// Carros do jogo além do Uno: modelos genéricos feitos aqui no código (sem logo, sem nome de marca),
// inspirados nos carros que rodam modificados em Parauapebas: fusca, gol quadrado, civic, opala,
// e os "top" (muscle americano, sedã alemão, esportivo de motor traseiro).
// Cada carro é o perfil lateral (silhueta) extrudado na largura, com a cabine mais estreita em cima,
// caixas de roda recortadas no perfil, vidros, faróis, lanternas e rodas. Frente = +z, centro do
// entre-eixos na origem (ficha.centro = 0). Os nomes de material seguem o GLB do Uno ('paint', 'glass',
// 'lensF', 'lensR', 'teia', 'tire'), então carro.js, garagem.js e main.js tratam todos do mesmo jeito.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// ficha: vmax (m/s, sem peças), acel (empurrão do motor), grip, freio, eixo (entre-eixos), r (raio da roda),
// L e W (tamanho), cil (cilindros: muda o ronco), peca (multiplica o preço das peças), cor (cor de fábrica)
export const UNO = { id: 'uno', nome: 'Uno 1.6R', tipo: 'Hatch 1.6 · o carro do projeto', preco: 0, vmax: 49, acel: 4.6, grip: 1, freio: 1, eixo: 2.36, r: 0.286, L: 3.7, W: 1.62, cil: 4, centro: 0.333, peca: 1, cor: 'branco' };

const SPECS = {
  besouro: {
    nome: 'Besouro 1300', tipo: 'Clássico a ar, motor atrás', preco: 1500, vmax: 40, acel: 3.9, grip: 0.92, freio: 0.9, cil: 4, peca: 0.8, cor: 'azul',
    W: 1.54, eixo: 2.40, r: 0.32, bitola: 1.32, suave: 2, ombro: [0.6, 0.24], planta: [1.1, -1.25, 0.3],
    corpo: [[1.98, 0.36], [2.03, 0.52], [1.95, 0.68], [1.65, 0.82], [1.2, 0.9], [0.78, 0.95], [-1.4, 0.95], [-1.62, 0.88], [-1.88, 0.75], [-2.03, 0.58], [-2.08, 0.45], [-2.04, 0.36]],
    cab: [[0.78, 0.95], [0.45, 1.3], [0.1, 1.46], [-0.35, 1.5], [-0.8, 1.43], [-1.15, 1.22], [-1.4, 0.95]], cabW: 0.84, afina: 0.26, suaveCab: 2, pilares: [-0.3],
    farol: { tipo: 'redondo', y: 0.76, x: 0.5, r: 0.1 }, lanterna: { tipo: 'par', y: 0.72, w: 0.14, h: 0.2 }, parachoque: 'chrome',
  },
  quadrado: {
    nome: 'Quadrado 1.8', tipo: 'Hatch dos anos 80, motor forte', preco: 3000, vmax: 52, acel: 5.1, grip: 1, freio: 1, cil: 4, peca: 1, cor: 'vermelho',
    W: 1.6, eixo: 2.36, r: 0.29, bitola: 1.38, suave: 1, ombro: [0.7, 0.05], planta: [1.7, -1.7, 0.06],
    corpo: [[1.92, 0.32], [1.95, 0.6], [1.9, 0.76], [1.75, 0.8], [0.85, 0.88], [-1.72, 0.92], [-1.86, 0.86], [-1.9, 0.6], [-1.88, 0.32]],
    cab: [[0.85, 0.88], [0.12, 1.36], [-1.05, 1.38], [-1.74, 0.92]], cabW: 0.9, afina: 0.1, suaveCab: 0, pilares: [-0.3],
    farol: { tipo: 'ret', y: 0.66, x: 0.5, w: 0.42, h: 0.15 }, grade: true, lanterna: { tipo: 'par', y: 0.72, w: 0.36, h: 0.18 }, parachoque: 'plastic',
  },
  tufao: {
    nome: 'Tufão 2.0 16V', tipo: 'Sedã japonês de giro alto', preco: 7000, vmax: 58, acel: 5.7, grip: 1.12, freio: 1.08, cil: 4, peca: 1.4, cor: 'preto',
    W: 1.72, eixo: 2.62, r: 0.31, bitola: 1.48, suave: 1, ombro: [0.72, 0.08], planta: [1.8, -1.9, 0.1],
    corpo: [[2.22, 0.34], [2.26, 0.58], [2.18, 0.72], [1.9, 0.8], [1.0, 0.93], [-1.55, 0.99], [-2.12, 1.0], [-2.22, 0.9], [-2.24, 0.6], [-2.2, 0.34]],
    cab: [[1.0, 0.93], [0.08, 1.4], [-0.7, 1.42], [-1.55, 0.99]], cabW: 0.86, afina: 0.18, suaveCab: 1, pilares: [-0.08, -0.98],
    farol: { tipo: 'ret', y: 0.7, x: 0.56, w: 0.44, h: 0.12 }, grade: true, lanterna: { tipo: 'faixa', y: 0.88, h: 0.1 }, parachoque: 'paint',
    asa: { z: -2.0, y: 1.16, w: 1.5 },
  },
  canecos: {
    nome: 'Seis Canecos 4.1', tipo: 'Cupê nacional de 6 cilindros', preco: 9000, vmax: 56, acel: 6.3, grip: 0.92, freio: 0.95, cil: 6, peca: 1.4, cor: 'grafite',
    W: 1.76, eixo: 2.67, r: 0.32, bitola: 1.42, suave: 1, ombro: [0.72, 0.06], planta: [2.0, -2.1, 0.06],
    corpo: [[2.34, 0.36], [2.37, 0.66], [2.32, 0.8], [2.1, 0.84], [0.95, 0.9], [-1.55, 0.95], [-2.36, 0.94], [-2.42, 0.82], [-2.42, 0.56], [-2.38, 0.36]],
    cab: [[0.95, 0.9], [0.25, 1.32], [-0.6, 1.35], [-1.55, 0.95]], cabW: 0.86, afina: 0.16, suaveCab: 1, pilares: [-0.38],
    farol: { tipo: 'ret', y: 0.68, x: 0.58, w: 0.4, h: 0.16 }, grade: true, lanterna: { tipo: 'par', y: 0.74, w: 0.5, h: 0.12 }, parachoque: 'chrome',
  },
  barao: {
    nome: 'Barão V8', tipo: 'Sedã alemão de luxo', preco: 16000, vmax: 66, acel: 7.0, grip: 1.12, freio: 1.15, cil: 8, peca: 2, cor: 'preto',
    W: 1.86, eixo: 2.94, r: 0.34, bitola: 1.58, suave: 1, ombro: [0.78, 0.07], planta: [1.9, -2.2, 0.1],
    corpo: [[2.32, 0.38], [2.36, 0.66], [2.28, 0.8], [2.0, 0.88], [1.05, 0.99], [-1.75, 1.05], [-2.48, 1.04], [-2.58, 0.92], [-2.6, 0.62], [-2.55, 0.38]],
    cab: [[1.05, 0.99], [0.15, 1.45], [-0.95, 1.47], [-1.75, 1.05]], cabW: 0.88, afina: 0.18, suaveCab: 1, pilares: [-0.1, -1.12],
    farol: { tipo: 'ret', y: 0.72, x: 0.62, w: 0.42, h: 0.13 }, grade: 'chrome', lanterna: { tipo: 'faixa', y: 0.9, h: 0.12 }, parachoque: 'paint',
  },
  bisao: {
    nome: 'Bisão V8', tipo: 'Muscle car americano', preco: 20000, vmax: 70, acel: 7.8, grip: 1.04, freio: 1.1, cil: 8, peca: 2, cor: 'amarelo',
    W: 1.9, eixo: 2.81, r: 0.36, bitola: 1.62, suave: 1, ombro: [0.8, 0.08], planta: [2.0, -2.1, 0.08],
    corpo: [[2.36, 0.4], [2.42, 0.7], [2.32, 0.86], [2.0, 0.9], [0.8, 0.98], [-1.72, 1.02], [-2.36, 1.03], [-2.46, 0.95], [-2.46, 0.65], [-2.4, 0.4]],
    cab: [[0.8, 0.98], [0.0, 1.3], [-0.72, 1.33], [-1.72, 1.02]], cabW: 0.82, afina: 0.22, suaveCab: 1, pilares: [-0.42],
    farol: { tipo: 'ret', y: 0.74, x: 0.62, w: 0.36, h: 0.1 }, grade: true, lanterna: { tipo: 'faixa', y: 0.88, h: 0.12 }, parachoque: 'paint',
    tomada: { z: 1.35, w: 0.55, l: 0.8 }, faixas: true,
  },
  bala: {
    nome: 'Bala Boxer', tipo: 'Esportivo de motor traseiro', preco: 26000, vmax: 74, acel: 8.2, grip: 1.26, freio: 1.25, cil: 6, peca: 2.4, cor: 'grafite',
    W: 1.82, eixo: 2.45, r: 0.34, bitola: 1.55, suave: 2, ombro: [0.58, 0.2], planta: [1.3, -1.5, 0.24],
    corpo: [[2.2, 0.36], [2.25, 0.52], [2.12, 0.66], [1.85, 0.76], [1.5, 0.82], [0.75, 0.88], [-1.7, 0.95], [-2.1, 0.84], [-2.27, 0.66], [-2.28, 0.5], [-2.24, 0.36]],
    cab: [[0.75, 0.88], [0.12, 1.27], [-0.45, 1.3], [-1.05, 1.16], [-1.7, 0.95]], cabW: 0.78, afina: 0.26, suaveCab: 2, pilares: [-0.38],
    farol: { tipo: 'redondo', y: 0.74, x: 0.6, r: 0.11 }, lanterna: { tipo: 'faixa', y: 0.78, h: 0.08 }, parachoque: 'paint',
    rabeta: { z: -1.95, y: 0.99, w: 1.3 },
  },
  // só trânsito
  picape: {
    nome: 'Picape', W: 1.82, eixo: 3.0, r: 0.37, bitola: 1.56, suave: 1, ombro: [1.0, 0.04], planta: [2.1, -2.3, 0.05],
    corpo: [[2.4, 0.5], [2.43, 0.92], [2.33, 1.06], [2.0, 1.1], [0.95, 1.15], [-2.48, 1.15], [-2.52, 1.05], [-2.52, 0.5]],
    cab: [[0.95, 1.15], [0.38, 1.72], [-0.5, 1.74], [-0.62, 1.15]], cabW: 0.9, afina: 0.1, suaveCab: 0, pilares: [],
    farol: { tipo: 'ret', y: 0.92, x: 0.6, w: 0.4, h: 0.16 }, grade: true, lanterna: { tipo: 'par', y: 0.9, w: 0.14, h: 0.32 }, parachoque: 'plastic', capota: true,
  },
  suv: {
    nome: 'SUV', W: 1.84, eixo: 2.7, r: 0.37, bitola: 1.56, suave: 1, ombro: [1.0, 0.05], planta: [1.9, -2.1, 0.06],
    corpo: [[2.15, 0.5], [2.18, 0.95], [2.06, 1.08], [1.75, 1.12], [1.15, 1.15], [-2.25, 1.17], [-2.33, 1.05], [-2.35, 0.5]],
    cab: [[1.15, 1.15], [0.42, 1.76], [-2.12, 1.8], [-2.28, 1.17]], cabW: 0.9, afina: 0.1, suaveCab: 0, pilares: [0.0, -1.15],
    farol: { tipo: 'ret', y: 0.95, x: 0.6, w: 0.42, h: 0.14 }, grade: true, lanterna: { tipo: 'par', y: 1.0, w: 0.16, h: 0.3 }, parachoque: 'plastic',
  },
};

// lista da garagem (ordem de preço), com o Uno primeiro
export const CARROS = [UNO, ...['besouro', 'quadrado', 'tufao', 'canecos', 'barao', 'bisao', 'bala'].map(id => fichaDe(id))];
export function fichaDe(id) {
  if (id === 'uno') return UNO;
  const s = SPECS[id]; if (!s) return UNO;
  const L = s.corpo[0][0] - s.corpo[s.corpo.length - 1][0];
  return { id, nome: s.nome, tipo: s.tipo, preco: s.preco || 0, vmax: s.vmax || 45, acel: s.acel || 4.4, grip: s.grip || 1, freio: s.freio || 1,
    eixo: s.eixo, r: s.r, L, W: s.W, cil: s.cil || 4, centro: 0, peca: s.peca || 1, cor: s.cor || 'branco' };
}

// ---------- geometria
function chaikin(pts, n) {
  for (let k = 0; k < n; k++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]); pts = out;
  }
  return pts;
}

// encolhe um polígono convexo (margem dos vidros)
function encolher(pts, d) {
  const n = pts.length; let area = 0;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1, ls = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n]; let dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    ls.push([a[0] - dy * s * d, a[1] + dx * s * d, dx, dy]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const l1 = ls[(i + n - 1) % n], l2 = ls[i], den = l1[2] * l2[3] - l1[3] * l2[2];
    if (Math.abs(den) < 1e-5) { out.push([l2[0], l2[1]]); continue; }
    const t = ((l2[0] - l1[0]) * l2[3] - (l2[1] - l1[1]) * l2[2]) / den;
    out.push([l1[0] + l1[2] * t, l1[1] + l1[3] * t]);
  }
  return out;
}
// corta o polígono num plano z = z0, mantendo o lado (z - z0) * lado >= 0
function cortar(pts, z0, lado) {
  const out = [], dentro = p => (p[0] - z0) * lado >= 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ia = dentro(a), ib = dentro(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (z0 - a[0]) / (b[0] - a[0]); out.push([z0, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}

// extruda o perfil (z, y) na largura (x), centrado
function extrudar(pts, largura, bisel) {
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth: largura - 2 * bisel, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel * 0.7, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(largura - 2 * bisel) / 2);
  g.rotateY(-Math.PI / 2);                      // x do perfil vira z do carro; a extrusão vira x
  return g;
}
function limpar(g) {                            // só posição e normal, sem índice: tudo junta no merge
  let n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}
function moldar(g, f, liso) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * f(p.getY(i), p.getZ(i)));
  p.needsUpdate = true;
  if (liso) {
    let m = g.clone(); for (const k of Object.keys(m.attributes)) if (k !== 'position') m.deleteAttribute(k);
    m = mergeVertices(m, 1e-4); m.computeVertexNormals(); return limpar(m);
  }
  g.computeVertexNormals(); return limpar(g);
}
function caixa(w, h, d, x, y, z, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); g.translate(x, y, z); return limpar(g);
}
function disco(r, esp, x, y, z, inclina = 0, seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, esp, seg).rotateX(Math.PI / 2 - inclina); g.translate(x, y, z); return limpar(g);
}

// monta as peças do carro: { mat: [geometrias] } + rodas
function pecas(id, simples) {
  const s = SPECS[id], W = s.W;
  const topo = chaikin(s.corpo, simples ? Math.min(1, s.suave) : s.suave);
  const yS = s.corpo[0][1], R = s.r + 0.09, yc = s.r;
  const inch = simples ? 0 : 0.042;               // o bisel estufa a lataria uns 4 cm
  const base = [];
  for (const zc of [-s.eixo / 2, s.eixo / 2]) {
    const t0 = Math.asin(Math.max(-1, Math.min(1, (yS - yc) / R))), n = simples ? 6 : 12;
    for (let i = 0; i <= n; i++) { const t = Math.PI - t0 - (Math.PI - 2 * t0) * i / n; base.push([zc + R * Math.cos(t), yc + R * Math.sin(t)]); }
  }
  const zF = topo[0][0], zT = topo[topo.length - 1][0];
  // onde a frente / a traseira passam numa altura y (para pôr farol, grade, lanterna, para-choque)
  const zNa = (y, deTras) => {
    const lista = deTras ? [...topo].reverse() : topo;
    for (let i = 1; i < lista.length; i++) {
      const a = lista[i - 1], b = lista[i];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
    }
    return deTras ? zT : zF;
  };
  const zFr = y => zNa(y) + inch, zTr = y => zNa(y, true) - inch;
  const cinto = Math.max(...s.cab.map(p => p[1])) > 0 ? s.cab[0][1] : 0.9;
  const [pzF, pzT, pk] = s.planta, [oy, ok] = s.ombro;
  const fCorpo = (y, z) => {
    let k = 1;
    if (y > oy) k *= 1 - ok * Math.pow(Math.min(1, (y - oy) / Math.max(0.05, cinto - oy)), 2);
    if (z > pzF) k *= 1 - pk * Math.pow(Math.min(1, (z - pzF) / (zF - pzF)), 2);
    if (z < pzT) k *= 1 - pk * Math.pow(Math.min(1, (pzT - z) / (pzT - zT)), 2);
    return k;
  };
  const P = { paint: [], glass: [], plastic: [], chrome: [], lensF: [], lensR: [] };
  P.paint.push(moldar(extrudar([...topo, ...base], W, simples ? 0 : 0.06), fCorpo, !simples));

  // cabine: vidro na frente/atrás, teto e colunas pintados; vidros laterais por cima
  const roof = chaikin(s.cab, simples ? 0 : s.suaveCab);
  const yb = Math.min(roof[0][1], roof[roof.length - 1][1]), yTopo = Math.max(...roof.map(p => p[1]));
  const cabPoly = [...roof, [roof[roof.length - 1][0], yb - 0.08], [roof[0][0], yb - 0.08]];
  const Wc = W * s.cabW;
  const afina = y => 1 - s.afina * Math.max(0, Math.min(1, (y - yb) / (yTopo - yb)));
  const cab = moldar(extrudar(cabPoly, Wc, 0), (y) => afina(y), false);
  {
    const pos = cab.attributes.position, nor = cab.attributes.normal, pinta = [], vidro = [];
    for (let i = 0; i < pos.count; i += 3) {
      const nx = nor.getX(i), ny = nor.getY(i);
      const alvo = Math.abs(nx) > 0.55 || ny > 0.93 ? pinta : vidro;
      for (let k = 0; k < 3; k++) alvo.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
    }
    const mk = arr => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
    if (pinta.length) P.paint.push(mk(pinta));
    if (vidro.length) P.glass.push(mk(vidro));
  }
  // vidros laterais: a silhueta da cabine com margem, dividida nas colunas
  let resto = encolher([...roof, ], 0.07);
  const pedacos = [];
  for (const zp of [...s.pilares].sort((a, b) => b - a)) { pedacos.push(cortar(resto, zp + 0.05, 1)); resto = cortar(resto, zp - 0.05, -1); }
  pedacos.push(resto);
  for (const pd of pedacos) {
    if (pd.length < 3) continue;
    const tri = THREE.ShapeUtils.triangulateShape(pd.map(p => new THREE.Vector2(p[0], p[1])), []);
    for (const lado of [1, -1]) {
      const arr = [];
      for (const t of tri) for (const k of t) { const [z, y] = pd[k]; arr.push(lado * (Wc / 2 * afina(y) + 0.006), y, z); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals();
      P.glass.push(g);
    }
  }

  // para-choques, grade, faróis e lanternas
  const pc = s.parachoque === 'chrome' ? P.chrome : s.parachoque === 'paint' ? P.paint : P.plastic;
  const yPc = yS + 0.1;
  const lpc = W * (s.parachoque === 'chrome' ? 1.0 : 0.96);
  pc.push(caixa(lpc * fCorpo(yPc, zFr(yPc) - 0.1), 0.2, 0.18, 0, yPc, zFr(yPc) - 0.05));
  pc.push(caixa(lpc * fCorpo(yPc, zTr(yPc) + 0.1), 0.2, 0.18, 0, yPc, zTr(yPc) + 0.05));
  const f = s.farol;
  if (s.grade) {
    const zg = zFr(f.y) - 0.01, kg = fCorpo(f.y, zg - 0.05);
    (s.grade === 'chrome' ? P.chrome : P.plastic).push(caixa((f.x * 2 - (f.w || 0.2)) * kg - 0.08, (f.h || 0.12) * 1.1, 0.06, 0, f.y, zg));
  }
  for (const sx of [1, -1]) {
    const zf = zFr(f.y), xf = sx * f.x * fCorpo(f.y, zf - 0.05);
    if (f.tipo === 'redondo') {
      P.lensF.push(disco(f.r, 0.08, xf, f.y, zf - 0.03, 0.35));
      P.chrome.push(disco(f.r * 1.2, 0.06, xf, f.y, zf - 0.06, 0.35));
    } else P.lensF.push(caixa(f.w, f.h, 0.08, xf, f.y, zf - 0.02));
    const l = s.lanterna;
    if (l.tipo === 'par') { const zl = zTr(l.y); P.lensR.push(caixa(l.w, l.h, 0.08, sx * (W / 2 - l.w / 2 - 0.1) * fCorpo(l.y, zl + 0.05), l.y, zl + 0.02)); }
  }
  if (s.lanterna.tipo === 'faixa') { const zl = zTr(s.lanterna.y); P.lensR.push(caixa(W * 0.84 * fCorpo(s.lanterna.y, zl + 0.05), s.lanterna.h, 0.08, 0, s.lanterna.y, zl + 0.02)); }
  // retrovisores
  for (const sx of [1, -1]) P.paint.push(caixa(0.12, 0.09, 0.16, sx * (Wc / 2 + 0.07), yb + 0.13, roof[0][0] - 0.22));
  // extras
  if (s.asa) {
    P.paint.push(caixa(s.asa.w, 0.04, 0.26, 0, s.asa.y, s.asa.z));
    for (const sx of [1, -1]) P.paint.push(caixa(0.05, 0.14, 0.12, sx * s.asa.w * 0.38, s.asa.y - 0.08, s.asa.z));
  }
  if (s.rabeta) P.paint.push(caixa(s.rabeta.w, 0.05, 0.3, 0, s.rabeta.y, s.rabeta.z, -0.25));
  if (s.tomada) { const y = 0.99 + inch; P.plastic.push(caixa(s.tomada.w, 0.1, s.tomada.l, 0, y, s.tomada.z)); }
  if (s.faixas) for (const sx of [1, -1]) {
    // duas faixas pretas pelo capô, teto e tampa
    for (let i = 1; i < topo.length; i++) {
      const a = topo[i - 1], b = topo[i]; if (a[1] < 0.8 || b[1] < 0.8) continue;
      const zm = (a[0] + b[0]) / 2; if (zm < roof[0][0] && zm > roof[roof.length - 1][0]) continue;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      P.plastic.push(caixa(0.16, 0.012, L + 0.01, sx * 0.17, (a[1] + b[1]) / 2 + 0.008 + inch, zm, -Math.atan2(b[1] - a[1], b[0] - a[0])));
    }
    for (let i = 1; i < roof.length; i++) {
      const a = roof[i - 1], b = roof[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ym = (a[1] + b[1]) / 2;
      P.plastic.push(caixa(0.16, 0.012, L + 0.01, sx * 0.17 * afina(ym), ym + 0.008, (a[0] + b[0]) / 2, -Math.atan2(b[1] - a[1], b[0] - a[0])));
    }
  }
  if (s.capota) { const zc0 = s.cab[s.cab.length - 1][0] - 0.05, zc1 = zT + 0.08; P.plastic.push(caixa(W * 0.9, 0.03, zc0 - zc1, 0, 1.165, (zc0 + zc1) / 2)); }

  // rodas: pneu + aro com raios
  const esp = 0.2 + (s.r - 0.29) * 0.4;
  const pneu = limpar(new THREE.CylinderGeometry(s.r, s.r, esp, simples ? 10 : 18).rotateZ(Math.PI / 2));
  const aro = [limpar(new THREE.CylinderGeometry(s.r * 0.64, s.r * 0.64, esp + 0.02, simples ? 8 : 16).rotateZ(Math.PI / 2))];
  if (!simples) for (let k = 0; k < 5; k++) aro.push(caixa(esp + 0.035, 0.06, s.r * 1.18, 0, 0, 0, k * Math.PI * 2 / 5));
  const rodas = [];
  for (const [nome, sx, sz] of [['roda_dianteira_esq', 1, 1], ['roda_dianteira_dir', -1, 1], ['roda_traseira_esq', 1, -1], ['roda_traseira_dir', -1, -1]])
    rodas.push({ nome, x: sx * (s.bitola / 2 + esp / 2 - 0.02), y: s.r, z: sz * s.eixo / 2 });
  return { P, pneu, aro: mergeGeometries(aro), rodas, L: zF - zT, W };
}

// materiais com os mesmos nomes do GLB do Uno
function materiais(corHex) {
  const m = (nome, o) => { const x = new THREE.MeshStandardMaterial(o); x.name = nome; return x; };
  return {
    paint: m('paint', { color: corHex, metalness: 0.15, roughness: 0.38 }),
    glass: m('glass', { color: 0x0a1016, metalness: 0.9, roughness: 0.06, transparent: true, opacity: 0.88, side: THREE.DoubleSide }),
    plastic: m('plastic', { color: 0x121314, roughness: 0.7 }),
    chrome: m('chrome', { color: 0xd8dade, metalness: 0.6, roughness: 0.25 }),
    lensF: m('lensF', { color: 0xffffff, roughness: 0.2 }),
    lensR: m('lensR', { color: 0x7a0808, roughness: 0.3 }),
    tire: m('tire', { color: 0x0e0e0f, roughness: 0.9 }),
    teia: m('teia', { color: 0x0d0e10, metalness: 0.4, roughness: 0.6 }),
  };
}

const CORES_FABRICA = { branco: 0xd6d9d5, preto: 0x111214, vermelho: 0xb5121b, azul: 0x1d4fb0, amarelo: 0xf2c00f, verde: 0x1e7a3c, grafite: 0x4a4f55 };
const cache = new Map();

// modelo completo para o Carro (jogador, rival): { scene, ficha }
export function montarModelo(id, corHex) {
  if (!cache.has(id)) cache.set(id, pecas(id, false));
  const pc = cache.get(id), ficha = fichaDe(id);
  const M = materiais(corHex ?? CORES_FABRICA[ficha.cor] ?? 0xd6d9d5);
  const scene = new THREE.Group();
  for (const [k, lista] of Object.entries(pc.P)) if (lista.length) {
    const ms = new THREE.Mesh(mergeGeometries(lista), M[k]); ms.name = 'lataria_' + k; scene.add(ms);
  }
  for (const r of pc.rodas) {
    const g = new THREE.Group(); g.name = r.nome; g.position.set(r.x, r.y, r.z);
    g.add(new THREE.Mesh(pc.pneu, M.tire), new THREE.Mesh(pc.aro, M.teia));
    scene.add(g);
  }
  return { scene, ficha };
}

// versão leve para o trânsito: duas geometrias (lataria branca para tingir e detalhes com cor própria)
const COR_DET = { glass: 0x0c1116, plastic: 0x141516, chrome: 0x9a9ea3, lensF: 0xfff4d8, lensR: 0xd01010, tire: 0x0b0b0c, teia: 0x34363a };
function pintar(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
export function modeloTransito(id) {
  const pc = pecas(id, true);
  const corpo = mergeGeometries(pc.P.paint.map(g => pintar(g.clone(), 0xffffff)));
  const det = [];
  for (const k of ['glass', 'plastic', 'chrome', 'lensF', 'lensR']) for (const g of pc.P[k]) det.push(pintar(g.clone(), COR_DET[k]));
  for (const r of pc.rodas) {
    det.push(pintar(pc.pneu.clone().translate(r.x, r.y, r.z), COR_DET.tire));
    det.push(pintar(pc.aro.clone().translate(r.x, r.y, r.z), COR_DET.teia));
  }
  return { corpo, det: mergeGeometries(det), L: pc.L, W: pc.W };
}
export const TIPOS_TRANSITO = ['quadrado', 'quadrado', 'besouro', 'tufao', 'tufao', 'canecos', 'picape', 'picape', 'suv', 'suv', 'barao'];
