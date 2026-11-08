// Cidade gerada a partir do mapa do OpenStreetMap (jogo/dados/mapa.json).
// Eixos: x = leste, z = sul, y = para cima. Lock-Up Auto Center perto da origem.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { construirGalpoes, construirCasas } from './construcoes.js';

const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function ruido(ctx, w, h, base, amp, n = 4000, size = 2) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (rnd() - 0.5) * amp;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    ctx.fillRect(rnd() * w, rnd() * h, size * rnd() + 1, size * rnd() + 1);
  }
}

// ---------- texturas
function texAvenida() {
  return canvasTex(128, 512, (g, w, h) => {
    ruido(g, w, h, '#58585d', 0.12, 6000);
    g.fillStyle = '#d9d6cc'; g.fillRect(5, 0, 3, h); g.fillRect(w - 8, 0, 3, h);           // bordas
    g.fillStyle = '#d8b13a'; g.fillRect(w / 2 - 4, 0, 3, h); g.fillRect(w / 2 + 1, 0, 3, h); // faixa dupla amarela
  });
}
// pista de mão única (cada lado da PA-160 e das avenidas duplicadas): bordas brancas e tracejado branco
function texAvenidaMao() {
  return canvasTex(128, 512, (g, w, h) => {
    ruido(g, w, h, '#57575c', 0.13, 6000);
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(w * 0.18, 0, 10, h); g.fillRect(w * 0.72, 0, 10, h);
    g.fillStyle = '#d9d6cc'; g.fillRect(5, 0, 3, h); g.fillRect(w - 8, 0, 3, h);
    for (let y = 0; y < h; y += 128) g.fillRect(w / 2 - 2, y, 4, 64);
  });
}
function texRua() {
  return canvasTex(128, 512, (g, w, h) => {
    ruido(g, w, h, '#5c5b60', 0.16, 7000);
    g.fillStyle = 'rgba(0,0,0,0.25)';                                         // marcas de pneu
    g.fillRect(w * 0.25, 0, 10, h); g.fillRect(w * 0.7, 0, 10, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(20,20,20,0.6)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 10, 4 + rnd() * 8, 0, 0, 7); g.fill(); }
  });
}
function texTerra() {
  return canvasTex(128, 512, (g, w, h) => {
    ruido(g, w, h, '#8a4a2c', 0.18, 8000, 3);
    g.fillStyle = 'rgba(60,25,12,0.35)'; g.fillRect(w * 0.22, 0, 14, h); g.fillRect(w * 0.68, 0, 14, h);
  });
}
function texChao() {
  return canvasTex(256, 256, (g, w, h) => {
    ruido(g, w, h, '#86492b', 0.16, 9000, 3);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(60,90,40,${0.15 + rnd() * 0.25})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 20, 4 + rnd() * 14, rnd() * 3, 0, 7); g.fill(); }
  });
}
function texGlow() {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, false);
}
// fachada: 4x4 módulos (3,5 m x 3,1 m cada), janelas acesas ao acaso no mapa de emissão
function texFachada() {
  const N = 4, M = 128;
  const desenha = (luz) => (g) => {
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = i * M, y = j * M;
      g.fillStyle = luz ? '#000' : '#e8e4dc'; g.fillRect(x, y, M, M);
      if (!luz) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, y + M - 10, M, 10); }
      const tipo = (i * 7 + j * 3) % 5;
      if (tipo === 4 && !luz) continue;                                     // parede cega
      const acesa = rnd() < 0.42;
      if (luz) {
        if (tipo !== 4 && acesa) { g.fillStyle = rnd() < 0.7 ? '#ffcf8a' : '#cfe6ff'; g.fillRect(x + 34, y + 30, 60, 52); }
      } else {
        g.fillStyle = '#20262c'; g.fillRect(x + 34, y + 30, 60, 52);
        g.fillStyle = '#9aa0a6'; g.fillRect(x + 62, y + 30, 4, 52); g.fillRect(x + 30, y + 82, 68, 5);
      }
    }
  };
  const map = canvasTex(N * M, N * M, desenha(false));
  const emi = canvasTex(N * M, N * M, desenha(true));
  return { map, emi };
}

