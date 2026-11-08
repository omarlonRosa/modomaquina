// Arrancada de 402 m na PA-160 (pista que sobe), você contra o rival, cada um numa faixa.
// Largada de arrancada: segura FREIO + ACELERA (o motor fica no giro de largada) e solta o FREIO no verde.
// Soltou antes do verde = queimou. Câmbio na mão: MARCHA (Espaço/E ou botão) — trocar com o
// ponteiro no verde do conta-giros dá um empurrão. Nitro quando quiser (um cilindro).
// A física aqui é em linha (1D) sobre a reta, para a disputa ser de largada, troca e nitro.
const DIST = 402;
const S0 = 560;                       // onde fica a largada, em metros do percurso do racha (trecho reto)
const VG = [13.2, 22, 30.5, 39, 49.5]; // m/s no corte de giro de cada marcha
const AG = [7.4, 5.5, 4.2, 3.25, 2.55]; // aceleração "cheia" de cada marcha
const CORTE = 7000, LENTA = 900, GIRO_LARGADA = 5200;
const ZONA = [6300, 6950];            // troca perfeita

const torque = rpm => { const x = (rpm - 5300) / 4300; return Math.max(0.42, 1 - x * x); };

function piloto() {
  return { s: 0, v: 0, g: 0, rpm: LENTA, trocando: 0, boost: 0, patina: 0, nitro: 1, nitroOn: false,
    largou: false, queimou: false, reacao: null, tempo: null, vFinal: 0, noCorte: 0 };
}

function passo(p, dt, acel, nitro) {
  if (!p.largou) {                                  // parado na linha: motor sobe até o giro de largada
    const alvo = acel > 0.5 ? GIRO_LARGADA + Math.random() * 120 : LENTA;
    p.rpm += (alvo - p.rpm) * Math.min(1, dt * 6);
    return;
  }
  let a = 0;
  const vRpm = LENTA + (p.v / VG[p.g]) * (CORTE - LENTA);
  if (p.trocando > 0) {
    p.trocando -= dt; p.rpm += (vRpm - p.rpm) * Math.min(1, dt * 12); a = -0.3;
  } else {
    p.rpm = Math.max(vRpm, p.g === 0 && p.v < 6 && acel > 0.5 ? 3600 : vRpm);
    if (p.rpm >= CORTE) { p.rpm = CORTE - Math.random() * 280; p.noCorte += dt; a = 0; }   // batendo no corte
    else a = acel * AG[p.g] * torque(p.rpm) * (p.boost > 0 ? 1.13 : 1) * (p.patina > 0 ? 0.62 : 1);
  }
  p.nitroOn = !!nitro && p.nitro > 0 && p.trocando <= 0;
  if (p.nitroOn) { a += 3.7; p.nitro = Math.max(0, p.nitro - dt / 2.6); }
  a -= 0.00085 * p.v * p.v;                         // ar
  p.boost -= dt; p.patina -= dt;
  p.v = Math.max(0, p.v + a * dt); p.s += p.v * dt;
  p.ac = a;
}

function trocar(p) {
  if (!p.largou || p.g >= VG.length - 1 || p.trocando > 0) return null;
  const r = p.rpm;
  const q = r >= ZONA[0] && r <= ZONA[1] ? 'perfeita' : r > ZONA[1] ? 'passou' : r >= 5500 ? 'boa' : 'cedo';
  p.g++; p.trocando = { perfeita: 0.1, boa: 0.2, passou: 0.22, cedo: 0.3 }[q];
  if (q === 'perfeita') p.boost = 0.7;
  return q;
}

const fmt = s => s.toFixed(2).replace('.', ',') + ' s';

