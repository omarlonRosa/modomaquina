// Multiplayer do jogo (modomaquina.com.br/jogo/): cada sala é um Durable Object com WebSocket.
// O servidor só repassa: cada jogador manda a própria posição ~10 vezes por segundo e a sala espalha
// para os outros. Também marca a largada dos rachas online (hora do servidor) e junta os tempos de chegada.
// Nada é guardado: a sala some quando todo mundo sai. Sem login; o apelido é limpo (A-Z, 0-9, espaço).
// Endereço: wss://modomaquina.com.br/api/jogo/sala/<CODIGO>  (CODIGO: 3 a 8 letras/números; "PEBAS" = sala aberta)

const MAX_JOGADORES = 8;
const ROTAS = ['principal', 'bairro', 'cidade', 'pa'];
const CARROS = ['uno', 'besouro', 'quadrado', 'tufao', 'canecos', 'barao', 'bisao', 'bala'];

const limparNome = (s) => String(s || '').replace(/<[^>]*>/g, '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
const num = (v, lim = 1e5) => { const n = Number(v); return Number.isFinite(n) ? Math.max(-lim, Math.min(lim, Math.round(n * 100) / 100)) : 0; };

export async function salaJogo(req, env, url, origens) {
  const m = url.pathname.match(/^\/api\/jogo\/sala\/([A-Za-z0-9]{3,8})$/);
  if (!m) return new Response('sala?', { status: 404 });
  if (req.headers.get('Upgrade') !== 'websocket') return new Response('websocket', { status: 426 });
  const origem = req.headers.get('Origin');
  if (origem && !origens.includes(origem) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origem)) return new Response('origem', { status: 403 });
  const id = env.SALAS.idFromName(m[1].toUpperCase());
  return env.SALAS.get(id).fetch(req);
}

export class SalaJogo {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.racha = null;          // { rota, inicio, chegadas: [{id, nome, tempo}] }
  }

  jogadores() {
    return this.ctx.getWebSockets().map((ws) => ({ ws, j: ws.deserializeAttachment() })).filter((x) => x.j && x.j.nome);
  }
  mandar(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }
  espalhar(obj, menos) { const txt = JSON.stringify(obj); for (const ws of this.ctx.getWebSockets()) if (ws !== menos) { try { ws.send(txt); } catch {} } }

  async fetch(req) {
    if (this.ctx.getWebSockets().length >= MAX_JOGADORES) return new Response('cheia', { status: 409 });
    const par = new WebSocketPair();
    this.ctx.acceptWebSocket(par[1]);
    par[1].serializeAttachment({ id: crypto.randomUUID().slice(0, 8), nome: null, msgs: 0, janela: Date.now() });
    return new Response(null, { status: 101, webSocket: par[0] });
  }

  async webSocketMessage(ws, dados) {
    if (typeof dados !== 'string' || dados.length > 600) return;
    const j = ws.deserializeAttachment();
    // limite: 40 mensagens por segundo por jogador
    const agora = Date.now();
    if (agora - j.janela > 1000) { j.janela = agora; j.msgs = 0; }
    if (++j.msgs > 40) { ws.serializeAttachment(j); return; }
    let m; try { m = JSON.parse(dados); } catch { return; }

    if (m.t === 'oi') {
      const novo = !j.nome;
      j.nome = limparNome(m.nome) || 'PILOTO ' + j.id.slice(0, 3).toUpperCase();
      j.carro = CARROS.includes(m.carro) ? m.carro : 'uno';
      j.cor = Number.isInteger(m.cor) ? m.cor & 0xffffff : 0xd6d9d5;
      ws.serializeAttachment(j);
      const outros = this.jogadores().filter((x) => x.ws !== ws).map((x) => ({ id: x.j.id, nome: x.j.nome, carro: x.j.carro, cor: x.j.cor }));
      if (novo) this.mandar(ws, { t: 'bv', id: j.id, agora, jogadores: outros, racha: this.racha && this.racha.inicio > agora - 600000 ? this.racha : null });
      this.espalhar({ t: 'entrou', id: j.id, nome: j.nome, carro: j.carro, cor: j.cor }, ws);
      return;
    }
    if (!j.nome) return;
    ws.serializeAttachment(j);
    if (m.t === 'pos') {
      // posição: x, z, ângulo, velocidade, volante, nitro, freio, progresso no racha
      this.espalhar({ t: 'pos', id: j.id, x: num(m.x), z: num(m.z), a: num(m.a, 100), v: num(m.v, 200), d: num(m.d, 2), n: m.n ? 1 : 0, f: m.f ? 1 : 0, s: num(m.s) }, ws);
    } else if (m.t === 'racha') {
      // qualquer um chama o racha; vale se não tiver outro rolando (ou se o anterior já acabou)
      if (this.racha && agora < this.racha.inicio + 240000 && this.racha.chegadas.length < this.jogadores().length) return;
      const rota = ROTAS.includes(m.rota) ? m.rota : 'principal';
      const vagas = this.jogadores().map((x) => x.j.id);
      this.racha = { rota, inicio: agora + 6000, vagas, chegadas: [], por: j.nome };
      this.espalhar({ t: 'racha', ...this.racha, agora });
    } else if (m.t === 'chegou') {
      if (!this.racha || this.racha.chegadas.some((c) => c.id === j.id)) return;
      const tempo = num(m.tempo, 3600);
      if (tempo < 20) return;     // tempo impossível
      this.racha.chegadas.push({ id: j.id, nome: j.nome, tempo });
      this.racha.chegadas.sort((a, b) => a.tempo - b.tempo);
      this.espalhar({ t: 'chegadas', chegadas: this.racha.chegadas });
    } else if (m.t === 'ping') {
      this.mandar(ws, { t: 'pong', c: num(m.c, 1e13), agora });
    }
  }

  async webSocketClose(ws) { this.saiu(ws); }
  async webSocketError(ws) { this.saiu(ws); }
  saiu(ws) {
    const j = ws.deserializeAttachment();
    try { ws.close(1000, 'tchau'); } catch {}
    if (j && j.nome) this.espalhar({ t: 'saiu', id: j.id }, ws);
  }
}
