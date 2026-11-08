// Trânsito: carros comuns (hatch, sedã, picape, SUV, modelos genéricos feitos aqui) rodando pelas ruas do mapa.
// Regras (combinadas com o usuário): andam pela DIREITA, respeitam mão única (OSM oneway), não cruzam o canteiro
// fora das aberturas (só seguem ruas do mapa), diminuem nas curvas e param atrás de quem está na frente.
// Também exporta a rede de ruas (Rede), que a polícia usa para achar caminho até o jogador.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const chave = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
const VEL = { 1: 8.5, 2: 11, 3: 13, 4: 17, 5: 17 };          // m/s por classe de rua (30 a 60 km/h)

// ---------- rede de ruas (nós = pontos das ruas; arestas = trechos)
export class Rede {
  constructor(ruas, raio) {
    this.nos = new Map();       // chave -> { id, p:[x,z], saidas:[aresta], todas:[aresta] }
    this.lista = [];
    this.arestas = [];
    const no = p => { const k = chave(p); let n = this.nos.get(k); if (!n) { n = { id: this.lista.length, p, saidas: [], todas: [] }; this.nos.set(k, n); this.lista.push(n); } return n; };
    for (const r of ruas) {
      if (r.t === 'track') continue;
      for (let i = 1; i < r.p.length; i++) {
        const a = no(r.p[i - 1]), b = no(r.p[i]);
        if (a === b) continue;
        const dx = b.p[0] - a.p[0], dz = b.p[1] - a.p[1], L = Math.hypot(dx, dz);
        const ida = { a, b, rua: r, L, d: [dx / L, dz / L], volta: null };
        const volta = { a: b, b: a, rua: r, L, d: [-dx / L, -dz / L], volta: ida, contramao: !!r.mao };
        ida.volta = volta;
        this.arestas.push(ida);
        a.todas.push(ida); b.todas.push(volta);           // a polícia em perseguição pode ir na contramão
        a.saidas.push(ida); if (!r.mao) b.saidas.push(volta);
      }
    }
    this.raio = raio;
    this.paraTransito = this.arestas.filter(e => e.rua.t !== 'service' && Math.hypot(...e.a.p) < raio - 60 && Math.hypot(...e.b.p) < raio - 60);
  }

  noPerto(x, z, max = 60) {
    let m = null, dm = max;
    for (const n of this.lista) { const d = Math.hypot(n.p[0] - x, n.p[1] - z); if (d < dm) { dm = d; m = n; } }
    return m;
  }

  // trecho de rua onde um carro está, no sentido em que ele anda (evita pegar a outra pista da PA-160)
  arestaPerto(x, z, ang, max = 9) {
    const fx = Math.sin(ang), fz = Math.cos(ang);
    let m = null, dm = max;
    for (const ida of this.arestas) for (const e of [ida, ida.volta]) {
      if (e.d[0] * fx + e.d[1] * fz < 0.5) continue;
      const [ax, az] = e.a.p, [bx, bz] = e.b.p, vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
      const d = Math.hypot(ax + vx * u - x, az + vz * u - z);
      if (d < dm) { dm = d; m = e; }
    }
    return m;
  }

  // menor caminho (Dijkstra) por todas as ruas, nos dois sentidos; devolve lista de pontos
  caminho(de, para, limite = 3000) {
    if (!de || !para) return null;
    const dist = new Map([[de.id, 0]]), ant = new Map(), fila = [[0, de]];
    let passos = 0;
    while (fila.length && passos++ < limite) {
      let k = 0; for (let i = 1; i < fila.length; i++) if (fila[i][0] < fila[k][0]) k = i;
      const [d, n] = fila.splice(k, 1)[0];
      if (n === para) break;
      if (d > (dist.get(n.id) ?? Infinity)) continue;
      for (const e of n.todas) {
        const nd = d + e.L * (e.contramao ? 1.3 : 1);
        if (nd < (dist.get(e.b.id) ?? Infinity)) { dist.set(e.b.id, nd); ant.set(e.b.id, n); fila.push([nd, e.b]); }
      }
    }
    if (!ant.has(para.id) && de !== para) return null;
    const out = [para.p]; let n = para;
    while (n !== de) { n = ant.get(n.id); if (!n) return null; out.push(n.p); }
    return out.reverse();
  }
}