export class Arrancada {
  constructor(racha, scene, THREE) {
    this.racha = racha; this.ativo = false;
    // faixas pintadas: largada e chegada (quadriculada) atravessando a pista
    const faixa = (s, quadri) => {
      const [x, z] = racha.pontoNa(S0 + s), [x2, z2] = racha.pontoNa(S0 + s + 2);
      const c = document.createElement('canvas'); c.width = 256; c.height = 32;
      const g = c.getContext('2d');
      if (quadri) { for (let i = 0; i < 32; i++) for (let k = 0; k < 4; k++) { g.fillStyle = (i + k) % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 8, k * 8, 8, 8); } }
      else { g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 256, 32); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.1).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
      m.position.set(x, 0.1, z); m.rotation.y = Math.atan2(x2 - x, z2 - z); m.visible = false;
      scene.add(m); return m;
    };
    this.linhas = [faixa(0, false), faixa(DIST, true)];
    this.el = {
      box: document.getElementById('drag'), luzes: [...document.querySelectorAll('#arvore i')], info: document.getElementById('drag-info'),
      agulha: document.getElementById('tac-agulha'), marcha: document.getElementById('tac-marcha'),
      eu: document.getElementById('drag-eu'), ele: document.getElementById('drag-ele'),
    };
  }

  // posição e rumo numa faixa da reta (lado: +1 esquerda, -1 direita de quem dirige)
  pose(s, lado) {
    const r = this.racha, [x, z] = r.pontoNa(S0 + s), [x2, z2] = r.pontoNa(S0 + s + 2);
    const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz) || 1;
    return { x: x + dz / L * 1.9 * lado, z: z - dx / L * 1.9 * lado, ang: Math.atan2(dx, dz) };
  }

  iniciar(carro, rival, hud, aoTerminar) {
    this.carro = carro; this.rival = rival; this.hud = hud; this.fim = aoTerminar;
    this.eu = piloto(); this.ele = piloto();
    this.eu.nitro = 1; this.ele.nitro = 1;
    this.fase = 'pre';           // pre (segurar freio) → arvore → corrida → acabou
    this.t = 0; this.tVerde = null; this.freioAntes = false; this.trocaAntes = false; this.tAcabou = 0;
    // rival: reação e jeito de trocar sorteados (às vezes ele erra a troca e perde tempo)
    this.ia = { reacao: 0.17 + Math.random() * 0.17, trocaEm: () => Math.random() < 0.18 ? 5350 + Math.random() * 300 : 6150 + Math.random() * 800, nitroNa: Math.random() < 0.7 ? 2 : 3 };
    this.ativo = true;
    this.linhas.forEach(m => (m.visible = true));
    rival.carro.grupo.visible = true;
    if (rival.marca) rival.marca.visible = false;     // na faixa do lado a plaquinha fica enorme
    this.el.box.classList.add('on'); document.body.classList.add('arrancada');
    this.el.luzes.forEach(l => l.classList.remove('on'));
    this.el.info.textContent = 'Segure FREIO e ACELERA';
    this.posicionar(0);
  }

  parar() {
    if (!this.ativo) return;
    this.ativo = false;
    this.linhas.forEach(m => (m.visible = false));
    if (this.rival && !this.rival.ativo) this.rival.carro.grupo.visible = false;
    if (this.rival && this.rival.marca) this.rival.marca.visible = true;
    this.el.box.classList.remove('on'); document.body.classList.remove('arrancada');
  }

  posicionar(dt) {
    for (const [p, c, lado] of [[this.eu, this.carro, 1], [this.ele, this.rival.carro, -1]]) {
      const q = this.pose(p.s, lado);
      c.pos.set(q.x, 0, q.z); c.ang = q.ang; c.vel.set(Math.sin(q.ang) * p.v, Math.cos(q.ang) * p.v);
      c.vf = p.v; c.vl = 0; c.w = 0; c.dir = 0; c.acLong = p.ac || 0; c.rpm = p.rpm; c.marcha = p.g + 1;
      c.nitroAtivo = p.nitroOn; c.nitro = p.nitro; c.derrapando = p.patina > 0 ? 0.8 : 0; c.freando = this.fase === 'pre' || this.fase === 'arvore';
      c.choque = Math.max(0, (c.choque || 0) - dt * 2.5);
      c.atualizarModelo(dt);
    }
  }

  update(dt, inp) {
    if (!this.ativo) return;
    const eu = this.eu, ele = this.ele;
    const freio = (inp.freio || 0) > 0.5, acel = inp.acel || 0, troca = !!inp.mao;
    this.t += dt;
    if (this.fase === 'pre') {
      if (freio) { this.fase = 'arvore'; this.tArvore = 0; this.atraso = 0.6 + Math.random() * 0.5; this.el.info.textContent = 'Solte o FREIO no verde!'; }
    } else if (this.fase === 'arvore') {
      this.tArvore += dt;
      const k = Math.floor((this.tArvore - this.atraso) / 0.5);           // 3 amarelas, meio segundo cada, depois verde
      this.el.luzes.forEach((l, i) => l.classList.toggle('on', i < 3 ? k >= i : k >= 3));
      if (k >= 3 && this.tVerde === null) { this.tVerde = this.t; this.fase = 'corrida'; this.el.info.textContent = ''; }
      if (!freio && this.tVerde === null) {                                // soltou antes do verde
        eu.queimou = true; eu.largou = true; eu.reacao = -1; this.tVerde = this.t + 0.4; this.fase = 'corrida';
        this.el.luzes.forEach(l => l.classList.add('vermelho'));
        this.hud.aviso('QUEIMOU A LARGADA!', 1.6);
      }
    }
    if (this.fase === 'corrida' || this.fase === 'acabou') {
      const tv = this.t - this.tVerde;
      // você: larga quando soltar o freio; sem acelerar na hora, o carro "morre" um pouco
      if (!eu.largou && !freio) {
        eu.largou = true; eu.reacao = tv;
        if (eu.rpm < 3000) { eu.patina = 0.9; this.hud.aviso('Largou sem acelerar!', 0.9); }   // motor baixo: afoga
        else if (tv < 0.12) { this.hud.aviso('REAÇÃO PERFEITA!', 1); eu.boost = 0.5; }
      }
      if (!ele.largou && tv >= this.ia.reacao) { ele.largou = true; ele.reacao = this.ia.reacao; if (Math.random() < 0.2) ele.patina = 0.5; }
      // troca de marcha (borda do botão)
      if (troca && !this.trocaAntes) {
        const q = trocar(eu);
        if (q) this.hud.aviso({ perfeita: 'TROCA PERFEITA!', boa: 'Boa troca', passou: 'Passou do giro', cedo: 'Trocou cedo' }[q], q === 'perfeita' ? 0.9 : 0.7);
      }
      if (ele.largou && ele.rpm >= (this.ia.alvo || (this.ia.alvo = this.ia.trocaEm()))) { trocar(ele); this.ia.alvo = this.ia.trocaEm(); }
      for (let k = 0, n = Math.max(1, Math.round(dt / (1 / 120))); k < n; k++) {
        const h = dt / n;
        passo(eu, h, eu.tempo === null ? (eu.largou ? acel : acel) : 0, eu.tempo === null && inp.nitro);
        passo(ele, h, ele.tempo === null ? 1 : 0, ele.tempo === null && ele.g >= this.ia.nitroNa);
        for (const p of [eu, ele]) {
          if (p.tempo === null && p.s >= DIST) { p.tempo = this.t - this.tVerde; p.vFinal = p.v; }
          if (p.tempo !== null) p.v = Math.max(0, p.v - 7 * h);               // freia depois da chegada
        }
      }
      if (this.fase === 'corrida' && eu.tempo !== null && (ele.tempo !== null || this.t - this.tVerde - eu.tempo > 3)) { this.fase = 'acabou'; this.tAcabou = 0; }
      if (this.fase === 'acabou' && (this.tAcabou += dt) > 1.2) this.terminar();
    } else {
      passo(eu, dt, acel, false); passo(ele, dt, 1, false);
    }
    this.trocaAntes = troca;
    this.posicionar(dt);
    // conta-giros e corrida no HUD
    const f = Math.min(1, eu.rpm / CORTE);
    this.el.agulha.style.width = (f * 100).toFixed(1) + '%';
    this.el.agulha.classList.toggle('zona', eu.rpm >= ZONA[0] && eu.rpm <= ZONA[1]);
    this.el.agulha.classList.toggle('corte', eu.rpm > ZONA[1]);
    this.el.marcha.textContent = eu.g + 1;
    this.el.eu.style.left = Math.min(100, eu.s / DIST * 100) + '%';
    this.el.ele.style.left = Math.min(100, ele.s / DIST * 100) + '%';
  }

  terminar() {
    const eu = this.eu, ele = this.ele;
    const tEle = ele.tempo ?? Infinity;
    const ganhou = !eu.queimou && eu.tempo !== null && eu.tempo < tEle;
    let recorde = null, novo = false;
    if (!eu.queimou && eu.tempo !== null) {
      try { recorde = parseFloat(localStorage.getItem('arrancada-recorde')); } catch {}
      novo = !recorde || eu.tempo < recorde;
      if (novo) try { localStorage.setItem('arrancada-recorde', String(eu.tempo)); } catch {}
    }
    const premio = ganhou ? 200 : eu.queimou ? 0 : 30;
    let grana = 0;
    try { grana = (parseInt(localStorage.getItem('racha-grana')) || 0) + premio; if (premio) localStorage.setItem('racha-grana', String(grana)); } catch {}
    const r = {
      ganhou, queimou: eu.queimou, rival: this.rival.nome, premio, grana, novo,
      tempo: eu.tempo !== null && !eu.queimou ? fmt(eu.tempo) : '—',
      tRival: ele.tempo !== null ? fmt(ele.tempo) : '—',
      reacao: eu.reacao > 0 ? eu.reacao.toFixed(3).replace('.', ',') + ' s' : '—',
      kmh: Math.round(eu.vFinal * 3.6), recorde: recorde ? fmt(recorde) : null,
    };
    this.parar();
    this.fim(r);
  }
}
