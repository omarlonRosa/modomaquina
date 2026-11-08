// Uno 1.6R: modelo, física arcade e som do motor.
// Rumo (ang) = rotation.y; frente do carro = (sin ang, cos ang); +x local = lado esquerdo.
import * as THREE from 'three';

const ENTRE_EIXOS = 2.36;
const RAIO_RODA = 0.286;
const MARCHAS = [12.5, 21, 29.5, 38, 49];     // m/s no corte de cada marcha
const CENTRO = 0.333;                          // meio do entre-eixos no modelo

export class Carro {
  // opts.cor: pintura (o rival usa outra cor); opts.leve: sem luz de farol (o spot pesa no celular)
  constructor(gltf, scene, opts = {}) {
    this.grupo = new THREE.Group();
    this.corpo = new THREE.Group();            // recebe rolagem e arfagem
    this.grupo.add(this.corpo);
    const m = gltf.scene;
    m.position.z = -CENTRO;
    this.corpo.add(m);
    scene.add(this.grupo);

    this.rodas = [];
    for (const nome of ['roda_dianteira_esq', 'roda_dianteira_dir', 'roda_traseira_esq', 'roda_traseira_dir']) {
      const w = m.getObjectByName(nome);
      if (!w) continue;
      const piv = new THREE.Group(); piv.position.copy(w.position);
      w.parent.add(piv); piv.add(w); w.position.set(0, 0, 0);
      this.rodas.push({ piv, w, frente: nome.includes('dianteira') });
    }
    this.lanternas = []; this.farois = [];
    m.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((mt, i) => {
        if (mt.name === 'lensR' || mt.name === 'lensRedGlass') {
          const c = mt.clone(); c.emissive = new THREE.Color(0xff1010); c.emissiveIntensity = 0.5;
          if (Array.isArray(o.material)) o.material[i] = c; else o.material = c;
          this.lanternas.push(c);
        } else if (mt.name === 'lensF' || mt.name === 'lensClear') {
          mt.emissive = new THREE.Color(0xfff4dd); mt.emissiveIntensity = mt.name === 'lensF' ? 2.2 : 0.6; this.farois.push(mt);
        }
        if (mt.map) mt.map.anisotropy = 4;
        if (opts.cor && mt.name === 'paint') {
          const c = mt.clone(); c.color = new THREE.Color(opts.cor);
          if (Array.isArray(o.material)) o.material[i] = c; else o.material = c;
        }
        // partes da lataria vieram com faces invertidas (as laterais do teto sumiam vistas de cima)
        if (['paint', 'grafite', 'plastic', 'chrome'].includes(mt.name)) mt.side = THREE.DoubleSide;
      });
    });

    // farol: um spot só, para não pesar no celular
    if (!opts.leve) {
      const farol = new THREE.SpotLight(0xfff1d6, 160, 70, 0.62, 0.55, 1.4);
      farol.position.set(0, 0.75, 1.9); farol.target.position.set(0, 0, 18);
      this.grupo.add(farol, farol.target);
    }
    // chama do nitro no escapamento (traseira, lado direito)
    this.grupo.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(m);
    const chama = new THREE.Group();
    const cone = (r, l, cor, op) => new THREE.Mesh(new THREE.ConeGeometry(r, l, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -l / 2),
      new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    chama.add(cone(0.12, 1.2, 0x1f5bff, 0.55), cone(0.06, 0.55, 0x9cc8ff, 0.6), cone(0.17, 0.75, 0xff6a10, 0.28));
    chama.position.set(-0.42, 0.27, caixa.min.z - 0.02);
    chama.visible = false;
    this.corpo.add(chama); this.chama = chama;
    // brilho no chão à frente (barato e dá leitura de farol aceso)
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const poca = new THREE.Mesh(new THREE.PlaneGeometry(7, 14).rotateX(-Math.PI / 2).translate(0, 0.1, 9),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), color: 0xfff0d0, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.grupo.add(poca);
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6).rotateX(-Math.PI / 2).translate(0, 0.1, -2.6),
      new THREE.MeshBasicMaterial({ map: poca.material.map, color: 0xff2020, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.grupo.add(fr); this.brilhoFreio = fr.material;

    this.reset(0, 0, 0);
  }

  reset(x, z, ang) {
    if (this.nitro === undefined) this.nitro = 1;
    this.nitroAtivo = false; this.impulso = 0; this.bonus = 0;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector2(0, 0);   // (x, z) no mundo
    this.ang = ang; this.w = 0; this.dir = 0;
    this.vf = 0; this.vl = 0; this.giro = 0; this.marcha = 1; this.rpm = 900;
    this.rol = 0; this.arf = 0; this.choque = 0; this.foraDaRua = false; this.rua = null;
    this.avaria = 0; this.noCanteiro = false; this.evento = null; this.embalo = 0;   // R (voltar pra rua) conserta
    this.atualizarModelo(0);
  }

  update(dt, inp, mundo) {
    const f = new THREE.Vector2(Math.sin(this.ang), Math.cos(this.ang));
    const e = new THREE.Vector2(Math.cos(this.ang), -Math.sin(this.ang));   // esquerda
    let vf = this.vel.dot(f), vl = this.vel.dot(e);

    const info = mundo.infoRua(this.pos.x, this.pos.z, 30);
    this.rua = info.rua;
    const naTerra = !info.rua || info.dist > info.rua.w / 2 + 2.2 || info.rua.terra;
    this.foraDaRua = naTerra;
    const M = this.mods || {};                                       // peças da garagem (garagem.js)
    const vmax = (naTerra ? 30 : 49 + (M.vmax || 0)) * (1 - 0.2 * (this.avaria || 0));   // avariado no canteiro: perde velocidade
    const aderencia = inp.mao ? 1.3 : (naTerra ? 4.2 : 9) * (M.grip || 1);

    // nitro: empurrão forte e mais velocidade final enquanto tem no cilindro (uns 3 s cheio)
    const nitroOn = !!inp.nitro && this.nitro > 0.01 && vf > 2 && !inp.parado;
    if (nitroOn) this.nitro = Math.max(0, this.nitro - dt / (M.nitroDur || 3));
    else this.nitro = Math.min(1, this.nitro + dt * (0.03 + (this.derrapando || 0) * 0.12) * (M.nitroRec || 1));   // recarrega devagar, mais rápido derrapando
    this.nitroAtivo = nitroOn;
    const vmaxEf = vmax + (nitroOn ? 14 : 0);
    // motor, freio e ré
    let ac = 0;
    if (inp.acel > 0) {
      if (vf < -0.5) ac = 11 * inp.acel;
      else ac = inp.acel * (4.6 + (this.bonus || 0)) * (M.acel || 1) * Math.max(0, 1 - Math.pow(Math.max(vf, 0) / vmaxEf, 1.7)) * (naTerra ? 0.8 : 1);
    }
    if (nitroOn) ac += 6.5 * Math.max(0, 1 - Math.max(vf, 0) / vmaxEf);
    if (this.impulso > 0) { this.impulso -= dt; ac += 5; }        // largada perfeita
    if (inp.freio > 0) {
      if (vf > 0.6) ac -= 11 * inp.freio * (M.freio || 1);
      else ac -= 3.4 * inp.freio * (vf > -9 ? 1 : 0);          // ré até ~32 km/h
    }
    if (!inp.acel && !inp.freio) ac -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 0.9 + Math.abs(vf) * 0.02);
    if (inp.mao) ac -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 4);
    if (naTerra && Math.abs(vf) > vmax) ac -= Math.sign(vf) * 6;
    vf += ac * dt;

    // direção: menos esterço em alta
    const dMax = 0.62 / (1 + Math.abs(vf) * 0.055);
    const alvo = inp.dir * dMax + (this.avaria || 0) * 0.03 * Math.min(1, Math.abs(vf) / 8);   // suspensão torta puxa para a esquerda
    this.dir += (alvo - this.dir) * Math.min(1, dt * (inp.analogico ? 14 : 7));
    let wAlvo = vf * Math.tan(this.dir) / ENTRE_EIXOS;
    if (inp.mao && Math.abs(vf) > 7) wAlvo *= 1.7;
    this.w += (wAlvo - this.w) * Math.min(1, dt * (inp.mao ? 3 : 10));

    // derrapagem: o lateral morre conforme a aderência
    const vlAntes = vl;
    vl *= Math.exp(-aderencia * dt);
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), Math.abs(vlAntes - vl) * 0.35);
    this.vel.set(f.x * vf + e.x * vl, f.y * vf + e.y * vl);

    if (inp.parado) { this.vel.set(0, 0); this.w = 0; }          // contagem da largada: segura o carro, mas deixa acelerar o motor
    this.ang += this.w * dt;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;

    // colisão: três círculos ao longo do carro
    const nf = new THREE.Vector2(Math.sin(this.ang), Math.cos(this.ang));
    let bateu = null;
    // canteiro alto: devagar é parede; acima de ~80 km/h o carro passa por cima, mas se arrebenta
    // embalo: depois de subir no canteiro, segue por cima até sair do outro lado (os dois meios-fios)
    if (this.embalo > 0) this.embalo -= dt;
    const rapido = Math.abs(this.vf) > 22 || this.embalo > 0;
    for (const off of [1.35, 0, -1.25]) {
      const p = { x: this.pos.x + nf.x * off, z: this.pos.z + nf.y * off };
      const ox = p.x, oz = p.z;
      const n = mundo.colidir(p, 0.86, rapido);
      if (n) { this.pos.x += p.x - ox; this.pos.z += p.z - oz; bateu = n; }
    }
    if (bateu) {
      const vn = this.vel.x * bateu.x + this.vel.y * bateu.z;
      if (vn < 0) {
        this.vel.x -= vn * 1.25 * bateu.x; this.vel.y -= vn * 1.25 * bateu.z;
        this.vel.multiplyScalar(0.8);
        this.w *= 0.5;
        this.choque = Math.max(this.choque, Math.min(1, -vn / 14));
      }
    }
    if (mundo.tocaCanteiro) {
      const toca = mundo.tocaCanteiro(this.pos.x, this.pos.z, 1.0);
      if (toca && this.embalo > 0) this.embalo = Math.max(this.embalo, 0.25);
      else if (toca && !this.noCanteiro && rapido) {
        this.embalo = 0.9;
        this.vel.multiplyScalar(0.55); this.w *= 0.3;
        this.choque = 1; this.avaria = Math.min(2, this.avaria + 1); this.evento = 'canteiro';
      }
      this.noCanteiro = toca;
    }
    // borda do mapa
    const r = Math.hypot(this.pos.x, this.pos.z), lim = mundo.raio + 40;
    if (r > lim) { this.pos.x *= lim / r; this.pos.z *= lim / r; this.vel.multiplyScalar(0.5); }

    // estado para HUD e som
    const ef = new THREE.Vector2(Math.sin(this.ang), Math.cos(this.ang)), ee = new THREE.Vector2(Math.cos(this.ang), -Math.sin(this.ang));
    const novoVf = this.vel.dot(ef);
    this.acLong = (novoVf - this.vf) / dt;
    this.vf = novoVf; this.vl = this.vel.dot(ee);
    const v = Math.abs(this.vf);
    let m = 0; while (m < MARCHAS.length - 1 && v > MARCHAS[m]) m++;
    this.marcha = this.vf < -0.5 ? 'R' : m + 1;
    const lo = m ? MARCHAS[m - 1] * 0.55 : 0;
    const rpmAlvo = 900 + Math.max(0, (v - lo) / (MARCHAS[m] - lo)) * 5900 * (m ? 1 : 1) + (inp.acel && v < 2 ? 2200 * inp.acel : 0);
    this.rpm += (Math.min(7000, rpmAlvo) - this.rpm) * Math.min(1, dt * 8);
    this.derrapando = Math.min(1, Math.max(0, (Math.abs(this.vl) - 2.2) / 6)) * (v > 4 ? 1 : 0);
    this.freando = inp.freio > 0 && this.vf > 0.5;
    this.choque = Math.max(0, this.choque - dt * 2.5);
    this.atualizarModelo(dt, inp);
  }

  atualizarModelo(dt, inp = {}) {
    this.grupo.position.copy(this.pos);
    this.grupo.rotation.y = this.ang;
    const lat = (this.w || 0) * (this.vf || 0);
    this.rol += (THREE.MathUtils.clamp(-lat * 0.006, -0.06, 0.06) - this.rol) * Math.min(1, dt * 6);
    this.arf += (THREE.MathUtils.clamp(-(this.acLong || 0) * 0.004, -0.035, 0.035) - this.arf) * Math.min(1, dt * 5);
    this.corpo.rotation.z = this.rol; this.corpo.rotation.x = this.arf;
    this.giro += (this.vf || 0) / RAIO_RODA * dt;
    for (const r of this.rodas) {
      r.w.rotation.x = this.giro;
      if (r.frente) r.piv.rotation.y = this.dir;
    }
    if (this.chama) {
      this.chama.visible = !!this.nitroAtivo;
      if (this.nitroAtivo) { const k = 0.8 + Math.random() * 0.45; this.chama.scale.set(1, 1, k); }
    }
    const fr = this.freando ? 2.8 : 0.5;
    for (const l of this.lanternas) l.emissiveIntensity = fr;
    if (this.brilhoFreio) this.brilhoFreio.opacity = this.freando ? 0.5 : 0.12;
  }

  get kmh() { return Math.abs(this.vf) * 3.6; }
}

