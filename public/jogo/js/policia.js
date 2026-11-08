// Polícia: viaturas (Unos brancos com giroflex) fazendo ronda pelas ruas. Se virem você correndo
// (acima de ~95 km/h), batendo no trânsito, batendo nelas ou num racha, começa a perseguição.
// O nível de procurado sobe com o tempo (chama a 2ª viatura e elas ficam mais bravas).
// Parou cercado por uns segundos = enquadrado (multa). Abriu distância e sumiu = despistou (bônus).
// Na perseguição as viaturas acham caminho pelas ruas (Rede) e podem ir na contramão, com sirene.
import * as THREE from 'three';
import { Carro } from './carro.js';

const embrulhar = a => Math.atan2(Math.sin(a), Math.cos(a));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

function giroflex() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.28), new THREE.MeshStandardMaterial({ color: 0x1a1b1e }));
  const vm = new THREE.MeshBasicMaterial({ color: 0xff1a1a }), az = new THREE.MeshBasicMaterial({ color: 0x1a4dff });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.24), vm); l1.position.set(0.25, 0.08, 0);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.24), az); l2.position.set(-0.25, 0.08, 0);
  // brilho em volta (aditivo), que é o que se vê de longe
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const s1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  const s2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0x2050ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s1.position.set(0.3, 0.1, 0); s2.position.set(-0.3, 0.1, 0); s1.scale.setScalar(2.6); s2.scale.setScalar(2.6);
  g.add(base, l1, l2, s1, s2);
  g.position.set(0, 1.5, -0.15);
  return { g, vm, az, s1, s2 };
}

export class Policia {
  constructor(clones, scene, rede, mundo) {
    this.rede = rede; this.mundo = mundo; this.ativo = false;
    this.v = clones.map(cl => {
      const carro = new Carro(cl, scene, { cor: 0xf4f4f2, leve: true });
      const gf = giroflex(); carro.corpo.add(gf.g);
      carro.grupo.visible = false;
      carro.mods = { acel: 1.2, vmax: 4, grip: 1.15, freio: 1.1 };
      return { carro, gf, modo: 'fora', cam: [], iCam: 0, tCam: 0, preso: 0, inp: { acel: 0, freio: 0, dir: 0, mao: false, analogico: true } };
    });
    this.nivel = 0; this.tPerseg = 0; this.tFuga = 0; this.tEnquadro = 0; this.tInfracao = 0;
    this.aoEnquadrar = null; this.aoFugir = null;
    this.el = { box: document.getElementById('procurado'), estrelas: document.getElementById('proc-nivel'), txt: document.getElementById('proc-txt') };
  }

  get perseguindo() { return this.nivel > 0; }
  carros() { return this.v.filter(p => p.modo !== 'fora').map(p => p.carro); }

  ligar(sim) {
    this.ativo = sim;
    if (!sim) { for (const p of this.v) this.sumir(p); this.nivel = 0; this.mostrar(); }
  }

  sumir(p) { p.modo = 'fora'; p.carro.grupo.visible = false; }

  // põe a viatura numa rua entre dmin e dmax do jogador
  aparecer(p, jog, dmin = 140, dmax = 280) {
    const A = this.rede.paraTransito;
    for (let t = 0; t < 40; t++) {
      const e = A[Math.floor(Math.random() * A.length)];
      const d = Math.hypot(e.a.p[0] - jog.pos.x, e.a.p[1] - jog.pos.z);
      if (d < dmin || d > dmax) continue;
      p.carro.reset(e.a.p[0], e.a.p[1], Math.atan2(e.d[0], e.d[1]));
      p.carro.grupo.visible = true; p.modo = 'ronda'; p.cam = []; p.iCam = 0; p.preso = 0;
      this.ronda(p, e);
      return true;
    }
    return false;
  }

  // caminho de ronda: anda pelas ruas, no sentido certo, uns 400 m
  ronda(p, e) {
    const pts = [e.a.p, e.b.p]; let at = e, tot = e.L;
    while (tot < 400) {
      const ops = at.b.saidas.filter(x => x !== at.volta && x.rua.t !== 'service');
      if (!ops.length) break;
      at = ops[Math.floor(Math.random() * ops.length)]; pts.push(at.b.p); tot += at.L;
    }
    p.cam = pts; p.iCam = 0;
  }

  infracao(tipo) {
    // só vale se alguma viatura estiver vendo (perto)
    if (!this.ativo) return;
    this.tInfracao = 2.5; this.tipoInfracao = tipo;
    if (tipo === 'bateuPolicia') this.ultimaBatida = performance.now();
  }

  comecar(jog) {
    if (this.nivel === 0) { this.nivel = 1; this.tPerseg = 0; this.tFuga = 0; this.tEnquadro = 0; }
    for (const p of this.v) if (p.modo === 'ronda') p.modo = 'caca';
  }

