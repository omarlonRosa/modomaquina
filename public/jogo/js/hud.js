// Velocímetro, nome da rua e minimapa.
const ESC = 0.5;          // pixels por metro no mapa pré-desenhado

export class Hud {
  constructor(mapa, lock, extras = []) {
    this.el = {
      vel: document.getElementById('vel'), marcha: document.getElementById('marcha'),
      rua: document.getElementById('rua'), aviso: document.getElementById('aviso'),
      mini: document.getElementById('mini'), nitro: document.querySelector('#nitro i'),
    };
    this.ruaAtual = ''; this.ruaTempo = 0; this.avisoTempo = 0;
    const R = mapa.raio + 100;
    this.R = R;
    const c = document.createElement('canvas'); c.width = c.height = Math.round(2 * R * ESC);
    const g = c.getContext('2d');
    const P = (x, z) => [(x + R) * ESC, (z + R) * ESC];
    g.fillStyle = '#1a1310'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#20311b';
    for (const a of mapa.verdes) { g.beginPath(); a.p.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...P(...p))); g.fill(); }
    g.fillStyle = '#3a3634';
    for (const b of mapa.predios.concat(extras)) { g.beginPath(); b.p.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...P(...p))); g.fill(); }
    g.lineCap = g.lineJoin = 'round';
    for (const r of [...mapa.ruas].sort((a, b) => a.c - b.c)) {
      g.strokeStyle = r.terra ? '#7b4a30' : r.c >= 3 ? '#d9d4c9' : '#9c9890';
      g.lineWidth = Math.max(2, r.w * ESC * 1.3);
      g.beginPath(); r.p.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](...P(...p))); g.stroke();
    }
    // Lock-Up
    const [lx, lz] = P(lock.x, lock.z);
    g.fillStyle = '#e8541c'; g.fillRect(lx - 7, lz - 7, 14, 14);
    g.fillStyle = '#fff'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('L', lx, lz + 4);
    this.mapa = c; this.P = P;
    this.ctx = this.el.mini.getContext('2d');
  }

  aviso(txt, seg = 2.5) { this.el.aviso.textContent = txt; this.el.aviso.classList.add('on'); this.avisoTempo = seg; }

  update(dt, carro, rota) {
    this.el.vel.textContent = Math.round(carro.kmh);
    this.el.marcha.textContent = carro.marcha;
    if (this.el.nitro) {
      const n = Math.round((carro.nitro || 0) * 100);
      if (n !== this.nitroAntes) { this.nitroAntes = n; this.el.nitro.style.width = n + '%'; }
    }
    const nome = carro.rua && !carro.foraDaRua ? carro.rua.n : '';
    if (nome && nome !== this.ruaAtual) { this.ruaAtual = nome; this.el.rua.textContent = nome; this.el.rua.classList.add('on'); this.ruaTempo = 3; }
    if (this.ruaTempo > 0 && (this.ruaTempo -= dt) <= 0) this.el.rua.classList.remove('on');
    if (this.avisoTempo > 0 && (this.avisoTempo -= dt) <= 0) this.el.aviso.classList.remove('on');

    // minimapa girando com o carro (frente para cima)
    const g = this.ctx, W = g.canvas.width, H = g.canvas.height;
    const k = W / 150;                       // 150 px CSS = 300 m
    g.save(); g.clearRect(0, 0, W, H);
    g.beginPath(); g.arc(W / 2, H / 2, W / 2, 0, 7); g.clip();
    g.fillStyle = '#1a1310'; g.fill();
    g.translate(W / 2, H / 2); g.scale(k, k); g.rotate(carro.ang - Math.PI);
    const [cx, cz] = this.P(carro.pos.x, carro.pos.z);
    g.drawImage(this.mapa, -cx, -cz);
    if (rota && rota.rota) {
      // rota estilo GPS: linha grossa com contorno escuro, só o que falta andar
      const pts = rota.rota.slice(Math.max(0, Math.floor(rota.iRota)));
      const traco = () => { g.beginPath(); pts.forEach((p, i) => { const [x, z] = this.P(...p); g[i ? 'lineTo' : 'moveTo'](x - cx, z - cz); }); g.stroke(); };
      g.lineCap = g.lineJoin = 'round';
      g.strokeStyle = '#3a1c00'; g.lineWidth = 9; traco();
      g.strokeStyle = '#ffa21f'; g.lineWidth = 5.5; traco();
      const fim = rota.rota[rota.rota.length - 1];
      { const [x, z] = this.P(...fim); g.fillStyle = '#40ff70'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(x - cx, z - cz, 7, 0, 7); g.fill(); g.stroke(); }
      if (rota.rival) {   // rival: bolinha vermelha
        const [x, z] = this.P(rota.rival.x, rota.rival.z);
        g.fillStyle = '#ff3b30'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x - cx, z - cz, 6, 0, 7); g.fill(); g.stroke();
      }
      const p = rota.pontos[rota.prox];
      if (p) { const [x, z] = this.P(...p); g.fillStyle = '#fff'; g.strokeStyle = '#ffa21f'; g.lineWidth = 2.5; g.beginPath(); g.arc(x - cx, z - cz, 5, 0, 7); g.fill(); g.stroke(); }
    }
    if (this.policia) {     // viaturas: pisca vermelho e azul
      const fase = Math.floor(performance.now() / 200) % 2;
      for (const q of this.policia) { const [x, z] = this.P(q.x, q.z); g.fillStyle = fase ? '#ff2a2a' : '#2a5aff'; g.beginPath(); g.arc(x - cx, z - cz, 6, 0, 7); g.fill(); }
    }
    if (this.amigos) {      // jogadores online: azul
      for (const q of this.amigos) { const [x, z] = this.P(q.x, q.z); g.fillStyle = '#2f9bff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(x - cx, z - cz, 6, 0, 7); g.fill(); g.stroke(); }
    }
    g.restore();
    // carro no centro
    g.fillStyle = '#ffffff'; g.strokeStyle = '#e8541c'; g.lineWidth = 2 * k / 2;
    g.beginPath(); g.moveTo(W / 2, H / 2 - 9 * k / 1.5); g.lineTo(W / 2 + 6 * k / 1.5, H / 2 + 7 * k / 1.5); g.lineTo(W / 2 - 6 * k / 1.5, H / 2 + 7 * k / 1.5); g.closePath(); g.fill(); g.stroke();
  }
}
