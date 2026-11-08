// Multiplayer online: entra numa sala do servidor do site (Durable Object em /api/jogo/sala/<código>),
// manda a posição do seu carro ~10 vezes por segundo e desenha os outros jogadores com o carro e a cor
// de cada um. Os outros aparecem ~150 ms "atrasados" e interpolados, para andarem lisos mesmo com a
// internet oscilando. Batida com carro online só empurra o seu carro (cada um cuida do próprio).
// Racha online: qualquer um da sala chama; o servidor marca a hora da largada e junta os tempos.
import * as THREE from 'three';
import { Carro } from './carro.js';
import { plaquinha } from './rival.js';

const ATRASO = 150;            // ms de atraso de desenho (interpolação)
const ENVIO = 100;             // ms entre envios de posição

export class Online {
  // criarModelo(carroId, cor) -> { scene, ficha } (main.js), para montar o carro de cada jogador
  constructor(scene, criarModelo) {
    this.scene = scene; this.criarModelo = criarModelo;
    this.ws = null; this.sala = null; this.id = null; this.on = false;
    this.outros = new Map();     // id -> { nome, carroId, cor, carro, buf: [{t, x, z, a, v, d, n, f, s}] }
    this.desvio = 0;             // hora do servidor - hora daqui
    this.ultimoEnvio = 0;
    this.eventos = {};           // aoMudar, aoRacha, aoChegadas, aoCair
  }

  get conectado() { return !!(this.ws && this.ws.readyState === 1 && this.id); }
  get agoraServidor() { return Date.now() + this.desvio; }

