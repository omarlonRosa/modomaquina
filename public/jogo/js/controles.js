// Teclado (WASD/setas, espaço = freio de mão) e botões de toque para celular.
export class Controles {
  constructor() {
    this.teclas = new Set();
    this.toque = { esq: false, dir: false, acel: false, freio: false, mao: false };
    this.travado = false;
    this.acoes = {};
    addEventListener('keydown', e => {
      if (e.repeat) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); return; }
      this.teclas.add(e.code);
      const a = { KeyC: 'camera', KeyR: 'reset', KeyM: 'som', Escape: 'menu', KeyP: 'menu' }[e.code];
      if (a && this.acoes[a]) this.acoes[a]();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => this.teclas.delete(e.code));
    addEventListener('blur', () => { this.teclas.clear(); for (const k in this.toque) this.toque[k] = false; });

    for (const el of document.querySelectorAll('[data-toque]')) {
      const k = el.dataset.toque;
      const on = e => { e.preventDefault(); this.toque[k] = true; el.classList.add('ativo'); if (this.acoes.primeiroToque) this.acoes.primeiroToque(); };
      const off = e => { e.preventDefault(); this.toque[k] = false; el.classList.remove('ativo'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    }
    for (const el of document.querySelectorAll('[data-acao]')) {
      el.addEventListener('click', e => { e.preventDefault(); const f = this.acoes[el.dataset.acao]; if (f) f(); el.blur(); });
    }
  }
  ler() {
    const t = this.teclas, q = this.toque;
    const acel = (t.has('KeyW') || t.has('ArrowUp') || q.acel) ? 1 : 0;
    const freio = (t.has('KeyS') || t.has('ArrowDown') || q.freio) ? 1 : 0;
    const dir = ((t.has('KeyA') || t.has('ArrowLeft') || q.esq) ? 1 : 0) - ((t.has('KeyD') || t.has('ArrowRight') || q.dir) ? 1 : 0);
    const mao = t.has('Space') || q.mao;
    if (this.travado) return { acel: 0, freio: 1, dir: 0, mao: false };
    return { acel, freio, dir, mao };
  }
}
