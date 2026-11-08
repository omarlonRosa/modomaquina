// Rival do racha (máquina): outro Uno, pintado, que segue a rota do racha pela faixa da direita
// usando a mesma física do jogador. Freia antes das curvas, usa nitro nas retas e tem um "elástico"
// leve para a corrida ficar disputada. Se ficar preso numa parede, volta para a rota.
// O personagem e o carro são inventados; dá para trocar por gente da Lock-Up (com permissão) depois.
import * as THREE from 'three';
import { Carro } from './carro.js';

const embrulhar = a => Math.atan2(Math.sin(a), Math.cos(a));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

function plaquinha(nome) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(11,16,32,0.8)'; g.beginPath(); g.roundRect(8, 6, 240, 52, 12); g.fill();
  g.fillStyle = '#ff3b30'; g.fillRect(8, 6, 8, 52);
  g.fillStyle = '#fff'; g.font = 'italic 900 34px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(nome, 132, 33);
  g.fillStyle = '#ff3b30'; g.beginPath(); g.moveTo(112, 64); g.lineTo(144, 64); g.lineTo(128, 90); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  sp.scale.set(2.4, 0.9, 1); sp.position.y = 2.7; sp.renderOrder = 10;
  return sp;
}

export class Rival {
  constructor(gltfClone, scene, racha, nome = 'ZÉ TURBO', cor = 0xff2a1f) {
    this.nome = nome; this.racha = racha;
    this.carro = new Carro(gltfClone, scene, { cor, leve: true });
    this.marca = plaquinha(nome); this.carro.grupo.add(this.marca);
    this.elastico = true;          // na carreira os chefes correm sem aliviar
    this.est = { iRota: 0, distRota: 0 };
    this.s = 0; this.ativo = false; this.chegou = false; this.preso = 0;
    this.carro.grupo.visible = false;
    this.inp = { acel: 0, freio: 0, dir: 0, mao: false, nitro: false, analogico: true, parado: true };
  }

  iniciar(x, z, ang) {
    this.carro.reset(x, z, ang); this.carro.nitro = 1; this.carro.avaria = 0;
    this.est.iRota = 0; this.est.distRota = 0; this.s = 0;
    this.ativo = true; this.chegou = false; this.preso = 0;
    this.carro.grupo.visible = true;
  }

  parar() { this.ativo = false; this.carro.grupo.visible = false; }

  // outro piloto (carreira): troca o nome e a plaquinha
  nomear(nome) {
    if (nome === this.nome) return;
    this.nome = nome;
    const vis = this.marca.visible;
    this.carro.grupo.remove(this.marca); this.marca.material.map.dispose(); this.marca.material.dispose();
    this.marca = plaquinha(nome); this.marca.visible = vis; this.carro.grupo.add(this.marca);
  }

  // decide os comandos do frame; a física roda no passo fixo do jogo (main.js)
  pensar(dt, sJogador, largando) {
    const c = this.carro, r = this.racha, inp = this.inp;
    if (!this.ativo) return inp;
    this.s = r.progresso(this.est, c.pos.x, c.pos.z);
    const v = c.vf;
    if (this.chegou) {                                   // passou a chegada: tira o pé e encosta
      Object.assign(inp, { acel: 0, freio: v > 1 ? 0.5 : 0, dir: 0, nitro: false, parado: false });
      return inp;
    }
    // mira um ponto à frente na faixa da direita
    const olhar = 6 + Math.max(0, v) * 0.5;
    const [tx, tz] = r.pontoFaixa(this.s + olhar);
    const erro = embrulhar(Math.atan2(tx - c.pos.x, tz - c.pos.z) - c.ang);
    const dir = lim(erro * 2.4, -1, 1);
    // velocidade que dá para fazer cada curva à frente (e frear a tempo)
    // carro mais rápido e com mais aderência: reta mais longa e curva mais forte
    const F = c.ficha, M = c.mods || {}, kG = Math.sqrt(F.grip * (M.grip || 1)), kF = F.freio * (M.freio || 1);
    let vAlvo = Math.max(30, (F.vmax + (M.vmax || 0)) * 0.96);
    for (const cv of r.curvas) {
      const d = cv.s - this.s;
      if (d < -10 || d > 190) continue;
      const vc = (9 + 15 * Math.max(0, 1 - Math.abs(cv.ang) / 1.9)) * kG;
      vAlvo = Math.min(vAlvo, Math.sqrt(vc * vc + 2 * 7 * kF * Math.max(0, d - 6)));
    }
    if (this.est.distRota > 8) vAlvo = Math.min(vAlvo, 9);  // saiu da rota: volta com calma
    if (Math.abs(erro) > 0.9) vAlvo = Math.min(vAlvo, 8);
    // elástico: muito na frente alivia; atrás ganha um fôlego no motor
    const gap = this.s - sJogador;
    if (this.elastico) {
      if (gap > 70) vAlvo *= 0.86;
      c.bonus = gap < -45 ? 1.5 : gap < -15 ? 0.7 : 0;
    } else c.bonus = gap < -60 ? 0.5 : 0;
    let acel = 0, freio = 0;
    if (v < vAlvo - 0.5) acel = 1;
    else if (v > vAlvo + 1.5) freio = lim((v - vAlvo) / 5, 0.25, 1);
    else acel = 0.35;
    const reta = !r.curvas.some(cv => cv.s - this.s > -6 && cv.s - this.s < 140);
    const nitro = !largando && reta && v > 12 && c.nitro > 0.2 && gap < 45 && Math.abs(erro) < 0.15;
    // preso (parede, poste, carro): depois de um tempo volta para a rota
    if (!largando && Math.abs(v) < 1.2) this.preso += dt; else this.preso = 0;
    if (this.preso > 2.5) {
      const [px, pz] = r.pontoFaixa(this.s + 3), [qx, qz] = r.pontoFaixa(this.s + 7);
      c.reset(px, pz, Math.atan2(qx - px, qz - pz)); this.preso = 0;
    }
    Object.assign(inp, { acel: largando ? (Math.random() < 0.5 ? 1 : 0.6) : acel, freio, dir: largando ? 0 : dir, nitro, parado: largando });
    return inp;
  }
}

// batida entre dois carros: três círculos em cada, empurra para os lados e troca velocidade
export function colisaoCarros(a, b) {
  let houve = 0;
  const fa = [Math.sin(a.ang), Math.cos(a.ang)], fb = [Math.sin(b.ang), Math.cos(b.ang)];
  for (const oa of [1.3, 0, -1.2]) for (const ob of [1.3, 0, -1.2]) {
    const ax = a.pos.x + fa[0] * oa, az = a.pos.z + fa[1] * oa, bx = b.pos.x + fb[0] * ob, bz = b.pos.z + fb[1] * ob;
    const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz);
    if (d > 1.7 || d < 1e-4) continue;
    const nx = dx / d, nz = dz / d, emp = (1.7 - d) / 2;
    a.pos.x += nx * emp; a.pos.z += nz * emp; b.pos.x -= nx * emp; b.pos.z -= nz * emp;
    const vr = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * nz;
    if (vr < 0) {
      const j = -vr * 0.6;
      a.vel.x += nx * j; a.vel.y += nz * j; b.vel.x -= nx * j; b.vel.y -= nz * j;
      houve = Math.max(houve, Math.min(1, -vr / 10));
    }
  }
  if (houve) { a.choque = Math.max(a.choque, houve); b.choque = Math.max(b.choque, houve); }
  return houve;
}