  // decide os comandos de cada viatura (a física roda no passo fixo, em main.js)
  pensar(dt, jog, contexto = {}) {
    if (!this.ativo) return;
    const rapido = Math.abs(jog.vf) > 26.4;
    // garante uma viatura de ronda por perto
    if (!this.v.some(p => p.modo !== 'fora')) this.aparecer(this.v[0], jog);
    for (const p of this.v) {
      if (p.modo === 'fora') continue;
      const c = p.carro, d = Math.hypot(c.pos.x - jog.pos.x, c.pos.z - jog.pos.z);
      if (p.modo === 'ronda') {
        if (d > 420) { this.aparecer(p, jog); continue; }
        // viu infração?
        const viu = d < 80;
        if (viu && (rapido || this.tInfracao > 0 || (contexto.racha && Math.abs(jog.vf) > 19))) this.comecar(jog);
        this.seguir(p, dt, 11, false);
      } else if (p.modo === 'caca') {
        if (d > 600) { this.aparecer(p, jog, 160, 240); p.modo = 'caca'; }
        p.tCam -= dt;
        if (d > 45 && (p.tCam <= 0 || !p.cam.length)) {
          p.tCam = 1.2;
          // parte do fim do trecho em que a viatura está (no sentido dela) e vai até o trecho do jogador
          const eV = this.rede.arestaPerto(c.pos.x, c.pos.z, c.ang), eJ = this.rede.arestaPerto(jog.pos.x, jog.pos.z, jog.ang, 12);
          const de = eV ? eV.b : this.rede.noPerto(c.pos.x, c.pos.z, 80);
          const para = eJ ? eJ.a : this.rede.noPerto(jog.pos.x, jog.pos.z, 80);
          const cam = this.rede.caminho(de, para, 2500);
          if (cam && cam.length) {
            // descarta nós do começo que ficaram para trás da viatura (senão ela fica tentando voltar)
            const fx = Math.sin(c.ang), fz = Math.cos(c.ang);
            while (cam.length > 2 && ((cam[0][0] - c.pos.x) * fx + (cam[0][1] - c.pos.z) * fz) < 2) cam.shift();
            p.cam = [[c.pos.x, c.pos.z], ...cam, [jog.pos.x, jog.pos.z]]; p.iCam = 0;
          }
        }
        if (d <= 45) {        // perto: vai direto no jogador, mirando um pouco à frente dele
          const t = Math.min(1.2, d / 25);
          p.cam = [[c.pos.x, c.pos.z], [jog.pos.x + jog.vel.x * t, jog.pos.z + jog.vel.y * t]]; p.iCam = 0;
        }
        c.bonus = 0.6 + this.nivel * 0.5;
        this.seguir(p, dt, 30 + this.nivel * 4, true, d, Math.abs(jog.vf));
      }
      // giroflex pisca (na ronda, apagado)
      const on = p.modo === 'caca', fase = Math.floor(performance.now() / 130) % 2;
      p.gf.s1.visible = on && fase === 0; p.gf.s2.visible = on && fase === 1;
      p.gf.vm.color.setHex(on && fase === 0 ? 0xff2a2a : 0x551111); p.gf.az.color.setHex(on && fase === 1 ? 0x2a5aff : 0x111a55);
    }
    this.tInfracao = Math.max(0, this.tInfracao - dt);

    if (this.nivel > 0) {
      this.tPerseg += dt;
      const novo = Math.min(3, 1 + Math.floor(this.tPerseg / 25));
      if (novo > this.nivel) { this.nivel = novo; contexto.hud && contexto.hud.aviso(`PROCURADO NÍVEL ${novo}`, 1.4); }
      if (this.nivel >= 2) { const p2 = this.v.find(p => p.modo === 'fora'); if (p2 && this.aparecer(p2, jog, 120, 200)) p2.modo = 'caca'; }
      const caca = this.v.filter(p => p.modo === 'caca');
      const dmin = Math.min(...caca.map(p => Math.hypot(p.carro.pos.x - jog.pos.x, p.carro.pos.z - jog.pos.z)), 999);
      // enquadro: viatura colada e você parado
      if (dmin < 12 && Math.abs(jog.vf) < 3) this.tEnquadro += dt; else this.tEnquadro = Math.max(0, this.tEnquadro - dt * 2);
      // fuga: longe de todas
      if (dmin > 170) this.tFuga += dt; else if (dmin < 110) this.tFuga = 0;
      if (this.tEnquadro > 2.5) { const n = this.nivel; this.encerrar(jog); this.aoEnquadrar && this.aoEnquadrar(n); }
      else if (this.tFuga > 10) { const n = this.nivel; this.encerrar(jog); this.aoFugir && this.aoFugir(n); }
      this.dmin = dmin;
    }
    this.mostrar();
  }

  encerrar(jog) {
    this.nivel = 0; this.tPerseg = 0; this.tFuga = 0; this.tEnquadro = 0;
    let fica = false;
    for (const p of this.v) { if (p.modo === 'fora') continue; if (!fica) { p.modo = 'ronda'; fica = true; this.aparecer(p, jog, 260, 380); } else this.sumir(p); }
  }