// ---------- modelos genéricos (sem marca): hatch, sedã, picape, SUV
const CORES = [0xf2f2ee, 0xd8d8d4, 0x9aa0a6, 0x2b2e33, 0x111214, 0x8f1a1a, 0x1d3d7a, 0x5a6b4e, 0xc9b48a, 0xb0b5ba, 0xe8e8e4, 0x6a1f1f];
function caixa(w, h, l, x, y, z, cor) {
  const g = new THREE.BoxGeometry(w, h, l).translate(x, y, z).toNonIndexed();
  const c = new THREE.Color(cor), arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.deleteAttribute('uv');
  return g;
}
const FORMAS = {
  hatch:  { L: 3.9, W: 1.68, H: 0.75, cab: [1.55, 0.62, -0.25], vid: 1.0 },
  seda:   { L: 4.45, W: 1.72, H: 0.72, cab: [1.75, 0.62, -0.05], vid: 1.0 },
  picape: { L: 4.9, W: 1.8, H: 0.85, cab: [1.6, 0.7, 0.65], cacamba: true },
  suv:    { L: 4.5, W: 1.82, H: 0.95, cab: [2.3, 0.75, -0.3] },
};
function modelo(tipo) {
  const f = FORMAS[tipo], y0 = 0.32;
  const corpo = [caixa(f.W, f.H, f.L, 0, y0 + f.H / 2, 0, 0xffffff)];
  const [cl, ch, cz] = f.cab;
  corpo.push(caixa(f.W - 0.12, ch, cl, 0, y0 + f.H + ch / 2, cz, 0xffffff));
  if (f.cacamba) corpo.push(caixa(f.W, 0.35, 0.08, 0, y0 + f.H + 0.17, -f.L / 2 + 0.04, 0xffffff));
  const det = [];
  // vidros (escuros) por cima da cabine
  det.push(caixa(f.W - 0.08, ch * 0.7, cl * 0.92, 0, y0 + f.H + ch * 0.48, cz, 0x0c1116));
  // rodas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) det.push(caixa(0.24, 0.62, 0.62, sx * (f.W / 2 - 0.1), 0.31, sz * (f.L / 2 - 0.75), 0x0b0b0c));
  // faróis e lanternas
  for (const sx of [-1, 1]) {
    det.push(caixa(0.36, 0.14, 0.04, sx * (f.W / 2 - 0.3), y0 + f.H - 0.18, f.L / 2 + 0.01, 0xfff4d8));
    det.push(caixa(0.34, 0.14, 0.04, sx * (f.W / 2 - 0.28), y0 + f.H - 0.16, -f.L / 2 - 0.01, 0xd01010));
  }
  return { corpo: mergeGeometries(corpo), det: mergeGeometries(det), L: f.L };
}

export class Transito {
  constructor(scene, rede, mundo, opcoes = {}) {
    this.scene = scene; this.rede = rede; this.mundo = mundo;
    this.max = opcoes.max || 20;
    this.modelos = Object.fromEntries(Object.keys(FORMAS).map(t => [t, modelo(t)]));
    this.matDet = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.carros = [];
    this.ativo = false;
    this.grupo = new THREE.Group(); scene.add(this.grupo);
  }

  criarCarro() {
    const tipos = ['hatch', 'hatch', 'seda', 'seda', 'picape', 'suv'], tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const m = this.modelos[tipo];
    const g = new THREE.Group();
    const corpo = new THREE.Mesh(m.corpo, new THREE.MeshStandardMaterial({ vertexColors: true, color: CORES[Math.floor(Math.random() * CORES.length)], roughness: 0.45, metalness: 0.3 }));
    g.add(corpo, new THREE.Mesh(m.det, this.matDet));
    this.grupo.add(g);
    return { g, L: m.L, pos: new THREE.Vector3(), vel: new THREE.Vector2(), ang: 0, choque: 0, e: null, s: 0, v: 0, faixa: 0, parado: 0, vivo: false };
  }

  ligar(sim) { this.ativo = sim; this.grupo.visible = sim; if (!sim) for (const c of this.carros) c.vivo = false; }

  // coloca um carro numa aresta aleatória longe da vista (entre 110 e 260 m do jogador)
  nascer(c, px, pz) {
    const A = this.rede.paraTransito;
    for (let t = 0; t < 30; t++) {
      const e = A[Math.floor(Math.random() * A.length)];
      const d = Math.hypot(e.a.p[0] - px, e.a.p[1] - pz);
      if (d < 110 || d > 260) continue;
      c.e = Math.random() < 0.5 && e.volta && !e.rua.mao ? e.volta : e;
      c.s = Math.random() * c.e.L; c.v = VEL[c.e.rua.c] || 9; c.vivo = true; c.parado = 0;
      c.faixa = c.e.rua.mao ? (Math.random() < 0.5 ? 1 : -1) : -1;     // -1 = faixa da direita
      c.g.visible = true;
      this.posicionar(c, 1);
      return true;
    }
    c.vivo = false; c.g.visible = false; return false;
  }