// ---------- som: motor sintetizado (sem arquivo de áudio), pneu e batida
export class Som {
  constructor() { this.ok = false; this.mudo = false; }
  iniciar() {
    // iPhone: no modo silencioso o Safari corta o áudio da web; como "playback" (igual vídeo/música) ele toca
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (this.ok) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    // iOS antigo: um bip mudo dentro do toque destrava o áudio
    try { const b = ctx.createBuffer(1, 1, 22050), src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); } catch (e) {}
    if (ctx.state !== 'running') ctx.resume();
    this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);
    const filtro = this.filtro = ctx.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 600; filtro.Q.value = 2;
    const dist = ctx.createWaveShaper(); const k = 18, curva = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curva[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    dist.curve = curva;
    this.gMotor = ctx.createGain(); this.gMotor.gain.value = 0.12;
    this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator(); this.o2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.o1.connect(dist); this.o2.connect(g2); g2.connect(dist); dist.connect(filtro); filtro.connect(this.gMotor); this.gMotor.connect(this.master);
    this.o1.start(); this.o2.start();
    // ruído para pneu e batida
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.ruido = buf;
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 6;
    this.gPneu = ctx.createGain(); this.gPneu.gain.value = 0;
    n.connect(bp); bp.connect(this.gPneu); this.gPneu.connect(this.master); n.start();
    this.ok = true;
  }
  update(carro, acel) {
    if (!this.ok) return;
    const t = this.ctx.currentTime, f = carro.rpm / 60 * 2;
    this.o1.frequency.setTargetAtTime(f, t, 0.03);
    this.o2.frequency.setTargetAtTime(f / 2, t, 0.03);
    this.filtro.frequency.setTargetAtTime(380 + carro.rpm * 0.28 + acel * 500, t, 0.05);
    this.gMotor.gain.setTargetAtTime(0.07 + acel * 0.09 + (carro.nitroAtivo ? 0.05 : 0), t, 0.05);
    this.nitro(!!carro.nitroAtivo);
    this.gPneu.gain.setTargetAtTime(carro.derrapando * 0.22, t, 0.05);
    this.master.gain.setTargetAtTime(this.mudo ? 0 : 0.55, t, 0.05);
  }
  // chiado do nitro: ruído agudo enquanto ligado, com um "tssss" de abertura
  nitro(ligado) {
    if (!this.ok) return;
    if (!this.gNitro) {
      const n = this.ctx.createBufferSource(); n.buffer = this.ruido; n.loop = true;
      const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
      this.gNitro = this.ctx.createGain(); this.gNitro.gain.value = 0;
      n.connect(hp); hp.connect(this.gNitro); this.gNitro.connect(this.master); n.start();
    }
    const t = this.ctx.currentTime;
    if (ligado && !this.nitroLigado) { this.gNitro.gain.cancelScheduledValues(t); this.gNitro.gain.setValueAtTime(0.32, t); this.gNitro.gain.setTargetAtTime(0.13, t + 0.05, 0.2); }
    if (!ligado && this.nitroLigado) this.gNitro.gain.setTargetAtTime(0, t, 0.12);
    this.nitroLigado = ligado;
  }
  batida(forca) {
    if (!this.ok || this.mudo) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.ruido;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const g = this.ctx.createGain(); const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.6 * forca, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    s.connect(lp); lp.connect(g); g.connect(this.master); s.start(t); s.stop(t + 0.4);
  }
  pausar() { if (this.ok) this.ctx.suspend(); }
}