  // segue o caminho com a mesma física dos carros (igual ao rival)
  seguir(p, dt, vMax, bravo, dJog = 99, vJog = 0) {
    const c = p.carro, inp = p.inp;
    if (!p.cam.length) { Object.assign(inp, { acel: 0, freio: 1, dir: 0 }); return; }
    // avança o índice para o ponto mais à frente que já passou
    while (p.iCam < p.cam.length - 1) {
      const [ax, az] = p.cam[p.iCam], [bx, bz] = p.cam[p.iCam + 1];
      const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
      if (((c.pos.x - ax) * vx + (c.pos.z - az) * vz) / L2 > 0.95) p.iCam++; else break;
    }
    const olhar = 5 + Math.max(0, c.vf) * 0.45;
    // ponto alvo: anda olhar metros a partir da posição projetada
    let [tx, tz] = p.cam[Math.min(p.iCam + 1, p.cam.length - 1)], resto = olhar;
    let px = c.pos.x, pz = c.pos.z;
    for (let i = p.iCam + 1; i < p.cam.length; i++) {
      const [qx, qz] = p.cam[i], L = Math.hypot(qx - px, qz - pz);
      if (L >= resto) { tx = px + (qx - px) * resto / L; tz = pz + (qz - pz) * resto / L; break; }
      resto -= L; px = qx; pz = qz; tx = qx; tz = qz;
    }
    const erro = embrulhar(Math.atan2(tx - c.pos.x, tz - c.pos.z) - c.ang);
    // curva à frente: ângulo entre os próximos trechos
    let vAlvo = vMax;
    for (let i = p.iCam + 1; i < Math.min(p.cam.length - 1, p.iCam + 6); i++) {
      const [ax, az] = p.cam[i - 1], [bx, bz] = p.cam[i], [cx2, cz2] = p.cam[i + 1];
      const g = Math.abs(embrulhar(Math.atan2(cx2 - bx, cz2 - bz) - Math.atan2(bx - ax, bz - az)));
      const dist = Math.hypot(bx - c.pos.x, bz - c.pos.z);
      if (g > 0.4) { const vc = 7 + 14 * Math.max(0, 1 - g / 1.8); vAlvo = Math.min(vAlvo, Math.sqrt(vc * vc + 2 * 8 * Math.max(0, dist - 5))); }
    }
    if (Math.abs(erro) > 1.0) vAlvo = Math.min(vAlvo, 7);
    if (bravo) {
      // jogador devagar: chega freando a tempo (distância de frenagem) e para do lado; correndo: cola nele
      if (vJog < 8) vAlvo = Math.min(vAlvo, Math.sqrt(2 * 8 * Math.max(0, dJog - 7)) + vJog);
      else if (dJog < 35) vAlvo = Math.max(vAlvo, vJog + 4);
    }
    const v = c.vf;
    let acel = 0, freio = 0;
    if (v < vAlvo - 0.5) acel = 1; else if (v > vAlvo + 1.5) freio = lim((v - vAlvo) / 5, 0.25, 1); else acel = 0.35;
    // presa: dá ré um pouco, depois tenta de novo
    if (Math.abs(v) < 1.0 && acel > 0) p.preso += dt; else p.preso = Math.max(0, p.preso - dt);
    let dir = lim(erro * 2.4, -1, 1), mao = false;
    if (bravo && dJog < 10 && vJog < 3) { Object.assign(inp, { acel: 0, freio: v > 0.5 ? 1 : 0, dir: 0, mao: v <= 0.5 }); p.preso = 0; return; }   // já encostou
    // alvo atrás: cavalo de pau (esterço todo, um pouco de freio de mão) em vez de ficar indo e voltando
    if (Math.abs(erro) > 1.6 && bravo) { dir = Math.sign(erro); acel = 0.8; freio = 0; mao = v > 6; }
    if (p.preso > 1.5) { acel = 0; freio = 1; dir = -dir; mao = false; if (p.preso > 3) p.preso = 0; }
    Object.assign(inp, { acel, freio, dir, mao });
  }

  mostrar() {
    const el = this.el; if (!el.box) return;
    el.box.classList.toggle('on', this.nivel > 0);
    document.body.classList.toggle('sirene', this.nivel > 0);
    if (this.nivel > 0) {
      const k = '★'.repeat(this.nivel) + '☆'.repeat(3 - this.nivel);
      if (el.estrelas.textContent !== k) el.estrelas.textContent = k;
      const txt = this.tEnquadro > 0.3 ? 'Encostando… acelera!' : this.tFuga > 0 ? `Despistando… ${Math.ceil(10 - this.tFuga)} s` : `Polícia a ${Math.round(this.dmin || 0)} m`;
      if (el.txt.textContent !== txt) el.txt.textContent = txt;
    }
  }
}
