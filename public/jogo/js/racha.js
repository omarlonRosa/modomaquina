// Racha contra o relógio: sai da Lock-Up e passa pelos pontos até a chegada.
import * as THREE from 'three';

const RAIO_PONTO = 14;

function fmt(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, '0')}`;
}

export class Racha {
  constructor(dados, scene) {
    this.dados = dados; this.pontos = dados.pontos; this.ativo = false;
    // portal: cilindro aberto com brilho, só o próximo ponto aparece
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(c);
    this.portal = new THREE.Mesh(new THREE.CylinderGeometry(RAIO_PONTO * 0.6, RAIO_PONTO * 0.6, 10, 40, 1, true).translate(0, 5, 0),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xffa020, transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.portal.visible = false; scene.add(this.portal);
    this.el = { tempo: document.getElementById('tempo'), seta: document.getElementById('seta'), painel: document.getElementById('painel-racha'), cp: document.getElementById('cp') };
  }

  get prox() { return this.i; }

  iniciar(hud, controles, aoTerminar) {
    this.i = 0; this.t = 0; this.ativo = true; this.contagem = 3.5; this.fim = aoTerminar;
    this.hud = hud; this.controles = controles; controles.travado = true;
    this.el.painel.classList.add('on');
    this.mostrar();
  }

  parar() {
    this.ativo = false; this.portal.visible = false; this.el.painel.classList.remove('on');
    if (this.controles) this.controles.travado = false;
  }

  mostrar() {
    const p = this.pontos[this.i];
    this.portal.position.set(p[0], 0, p[1]); this.portal.visible = true;
    this.portal.material.color.set(this.i === this.pontos.length - 1 ? 0x40ff70 : 0xffa020);
    this.el.cp.textContent = `${this.i + 1}/${this.pontos.length}`;
  }

  update(dt, carro) {
    if (!this.ativo) return;
    this.portal.rotation.y += dt * 0.8;
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
    const dx = p[0] - carro.pos.x, dz = p[1] - carro.pos.z;
    // seta relativa à frente do carro
    const rel = Math.atan2(dx, dz) - carro.ang;
    this.el.seta.style.transform = `rotate(${-rel}rad)`;
    if (Math.hypot(dx, dz) < RAIO_PONTO) {
      this.i++;
      if (this.i >= this.pontos.length) return this.terminar();
      this.mostrar();
    }
  }

  terminar() {
    const tempo = this.t;
    let recorde = null;
    try { recorde = parseFloat(localStorage.getItem('racha-lockup-recorde')); } catch {}
    const novo = !recorde || tempo < recorde;
    if (novo) try { localStorage.setItem('racha-lockup-recorde', String(tempo)); } catch {}
    this.parar();
    this.fim({ tempo: fmt(tempo), recorde: novo ? null : fmt(recorde), novo, metros: this.dados.metros });
  }
}
