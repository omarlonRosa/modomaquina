// Teclado (WASD/setas, espaço = freio de mão) e botões de toque para celular.
// As teclas são "liga/desliga"; ler() transforma isso em volante, acelerador e freio
// que sobem e descem aos poucos, como um controle analógico.
const BOTOES = ['esq', 'dir', 'acel', 'freio', 'mao'];

export class Controles {
  constructor() {
    this.teclas = new Set();
    this.toque = { esq: false, dir: false, acel: false, freio: false, mao: false };
    this.travado = false;
    this.acoes = {};
    this.v = 0; this.a = 0; this.f = 0;   // volante (-1..1), acelerador e freio (0..1) já suavizados
    addEventListener('keydown', e => {
      if (e.repeat) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); return; }
      this.teclas.add(e.code);
      const a = { KeyC: 'camera', KeyR: 'reset', KeyM: 'som', Escape: 'menu', KeyP: 'menu' }[e.code];
      if (a && this.acoes[a]) this.acoes[a]();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => this.teclas.delete(e.code));
    addEventListener('blur', () => { this.teclas.clear(); this.soltarToques(); });

    this.ligarToque();
    for (const el of document.querySelectorAll('[data-acao]')) {
      el.addEventListener('click', e => { e.preventDefault(); const f = this.acoes[el.dataset.acao]; if (f) f(); el.blur(); });
    }
  }

  // Toque: em vez de cada botão ouvir o próprio dedo, olha onde estão todos os dedos a cada
  // movimento. Assim dá para escorregar o polegar do ◀ para o ▶ sem levantar, e dois dedos
  // ao mesmo tempo não viram "pinça" de zoom do navegador.
  ligarToque() {
    const els = {};
    for (const el of document.querySelectorAll('[data-toque]')) els[el.dataset.toque] = el;
    this.elsToque = els;
    const ehBotao = t => t && t.closest && t.closest('button, a, input, select');
    const atualizar = e => {
      const novo = { esq: false, dir: false, acel: false, freio: false, mao: false };
      for (const t of e.touches) {
        const k = this.botaoEm(t.clientX, t.clientY);
        if (k) novo[k] = true;
      }
      const algumNovo = BOTOES.some(k => novo[k] && !this.toque[k]);
      for (const k of BOTOES) { this.toque[k] = novo[k]; if (els[k]) els[k].classList.toggle('ativo', novo[k]); }
      if (algumNovo && this.acoes.primeiroToque) this.acoes.primeiroToque();
    };
    let ultimoFim = 0;
    const opc = { passive: false };
    document.addEventListener('touchstart', e => {
      if (!ehBotao(e.target) || e.touches.length > 1) e.preventDefault();
      atualizar(e);
    }, opc);
    document.addEventListener('touchmove', e => { e.preventDefault(); atualizar(e); }, opc);
    const fim = e => {
      // segundo toque rápido no mesmo lugar = zoom no Safari; corta, menos em botões do menu
      const agora = performance.now();
      if (!ehBotao(e.target) && agora - ultimoFim < 350) e.preventDefault();
      ultimoFim = agora;
      atualizar(e);
    };
    document.addEventListener('touchend', fim, opc);
    document.addEventListener('touchcancel', fim, opc);
    for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), opc);
    document.addEventListener('dblclick', e => e.preventDefault(), opc);
    document.addEventListener('contextmenu', e => { if (!ehBotao(e.target)) e.preventDefault(); });
  }

  // qual botão de toque está sob o dedo (com uma folga em volta, que o polegar erra)
  botaoEm(x, y) {
    let melhor = null, dMelhor = 26;
    for (const k of BOTOES) {
      const el = this.elsToque[k]; if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;   // escondido (fora do jogo ou no computador)
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < dMelhor) { melhor = k; dMelhor = d; }
    }
    return melhor;
  }

  soltarToques() {
    for (const k of BOTOES) { this.toque[k] = false; if (this.elsToque && this.elsToque[k]) this.elsToque[k].classList.remove('ativo'); }
  }

  // dt em segundos, kmh para o volante ficar mais calmo em alta
  ler(dt = 1 / 60, kmh = 0) {
    const t = this.teclas, q = this.toque;
    const acel = (t.has('KeyW') || t.has('ArrowUp') || q.acel) ? 1 : 0;
    const freio = (t.has('KeyS') || t.has('ArrowDown') || q.freio) ? 1 : 0;
    const dir = ((t.has('KeyA') || t.has('ArrowLeft') || q.esq) ? 1 : 0) - ((t.has('KeyD') || t.has('ArrowRight') || q.dir) ? 1 : 0);
    const mao = t.has('Space') || q.mao;
    // travado (contagem da largada): segura no freio de mão. Freio comum com o carro parado vira ré!
    if (this.travado) { this.v = 0; this.a = 0; this.f = 0; return { acel: 0, freio: 0, dir: 0, mao: true }; }

    // volante: vai girando (uns 0,35 s até o fim parado, ~0,8 s a 120 km/h) e volta ao centro mais rápido
    const calma = 1 + Math.abs(kmh) / 90;
    let taxa;
    if (dir === 0) taxa = 4.5;
    else if (Math.sign(dir) !== Math.sign(this.v) && Math.abs(this.v) > 0.05) taxa = 6;   // trocando de lado
    else taxa = 2.9 / calma;
    this.v = chegar(this.v, dir, taxa * dt);
    // acelerador sobe em ~0,25 s e alivia rápido; freio entra em ~0,15 s
    this.a = chegar(this.a, acel, (acel ? 4 : 8) * dt);
    this.f = chegar(this.f, freio, (freio ? 7 : 10) * dt);
    // curva suave: pouco volante perto do centro, total no fim
    const v = Math.sign(this.v) * Math.pow(Math.abs(this.v), 1.4);
    return { acel: this.a, freio: this.f, dir: v, mao, analogico: true };
  }
}

function chegar(atual, alvo, passo) {
  if (Math.abs(alvo - atual) <= passo) return alvo;
  return atual + Math.sign(alvo - atual) * passo;
}
