// Carreira: do Uno da Lock-Up até "Rei da PA-160". Quatro capítulos com três provas cada; a última de
// cada capítulo é contra o chefe da área. Os pilotos e os apelidos são inventados (nada de gente de verdade).
// As provas usam o que o jogo já tem: racha (rotas de rotas.js), arrancada (201/402 m), contra o relógio
// e fuga da polícia. Os rivais da carreira têm carro e preparação fixos: para ganhar dos últimos é
// preciso preparar o carro ou comprar um melhor na garagem.
// Progresso salvo no aparelho (localStorage 'carreira-lockup').
import { fichaDe } from './modelos.js';

export const CAPITULOS = [
  { id: 'c1', nome: 'Rua Aparaí', txt: 'Todo mundo começa em algum lugar. O Zé Turbo manda na rua da oficina.', provas: [
    { id: 'c1a', tipo: 'arrancada', titulo: 'Tiro curto', dist: 201, rival: { nome: 'ZÉ TURBO', carro: 'uno', p: 0 }, premio: 250,
      txt: '201 m na PA-160 contra o Zé. Segure ACELERA no verde e troque no giro certo.' },
    { id: 'c1b', tipo: 'relogio', titulo: 'Conhecendo o caminho', rota: 'principal', meta: 75, premio: 300,
      txt: 'Faça o Racha da Lock-Up em menos de 1:15. Sem rival, só você e o cronômetro.' },
    { id: 'c1c', tipo: 'racha', titulo: 'Chefe: Zé Turbo', rota: 'principal', rival: { nome: 'ZÉ TURBO', carro: 'uno', p: 0.25 }, premio: 600, chefe: true,
      txt: 'O Zé mexeu no Uno dele. Ganhe o racha da Lock-Up e a rua é sua.' },
  ] },
  { id: 'c2', nome: 'Volta das Avenidas', txt: 'Do outro lado da PA, nas avenidas largas, quem corre é a turma da Dona Neide.', provas: [
    { id: 'c2a', tipo: 'racha', titulo: 'Rodando nas avenidas', rota: 'bairro', rival: { nome: 'FAÍSCA', carro: 'quadrado', p: 0.25 }, premio: 700,
      txt: 'Racha de 2 km pelas avenidas contra o Faísca e o Quadrado 1.8 dele.' },
    { id: 'c2b', tipo: 'fuga', titulo: 'Sirene ligada', nivel: 2, premio: 800,
      txt: 'A polícia já está na sua cola, nível 2. Abra distância e suma por 10 segundos.' },
    { id: 'c2c', tipo: 'arrancada', titulo: 'Chefe: Dona Neide', dist: 402, rival: { nome: 'DONA NEIDE', carro: 'canecos', p: 0.35 }, premio: 1500, chefe: true,
      txt: 'Ela corre de Seis Canecos desde antes de você nascer. 402 m, sem desculpa.' },
  ] },
  { id: 'c3', nome: 'Cidade Nova', txt: 'Carro importado e dinheiro alto. Aqui o Uno original não segura mais.', provas: [
    { id: 'c3a', tipo: 'racha', titulo: 'Avenida curva', rota: 'cidade', rival: { nome: 'BIGODE', carro: 'tufao', p: 0.35 }, premio: 2000,
      txt: 'O Bigode e o Tufão 2.0 16V dele conhecem cada curva da Cidade Nova.' },
    { id: 'c3b', tipo: 'relogio', titulo: 'Contra o relógio na Cidade Nova', rota: 'cidade', meta: 62, premio: 2500,
      txt: 'A volta pela Cidade Nova em menos de 1:02.' },
    { id: 'c3c', tipo: 'racha', titulo: 'Chefe: Doutor', rota: 'cidade', rival: { nome: 'DOUTOR', carro: 'barao', p: 0.4 }, premio: 5000, chefe: true,
      txt: 'Terno, Barão V8 e nunca perdeu na Cidade Nova. Ainda.' },
  ] },
  { id: 'c4', nome: 'Rei da PA-160', txt: 'A rodovia inteira. Só os mais rápidos de Parauapebas correm aqui.', provas: [
    { id: 'c4a', tipo: 'arrancada', titulo: 'Meia força não serve', dist: 402, rival: { nome: 'TOURO', carro: 'bisao', p: 0.5 }, premio: 5000,
      txt: '402 m contra o Touro e o Bisão V8. Precisa de carro bom e troca perfeita.' },
    { id: 'c4b', tipo: 'fuga', titulo: 'Procurado nível 3', nivel: 3, premio: 5000,
      txt: 'Duas viaturas atrás de você e elas não aliviam. Despiste as duas.' },
    { id: 'c4c', tipo: 'racha', titulo: 'Chefe final: Fantasma', rota: 'pa', rival: { nome: 'FANTASMA', carro: 'bala', p: 0.6 }, premio: 10000, chefe: true,
      txt: 'Ninguém sabe quem é. Só que o Bala Boxer dele nunca perdeu na PA-160 de ponta a ponta.' },
  ] },
];

