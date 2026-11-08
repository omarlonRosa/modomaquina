// Garagem da Lock-Up: gasta a grana dos rachas e arrancadas em peças que mudam o Uno de verdade
// (motor, turbo, nitro, pneus, suspensão) e no visual (cor, rodas, neon). A aba "Projeto Uno" mostra
// peças que destravam quando o restomod real avança (dados/projeto.json: o Modo Máquina marca as etapas feitas).
// A aba "Carros" vende os outros carros (modelos.js); cada carro guarda as próprias peças e o visual.
// Tudo fica salvo no aparelho (localStorage).
import * as THREE from 'three';
import { CARROS, fichaDe } from './modelos.js';

export const DESEMPENHO = [
  { id: 'motor', nome: 'Motor', niveis: ['1.6R original', 'Preparação leve', 'Comando e cabeçote', 'Forjado'], precos: [0, 300, 700, 1300],
    efeito: n => ({ acel: [1, 1.07, 1.15, 1.25][n], vmax: [0, 1.5, 3, 5][n] }) },
  { id: 'turbo', nome: 'Turbo', niveis: ['Aspirado', 'Turbo baixa pressão', 'Turbo alta pressão'], precos: [0, 900, 1800],
    efeito: n => ({ acel: [1, 1.12, 1.24][n], vmax: [0, 3, 6][n] }) },
  { id: 'nitro', nome: 'Nitro', niveis: ['Cilindro pequeno', 'Cilindro médio', 'Cilindro grande'], precos: [0, 400, 900],
    efeito: n => ({ nitroDur: [3, 4, 5.2][n], nitroRec: [1, 1.3, 1.6][n] }) },
  { id: 'pneus', nome: 'Pneus', niveis: ['Comuns', 'Esportivos', 'Semi-slick'], precos: [0, 300, 700],
    efeito: n => ({ grip: [1, 1.15, 1.3][n], freio: [1, 1.1, 1.2][n] }) },
  { id: 'suspensao', nome: 'Suspensão', niveis: ['Original', 'Molas esportivas', 'Coilover'], precos: [0, 350, 800],
    efeito: n => ({ grip: [1, 1.05, 1.1][n], rebaixa: [0, 0.035, 0.065][n] }) },
];

export const VISUAL = {
  cor: { nome: 'Cor', opcoes: [
    { id: 'branco', nome: 'Branco original', hex: 0xd6d9d5, preco: 0 },
    { id: 'preto', nome: 'Preto', hex: 0x111214, preco: 150 },
    { id: 'vermelho', nome: 'Vermelho', hex: 0xb5121b, preco: 150 },
    { id: 'azul', nome: 'Azul', hex: 0x1d4fb0, preco: 150 },
    { id: 'amarelo', nome: 'Amarelo', hex: 0xf2c00f, preco: 150 },
    { id: 'verde', nome: 'Verde', hex: 0x1e7a3c, preco: 150 },
    { id: 'grafite', nome: 'Grafite', hex: 0x4a4f55, preco: 150 },
    { id: 'laranja', nome: 'Laranja Modo Máquina', hex: 0xe8541c, preco: 0, projeto: 'cor' },
  ] },
  rodas: { nome: 'Rodas', opcoes: [
    { id: 'preta', nome: 'Pretas', hex: 0x0d0e10, preco: 0 },
    { id: 'prata', nome: 'Prata', hex: 0xb9bec4, preco: 150, metal: 0.9 },
    { id: 'bronze', nome: 'Bronze', hex: 0x8a5a2b, preco: 200, metal: 0.7 },
    { id: 'branca', nome: 'Brancas', hex: 0xeceae6, preco: 200 },
  ] },
  neon: { nome: 'Neon embaixo', opcoes: [
    { id: 'sem', nome: 'Sem neon', hex: null, preco: 0 },
    { id: 'azul', nome: 'Azul', hex: 0x2f7bff, preco: 250 },
    { id: 'verde', nome: 'Verde', hex: 0x2dff6a, preco: 250 },
    { id: 'rosa', nome: 'Rosa', hex: 0xff3fb4, preco: 250 },
    { id: 'laranja', nome: 'Laranja Modo Máquina', hex: 0xff7a1a, preco: 0, projeto: 'neon' },
  ] },
};