  entrar(sala, eu) {
    this.sair();
    this.sala = sala.toUpperCase(); this.eu = eu; this.on = true;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    // no teste local (servidor de arquivos simples) o jogo fala com o wrangler dev na porta 8792
    const host = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '8792' ? `${location.hostname}:8792` : location.host;
    const ws = this.ws = new WebSocket(`${proto}://${host}/api/jogo/sala/${this.sala}`);
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'oi', ...eu })); this.ping(); };
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.receber(m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const estava = this.on; this.limpar(); this.ws = null; this.id = null;
      if (estava && this.eventos.aoCair) this.eventos.aoCair();
    };
  }

  sair() {
    this.on = false;
    if (this.ws) { const w = this.ws; this.ws = null; try { w.close(1000); } catch {} }
    this.limpar(); this.id = null; this.racha = null;
    this.mudou();
  }

  limpar() { for (const o of this.outros.values()) this.removerCarro(o); this.outros.clear(); }
  removerCarro(o) { if (o.carro) { this.scene.remove(o.carro.grupo); o.carro = null; } }
  mudou() { if (this.eventos.aoMudar) this.eventos.aoMudar(); }

  // atualiza o próprio carro/cor (trocou na garagem)
  atualizarEu(eu) { this.eu = eu; if (this.conectado) this.ws.send(JSON.stringify({ t: 'oi', ...eu })); }

  ping() { if (this.conectado || (this.ws && this.ws.readyState === 1)) this.ws.send(JSON.stringify({ t: 'ping', c: Date.now() })); }

  receber(m) {
    if (m.t === 'bv') {
      this.id = m.id; this.desvio = m.agora - Date.now();
      for (const j of m.jogadores) this.novo(j);
      this.mudou();
      if (m.racha && this.eventos.aoRacha && m.racha.inicio > this.agoraServidor) this.eventos.aoRacha(m.racha);
    } else if (m.t === 'pong') {
      // hora do servidor com metade do tempo de ida e volta
      const ida = (Date.now() - m.c) / 2; this.desvio = m.agora + ida - Date.now(); this.lat = Math.round(ida * 2);
    } else if (m.t === 'entrou') {
      const o = this.outros.get(m.id);
      if (o && (o.carroId !== m.carro || o.cor !== m.cor)) { this.removerCarro(o); this.outros.delete(m.id); }
      if (o && this.outros.has(m.id)) o.nome = m.nome; else this.novo(m);
      this.mudou();
    } else if (m.t === 'saiu') {
      const o = this.outros.get(m.id); if (o) { this.removerCarro(o); this.outros.delete(m.id); this.mudou(); }
    } else if (m.t === 'pos') {
      const o = this.outros.get(m.id); if (!o) return;
      o.buf.push({ ...m, t: performance.now() });
      if (o.buf.length > 30) o.buf.shift();
    } else if (m.t === 'racha') {
      this.racha = m; this.desvio = m.agora - Date.now() + (this.desvio - (m.agora - Date.now())) * 0.5;
      if (this.eventos.aoRacha) this.eventos.aoRacha(m);
    } else if (m.t === 'chegadas') {
      if (this.eventos.aoChegadas) this.eventos.aoChegadas(m.chegadas);
    }
  }

  novo(j) {
    const { scene, ficha } = this.criarModelo(j.carro, j.cor);
    const carro = new Carro({ scene, ficha }, this.scene, { cor: j.cor, leve: true });
    const marca = plaquinha(j.nome, '#2f9bff'); carro.grupo.add(marca);
    carro.grupo.visible = false;
    this.outros.set(j.id, { nome: j.nome, carroId: j.carro, cor: j.cor, carro, marca, buf: [] });
  }

  // manda a sua posição (chamado todo quadro; envia a cada ENVIO ms)
  enviar(carro, s) {
    if (!this.conectado) return;
    const agora = performance.now();
    if (agora - this.ultimoEnvio < ENVIO) return;
    this.ultimoEnvio = agora;
    this.ws.send(JSON.stringify({ t: 'pos', x: carro.pos.x, z: carro.pos.z, a: carro.ang, v: carro.vf, d: carro.dir, n: carro.nitroAtivo ? 1 : 0, f: carro.freando ? 1 : 0, s: s || 0 }));
    if (!this.tPing || agora - this.tPing > 5000) { this.tPing = agora; this.ping(); }
  }

  chamarRacha(rota) { if (this.conectado) this.ws.send(JSON.stringify({ t: 'racha', rota })); }
  chegou(tempo) { if (this.conectado) this.ws.send(JSON.stringify({ t: 'chegou', tempo })); }

  // desenha os outros na posição de ~150 ms atrás, interpolando entre as duas mensagens em volta
  update(dt) {
    const alvo = performance.now() - ATRASO;
    for (const o of this.outros.values()) {
      const b = o.buf, c = o.carro;
      if (!c || !b.length) continue;
      while (b.length > 2 && b[1].t <= alvo) b.shift();
      let p = b[0], q = b[1] || b[0];
      let u = q.t > p.t ? Math.max(0, Math.min(1.5, (alvo - p.t) / (q.t - p.t))) : 0;
      if (performance.now() - b[b.length - 1].t > 3000) { c.grupo.visible = false; continue; }   // parou de mandar
      const da = Math.atan2(Math.sin(q.a - p.a), Math.cos(q.a - p.a));
      c.pos.set(p.x + (q.x - p.x) * u, 0, p.z + (q.z - p.z) * u);
      c.ang = p.a + da * u; c.vf = p.v + (q.v - p.v) * Math.min(1, u); c.dir = q.d;
      c.vel.set(Math.sin(c.ang) * c.vf, Math.cos(c.ang) * c.vf);
      c.nitroAtivo = !!q.n; c.freando = !!q.f; c.s = q.s;
      c.grupo.visible = true;
      c.atualizarModelo(dt);
    }
  }

  // carros dos outros (para batida, minimapa e posição no racha)
  carros() { return [...this.outros.values()].filter(o => o.carro && o.carro.grupo.visible).map(o => o.carro); }
  lista() { return [...this.outros.entries()].map(([id, o]) => ({ id, nome: o.nome, carro: o.carroId, s: o.carro ? o.carro.s || 0 : 0 })); }
}