const CHAVE = 'carreira-lockup';
const lerGrana = () => { try { return parseInt(localStorage.getItem('racha-grana')) || 0; } catch { return 0; } };
const gravarGrana = v => { try { localStorage.setItem('racha-grana', String(v)); } catch {} };
const fmt = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, '0')}`.replace('.', ','); };
export const todasProvas = () => CAPITULOS.flatMap(c => c.provas);

// preparação do rival da carreira (0 a 1), na mesma régua das peças da garagem
export function modsRival(p) {
  return { acel: 1 + 0.42 * p, vmax: 7.5 * p, grip: 1 + 0.25 * p, freio: 1 + 0.15 * p, nitroDur: 3 + 1.6 * p, nitroRec: 1 + 0.4 * p };
}

export class Carreira {
  constructor() {
    let e = null; try { e = JSON.parse(localStorage.getItem(CHAVE)); } catch {}
    this.e = Object.assign({ feitas: [], melhor: {} }, e || {});
  }
  salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(this.e)); } catch {} }
  feita(id) { return this.e.feitas.includes(id); }
  // a próxima prova em aberto (as anteriores ficam liberadas para repetir)
  get proxima() { return todasProvas().find(p => !this.feita(p.id)) || null; }
  liberada(id) { const lista = todasProvas(), i = lista.findIndex(p => p.id === id); return i >= 0 && lista.slice(0, i).every(p => this.feita(p.id)); }
  get titulo() { return this.feita('c4c') ? 'Rei da PA-160' : null; }

  // resultado de uma prova: { venceu, tempo (s) }; paga o prêmio cheio na primeira vez e 20% nas repetições
  concluir(prova, r) {
    if (r.tempo) { const m = this.e.melhor[prova.id]; if (!m || r.tempo < m) this.e.melhor[prova.id] = r.tempo; }
    let premio = 0, primeira = false;
    if (r.venceu) {
      primeira = !this.feita(prova.id);
      premio = primeira ? prova.premio : Math.round(prova.premio * 0.2 / 10) * 10;
      if (primeira) this.e.feitas.push(prova.id);
      gravarGrana(lerGrana() + premio);
    }
    this.salvar();
    const cap = CAPITULOS.find(c => c.provas.includes(prova));
    const fechou = primeira && prova.chefe;
    return { premio, primeira, fechou, capitulo: cap, grana: lerGrana() };
  }

  // ---------- tela
  abrir(el, aoCorrer, aoFechar) {
    this.el = el; this.aoCorrer = aoCorrer; this.aoFechar = aoFechar;
    if (!this.ligado) {
      this.ligado = true;
      el.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return;
        ev.preventDefault();
        if (b.dataset.fechar !== undefined) { this.aoFechar(); return; }
        if (b.dataset.prova) { const p = todasProvas().find(x => x.id === b.dataset.prova); if (p && this.liberada(p.id)) this.aoCorrer(p); }
      });
    }
    el.classList.add('on');
    this.render();
    // rola até a próxima prova
    const prox = this.proxima, alvo = prox && el.querySelector(`[data-item="${prox.id}"]`);
    if (alvo) alvo.scrollIntoView({ block: 'center' });
  }
  fechar() { if (this.el) this.el.classList.remove('on'); }

  descricao(p) {
    if (p.tipo === 'arrancada') return `Arrancada ${p.dist} m · ${fichaDe(p.rival.carro).nome}`;
    if (p.tipo === 'relogio') return `Contra o relógio · meta ${fmt(p.meta)}`;
    if (p.tipo === 'fuga') return `Fuga · procurado nível ${p.nivel}`;
    return `Racha · ${fichaDe(p.rival.carro).nome}`;
  }

  render() {
    if (!this.el) return;
    const real = r => r.toLocaleString('pt-BR');
    const total = todasProvas().length, feitas = this.e.feitas.length;
    const prox = this.proxima;
    const lista = CAPITULOS.map((c, ci) => {
      const aberto = c.provas.some(p => this.liberada(p.id));
      const provas = c.provas.map(p => {
        const ok = this.feita(p.id), lib = this.liberada(p.id), atual = prox && prox.id === p.id;
        const melhor = this.e.melhor[p.id] && p.tipo !== 'fuga' ? ` · melhor ${fmt(this.e.melhor[p.id])}` : '';
        const botao = !lib ? '<em>🔒</em>' : `<button data-prova="${p.id}">${ok ? 'Repetir' : 'Correr'}<small>R$ ${real(ok ? Math.round(p.premio * 0.2 / 10) * 10 : p.premio)}</small></button>`;
        return `<div class="g-item c-prova ${atual ? 'atual' : ''} ${p.chefe ? 'chefe' : ''} ${lib ? '' : 'trancado'}" data-item="${p.id}">
          <div><b>${ok ? '✓ ' : ''}${p.titulo}</b><small>${this.descricao(p)}${melhor}</small>${atual ? `<small class="c-txt">${p.txt}</small>` : ''}</div>${botao}</div>`;
      }).join('');
      return `<div class="c-cap ${aberto ? '' : 'fechado'}"><div class="c-cab"><span>${ci + 1}</span><div><b>${c.nome}</b><small>${c.txt}</small></div></div>${provas}</div>`;
    }).join('');
    this.el.innerHTML = `
      <div class="g-topo"><div><small>Carreira</small><b>${this.titulo ? 'REI DA PA-160' : 'DO UNO AO TOPO'}</b></div><span class="g-caixa">R$ ${real(lerGrana())}</span><button data-fechar aria-label="Fechar a carreira">✕</button></div>
      <div class="c-progresso"><i style="width:${Math.round(feitas / total * 100)}%"></i><span>${feitas} de ${total} provas</span></div>
      <div class="g-lista rolavel">${lista}</div>`;
  }
}
