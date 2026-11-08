// Racha contra o relógio: sai da Lock-Up e passa pelos pontos até a chegada.
// Navegação estilo GPS: seta 3D grande sobre o carro apontando o caminho, faixa de setas
// no asfalto, rota no minimapa e cartão com a próxima curva ("Vire à direita · 120 m · PA-160").
import * as THREE from 'three';

const RAIO_PONTO = 14;
const PASSO_ROTA = 4;          // metros entre pontos da rota reamostrada
const COR = 0xffa21f;

function fmt(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, '0')}`;
}
const embrulhar = a => Math.atan2(Math.sin(a), Math.cos(a));

// rota a cada PASSO_ROTA metros, com a distância acumulada
function reamostrar(rota) {
  const out = [[rota[0][0], rota[0][1]]], s = [0];
  let total = 0, falta = PASSO_ROTA;
  for (let i = 1; i < rota.length; i++) {
    let [ax, az] = rota[i - 1]; const [bx, bz] = rota[i];
    let L = Math.hypot(bx - ax, bz - az);
    while (L >= falta) {
      const u = falta / L;
      ax += (bx - ax) * u; az += (bz - az) * u; L -= falta; total += falta; falta = PASSO_ROTA;
      out.push([ax, az]); s.push(total);
    }
    falta -= L; total += L;
  }
  const ult = rota[rota.length - 1];
  if (Math.hypot(ult[0] - out[out.length - 1][0], ult[1] - out[out.length - 1][1]) > 0.5) { out.push([ult[0], ult[1]]); s.push(total); }
  return { p: out, s };
}

// curvas da rota: onde o rumo muda mais de ~30° em 20 m
function acharCurvas(p, s, mundo) {
  const n = p.length, J = 5;
  const rumo = (a, b) => Math.atan2(p[b][0] - p[a][0], p[b][1] - p[a][1]);
  const giro = [];
  for (let i = 0; i < n; i++) giro.push(i < J || i >= n - J ? 0 : embrulhar(rumo(i, i + J) - rumo(i - J, i)));
  const curvas = [];
  for (let i = 0; i < n; i++) {
    if (Math.abs(giro[i]) < 0.52) continue;
    let j = i, mx = i;
    while (j < n && Math.abs(giro[j]) >= 0.52 && Math.sign(giro[j]) === Math.sign(giro[i])) { if (Math.abs(giro[j]) > Math.abs(giro[mx])) mx = j; j++; }
    const k = Math.min(n - 1, mx + 8);
    const info = mundo ? mundo.infoRua(p[k][0], p[k][1], 18) : null;
    curvas.push({ i: mx, s: s[mx], ang: giro[mx], rua: info && info.rua ? info.rua.n || '' : '' });
    i = j;
  }
  return curvas;
}

// seta: contorno de flecha no plano XY apontando para -Y
function formaSeta() {
  const f = new THREE.Shape();
  f.moveTo(0, -1.45);
  f.lineTo(1.05, -0.2); f.lineTo(0.42, -0.2); f.lineTo(0.42, 1.1);
  f.lineTo(-0.42, 1.1); f.lineTo(-0.42, -0.2); f.lineTo(-1.05, -0.2);
  f.closePath();
  return f;
}

function texturaChevron() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(10, 50); g.lineTo(32, 20); g.lineTo(54, 50); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export class Racha {
  constructor(dados, scene, mundo) {
    this.dados = dados; this.pontos = dados.pontos; this.ativo = false; this.scene = scene;
    // portal: cilindro aberto com brilho, só o próximo ponto aparece
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(c);
    this.portal = new THREE.Mesh(new THREE.CylinderGeometry(RAIO_PONTO * 0.6, RAIO_PONTO * 0.6, 10, 40, 1, true).translate(0, 5, 0),
      new THREE.MeshBasicMaterial({ map: tex, color: COR, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.portal.visible = false; scene.add(this.portal);
    this.el = {
      tempo: document.getElementById('tempo'), painel: document.getElementById('painel-racha'), cp: document.getElementById('cp'),
      gps: document.getElementById('gps'), gpsIcone: document.getElementById('gps-icone'), gpsDist: document.getElementById('gps-dist'),
      gpsTxt: document.getElementById('gps-txt'), gpsRua: document.getElementById('gps-rua'),
    };

    // rota completa (da porta da Lock-Up até a chegada)
    const bruta = dados.rota || [dados.saida, ...dados.pontos];
    const { p, s } = reamostrar(bruta);
    this.rota = p; this.rotaS = s; this.total = s[s.length - 1];
    this.curvas = acharCurvas(p, s, mundo);
    this.iRota = 0;

    this.criarSeta(scene);
    this.criarFaixa(scene, mundo);
  }

  criarSeta(scene) {
    const geo = new THREE.ExtrudeGeometry(formaSeta(), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);            // deita: ponta para a frente (+z), face de cima para cima
    geo.translate(0, -0.14, 0);
    const corpo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COR, emissive: COR, emissiveIntensity: 0.75, roughness: 0.4, metalness: 0.1 }));
    const borda = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x1a0d00, side: THREE.BackSide }));
    borda.scale.setScalar(1.09);
    for (const m of [corpo, borda]) { m.renderOrder = 5; m.frustumCulled = false; }
    this.setaGiro = new THREE.Group(); this.setaGiro.add(borda, corpo);     // gira no plano (direção do caminho)
    this.setaInclina = new THREE.Group(); this.setaInclina.add(this.setaGiro); // inclina para a câmera ver o desenho
    this.setaInclina.rotation.x = -0.5;
    this.seta = new THREE.Group(); this.seta.add(this.setaInclina);        // segue o carro
    this.seta.visible = false; this.setaAng = 0;
    scene.add(this.seta);
  }

  criarFaixa(scene, mundo) {
    const p = this.rota, n = p.length, L = 1.4, Y = 0.09;
    // nas ruas de mão dupla as setas vão na faixa da direita (no Brasil se anda pela direita);
    // na pista de mão única (PA-160) ficam no meio da pista
    const desl0 = p.map(([x, z]) => { const i = mundo ? mundo.infoRua(x, z, 12) : null; return i && i.rua && !i.rua.mao && i.dist < 3 ? i.rua.w / 4 : 0; });
    const desl = desl0.map((_, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) { s += desl0[j]; k++; } return s / k; });
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), idx = [];
    for (let i = 0; i < n; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1]; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const ex = dz * L / 2, ez = -dx * L / 2;          // lado esquerdo
      const cx = p[i][0] - dz * desl[i], cz = p[i][1] + dx * desl[i];   // puxado para a direita
      pos.set([cx + ex, Y, cz + ez, cx - ex, Y, cz - ez], i * 6);
      const v = this.rotaS[i] / 2.4;
      uv.set([0, v, 1, v], i * 4);
      if (i < n - 1) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.texFaixa = texturaChevron();
    this.faixa = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      map: this.texFaixa, color: COR, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    this.faixa.renderOrder = 2; this.faixa.visible = false; this.faixa.frustumCulled = false;
    scene.add(this.faixa);
  }

  get prox() { return this.i; }

  // o que o minimapa precisa para desenhar a rota
  infoMapa() { return { pontos: this.pontos, prox: this.i, rota: this.rota, iRota: this.iRota }; }

  iniciar(hud, controles, aoTerminar) {
    this.i = 0; this.t = 0; this.ativo = true; this.contagem = 3.5; this.fim = aoTerminar; this.contou = false;
    this.iRota = 0; this.setaAng = 0;
    this.hud = hud; this.controles = controles; controles.travado = true;
    this.el.painel.classList.add('on');
    this.seta.visible = true; this.faixa.visible = true;
    this.mostrar();
  }

  parar() {
    this.ativo = false; this.portal.visible = false; this.el.painel.classList.remove('on');
    this.seta.visible = false; this.faixa.visible = false;
    if (this.controles) this.controles.travado = false;
  }

  mostrar() {
    const p = this.pontos[this.i];
    this.portal.position.set(p[0], 0, p[1]); this.portal.visible = true;
    this.portal.material.color.set(this.i === this.pontos.length - 1 ? 0x40ff70 : COR);
    this.el.cp.textContent = `Ponto ${this.i + 1} de ${this.pontos.length}`;
  }

  // em que ponto da rota o carro está (procura só perto do último, para não pular de trecho)
  acompanhar(x, z) {
    const p = this.rota, n = p.length;
    const busca = (de, ate) => {
      let melhor = -1, dm = Infinity;
      for (let i = Math.max(0, de); i < Math.min(n - 1, ate); i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1];
        const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
        const u = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2));
        const d = Math.hypot(ax + vx * u - x, az + vz * u - z);
        if (d < dm) { dm = d; melhor = i + u; }
      }
      return [melhor, dm];
    };
    let [i, d] = busca(Math.floor(this.iRota) - 4, Math.floor(this.iRota) + 40);
    if (d > 45) { const [i2, d2] = busca(0, n); if (d2 < d) [i, d] = [i2, d2]; }
    this.iRota = i; this.distRota = d;
    const k = Math.floor(i);
    return this.rotaS[k] + (this.rotaS[Math.min(k + 1, n - 1)] - this.rotaS[k]) * (i - k);
  }

  pontoNa(s) {
    const S = this.rotaS, n = S.length;
    if (s >= S[n - 1]) return this.rota[n - 1];
    let k = Math.min(n - 2, Math.max(0, Math.floor(s / PASSO_ROTA)));
    while (k > 0 && S[k] > s) k--;
    while (k < n - 2 && S[k + 1] < s) k++;
    const u = (s - S[k]) / (S[k + 1] - S[k] || 1);
    const a = this.rota[k], b = this.rota[k + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }

  guiar(dt, carro) {
    const sCarro = this.acompanhar(carro.pos.x, carro.pos.z);
    // seta: aponta para um ponto mais à frente na rota (mais longe quanto mais rápido)
    // perto de uma curva (uns 55 m, mais em alta), aponta para a rua de saída dela
    const ver = 22 + Math.min(30, Math.abs(carro.vf || 0) * 0.7);
    const curva = this.curvas.find(c => c.s > sCarro - 6);
    let sAlvo = sCarro + ver;
    if (curva && curva.s - sCarro < 40 + ver * 0.6) sAlvo = Math.max(sAlvo, curva.s + 20);
    let [tx, tz] = this.pontoNa(sAlvo);
    if (this.distRota > 25) [tx, tz] = this.pontoNa(sCarro + 6);   // fora da rota: aponta de volta para ela
    const alvo = embrulhar(Math.atan2(tx - carro.pos.x, tz - carro.pos.z) - carro.ang);
    this.setaAng += embrulhar(alvo - this.setaAng) * Math.min(1, dt * 8);
    this.setaGiro.rotation.y = this.setaAng;
    const fx = Math.sin(carro.ang), fz = Math.cos(carro.ang);
    const dentro = this.camDentro;
    // uns 6 m à frente do carro e abaixo da altura da câmera: aparece pequena, acima do teto, sem tapar o carro
    this.seta.position.set(carro.pos.x + fx * (dentro ? 9 : 6.5), (carro.pos.y || 0) + (dentro ? 1.3 : 1.7), carro.pos.z + fz * (dentro ? 9 : 6.5));
    this.seta.rotation.y = carro.ang;
    this.setaInclina.rotation.x = dentro ? -0.4 : -0.7;
    this.setaGiro.scale.setScalar(dentro ? 0.45 : 1.0);

    // faixa no chão: some o que já passou e as setas andam
    this.faixa.geometry.setDrawRange((Math.floor(this.iRota) + 1) * 6, Infinity);
    this.texFaixa.offset.y -= dt * 1.6;

    // cartão de GPS
    const prox = this.curvas.find(c => c.s > sCarro + 4);
    const resta = this.total - sCarro;
    let ang = 0, dist, txt, rua = '';
    if (this.distRota > 25) { txt = 'Volte para a rota'; dist = Math.round(this.distRota) + ' m'; ang = alvo; }
    else if (prox && prox.s - sCarro < 300) {
      const d = prox.s - sCarro;
      ang = prox.ang;
      const a = Math.abs(ang), lado = ang > 0 ? 'esquerda' : 'direita';
      txt = a > 1.75 ? `Retorno à ${lado}` : a > 0.9 ? `Vire à ${lado}` : `Mantenha à ${lado}`;
      dist = d < 18 ? 'agora' : d < 100 ? Math.round(d / 5) * 5 + ' m' : Math.round(d / 10) * 10 + ' m';
      rua = prox.rua;
      this.el.gps.classList.toggle('perto', d < 60);
    } else {
      const d = prox ? prox.s - sCarro : resta;
      txt = prox ? 'Siga em frente' : 'Chegada';
      dist = d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(d / 10) * 10 + ' m';
      rua = prox ? (carro.rua && carro.rua.n) || '' : 'Linha de chegada';
      this.el.gps.classList.remove('perto');
    }
    const chave = `${txt}|${dist}|${rua}|${Math.round(ang * 20)}`;
    if (chave !== this.gpsAntes) {
      this.gpsAntes = chave;
      this.el.gpsTxt.textContent = txt; this.el.gpsDist.textContent = dist; this.el.gpsRua.textContent = rua;
      this.el.gpsIcone.innerHTML = iconeCurva(ang, !prox && txt === 'Chegada');
    }
  }

  update(dt, carro) {
    if (!this.ativo) return;
    this.portal.rotation.y += dt * 0.8;
    this.guiar(dt, carro);
    if (this.contagem > 0) {
      const antes = Math.ceil(this.contagem - 0.5);
      this.contagem -= dt;
      const agora = Math.ceil(this.contagem - 0.5);
      if (agora !== antes || !this.contou) { this.hud.aviso(agora > 0 ? String(agora) : 'VAI!', agora > 0 ? 0.9 : 1.2); this.contou = true; }
      if (this.contagem <= 0.5) this.controles.travado = false;
      if (this.contagem > 0.5) { this.el.tempo.textContent = fmt(0); return; }
    }
    this.t += dt;
    this.el.tempo.textContent = fmt(this.t);
    const p = this.pontos[this.i];
    if (Math.hypot(p[0] - carro.pos.x, p[1] - carro.pos.z) < RAIO_PONTO) {
      this.i++;
      if (this.i >= this.pontos.length) return this.terminar();
      this.mostrar();
    }
  }

  terminar() {
    const tempo = this.t;
    let recorde = null;
    try { recorde = parseFloat(localStorage.getItem('racha-lockup-recorde-v2')); } catch {}
    const novo = !recorde || tempo < recorde;
    if (novo) try { localStorage.setItem('racha-lockup-recorde-v2', String(tempo)); } catch {}
    this.parar();
    this.fim({ tempo: fmt(tempo), recorde: novo ? null : fmt(recorde), novo, metros: this.dados.metros });
  }
}

// ícone de curva desenhado pelo ângulo (positivo = esquerda): haste reta e a ponta dobrando
function iconeCurva(ang, chegada) {
  if (chegada) {
    let q = '';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2 === 0) q += `<rect x="${12 + x * 6}" y="${10 + y * 6}" width="6" height="6" fill="#fff"/>`;
    return `<svg viewBox="0 0 48 48"><line x1="12" y1="10" x2="12" y2="42" stroke="#fff" stroke-width="3"/>${q}<rect x="12" y="10" width="24" height="24" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;
  }
  const a = Math.max(-2.6, Math.min(2.6, ang));
  const cx = 24, cy = 26, L = 13;
  const ex = cx - Math.sin(a) * L, ey = cy - Math.cos(a) * L;
  const dx = (ex - cx) / L, dy = (ey - cy) / L, nx = -dy, ny = dx;
  const px = ex + dx * 7, py = ey + dy * 7;
  const cab = `${px},${py} ${ex + nx * 7},${ey + ny * 7} ${ex - nx * 7},${ey - ny * 7}`;
  return `<svg viewBox="0 0 48 48"><polyline points="${cx},44 ${cx},${cy} ${ex},${ey}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><polygon points="${cab}" fill="#fff" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>`;
}