  proxima(c) {
    const n = c.e.b;
    let ops = n.saidas.filter(e => e !== c.e.volta && e.rua.t !== 'service' && Math.hypot(...e.b.p) < this.rede.raio - 40);
    if (!ops.length) ops = n.saidas.filter(e => Math.hypot(...e.b.p) < this.rede.raio - 40);   // rua sem saída: retorna
    if (!ops.length) return null;
    // prefere seguir reto (pesa pelo alinhamento)
    const pesos = ops.map(e => 0.25 + Math.max(0, e.d[0] * c.e.d[0] + e.d[1] * c.e.d[1]) * 1.5 + (e.rua.c >= 3 ? 0.4 : 0));
    let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ops.length; i++) { r -= pesos[i]; if (r <= 0) return ops[i]; }
    return ops[ops.length - 1];
  }

  posicionar(c, k) {
    const e = c.e, u = c.s / e.L;
    // faixa -1 = direita de quem anda, deslocada (-dz, dx) * w/4; +1 = esquerda (só em mão única)
    const larg = e.rua.w / 4, sg = c.faixa === -1 ? 1 : -1;
    const x = e.a.p[0] + (e.b.p[0] - e.a.p[0]) * u - e.d[1] * larg * sg;
    const z = e.a.p[1] + (e.b.p[1] - e.a.p[1]) * u + e.d[0] * larg * sg;
    const ang = Math.atan2(e.d[0], e.d[1]);
    if (k >= 1) { c.pos.set(x, 0, z); c.ang = ang; }
    else {
      c.pos.x += (x - c.pos.x) * k; c.pos.z += (z - c.pos.z) * k;
      c.ang += Math.atan2(Math.sin(ang - c.ang), Math.cos(ang - c.ang)) * k;
    }
    c.vel.set(Math.sin(c.ang) * c.v, Math.cos(c.ang) * c.v);
    c.g.position.copy(c.pos); c.g.rotation.y = c.ang;
  }

  update(dt, outros) {
    if (!this.ativo) return;
    const ref = outros[0];
    while (this.carros.length < this.max) this.carros.push(this.criarCarro());
    for (const c of this.carros) {
      if (!c.vivo || Math.hypot(c.pos.x - ref.pos.x, c.pos.z - ref.pos.z) > 320) { this.nascer(c, ref.pos.x, ref.pos.z); if (!c.vivo) continue; }
      // velocidade alvo: classe da rua, curva chegando e quem está na frente
      let alvo = VEL[c.e.rua.c] || 9;
      const falta = c.e.L - c.s;
      if (falta < 14 && c.prox === undefined) c.prox = this.proxima(c);
      if (c.prox && falta < 16) {
        const cos = c.prox.d[0] * c.e.d[0] + c.prox.d[1] * c.e.d[1];
        if (cos < 0.85) alvo = Math.min(alvo, 4 + 6 * Math.max(0, cos));
      }
      const fx = Math.sin(c.ang), fz = Math.cos(c.ang);
      let livre = 99;
      const checa = (o, comp) => {
        const dx = o.pos.x - c.pos.x, dz = o.pos.z - c.pos.z, fr = dx * fx + dz * fz, la = Math.abs(dx * fz - dz * fx);
        if (fr > 0 && fr < 26 && la < 2.3) livre = Math.min(livre, fr - (comp || 4) / 2 - c.L / 2);
      };
      for (const o of this.carros) if (o !== c && o.vivo) checa(o, o.L);
      for (const o of outros) if (o) checa(o, 4);
      if (livre < 22) alvo = Math.min(alvo, Math.max(0, (livre - 2.5) * 1.1));
      if (c.parado > 0) { c.parado -= dt; alvo = 0; }
      c.v += Math.max(-7 * dt, Math.min(2.2 * dt, alvo - c.v));
      c.s += c.v * dt;
      while (c.s > c.e.L) {
        const n = c.prox || this.proxima(c); c.prox = undefined;
        if (!n) { c.vivo = false; c.g.visible = false; break; }
        c.s -= c.e.L; c.e = n;
        if (!n.rua.mao) c.faixa = -1;
      }
      if (!c.vivo) continue;
      this.posicionar(c, Math.min(1, dt * 10));
      c.choque = Math.max(0, c.choque - dt * 2);
    }
  }

  // batidas com carros que têm física (jogador, rival, polícia): empurra só o de física; o do trânsito para
  colidir(fis) {
    let forte = 0, quem = null;
    const ff = [Math.sin(fis.ang), Math.cos(fis.ang)];
    for (const c of this.carros) {
      if (!c.vivo) continue;
      if (Math.abs(c.pos.x - fis.pos.x) > 7 || Math.abs(c.pos.z - fis.pos.z) > 7) continue;
      const fc = [Math.sin(c.ang), Math.cos(c.ang)], meia = c.L / 2 - 0.9;
      for (const oa of [1.3, 0, -1.2]) for (const oc of [meia, 0, -meia]) {
        const ax = fis.pos.x + ff[0] * oa, az = fis.pos.z + ff[1] * oa, bx = c.pos.x + fc[0] * oc, bz = c.pos.z + fc[1] * oc;
        const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz);
        if (d > 1.75 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d;
        fis.pos.x += nx * (1.75 - d); fis.pos.z += nz * (1.75 - d);
        const vr = (fis.vel.x - c.vel.x) * nx + (fis.vel.y - c.vel.y) * nz;
        if (vr < 0) {
          fis.vel.x -= nx * vr * 1.3; fis.vel.y -= nz * vr * 1.3; fis.vel.multiplyScalar(0.85);
          const f = Math.min(1, -vr / 10); fis.choque = Math.max(fis.choque || 0, f);
          c.v = 0; c.parado = 2.5; if (f > forte) { forte = f; quem = c; }
        }
      }
    }
    return forte > 0.12 ? { forca: forte, carro: quem } : null;
  }
}