// galpão: chapa metálica trapezoidal (frisos verticais) sobre mureta de alvenaria
function texGalpao() {
  const N = 4, M = 128;
  const map = canvasTex(N * M, N * M, (g, w, h) => {
    ruido(g, w, h, '#f1f1ee', 0.06, 2500);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 3, 0, 1, h); }
    for (let j = 0; j < N; j++) {
      g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(0, j * M + M - 30, w, 30);             // mureta mais escura embaixo
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, j * M + M - 31, w, 2);
    }
  });
  const emi = canvasTex(8, 8, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 8, 8); });
  return { map, emi };
}

function texReboco() {
  const map = canvasTex(256, 256, (g, w, h) => {
    ruido(g, w, h, '#f4f3ef', 0.07, 2500);
    g.fillStyle = 'rgba(0,0,0,0.10)'; for (let j = 0; j < 4; j++) g.fillRect(0, j * 64 + 60, w, 4);   // rodapé
  });
  const emi = canvasTex(8, 8, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 8, 8); });
  return { map, emi };
}

// ---------- geometria
function faixa(pts, w, y, vLen) {
  // tira de largura w seguindo a polilinha, com emenda em mitra
  const pos = [], uv = [], idx = [], nor = [];
  let acc = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let n1 = null, n2 = null;
    if (i > 0) { const dx = p[0] - a[0], dz = p[1] - a[1], L = Math.hypot(dx, dz) || 1; n1 = [-dz / L, dx / L]; }
    if (i < pts.length - 1) { const dx = b[0] - p[0], dz = b[1] - p[1], L = Math.hypot(dx, dz) || 1; n2 = [-dz / L, dx / L]; }
    let n = n1 && n2 ? [n1[0] + n2[0], n1[1] + n2[1]] : (n1 || n2);
    const Ln = Math.hypot(n[0], n[1]) || 1; n = [n[0] / Ln, n[1] / Ln];
    let k = 1;
    if (n1 && n2) { const c = n[0] * n1[0] + n[1] * n1[1]; k = Math.min(2.2, 1 / Math.max(0.3, c)); }
    if (i > 0) acc += Math.hypot(p[0] - a[0], p[1] - a[1]);
    const h = w / 2 * k;
    pos.push(p[0] + n[0] * h, y, p[1] + n[1] * h, p[0] - n[0] * h, y, p[1] - n[1] * h);
    uv.push(0, acc / vLen, 1, acc / vLen);
    nor.push(0, 1, 0, 0, 1, 0);
    if (i > 0) { const o = i * 2; idx.push(o - 2, o, o - 1, o - 1, o, o + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}

function disco(x, z, r, y) {
  const g = new THREE.CircleGeometry(r, 20);
  g.rotateX(-Math.PI / 2); g.translate(x, y, z);
  return g;
}

function dentro(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > p[1]) !== (zj > p[1]) && p[0] < (xj - xi) * (p[1] - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const CORES = ['#efe9dc', '#f2e2b6', '#cfe3d6', '#cddcec', '#efc9b4', '#c9c6c0', '#b5653f', '#f3f1ec', '#a85a3a', '#e9d9a8'];
const CORES_GALPAO = ['#e4e6e8', '#b9c0c7', '#2f5d9e', '#eef0f1', '#7d868f', '#3d6fb5', '#d6dadd', '#8e2a26', '#4b535b'];
// casas novas do Parque dos Carajás: branco, gelo, cinzas e bege
const CORES_CAIXA = ['#f3f2ee', '#e8e6e0', '#dcdcd8', '#c3c6c8', '#8e9296', '#5e6266', '#e7dccb', '#d6c9b0', '#f6f3ea', '#cdd2d6'];
const PLATIBANDA = [0xe8e5dd, 0x1d1f22, 0xc9271f, 0x1f4f99, 0xf0c419, 0x9aa1a8];

function paredes(predios, fach, cores = CORES) {
  const pos = [], uv = [], cor = [], nor = [], idx = [];
  const col = new THREE.Color(), teto = new THREE.Color('#77736d');
  let v = 0;
  for (const b of predios) {
    const pts = b.p, h = b.h;
    col.set(cores[b.cor % cores.length]);
    // descobre o lado de fora testando a primeira parede
    const [a0, b0] = [pts[0], pts[1]];
    let dx = b0[0] - a0[0], dz = b0[1] - a0[1], L = Math.hypot(dx, dz) || 1;
    const mx = (a0[0] + b0[0]) / 2, mz = (a0[1] + b0[1]) / 2;
    const sinal = dentro([mx + dz / L * 0.05, mz - dx / L * 0.05], pts) ? -1 : 1;
    let u0 = rnd() * 4;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length];
      dx = c[0] - a[0]; dz = c[1] - a[1]; L = Math.hypot(dx, dz);
      if (L < 0.05) continue;
      const nx = dz / L * sinal, nz = -dx / L * sinal;
      const u1 = u0 + L / 3.5, vt = h / 3.1;
      pos.push(a[0], 0, a[1], c[0], 0, c[1], c[0], h, c[1], a[0], h, a[1]);
      uv.push(u0 / 4, 0, u1 / 4, 0, u1 / 4, vt / 4, u0 / 4, vt / 4);
      for (let k = 0; k < 4; k++) { cor.push(col.r, col.g, col.b); nor.push(nx, 0, nz); }
      if (sinal < 0) idx.push(v, v + 1, v + 2, v, v + 2, v + 3); else idx.push(v, v + 2, v + 1, v, v + 3, v + 2);
      v += 4; u0 = u1;
    }
    // telhado
    const contorno = pts.map(p => new THREE.Vector2(p[0], p[1]));
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contorno, []); } catch { tris = []; }
    const base = v;
    for (const p of pts) { pos.push(p[0], h, p[1]); uv.push(0.13, 0.99); cor.push(teto.r, teto.g, teto.b); nor.push(0, 1, 0); v++; }
    for (const t of tris) {
      // garante face para cima
      const [p0, p1, p2] = t.map(i => pts[i]);
      const cr = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]);
      if (cr < 0) idx.push(base + t[0], base + t[1], base + t[2]); else idx.push(base + t[0], base + t[2], base + t[1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  g.setIndex(idx);
  const m = new THREE.MeshStandardMaterial({ map: fach.map, emissiveMap: fach.emi, emissive: 0xffffff, emissiveIntensity: 0.9, vertexColors: true, roughness: 0.92 });
  return new THREE.Mesh(g, m);
}

// ---------- grade espacial (colisão e consulta de rua)
class Grade {
  constructor(cel) { this.cel = cel; this.m = new Map(); }
  chave(i, j) { return i * 100003 + j; }
  add(item, x0, z0, x1, z1) {
    const c = this.cel;
    for (let i = Math.floor(Math.min(x0, x1) / c); i <= Math.floor(Math.max(x0, x1) / c); i++)
      for (let j = Math.floor(Math.min(z0, z1) / c); j <= Math.floor(Math.max(z0, z1) / c); j++) {
        const k = this.chave(i, j); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(item);
      }
  }
  perto(x, z, r) {
    const c = this.cel, out = new Set();
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) {
        const a = this.m.get(this.chave(i, j)); if (a) for (const it of a) out.add(it);
      }
    return out;
  }
}