const CHAVE = 'garagem-lockup';
const lerGrana = () => { try { return parseInt(localStorage.getItem('racha-grana')) || 0; } catch { return 0; } };
const gravarGrana = v => { try { localStorage.setItem('racha-grana', String(v)); } catch {} };

export class Garagem {
  constructor() {
    let e = null; try { e = JSON.parse(localStorage.getItem(CHAVE)); } catch {}
    this.e = Object.assign({ donos: { cor: ['branco'], rodas: ['preta'], neon: ['sem'] }, carro: 'uno', frota: ['uno'], porCarro: {} }, e || {});
    // salvo antigo (só o Uno): as peças e o visual viram do Uno
    if (this.e.niveis) { this.e.porCarro.uno = { niveis: this.e.niveis, escolha: this.e.escolha }; delete this.e.niveis; delete this.e.escolha; }
    for (const id of this.e.frota) this.doCarro(id);
    this.projeto = { etapas: [] };
  }
  // peças e visual de um carro (cria na primeira vez, com a cor de fábrica)
  doCarro(id) {
    let c = this.e.porCarro[id];
    if (!c) c = this.e.porCarro[id] = { niveis: {}, escolha: { cor: fichaDe(id).cor, rodas: 'preta', neon: 'sem' } };
    for (const p of DESEMPENHO) if (c.niveis[p.id] === undefined) c.niveis[p.id] = 0;
    if (!this.e.donos.cor.includes(c.escolha.cor) && !VISUAL.cor.opcoes.find(o => o.id === c.escolha.cor && o.projeto)) this.e.donos.cor.push(c.escolha.cor);
    return c;
  }
  get c() { return this.doCarro(this.e.carro); }
  get ficha() { return fichaDe(this.e.carro); }
  precoPeca(p, n) { return Math.round(p.precos[n] * this.ficha.peca / 10) * 10; }
  salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(this.e)); } catch {} }
  get grana() { return lerGrana(); }

  // prêmios do projeto real já liberados (etapas marcadas como feitas)
  liberado(tipo) { return this.projeto.etapas.some(et => et.feita && et.premio && et.premio.tipo === tipo); }

  // efeitos somados das peças, para a física (carro.js e arrancada.js)
  mods() {
    const m = { acel: 1, vmax: 0, grip: 1, freio: 1, nitroDur: 3, nitroRec: 1, rebaixa: 0 };
    for (const p of DESEMPENHO) {
      const f = p.efeito(this.c.niveis[p.id] || 0);
      if (f.acel) m.acel *= f.acel; if (f.vmax) m.vmax += f.vmax; if (f.grip) m.grip *= f.grip; if (f.freio) m.freio *= f.freio;
      if (f.nitroDur) m.nitroDur = f.nitroDur; if (f.nitroRec) m.nitroRec = f.nitroRec; if (f.rebaixa !== undefined) m.rebaixa = Math.max(m.rebaixa, f.rebaixa);
    }
    if (this.liberado('nitro')) m.nitroDur += 1;
    return m;
  }

  // nível geral de preparação (0 a 1), usado para o rival acompanhar
  preparo() {
    let tot = 0, max = 0;
    for (const p of DESEMPENHO) { tot += this.c.niveis[p.id] || 0; max += p.niveis.length - 1; }
    return max ? tot / max : 0;
  }

  // aplica peças e visual no carro do jogador
  aplicar(carro) {
    carro.mods = this.mods();
    const op = (cat) => VISUAL[cat].opcoes.find(o => o.id === this.c.escolha[cat]) || VISUAL[cat].opcoes[0];
    // pintura e rodas: materiais próprios do jogador (o rival usa cópias da mesma malha)
    if (!carro.matsGaragem) {
      carro.matsGaragem = { paint: [], rodas: [] };
      const cache = new Map();
      carro.grupo.traverse(o => {
        if (!o.isMesh) return;
        const lista = Array.isArray(o.material) ? o.material : [o.material];
        lista.forEach((mt, i) => {
          const tipo = mt.name === 'paint' ? 'paint' : mt.name === 'teia' ? 'rodas' : null;
          if (!tipo) return;
          let c = cache.get(mt); if (!c) { c = mt.clone(); cache.set(mt, c); carro.matsGaragem[tipo].push(c); }
          if (Array.isArray(o.material)) o.material[i] = c; else o.material = c;
        });
      });
    }
    const cor = op('cor'), roda = op('rodas'), neon = op('neon');
    for (const m of carro.matsGaragem.paint) m.color.setHex(cor.hex);
    for (const m of carro.matsGaragem.rodas) { m.color.setHex(roda.hex); m.metalness = roda.metal ?? 0.4; m.roughness = roda.metal ? 0.35 : 0.6; }
    // neon: brilho colorido no chão, embaixo do carro
    if (!carro.neon) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128;
      const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 64, 4, 32, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
      carro.neon = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6).rotateX(-Math.PI / 2).translate(0, 0.06, 0),
        new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      carro.neon.renderOrder = 3; carro.grupo.add(carro.neon);
    }
    carro.neon.visible = neon.hex !== null;
    if (neon.hex !== null) carro.neon.material.color.setHex(neon.hex);
    // rebaixar: desce a carroceria e sobe as rodas na mesma medida
    const r = carro.mods.rebaixa;
    carro.corpo.position.y = -r;
    for (const w of carro.rodas) { if (w.yBase === undefined) w.yBase = w.piv.position.y; w.piv.position.y = w.yBase + r; }
  }

  // ---------- tela
  abrir(el, aoMudar, aoFechar) {
    this.el = el; this.aoMudar = aoMudar; this.aoFechar = aoFechar; this.aba = this.aba || 'desempenho';
    if (!this.ligado) {
      this.ligado = true;
      el.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return;
        ev.preventDefault();
        if (b.dataset.aba) { this.aba = b.dataset.aba; this.render(); return; }
        if (b.dataset.fechar !== undefined) { this.aoFechar(); return; }
        if (b.dataset.peca) this.comprarPeca(b.dataset.peca);
        if (b.dataset.cat) this.escolher(b.dataset.cat, b.dataset.op);
        if (b.dataset.carro) this.carroEscolhido(b.dataset.carro);
      });
    }
    el.classList.add('on');
    this.render();
  }
  fechar() { if (this.el) this.el.classList.remove('on'); }

  aviso(txt) { this.msg = txt; this.render(); clearTimeout(this.tMsg); this.tMsg = setTimeout(() => { this.msg = ''; this.render(); }, 2200); }

  comprarPeca(id) {
    const p = DESEMPENHO.find(x => x.id === id), n = this.c.niveis[id] || 0;
    if (n >= p.niveis.length - 1) return;
    const preco = this.precoPeca(p, n + 1);
    if (this.grana < preco) { this.aviso(`Falta R$ ${preco - this.grana}. Bora pro racha!`); return; }
    gravarGrana(this.grana - preco);
    this.c.niveis[id] = n + 1; this.salvar();
    this.aviso(`${p.niveis[n + 1]} instalado!`);
    this.aoMudar();
  }

  escolher(cat, id) {
    const o = VISUAL[cat].opcoes.find(x => x.id === id); if (!o) return;
    const dono = this.e.donos[cat].includes(id) || (o.projeto && this.liberado(o.projeto));
    if (!dono) {
      if (o.projeto) { this.aviso('Destrava quando o Uno de verdade chegar nessa etapa'); return; }
      if (this.grana < o.preco) { this.aviso(`Falta R$ ${o.preco - this.grana}. Bora pro racha!`); return; }
      gravarGrana(this.grana - o.preco); this.e.donos[cat].push(id);
    }
    this.c.escolha[cat] = id; this.salvar();
    this.aoMudar(); this.render();
  }

  // comprar ou trocar de carro
  carroEscolhido(id) {
    const f = fichaDe(id);
    if (!this.e.frota.includes(id)) {
      if (this.grana < f.preco) { this.aviso(`Falta R$ ${(f.preco - this.grana).toLocaleString('pt-BR')} pro ${f.nome}. Bora pro racha!`); return; }
      gravarGrana(this.grana - f.preco); this.e.frota.push(id); this.doCarro(id);
      this.e.carro = id; this.salvar();
      this.aviso(`${f.nome} é seu!`);
    } else { this.e.carro = id; this.salvar(); }
    this.aoMudar(); this.render();
  }

  render() {
    if (!this.el) return;
    const m = this.mods(), real = r => r.toLocaleString('pt-BR'), F = this.ficha;
    // barras do carro inteiro (fábrica + peças), na mesma régua para todos os carros
    const notas = (f, mm) => [['Aceleração', (f.acel * mm.acel - 3.6) / 8.8], ['Velocidade', (f.vmax + mm.vmax - 38) / 47], ['Aderência', (f.grip * mm.grip - 0.85) / 0.97], ['Nitro', (mm.nitroDur - 3) / 3.2]];
    const barrasDe = (lista) => lista.map(([n, f]) => `<div class="g-barra"><span>${n}</span><i><b style="width:${Math.round(10 + Math.max(0, Math.min(1, f)) * 90)}%"></b></i></div>`).join('');
    const barras = barrasDe(notas(F, m));
    let lista = '';
    if (this.aba === 'carros') {
      const base = { acel: 1, vmax: 0, grip: 1, nitroDur: 3 };
      lista = CARROS.map(f => {
        const meu = this.e.frota.includes(f.id), usando = this.e.carro === f.id;
        const kmh = Math.round(f.vmax * 3.6);
        return `<div class="g-carro ${usando ? 'esc' : ''}"><div><b>${f.nome}</b><small>${f.tipo} · ${kmh} km/h de fábrica</small>
          <div class="g-mini">${barrasDe(notas(f, base).slice(0, 3))}</div></div>
          ${usando ? '<em>na garagem</em>' : `<button data-carro="${f.id}">${meu ? 'Usar' : 'Comprar'}<small>${meu ? 'seu' : 'R$ ' + real(f.preco)}</small></button>`}</div>`;
      }).join('');
    } else if (this.aba === 'desempenho') {
      lista = DESEMPENHO.map(p => {
        const n = this.c.niveis[p.id] || 0, ult = n >= p.niveis.length - 1;
        const pontos = p.niveis.map((_, i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('');
        return `<div class="g-item"><div><b>${p.nome}</b><small>${p.niveis[n]}</small><span class="g-pontos">${pontos}</span></div>
          ${ult ? '<em>no máximo</em>' : `<button data-peca="${p.id}">${p.niveis[n + 1]}<small>R$ ${real(this.precoPeca(p, n + 1))}</small></button>`}</div>`;
      }).join('');
    } else if (this.aba === 'visual') {
      lista = Object.entries(VISUAL).map(([cat, v]) => `<div class="g-grupo"><b>${v.nome}</b><div class="g-ops">${v.opcoes.map(o => {
        const dono = this.e.donos[cat].includes(o.id) || (o.projeto && this.liberado(o.projeto));
        const esc = this.c.escolha[cat] === o.id;
        const amostra = o.hex === null ? 'transparent' : '#' + o.hex.toString(16).padStart(6, '0');
        const preco = dono ? (esc ? 'usando' : 'seu') : o.projeto ? 'projeto' : 'R$ ' + o.preco;
        return `<button data-cat="${cat}" data-op="${o.id}" class="${esc ? 'esc' : ''} ${!dono && o.projeto ? 'trancado' : ''}"><i style="background:${amostra}"></i>${o.nome}<small>${preco}</small></button>`;
      }).join('')}</div></div>`).join('');
    } else {
      const ets = this.projeto.etapas || [];
      lista = `<p class="g-txt">O Uno 1.6R do Modo Máquina está virando restomod de verdade. Cada etapa concluída na oficina libera uma peça aqui no jogo.</p>` +
        ets.map(et => `<div class="g-item ${et.feita ? '' : 'trancado'}"><div><b>${et.feita ? '✓' : '🔒'} ${et.nome}</b><small>${et.premio ? et.premio.nome + ' · ' + et.premio.efeito : ''}</small></div><em>${et.feita ? 'liberado' : 'em breve'}</em></div>`).join('') +
        (this.projeto.apoio ? `<a class="g-apoio" href="${this.projeto.apoio}" target="_blank" rel="noopener">Acompanhe e apoie o projeto →</a>` : '');
    }
    this.el.innerHTML = `
      <div class="g-topo"><div><small>Garagem da Lock-Up</small><b>${F.nome.toUpperCase()}</b></div><span class="g-caixa">R$ ${real(this.grana)}</span><button data-fechar aria-label="Sair da garagem">✕</button></div>
      <div class="g-abas">${[['carros', 'Carros'], ['desempenho', 'Peças'], ['visual', 'Visual'], ['projeto', 'Projeto Uno']].map(([id, n]) => `<button data-aba="${id}" class="${this.aba === id ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="g-stats">${barras}</div>
      <div class="g-lista rolavel">${lista}</div>
      ${this.msg ? `<div class="g-msg">${this.msg}</div>` : ''}`;
  }
}