function pontoSeg(px, pz, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1e-9;
  const u = Math.max(0, Math.min(1, ((px - s.ax) * dx + (pz - s.az) * dz) / L2));
  return [s.ax + u * dx, s.az + u * dz, u];
}

export class Mundo {
  constructor(mapa, scene, opts = {}) {
    this.mapa = mapa;
    this.scene = scene;
    this.paredes = new Grade(16);
    this.ruas = new Grade(24);
    this.raio = mapa.raio;
    this.ocupados = opts.ocupados || [];
    const grupo = new THREE.Group(); scene.add(grupo); this.grupo = grupo;
    const tAv = texAvenida(), tAvMao = texAvenidaMao(), tRua = texRua(), tTerra = texTerra();

    // chão
    const tc = texChao(); tc.repeat.set(160, 160);
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshStandardMaterial({ map: tc, roughness: 1 }));
    chao.rotation.x = -Math.PI / 2; grupo.add(chao);

    // áreas verdes e árvores
    const gv = { grama: [], mata: [] };
    const arvores = [];
    for (const a of mapa.verdes) {
      const shp = new THREE.Shape(a.p.map(p => new THREE.Vector2(p[0], -p[1])));
      const g = new THREE.ShapeGeometry(shp); g.rotateX(-Math.PI / 2); g.translate(0, a.t === 'mata' ? 0.025 : 0.02, 0);
      gv[a.t].push(g);
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const [x, z] of a.p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      const area = (x1 - x0) * (z1 - z0), n = Math.min(400, area / (a.t === 'mata' ? 90 : 700));
      for (let i = 0; i < n && arvores.length < 2200; i++) {
        const p = [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)];
        if (dentro(p, a.p)) arvores.push(p);
      }
    }
    if (gv.grama.length) grupo.add(new THREE.Mesh(mergeGeometries(gv.grama), new THREE.MeshStandardMaterial({ color: 0x3f5a2c, roughness: 1 })));
    if (gv.mata.length) grupo.add(new THREE.Mesh(mergeGeometries(gv.mata), new THREE.MeshStandardMaterial({ color: 0x2c4220, roughness: 1 })));

    // rios
    if (mapa.rios.length) {
      const gs = mapa.rios.map(r => faixa(r.p, 3.5, 0.03, 10));
      grupo.add(new THREE.Mesh(mergeGeometries(gs), new THREE.MeshStandardMaterial({ color: 0x1d3540, roughness: 0.2, metalness: 0.2 })));
    }

    // ruas, calçadas e cruzamentos
    const geo = { av: [], avMao: [], rua: [], terra: [], calc: [], cruz: [], cruzT: [] };
    const nos = new Map();
    for (const r of mapa.ruas) {
      const tipo = r.terra ? 'terra' : r.c >= 3 ? (r.mao ? 'avMao' : 'av') : 'rua';
      const y = tipo === 'terra' ? 0.05 : tipo === 'rua' ? 0.06 : 0.065;
      geo[tipo].push(faixa(r.p, r.w, y, 8));
      if (!r.terra && r.t !== 'service') geo.calc.push(faixa(r.p, r.w + 3.4, 0.035, 8));
      for (let i = 0; i < r.p.length; i++) {
        const k = r.p[i][0].toFixed(1) + ',' + r.p[i][1].toFixed(1);
        const e = nos.get(k) || { p: r.p[i], n: 0, w: 0, terra: true };
        e.n += (i === 0 || i === r.p.length - 1) ? 1 : 2; e.w = Math.max(e.w, r.w); e.terra = e.terra && !!r.terra;
        nos.set(k, e);
      }
      for (let i = 1; i < r.p.length; i++) {
        const s = { ax: r.p[i - 1][0], az: r.p[i - 1][1], bx: r.p[i][0], bz: r.p[i][1], rua: r };
        this.ruas.add(s, s.ax - r.w, s.az - r.w, s.bx + r.w, s.bz + r.w);
      }
    }
    for (const e of nos.values()) if (e.n >= 3) (e.terra ? geo.cruzT : geo.cruz).push(disco(e.p[0], e.p[1], e.w / 2 * 1.08, e.terra ? 0.055 : 0.072));
    const matRua = (map, off) => { const m = new THREE.MeshStandardMaterial({ map, roughness: 0.7, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -off, polygonOffsetUnits: -off }); return m; };
    const add = (lista, m) => { if (lista.length) { const me = new THREE.Mesh(mergeGeometries(lista), m); grupo.add(me); } };
    const tCruz = tRua.clone(); tCruz.needsUpdate = true;
    add(geo.calc, new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    add(geo.terra, matRua(tTerra, 2));
    add(geo.rua, matRua(tRua, 3));
    add(geo.av, matRua(tAv, 4));
    add(geo.avMao, matRua(tAvMao, 4));
    add(geo.cruzT, matRua(tTerra, 5));
    add(geo.cruz, matRua(tCruz, 6));

    // prédios (menos os que ocupam o terreno da Lock-Up)
    const livre = opts.areaLivre || (() => true);
    const predios = mapa.predios.filter(b => b.p.every(p => livre(p[0], p[1])));
    const lotes = this.gerarLotes(mapa.ruas, predios, livre);
    this.lotes = lotes;
    const casas = lotes.filter(b => b.tipo === 'casa'), galpoes = lotes.filter(b => b.tipo === 'galpao');
    const antigas = casas.filter(b => b.estilo !== 'caixa'), caixas = casas.filter(b => b.estilo === 'caixa');
    const fach = texFachada();
    grupo.add(paredes(predios.concat(antigas), fach));
    if (caixas.length) grupo.add(paredes(caixas, texReboco(), CORES_CAIXA));
    grupo.add(paredes(galpoes, texGalpao(), CORES_GALPAO));
    construirGalpoes(galpoes, grupo, rnd);
    construirCasas(casas, this.terrenos, grupo, this, rnd);
    for (const b of predios) this.addPoligono(b.p);
    for (const b of lotes) this.addPoligono(b.p);

    // árvores (fora de ruas e prédios)
    const arvOk = arvores.filter(([x, z]) => this.infoRua(x, z, 12).dist > 6);
    if (arvOk.length) {
      const tronco = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 2.4, 6).translate(0, 1.2, 0), new THREE.MeshStandardMaterial({ color: 0x4a3324 }), arvOk.length);
      const copa = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.9, 0).translate(0, 3.6, 0), new THREE.MeshStandardMaterial({ color: 0x24401f, flatShading: true, roughness: 1 }), arvOk.length);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
      arvOk.forEach(([x, z], i) => {
        const k = 0.7 + rnd() * 0.8; s.set(k, k * (0.9 + rnd() * 0.4), k);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6);
        m.compose(new THREE.Vector3(x, 0, z), q, s); tronco.setMatrixAt(i, m); copa.setMatrixAt(i, m);
      });
      grupo.add(tronco, copa);
    }

    this.postes(mapa.ruas, opts.poucosPostes);
  }

  // o OSM tem poucas casas mapeadas em Parauapebas: preenche as quadras com casas
  // de frente para a rua, respeitando as ruas, os prédios reais e o terreno da Lock-Up
  gerarLotes(ruas, predios, livre) {
    const occ = new Grade(20), lista = [];
    this.terrenos = [];
    const bb = p => { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of p) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); } return [x0, z0, x1, z1]; };
    for (const b of predios) { const r = bb(b.p); occ.add(r, ...r); }
    for (const p of this.ocupados) { const r = bb(p); occ.add(r, ...r); }   // hotel, galpão branco, placa (marcos.js)
    const sobrepoe = r => { for (const o of occ.perto((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, Math.max(r[2] - r[0], r[3] - r[1]))) if (r[0] < o[2] + 0.8 && r[2] > o[0] - 0.8 && r[1] < o[3] + 0.8 && r[3] > o[1] - 0.8) return true; return false; };
    const longeDasRuas = (x, z) => { for (const s of this.ruas.perto(x, z, 16)) { const [qx, qz] = pontoSeg(x, z, s); if (Math.hypot(x - qx, z - qz) < s.rua.w / 2 + 2.2) return false; } return true; };
    for (const r of ruas) {
      if (r.t === 'track' || r.t.endsWith('_link')) continue;
      for (const lado of [1, -1]) {
        let acc = rnd() * 5;
        for (let i = 1; i < r.p.length; i++) {
          const a = r.p[i - 1], b = r.p[i];
          const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1) { continue; }
          const tx = dx / L, tz = dz / L, nx = -tz * lado, nz = tx * lado;
          const comercial = r.c >= 4 || (r.c === 3 && rnd() < 0.55);
          while (acc < L) {
            const galpao = comercial && rnd() < 0.85;
            // casa-caixote (fachada na calçada, platibanda, portão de garagem) ou casa antiga (muro, quintal e telhado)
            const caixa = !galpao && rnd() < 0.68;
            const calc = r.w / 2 + 3.4;
            const patio = galpao ? 2 + rnd() * 7 : 0, quintal = galpao ? 0 : caixa ? 0.15 : 1.5 + rnd() * 2.5;
            const frente = galpao ? 11 + rnd() * 11 : 8 + rnd() * 4.5, fundo = galpao ? 16 + rnd() * 14 : 9 + rnd() * 8;
            const recuo = calc + patio + quintal;
            if (acc + frente > L) break;
            const vazio = rnd() < (r.t === 'service' ? 0.6 : galpao ? 0.1 : 0.18);
            const cx = a[0] + tx * (acc + frente / 2), cz = a[1] + tz * (acc + frente / 2);
            const pts = [[-frente / 2, recuo], [frente / 2, recuo], [frente / 2, recuo + fundo], [-frente / 2, recuo + fundo]]
              .map(([u, v]) => [cx + tx * u + nx * v, cz + tz * u + nz * v]);
            acc += frente + (caixa ? 0.05 + rnd() * 0.4 : 0.6 + rnd() * 2.5);
            const terreno = vazio && !galpao && r.t !== 'service' && rnd() < 0.5;   // baldio murado
            if (vazio && !terreno) continue;
            if (pts.some(([x, z]) => Math.hypot(x, z) > this.raio - 20 || !livre(x, z) || !longeDasRuas(x, z))) continue;
            const ctr = [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2];
            if (!longeDasRuas(...ctr)) continue;
            const bbLote = bb(pts);
            if (sobrepoe(bbLote)) continue;
            occ.add(bbLote, ...bbLote);
            const s = rnd(), f = [-nx, -nz];
            const muroFrente = [[cx + tx * (-frente / 2) + nx * calc, cz + tz * (-frente / 2) + nz * calc], [cx + tx * (frente / 2) + nx * calc, cz + tz * (frente / 2) + nz * calc]];
            if (terreno) { this.terrenos.push({ muro: muroFrente, f, tijolo: rnd() < 0.7 }); continue; }
            if (galpao) {
              lista.push({ tipo: 'galpao', h: 5.5 + rnd() * 3, cor: Math.floor(rnd() * 6), p: pts, f, patio, corPlat: PLATIBANDA[Math.floor(rnd() * PLATIBANDA.length)] });
            } else {
              if (caixa) {
                lista.push({ tipo: 'casa', estilo: 'caixa', h: s < 0.8 ? 3.4 + rnd() * 0.5 : 6.4 + rnd() * 0.5, cor: Math.floor(rnd() * 10), p: pts, f,
                  modelo: Math.floor(rnd() * 4), cima: Math.floor(rnd() * 4), espelho: rnd() < 0.5 });
              } else {
                const muro = rnd() < 0.85 ? muroFrente : null;
                lista.push({ tipo: 'casa', h: s < 0.82 ? 2.9 + rnd() * 0.6 : 5.8 + rnd() * 0.6, cor: Math.floor(rnd() * 10), p: pts, f, muro });
              }
            }
          }
          acc -= L;
        }
      }
    }
    return lista;
  }

  postes(ruas, poucos) {
    const lista = [], ocupado = new Grade(14);
    const passo = poucos ? 44 : 34;
    for (const r of ruas) {
      if (r.t === 'service' || r.t === 'track') continue;
      let acc = passo * 0.5 * rnd(), lado = 1;
      for (let i = 1; i < r.p.length; i++) {
        const a = r.p[i - 1], b = r.p[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.1) continue;
        const nx = -dz / L, nz = dx / L;
        while (acc < L) {
          const x = a[0] + dx * acc / L + nx * (r.w / 2 + 1.1) * lado, z = a[1] + dz * acc / L + nz * (r.w / 2 + 1.1) * lado;
          let livre = true;
          for (const o of ocupado.perto(x, z, 14)) if (Math.hypot(o[0] - x, o[1] - z) < 14) { livre = false; break; }
          if (livre && Math.hypot(x, z) < this.raio) { const p = [x, z, Math.atan2(-nx * lado, -nz * lado)]; lista.push(p); ocupado.add(p, x, z, x, z); }
          acc += passo; lado = r.c >= 3 ? lado : -lado;
        }
        acc -= L;
      }
    }
    const n = lista.length;
    const poste = new THREE.CylinderGeometry(0.08, 0.13, 7.5, 6).translate(0, 3.75, 0);
    const braco = new THREE.BoxGeometry(0.08, 0.08, 2.2).translate(0, 7.4, 1.1);
    const mPoste = new THREE.InstancedMesh(mergeGeometries([poste, braco]), new THREE.MeshStandardMaterial({ color: 0x8c8f93, roughness: 0.6 }), n);
    const mLuz = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.14, 0.7).translate(0, 7.3, 2.1), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), n);
    const mPoca = new THREE.InstancedMesh(new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2).translate(0, 0.09, 2.6),
      new THREE.MeshBasicMaterial({ map: texGlow(), color: 0xffa050, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    lista.forEach(([x, z, ang], i) => {
      q.setFromAxisAngle(up, ang); m.compose(new THREE.Vector3(x, 0, z), q, um);
      mPoste.setMatrixAt(i, m); mLuz.setMatrixAt(i, m); mPoca.setMatrixAt(i, m);
    });
    mPoca.renderOrder = 2;
    this.grupo.add(mPoste, mLuz, mPoca);
    for (const [x, z] of lista) this.addCirculo(x, z, 0.25);
    this.postesCanteiro(ruas, poucos);
  }

  // PA-160 e pistas duplicadas largas: postes altos de dois braços no canteiro central
  postesCanteiro(ruas, poucos) {
    const lista = [], ocupado = new Grade(30), passo = poucos ? 48 : 38;
    for (const r of ruas) {
      if (!(r.mao && r.c >= 4)) continue;
      let acc = passo * rnd();
      for (let i = 1; i < r.p.length; i++) {
        const a = r.p[i - 1], b = r.p[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 0.1) continue;
        const nx = dz / L, nz = -dx / L;                 // esquerda de quem dirige = lado do canteiro
        while (acc < L) {
          const x = a[0] + dx * acc / L + nx * (r.w / 2 + 1.6), z = a[1] + dz * acc / L + nz * (r.w / 2 + 1.6);
          let livre = Math.hypot(x, z) < this.raio && this.infoRua(x, z, 10).dist > 4.6;
          for (const o of ocupado.perto(x, z, 26)) if (Math.hypot(o[0] - x, o[1] - z) < 26) { livre = false; break; }
          if (livre) { const p = [x, z, Math.atan2(nx, nz)]; lista.push(p); ocupado.add(p, x, z, x, z); }
          acc += passo;
        }
        acc -= L;
      }
    }
    if (!lista.length) return;
    const n = lista.length, H = 11.5;
    const geoPoste = mergeGeometries([
      new THREE.CylinderGeometry(0.11, 0.2, H, 8).translate(0, H / 2, 0),
      new THREE.BoxGeometry(0.1, 0.1, 5.2).translate(0, H - 0.2, 0),                       // braço duplo, um para cada pista
      new THREE.BoxGeometry(0.4, 0.5, 0.4).translate(0, 0.25, 0),                          // base de concreto
    ]);
    const mPoste = new THREE.InstancedMesh(geoPoste, new THREE.MeshStandardMaterial({ color: 0x9a9da1, roughness: 0.5, metalness: 0.3 }), n);
    const geoLuz = mergeGeometries([new THREE.BoxGeometry(0.4, 0.16, 0.8).translate(0, H - 0.35, 2.5), new THREE.BoxGeometry(0.4, 0.16, 0.8).translate(0, H - 0.35, -2.5)]);
    const mLuz = new THREE.InstancedMesh(geoLuz, new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), n);
    const gPoca = new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2);
    const geoPoca = mergeGeometries([gPoca.clone().translate(0, 0.095, 4.5), gPoca.clone().translate(0, 0.095, -4.5)]);
    const mPoca = new THREE.InstancedMesh(geoPoca,
      new THREE.MeshBasicMaterial({ map: texGlow(), color: 0xffb060, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), um = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    lista.forEach(([x, z, ang], i) => {
      q.setFromAxisAngle(up, ang); m.compose(new THREE.Vector3(x, 0, z), q, um);
      mPoste.setMatrixAt(i, m); mLuz.setMatrixAt(i, m); mPoca.setMatrixAt(i, m);
    });
    mPoca.renderOrder = 2;
    this.grupo.add(mPoste, mLuz, mPoca);
    for (const [x, z] of lista) this.addCirculo(x, z, 0.35);
  }

  addPoligono(pts) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      this.addSeg(a[0], a[1], b[0], b[1]);
    }
  }
  addSeg(ax, az, bx, bz) { const s = { ax, az, bx, bz }; this.paredes.add(s, ax, az, bx, bz); }
  addCirculo(x, z, r) { const s = { ax: x, az: z, bx: x, bz: z, r }; this.paredes.add(s, x - r, z - r, x + r, z + r); }

  // empurra um círculo para fora das paredes; devolve a normal do choque (ou null)
  colidir(p, r) {
    let hit = null;
    for (const s of this.paredes.perto(p.x, p.z, r + 1)) {
      const [qx, qz] = pontoSeg(p.x, p.z, s);
      const rr = r + (s.r || 0);
      let dx = p.x - qx, dz = p.z - qz; const d = Math.hypot(dx, dz);
      if (d < rr) {
        if (d < 1e-4) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
        p.x = qx + dx * rr; p.z = qz + dz * rr;
        hit = hit ? { x: hit.x + dx, z: hit.z + dz } : { x: dx, z: dz };
      }
    }
    if (hit) { const L = Math.hypot(hit.x, hit.z) || 1; hit.x /= L; hit.z /= L; }
    return hit;
  }

  // rua mais próxima: distância ao eixo, rua, ponto e direção
  infoRua(x, z, raio = 40) {
    let best = { dist: 1e9, rua: null };
    for (const s of this.ruas.perto(x, z, raio)) {
      const [qx, qz] = pontoSeg(x, z, s);
      const d = Math.hypot(x - qx, z - qz);
      if (d < best.dist) best = { dist: d, rua: s.rua, x: qx, z: qz, dir: Math.atan2(s.bx - s.ax, s.bz - s.az) };
    }
    return best;
  }
}
