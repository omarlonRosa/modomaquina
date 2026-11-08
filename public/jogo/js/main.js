import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mundo } from './mundo.js';
import { criarLockup, areaLivre } from './lockup.js';
import { criarMarcos, areasMarcos } from './marcos.js';
import { Carro, Som } from './carro.js';
import { Controles } from './controles.js';
import { Hud } from './hud.js';
import { Racha } from './racha.js';
import { Rival, colisaoCarros } from './rival.js';
import { Arrancada } from './arrancada.js';
import { Garagem, VISUAL } from './garagem.js';
import { Online } from './online.js';
import { Rede, Transito } from './transito.js';
import { Policia } from './policia.js';
import { montarModelo, fichaDe } from './modelos.js';
import { montarRota } from './rotas.js';
import { Carreira, modsRival, CAPITULOS } from './carreira.js';

const celular = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('toque', celular);
// iPhone/iPad: o Safari não tem tela cheia para sites; aberto pelo ícone da Tela de Início ele vira app sem barras
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const comoApp = navigator.standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
document.body.classList.toggle('ios', ios);
document.body.classList.toggle('app', comoApp);
// versão dos arquivos (ferramentas/carimbar_versao.py põe ?v= no main.js); vai junto nos downloads
const VERSAO = new URL(import.meta.url).searchParams.get('v') || '';
const comVersao = (url) => VERSAO ? `${url}?v=${VERSAO}` : url;

const carregando = document.getElementById('carregando');
const barra = document.getElementById('barra');
const progresso = (f, txt) => { barra.style.width = Math.round(f * 100) + '%'; if (txt) carregando.querySelector('p').textContent = txt; };

const renderer = new THREE.WebGLRenderer({ antialias: !celular, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
// tamanho pela área da página e não pela janela visível: se o navegador der zoom, o jogo não encolhe
const tamanho = () => [document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight];
renderer.setSize(...tamanho(), false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.getElementById('tela').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.FogExp2(0x1a2236, 0.0032);
const camera = new THREE.PerspectiveCamera(62, tamanho()[0] / tamanho()[1], 0.1, 1400);

// noite: luz ambiente azulada, lua fraca, céu com gradiente
scene.add(new THREE.HemisphereLight(0x7d8fbf, 0x4a2a1a, 1.25));
const lua = new THREE.DirectionalLight(0xa9bdff, 0.7); lua.position.set(-200, 300, 120); scene.add(lua);
{
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#03050c'); gr.addColorStop(0.55, '#121a33'); gr.addColorStop(0.8, '#3a2a35'); gr.addColorStop(1, '#5a3a2a');
  g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(1200, 24, 12), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false }));
  ceu.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 1) a[i] = 1 - v; });
  scene.add(ceu); window._ceu = ceu;
  // estrelas
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const t2 = Math.random() * 6.28, p = Math.random() * 1.2 + 0.25; pos.set([Math.cos(t2) * Math.cos(p) * 1100, Math.sin(p) * 1100, Math.sin(t2) * Math.cos(p) * 1100], i * 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
}

async function baixar(url, peso, base) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !total) { const b = await r.arrayBuffer(); progresso(base + peso); return b; }
  const leitor = r.body.getReader(); const partes = []; let lido = 0;
  for (;;) {
    const { done, value } = await leitor.read(); if (done) break;
    partes.push(value); lido += value.length; progresso(base + peso * lido / total);
  }
  const out = new Uint8Array(lido); let o = 0; for (const p of partes) { out.set(p, o); o += p.length; }
  return out.buffer;
}

let mundo, carro, hud, racha, lockup, som, controles, rival, arrancada, garagem;
let garagemAng = 0.9, arrastando = null, rede, transito, policia;
let unoBase, carroId = 'uno';
let rachas = {}, carreira, provaAtual = null;
let online, esperaOnline = null, rachaOnline = null, chegadasOnline = [];
// rival no racha e na arrancada: um carro da mesma turma do seu (o desempenho dele é igualado em ajustarRival)
const RIVAL_DE = { uno: 'uno', besouro: 'quadrado', quadrado: 'tufao', tufao: 'canecos', canecos: 'tufao', barao: 'bisao', bisao: 'bala', bala: 'bisao' };
const modeloDe = (id, cor) => id === 'uno' ? { scene: unoBase.clone(true) } : montarModelo(id, cor);
let modo = 'menu', camModo = 0, vidros = [];
const CAMS = [{ d: 5.4, h: 2.0, olhar: 1.0 }, { d: 9, h: 3.8, olhar: 1.2 }, { d: -0.35, h: 1.12, olhar: 1.0, dentro: true }];

async function iniciar() {
  progresso(0.02, 'Baixando o mapa de Parauapebas…');
  const mapa = JSON.parse(new TextDecoder().decode(await baixar(comVersao('dados/mapa.json'), 0.1, 0)));
  progresso(0.1, 'Trazendo o Uno da garagem…');
  const glb = await baixar(comVersao('modelos/uno-hoje.glb'), 0.75, 0.1);
  progresso(0.86, 'Montando a cidade…');
  await new Promise(r => setTimeout(r, 30));
  // ruas mais largas que no mapa (o usuário achou estreitas e o carro batia muito): as de mão dupla
  // ganham mais (uma faixa por sentido ficava apertada); as pistas de mão única só um pouco, para não
  // comer o canteiro; a Rua Aparaí fica quase igual (a oficina e o hotel estão encostados nela)
  for (const r of mapa.ruas) {
    if (r.n === 'Rua Aparaí') r.w = Math.max(r.w, 8);
    else if (r.mao) r.w = Math.round(r.w * 1.12 * 10) / 10;
    else if (r.t !== 'track') r.w = Math.round((r.w * 1.3 + 1) * 10) / 10;
  }
  mundo = new Mundo(mapa, scene, { areaLivre: areaLivre(mapa.lockup), poucosPostes: celular, ocupados: areasMarcos(mapa.lockup) });
  lockup = criarLockup(mapa.lockup, mundo, scene);
  criarMarcos(mapa.lockup, mundo, scene);
  // texturas como <img> (blob: liberado em img-src) e não por fetch, que a CSP do site bloqueia em connect-src
  const loader = new GLTFLoader().register(parser => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: 'texturas_por_img' }; });
  const gltf = await loader.parseAsync(glb, '');
  unoBase = gltf.scene.clone(true);                            // cópia limpa antes do Carro mexer na hierarquia
  const gltfRival = { scene: gltf.scene.clone(true) };
  const gltfPolicia = [{ scene: gltf.scene.clone(true) }, { scene: gltf.scene.clone(true) }];
  garagem = new Garagem();
  carroId = garagem.e.carro;
  carro = new Carro(carroId === 'uno' ? gltf : modeloDe(carroId), scene);
  coletarVidros();
  controles = new Controles();
  hud = new Hud(mapa, mapa.lockup, mundo.lotes.concat(areasMarcos(mapa.lockup).slice(0, 2).map(p => ({ p }))));
  racha = new Racha(mapa.racha, scene, mundo);
  rachas.principal = racha;
  rival = new Rival(gltfRival, scene, racha);
  online = new Online(scene, (id, cor) => modeloDe(id, cor));
  arrancada = new Arrancada(racha, scene, THREE);
  rede = new Rede(mapa.ruas, mapa.raio);
  transito = new Transito(scene, rede, mundo, { max: celular ? 11 : 20 });
  policia = new Policia(gltfPolicia, scene, rede, mundo);
  policia.aoEnquadrar = enquadrado; policia.aoFugir = despistou;
  try { garagem.projeto = await (await fetch(comVersao('dados/projeto.json'))).json(); } catch (e) { console.warn('projeto.json', e); }
  garagem.aplicar(carro);
  carreira = new Carreira();
  ajustarRival(); ajustarPolicia();
  mostrarGrana();
  som = new Som();
  carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang);
  posicionarCamera(1, true);
  ligarAcoes();
  progresso(1, 'Pronto');
  renderer.compile(scene, camera);
  carregando.classList.add('fora');
  document.getElementById('menu').classList.add('on');
  ultimo = performance.now();
  requestAnimationFrame(loop);
}

function ligarAcoes() {
  const menu = document.getElementById('menu'), fim = document.getElementById('fim');
  // tipo: livre | racha | relogio | arrancada | fuga; prova: prova da carreira (carreira.js) ou nada
  const jogar = (tipo, prova = null) => {
    provaAtual = prova;
    telaCheia();
    som.iniciar();
    menu.classList.remove('on'); fim.classList.remove('on');
    document.body.classList.add('jogando');
    carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang);
    racha.parar(); arrancada.parar(); carro.avaria = 0;
    if (tipo === 'racha' || tipo === 'arrancada') prepararRival(prova && prova.rival);
    // rota do racha: a da Lock-Up ou uma da carreira
    racha = prova && prova.rota && prova.rota !== 'principal' ? obterRacha(prova.rota) : rachas.principal;
    rival.racha = racha;
    // trânsito e polícia: no rodar livre e nos rachas; a arrancada é com a pista fechada
    transito.ligar(tipo !== 'arrancada'); policia.ligar(tipo !== 'arrancada');
    const btRepetir = document.querySelector('#fim [data-acao]');
    const premioCarreira = prova ? [0, 0] : undefined;      // a carreira paga o prêmio dela
    if (tipo === 'arrancada') {
      modo = 'arrancada';
      arrancada.iniciar(carro, rival, hud, (r) => {
        modo = 'livre';
        if (prova) return fimCarreira(prova, { venceu: r.ganhou, tempo: r.queimou ? null : parseFloat(String(r.tempo).replace(',', '.')),
          titulo: r.queimou ? 'Queimou a largada' : null, linha: `${r.tempo} · ${r.rival}: ${r.tRival} · reação ${r.reacao}` });
        document.getElementById('fim-titulo').textContent = r.queimou ? 'Queimou a largada' : r.ganhou ? 'Você ganhou a arrancada!' : `${r.rival} ganhou a arrancada`;
        document.getElementById('fim-tempo').textContent = r.tempo;
        document.getElementById('fim-recorde').textContent = `Reação ${r.reacao} · ${r.kmh} km/h no fim · ${r.rival}: ${r.tRival}`;
        document.getElementById('fim-dist').textContent = r.novo ? 'Novo recorde nos 402 m neste aparelho!' : r.recorde ? `Seu recorde nos 402 m: ${r.recorde}` : '402 m na PA-160';
        document.getElementById('fim-grana').textContent = r.premio ? `+ R$ ${r.premio} pro caixa da garagem · caixa: R$ ${r.grana}` : '';
        botoesFim('arrancada', r.ganhou ? 'Correr de novo' : 'Revanche');
        mostrarGrana();
        document.getElementById('aviso').classList.remove('on');
        fim.classList.add('on');
      }, { dist: prova ? prova.dist : 402, premio: premioCarreira });
      posicionarCamera(1, true);          // a largada fica longe da Lock-Up: a câmera já começa atrás do carro
      return;
    }
    if (tipo === 'racha' || tipo === 'relogio') {
      modo = 'racha';
      const contra = tipo === 'racha';
      const L = racha === rachas.principal ? lockup.largada : racha.largada();
      if (contra || racha !== rachas.principal) carro.reset(L.jogador.x, L.jogador.z, L.jogador.ang);
      if (contra) rival.iniciar(L.rival.x, L.rival.z, L.rival.ang);
      carro.nitro = 1;
      racha.iniciar(hud, controles, (r) => {
        modo = 'livre';
        if (prova) {
          const venceu = contra ? r.posicao === 1 : r.segundos <= prova.meta;
          return fimCarreira(prova, { venceu, tempo: r.segundos, linha: contra ? (r.posicao === 1 ? `Você ganhou de ${r.rival}` : `${r.rival} fez ${r.tRival}`) : `Meta: ${fmtT(prova.meta)}` });
        }
        document.getElementById('fim-titulo').textContent = r.posicao === 1 ? 'Você ganhou!' : r.posicao === 2 ? `${r.rival} ganhou` : 'Chegada';
        document.getElementById('fim-tempo').textContent = r.tempo;
        document.getElementById('fim-recorde').textContent = r.posicao === 2 ? `${r.rival} fez ${r.tRival}` : r.novo ? 'Novo recorde neste aparelho!' : `Seu recorde: ${r.recorde}`;
        document.getElementById('fim-dist').textContent = `${(r.metros / 1000).toFixed(1).replace('.', ',')} km saindo da Lock-Up`;
        document.getElementById('fim-grana').textContent = r.premio ? `+ R$ ${r.premio} pro caixa da garagem · caixa: R$ ${r.grana}` : '';
        botoesFim(tipo, r.posicao === 2 ? 'Revanche' : 'Correr de novo');
        mostrarGrana();
        document.getElementById('aviso').classList.remove('on');
        fim.classList.add('on');
      }, contra ? { rival, premio: premioCarreira } : { premio: premioCarreira });
      posicionarCamera(1, true);
    } else if (tipo === 'fuga') {
      // fuga da carreira: a perseguição já começa, com uma viatura perto
      modo = 'livre';
      // começa na PA-160 (no pátio da oficina a viatura não acha caminho até você)
      const q = arrancada.pose(-120, -1); carro.reset(q.x, q.z, q.ang);
      // a viatura vem atrás, na mesma pista (do outro lado do canteiro ela levaria minutos para chegar)
      const v0 = policia.v[0], qv = arrancada.pose(-185, 1);
      v0.carro.reset(qv.x, qv.z, qv.ang); v0.carro.grupo.visible = true; v0.modo = 'ronda'; v0.cam = []; v0.iCam = 0; v0.preso = 0;
      policia.comecar(carro);
      policia.nivel = prova.nivel; policia.tPerseg = (prova.nivel - 1) * 25;
      hud.aviso(`PROCURADO NÍVEL ${prova.nivel}! Despiste a polícia`, 3);
    } else {
      modo = 'livre'; racha.parar();
      hud.aviso('Saindo da Lock-Up Auto Center', 3);
    }
  };
  // botões da tela de fim: repetir / rodar livre (ou carreira) / menu
  const botoesFim = (acao, txt) => {
    const [b1, b2] = document.querySelectorAll('#fim [data-acao]');
    b1.dataset.acao = acao; b1.textContent = txt;
    b2.dataset.acao = 'livre'; b2.textContent = 'Rodar livre';
  };
  // resultado de prova da carreira
  const fimCarreira = (prova, r) => {
    const res = carreira.concluir(prova, r);
    provaAtual = prova;
    som.sirene(0);
    const prox = carreira.proxima;
    document.getElementById('fim-titulo').textContent = r.titulo || (r.venceu ? (res.fechou ? (prova.id === 'c4c' ? 'REI DA PA-160!' : `${res.capitulo.nome}: dominada!`) : 'Prova vencida!') : 'Não foi dessa vez');
    document.getElementById('fim-tempo').textContent = r.tempo ? fmtT(r.tempo) : prova.titulo;
    document.getElementById('fim-recorde').textContent = r.linha || '';
    document.getElementById('fim-dist').textContent = r.venceu && res.fechou && prox ? `Próximo capítulo liberado: ${CAPITULO_DE(prox)}` : prova.titulo;
    document.getElementById('fim-grana').textContent = res.premio ? `+ R$ ${res.premio.toLocaleString('pt-BR')} · caixa: R$ ${res.grana.toLocaleString('pt-BR')}` : r.venceu ? '' : 'Dica: peças e carros novos na garagem ajudam';
    const [b1, b2] = document.querySelectorAll('#fim [data-acao]');
    if (r.venceu && prox) { b1.dataset.acao = 'proximaProva'; b1.textContent = `Próxima: ${prox.titulo}`; }
    else { b1.dataset.acao = 'repetirProva'; b1.textContent = r.venceu ? 'Correr de novo' : 'Tentar de novo'; }
    b2.dataset.acao = 'carreira'; b2.textContent = 'Carreira';
    mostrarGrana();
    document.getElementById('aviso').classList.remove('on');
    fim.classList.add('on');
  };
  // enquadrado no meio de um racha da carreira: a prova acaba
  falhouCarreira = (linha) => {
    if (!provaAtual || !racha.ativo) return false;
    const p = provaAtual; racha.parar(); modo = 'livre';
    fimCarreira(p, { venceu: false, linha });
    return true;
  };
  fugaCarreira = (venceu) => {
    if (!provaAtual || provaAtual.tipo !== 'fuga') return false;
    const p = provaAtual; modo = 'livre';
    fimCarreira(p, { venceu, linha: venceu ? 'Sumiu do radar' : 'A viatura te fechou' });
    return true;
  };
  controles.acoes = {
    livre: () => jogar('livre'),
    racha: () => jogar('racha'),
    carreira: () => abrirCarreira(),
    correrProva: (p) => jogar(p.tipo, p),
    repetirProva: () => provaAtual ? jogar(provaAtual.tipo, provaAtual) : abrirCarreira(),
    proximaProva: () => { const p = carreira.proxima; p ? jogar(p.tipo, p) : abrirCarreira(); },
    relogio: () => jogar('relogio'),
    arrancada: () => jogar('arrancada'),
    garagem: () => abrirGaragem(),
    online: () => abrirOnline(),
    camera: () => { camModo = (camModo + 1) % CAMS.length; },
    som: () => { som.iniciar(); som.mudo = !som.mudo; document.querySelector('[data-acao=som]').classList.toggle('mudo', som.mudo); },
    reset: () => {
      if (modo === 'arrancada') return;
      const i = mundo.infoRua(carro.pos.x, carro.pos.z, 200);
      if (i.rua) {
        let ang = i.dir; if (Math.cos(ang - carro.ang) < 0) ang += Math.PI;
        carro.reset(i.x, i.z, ang);
      }
    },
    menu: () => {
      provaAtual = null; esperaOnline = null; rachaOnline = null; controles.travado = false;
      if (modo === 'menu') return;
      racha.parar(); arrancada.parar(); transito.ligar(false); policia.ligar(false); modo = 'menu'; som.pausar();
      document.body.classList.remove('jogando'); fim.classList.remove('on'); menu.classList.add('on');
    },
    primeiroToque: () => { if (modo !== 'menu') som.iniciar(); },   // no menu fica quieto; o clique de jogar já liga o som
  };
}

// vidros: o insulfilm do modelo (quase preto) deixa a visão do motorista toda escura; por dentro ficam claros
function coletarVidros() {
  vidros = [];
  carro.grupo.traverse(o => { if (o.isMesh && o.material && o.material.name === 'glass' && !vidros.includes(o.material)) vidros.push(o.material); });
  for (const m of vidros) if (m.userData.opacidade === undefined) m.userData.opacidade = m.opacity;
}

// trocou de carro na garagem: novo modelo e nova ficha, mesma física
function trocarCarro() {
  carroId = garagem.e.carro;
  carro.trocarModelo(modeloDe(carroId));
  coletarVidros();
}

// o Zé pega um carro da mesma turma do seu, pintado de vermelho; na carreira o rival da prova vem com carro e preparação fixos
let rivalId = 'uno', fugaCarreira = () => false, falhouCarreira = () => false;
function prepararRival(def) {
  const id = def ? def.carro : RIVAL_DE[carroId] || 'uno';
  if (id !== rivalId) { rivalId = id; rival.carro.trocarModelo(modeloDe(id, 0xff2a1f), { cor: 0xff2a1f, leve: true }); }
  rival.nomear(def ? def.nome : 'ZÉ TURBO');
  rival.elastico = !def;
  if (def) rival.carro.mods = modsRival(def.p); else ajustarRival();
}
const fmtT = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, '0')}`.replace('.', ','); };
const CAPITULO_DE = p => (CAPITULOS.find(c => c.provas.includes(p)) || { nome: p.titulo }).nome;

// rotas da carreira: monta na primeira vez que precisa
function obterRacha(id) {
  if (!rachas[id]) rachas[id] = new Racha(montarRota(rede, id), scene, mundo);
  return rachas[id];
}

function abrirCarreira() {
  const menu = document.getElementById('menu');
  racha.parar(); arrancada.parar(); transito.ligar(false); policia.ligar(false); som.sirene(0);
  provaAtual = null;
  modo = 'garagem'; menu.classList.remove('on'); document.getElementById('fim').classList.remove('on');
  document.body.classList.remove('jogando'); document.body.classList.add('garagem');
  carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang);
  carreira.abrir(document.getElementById('carreira'), (prova) => {
    carreira.fechar(); document.body.classList.remove('garagem');
    controles.acoes.correrProva(prova);
  }, () => {
    carreira.fechar(); document.body.classList.remove('garagem');
    modo = 'menu'; menu.classList.add('on'); mostrarGrana();
  });
}

// o Zé também mexe no carro: chega perto do desempenho do seu (um pouco abaixo quanto mais preparado), seja qual for o carro dele
function ajustarRival() {
  const p = garagem.preparo(), F = carro.ficha, M = carro.mods || {}, R = rival.carro.ficha;
  rival.carro.mods = {
    acel: F.acel * (M.acel || 1) * (1 - 0.08 * p) / R.acel, vmax: F.vmax + (M.vmax || 0) - 3.5 * p - R.vmax,
    grip: F.grip * (M.grip || 1) * (1 - 0.13 * p) / R.grip, freio: F.freio * (1 + 0.15 * p) / R.freio, nitroDur: 3 + 1.6 * p, nitroRec: 1 + 0.4 * p,
  };
}

// as viaturas (Uno preparado) acompanham carro rápido, senão ninguém nunca é pego
function ajustarPolicia() {
  const F = carro.ficha, M = carro.mods || {};
  policia.escala = Math.max(1, (F.vmax + (M.vmax || 0)) / 55);
  for (const v of policia.v) v.carro.mods = { acel: Math.max(1.2, F.acel * (M.acel || 1) / 4.6 * 0.95), vmax: Math.max(4, (F.vmax + (M.vmax || 0)) * 0.93 - 49), grip: 1.15, freio: 1.1 };
}

function abrirGaragem() {
  const menu = document.getElementById('menu');
  racha.parar(); arrancada.parar(); transito.ligar(false); policia.ligar(false);
  modo = 'garagem'; menu.classList.remove('on'); document.getElementById('fim').classList.remove('on');
  document.body.classList.remove('jogando'); document.body.classList.add('garagem');
  carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang);
  garagem.abrir(document.getElementById('garagem'), () => {
    if (garagem.e.carro !== carroId) trocarCarro();
    garagem.aplicar(carro); ajustarRival(); ajustarPolicia(); mostrarGrana();
    if (online.conectado) online.atualizarEu(euOnline());
  }, () => {
    garagem.fechar(); document.body.classList.remove('garagem');
    modo = 'menu'; menu.classList.add('on'); mostrarGrana();
  });
}

// ---------- online
const corAtual = () => { const id = garagem.c.escolha.cor; const o = VISUAL.cor.opcoes.find(x => x.id === id); return o ? o.hex : 0xd6d9d5; };
const lerNome = () => { try { return localStorage.getItem('online-nome') || ''; } catch { return ''; } };
const euOnline = () => ({ nome: lerNome(), carro: carroId, cor: corAtual() });
const NOMES_ROTA = { principal: 'Racha da Lock-Up (1,8 km)', bairro: 'Volta das Avenidas (2,1 km)', cidade: 'Cidade Nova (2 km)', pa: 'PA-160 de ponta a ponta (2,4 km)' };

function abrirOnline() {
  const menu = document.getElementById('menu');
  racha.parar(); arrancada.parar(); transito.ligar(false); policia.ligar(false); som.sirene(0);
  provaAtual = null; esperaOnline = null; rachaOnline = null; controles.travado = false;
  modo = 'garagem'; menu.classList.remove('on'); document.getElementById('fim').classList.remove('on');
  document.body.classList.remove('jogando'); document.body.classList.add('garagem');
  carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang);
  const el = document.getElementById('online');
  el.classList.add('on');
  if (!el.dataset.ligado) {
    el.dataset.ligado = '1';
    el.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      ev.preventDefault();
      const nomeEl = el.querySelector('#on-nome'); if (nomeEl) try { localStorage.setItem('online-nome', nomeEl.value.trim().slice(0, 12)); } catch {}
      const a = b.dataset.on;
      if (a === 'fechar') { fecharOnline(); modo = 'menu'; menu.classList.add('on'); }
      else if (a === 'aberta') online.entrar('PEBAS', euOnline());
      else if (a === 'criar') online.entrar(Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'X'), euOnline());
      else if (a === 'codigo') { const c = (el.querySelector('#on-codigo').value || '').replace(/[^A-Za-z0-9]/g, ''); if (c.length >= 3) online.entrar(c, euOnline()); else avisoOnline('Código com 3 a 8 letras ou números'); }
      else if (a === 'sair') online.sair();
      else if (a === 'livre') { fecharOnline(); controles.acoes.livre(); }
      else if (a === 'racha') online.chamarRacha(b.dataset.rota);
      renderOnline();
    });
    online.eventos.aoMudar = () => renderOnline();
    online.eventos.aoCair = () => { hud.aviso('Caiu a conexão com a sala', 2.5); renderOnline(); };
    online.eventos.aoRacha = (m) => prepararRachaOnline(m);
    online.eventos.aoChegadas = (c) => { chegadasOnline = c; mostrarChegadas(); };
  }
  renderOnline();
}
function fecharOnline() { document.getElementById('online').classList.remove('on'); document.body.classList.remove('garagem'); }
function avisoOnline(t) { const m = document.querySelector('#online .g-msg'); if (m) { m.textContent = t; m.hidden = false; setTimeout(() => (m.hidden = true), 2200); } }

function renderOnline() {
  const el = document.getElementById('online'); if (!el || !el.classList.contains('on')) { atualizarChip(); return; }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let corpo;
  if (online.conectado) {
    const lista = [{ nome: (lerNome() || 'VOCÊ').toUpperCase() + ' (você)', carro: carroId }, ...online.lista()];
    corpo = `<p class="g-txt">Sala <b class="on-codigo">${esc(online.sala)}</b>${online.sala === 'PEBAS' ? ' (aberta)' : ' · passe o código pros amigos'} · ${lista.length} de 8${online.lat ? ` · ping ${online.lat} ms` : ''}</p>
      <div class="g-lista rolavel">${lista.map(j => `<div class="g-item"><div><b>${esc(j.nome)}</b><small>${esc(fichaDe(j.carro).nome)}</small></div></div>`).join('')}
      <div class="g-grupo"><b>Chamar racha (todo mundo da sala larga junto em 6 s)</b><div class="on-rotas">${Object.entries(NOMES_ROTA).map(([id, n]) => `<button data-on="racha" data-rota="${id}">${n}</button>`).join('')}</div></div></div>
      <button class="bt forte" data-on="livre">Rodar junto pelo bairro</button>
      <button class="bt" data-on="sair">Sair da sala</button>`;
  } else if (online.on) {
    corpo = `<p class="g-txt">Entrando na sala ${esc(online.sala)}…</p><button class="bt" data-on="sair">Cancelar</button>`;
  } else {
    corpo = `<label class="on-campo">Seu apelido<input id="on-nome" maxlength="12" autocomplete="off" placeholder="PILOTO" value="${esc(lerNome())}"></label>
      <button class="bt forte" data-on="aberta">Sala aberta de Parauapebas<small>Entra quem estiver online agora</small></button>
      <button class="bt forte2" data-on="criar">Criar sala com amigos<small>Gera um código pra passar pra galera</small></button>
      <div class="on-linha"><input id="on-codigo" maxlength="8" autocomplete="off" placeholder="CÓDIGO"><button class="bt" data-on="codigo">Entrar</button></div>
      <p class="g-txt">Sem cadastro. Os outros veem seu apelido, seu carro e onde você está no mapa. Nada fica salvo.</p>`;
  }
  el.innerHTML = `<div class="g-topo"><div><small>Multiplayer</small><b>ONLINE</b></div><button data-on="fechar" aria-label="Fechar">✕</button></div>${corpo}<div class="g-msg" hidden></div>`;
  atualizarChip();
}
function atualizarChip() {
  const chip = document.getElementById('online-chip'); if (!chip) return;
  chip.classList.toggle('on', online.conectado);
  if (online.conectado) chip.textContent = `ONLINE · ${online.sala} · ${online.outros.size + 1}`;
}

// racha online: vai pro grid e espera a hora marcada pelo servidor
function prepararRachaOnline(m) {
  const vaga = m.vagas.indexOf(online.id);
  if (vaga < 0) { hud.aviso(`Racha na sala: ${NOMES_ROTA[m.rota] || ''}. Fica pro próximo!`, 2.5); return; }
  fecharOnline(); document.getElementById('carreira').classList.remove('on'); document.getElementById('garagem').classList.remove('on');
  document.getElementById('menu').classList.remove('on'); document.getElementById('fim').classList.remove('on');
  document.body.classList.add('jogando');
  som.iniciar();
  racha.parar(); arrancada.parar(); provaAtual = null;
  racha = m.rota === 'principal' ? rachas.principal : obterRacha(m.rota);
  rival.racha = racha;
  transito.ligar(false); policia.ligar(false);       // racha online: pista limpa, igual para todos
  // grid: duas colunas, 7 m entre as filas
  const L = racha.largada(), ang = L.jogador.ang, f = [Math.sin(ang), Math.cos(ang)];
  const col = vaga % 2 === 0 ? L.jogador : L.rival, fila = Math.floor(vaga / 2) * 7;
  carro.reset(col.x - f[0] * fila, col.z - f[1] * fila, ang); carro.nitro = 1; carro.avaria = 0;
  modo = 'racha'; controles.travado = true;
  esperaOnline = m; rachaOnline = m; chegadasOnline = [];
  posicionarCamera(1, true);
}
function largarOnline() {
  const m = esperaOnline; esperaOnline = null;
  racha.iniciar(hud, controles, (r) => {
    modo = 'livre';
    online.chegou(r.segundos);
    rachaOnline = Object.assign({}, rachaOnline, { meuTempo: r.segundos });
    mostrarChegadas(true);
  }, { premio: [0, 0] });
}
function mostrarChegadas(abrir) {
  const fim = document.getElementById('fim');
  if (!rachaOnline || !rachaOnline.meuTempo) return;
  const total = rachaOnline.vagas.length;
  const lista = chegadasOnline.length ? chegadasOnline : [{ id: online.id, nome: lerNome() || 'VOCÊ', tempo: rachaOnline.meuTempo }];
  const minha = lista.findIndex(c => c.id === online.id);
  document.getElementById('fim-titulo').textContent = minha === 0 ? 'Você ganhou o racha online!' : minha > 0 ? `Você chegou em ${minha + 1}º` : 'Chegada';
  document.getElementById('fim-tempo').textContent = fmtT(rachaOnline.meuTempo);
  document.getElementById('fim-recorde').textContent = lista.slice(0, 5).map((c, i) => `${i + 1}º ${c.nome} ${fmtT(c.tempo)}`).join(' · ');
  document.getElementById('fim-dist').textContent = lista.length < total ? `Esperando ${total - lista.length} chegar…` : NOMES_ROTA[rachaOnline.rota] || '';
  document.getElementById('fim-grana').textContent = '';
  const [b1, b2] = document.querySelectorAll('#fim [data-acao]');
  b1.dataset.acao = 'online'; b1.textContent = 'Sala online';
  b2.dataset.acao = 'livre'; b2.textContent = 'Rodar livre';
  if (abrir) { document.getElementById('aviso').classList.remove('on'); fim.classList.add('on'); }
}
// posição no racha online (pelo quanto cada um já andou na rota)
function posicaoOnline() {
  const el = document.getElementById('posicao'); if (!el) return;
  const eu = racha.sJogador || 0;
  const outros = online.lista().filter(o => rachaOnline.vagas.includes(o.id));
  const chegaram = new Set(chegadasOnline.map(c => c.id));
  const frente = rachaOnline.vagas.filter(id => id !== online.id && (chegaram.has(id) || (outros.find(o => o.id === id) || { s: -1 }).s > eu)).length;
  const pos = Math.min(rachaOnline.vagas.length, frente + 1);
  el.classList.add('on'); el.classList.toggle('atras', pos > 1);
  el.textContent = `${pos}º de ${rachaOnline.vagas.length} · online`;
}

function enquadrado(nivel) {
  if (fugaCarreira(false)) return;
  let g = 0; try { g = parseInt(localStorage.getItem('racha-grana')) || 0; } catch {}
  const multa = Math.min(g, 100 * nivel);
  try { localStorage.setItem('racha-grana', String(g - multa)); } catch {}
  som.sirene(0);
  if (falhouCarreira(multa ? `Enquadrado: multa de R$ ${multa}` : 'Enquadrado pela polícia')) { mostrarGrana(); return; }
  if (racha.ativo) racha.parar();
  carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang); carro.avaria = 0;
  modo = 'livre';
  hud.aviso(multa ? `ENQUADRADO! Multa de R$ ${multa}` : 'ENQUADRADO! Liberado com advertência', 3);
  mostrarGrana();
}
function despistou(nivel) {
  if (fugaCarreira(true)) return;
  let g = 0; try { g = parseInt(localStorage.getItem('racha-grana')) || 0; } catch {}
  const bonus = 60 * nivel;
  try { localStorage.setItem('racha-grana', String(g + bonus)); } catch {}
  som.sirene(0);
  hud.aviso(`DESPISTOU! +R$ ${bonus}`, 2.5);
  mostrarGrana();
}

function mostrarGrana() {
  let g = 0; try { g = parseInt(localStorage.getItem('racha-grana')) || 0; } catch {}
  const el = document.getElementById('grana'); if (el) el.textContent = g ? `Caixa da garagem: R$ ${g}` : '';
}

const alvoCam = new THREE.Vector3(), olharCam = new THREE.Vector3(), olharSuave = new THREE.Vector3();
function posicionarCamera(dt, instantaneo) {
  const c = CAMS[camModo];
  const porDentro = !!c.dentro && modo !== 'menu';
  for (const m of vidros) m.opacity = porDentro ? 0.12 : m.userData.opacidade;
  const f = new THREE.Vector3(Math.sin(carro.ang), 0, Math.cos(carro.ang));
  if (modo === 'garagem') {
    if (!arrastando) garagemAng += dt * 0.18;
    const emPe = innerHeight > innerWidth;                    // em pé o painel cobre a metade de baixo: câmera mais longe e alta
    const kL = Math.max(1, carro.ficha.L / 3.7), r = (emPe ? 7.5 : 5.0) * kL, alt = emPe ? 2.6 : 1.55;
    alvoCam.set(carro.pos.x + Math.sin(carro.ang + garagemAng) * r, alt, carro.pos.z + Math.cos(carro.ang + garagemAng) * r);
    const dx = carro.pos.x - alvoCam.x, dz = carro.pos.z - alvoCam.z, L = Math.hypot(dx, dz) || 1;
    const painelDireita = innerWidth > innerHeight;            // deitado: painel à direita; em pé: painel embaixo
    olharCam.set(carro.pos.x + (painelDireita ? -dz / L * 1.5 : 0), painelDireita ? 0.75 : -2.2, carro.pos.z + (painelDireita ? dx / L * 1.5 : 0));
  } else if (modo === 'menu') {
    // giro lento em volta do carro, mostrando a fachada da Lock-Up
    const t = performance.now() / 1000 * 0.12;
    alvoCam.set(carro.pos.x + Math.sin(carro.ang + 0.9 + Math.sin(t) * 0.5) * 9, 2.2, carro.pos.z + Math.cos(carro.ang + 0.9 + Math.sin(t) * 0.5) * 9);
    olharCam.set(carro.pos.x, 1.0, carro.pos.z);
  } else if (c.dentro) {
    const e = new THREE.Vector3(Math.cos(carro.ang), 0, -Math.sin(carro.ang));
    alvoCam.copy(carro.pos).addScaledVector(f, c.d).addScaledVector(e, 0.33); alvoCam.y = c.h;
    olharCam.copy(alvoCam).addScaledVector(f, 10); olharCam.y = c.h - 0.2;
    instantaneo = true;
  } else {
    // a câmera segue a direção do movimento, um pouco atrasada
    alvoCam.copy(carro.pos).addScaledVector(f, -c.d); alvoCam.y = carro.pos.y + c.h;
    olharCam.copy(carro.pos).addScaledVector(f, 2.5); olharCam.y = c.olhar;
  }
  const k = instantaneo ? 1 : 1 - Math.exp(-dt * (modo === 'menu' ? 2 : 7));
  camera.position.lerp(alvoCam, k);
  olharSuave.lerp(olharCam, instantaneo ? 1 : 1 - Math.exp(-dt * 12));
  // evita a câmera entrar nos prédios
  if (!c.dentro && mundo) {
    const p = { x: camera.position.x, z: camera.position.z };
    if (mundo.colidir(p, 0.4)) { camera.position.x = p.x; camera.position.z = p.z; }
  }
  if (carro.nitroAtivo && !c.dentro) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0));
  if (carro.choque > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(carro.choque * 0.25));
  camera.lookAt(olharSuave);
  // tela larga (celular deitado) com o mesmo ângulo vertical deixava o carro miúdo: fecha o ângulo
  const largura = Math.min(1, Math.max(0, (camera.aspect - 1.5) / 0.7));
  const fov = (c.dentro ? 70 : 60) - largura * 10 + Math.min(12, carro.kmh / 14) + (carro.nitroAtivo ? 11 : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * (carro.nitroAtivo ? 7 : 3)); camera.updateProjectionMatrix(); }
}

let ultimo = 0, acc = 0, choqueAntes = 0, fpsT = 0, fpsN = 0, nitroAntes = false, chipN = 0;
const PASSO = 1 / 120;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
  if (document.hidden) return;
  const inp = modo === 'menu' ? { acel: 0, freio: 0, dir: 0, mao: false } : controles.ler(dt, carro.kmh);
  if (modo === 'arrancada') {
    // arrancada: a física em linha fica em arrancada.js (posiciona os dois carros)
    arrancada.update(dt, inp);
    if (carro.nitroAtivo !== nitroAntes) { nitroAntes = carro.nitroAtivo; document.body.classList.toggle('nitro', nitroAntes); }
    hud.update(dt, carro, null);
    som.update(carro, inp.acel);
  } else if (modo !== 'menu' && modo !== 'garagem') {
    acc += dt;
    if (esperaOnline) {
      const falta = esperaOnline.inicio - online.agoraServidor;
      if (falta <= 3500) largarOnline();
      else { const s2 = Math.ceil((falta - 3500) / 1000); if (s2 !== esperaOnline.aviso) { esperaOnline.aviso = s2; hud.aviso(`Racha online: ${NOMES_ROTA[esperaOnline.rota] || ''} · ${s2}`, 1.05); } }
    }
    const amigos = online.carros();
    const rInp = rival.ativo ? rival.pensar(dt, racha.sJogador || 0, racha.largando) : null;
    policia.pensar(dt, carro, { racha: racha.ativo && !racha.largando, hud });
    const viaturas = policia.v.filter(p => p.modo !== 'fora');
    transito.update(dt, [carro, rival.ativo ? rival.carro : null, ...viaturas.map(p => p.carro)]);
    while (acc >= PASSO) {
      carro.update(PASSO, inp, mundo);
      if (rInp) { rival.carro.update(PASSO, rInp, mundo); colisaoCarros(carro, rival.carro); if (transito.ativo) transito.colidir(rival.carro); }
      for (const p of viaturas) {
        p.carro.update(PASSO, p.inp, mundo);
        if (colisaoCarros(carro, p.carro) > 0.2) policia.infracao('bateuPolicia');
        if (transito.ativo) transito.colidir(p.carro);
      }
      if (transito.ativo) { const b = transito.colidir(carro); if (b) policia.infracao('bateuTransito'); }
      for (const o of amigos) colisaoCarros(carro, o);
      acc -= PASSO;
    }
    if (policia.perseguindo) { const d = policia.dmin || 999; som.sirene(1 - d / 160); } else som.sirene(0);
    if (carro.nitroAtivo !== nitroAntes) { nitroAntes = carro.nitroAtivo; document.body.classList.toggle('nitro', nitroAntes); }
    if (carro.evento === 'canteiro') {
      hud.aviso(carro.avaria >= 2 ? 'Foi a junta homocinética! (R conserta)' : 'Pancada no canteiro! Suspensão avariada', 2.6);
      carro.evento = null;
    }
    if (carro.choque > choqueAntes + 0.15) som.batida(carro.choque);
    choqueAntes = carro.choque;
    racha.camDentro = !!CAMS[camModo].dentro;
    racha.update(dt, carro, inp);
    hud.policia = policia.ativo ? viaturas.map(p => p.carro.pos) : null;
    hud.amigos = amigos.length ? amigos.map(c => c.pos) : null;
    if (rachaOnline && racha.ativo) posicaoOnline();
    hud.update(dt, carro, racha.ativo ? racha.infoMapa() : null);
    som.update(carro, inp.acel);
  } else carro.atualizarModelo(dt);   // menu e garagem: carro parado
  if (online.on) {
    online.update(dt);
    if (modo !== 'menu') online.enviar(carro, racha.ativo ? racha.sJogador : 0);
    if (++chipN % 60 === 0) atualizarChip();
  }
  posicionarCamera(dt);
  renderer.render(scene, camera);
  fpsN++; fpsT += dt; if (fpsT > 1) { window._fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
}

// garagem: arrastar na tela gira a câmera em volta do carro
renderer.domElement.addEventListener('pointerdown', e => { if (modo === 'garagem') arrastando = { x: e.clientX, a: garagemAng }; });
addEventListener('pointermove', e => { if (arrastando && modo === 'garagem') garagemAng = arrastando.a - (e.clientX - arrastando.x) * 0.012; });
addEventListener('pointerup', () => { arrastando = null; });
addEventListener('pointercancel', () => { arrastando = null; });

function redimensionar() {
  const [w, h] = tamanho();
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
addEventListener('orientationchange', () => setTimeout(redimensionar, 300));
// se mesmo assim o celular der zoom (o Safari ignora user-scalable=no), reescreve o viewport, que volta ao normal
const metaVp = document.querySelector('meta[name=viewport]');
if (window.visualViewport) visualViewport.addEventListener('resize', () => {
  if (visualViewport.scale > 1.02) {
    const c = metaVp.content; metaVp.content = c + ', minimum-scale=1';
    setTimeout(() => { metaVp.content = c; }, 50);
  }
});
// no celular, tela cheia e deitado (Android; no iPhone o Safari não deixa, aí vale o aviso de girar)
function telaCheia() {
  if (!celular || document.fullscreenElement) return;
  const el = document.documentElement;
  const pedir = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!pedir) return;
  try {
    Promise.resolve(pedir.call(el, { navigationUI: 'hide' }))
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.hidden && som) som.pausar(); else if (som && modo !== 'menu') som.iniciar(); });

iniciar().catch(e => { console.error(e); progresso(0, 'Não deu para carregar: ' + e.message); });
window._jogo = () => ({ carro, mundo, camera, scene, renderer, racha, controles, rival, arrancada, garagem, transito, policia, rede, online, carreira });
// teste sem a aba visível: simula N segundos com uma entrada fixa e desenha um quadro
window._simular = (seg, inp = {}) => {
  const e = { acel: 0, freio: 0, dir: 0, mao: false, ...inp };
  for (let t = 0; t < seg; t += PASSO) {
    carro.update(PASSO, e, mundo);
    if (rival.ativo) { rival.carro.update(PASSO, rival.pensar(PASSO, racha.sJogador || 0, racha.largando), mundo); colisaoCarros(carro, rival.carro); }
    racha.update(PASSO, carro, e); posicionarCamera(PASSO);
  }
  hud.update(0.016, carro, racha.ativo ? racha.infoMapa() : null);
  if (inp.cam) {   // [lado, altura, frente] em relação ao carro
    const f = new THREE.Vector3(Math.sin(carro.ang), 0, Math.cos(carro.ang)), l = new THREE.Vector3(Math.cos(carro.ang), 0, -Math.sin(carro.ang));
    camera.position.copy(carro.pos).addScaledVector(l, inp.cam[0]).addScaledVector(f, inp.cam[2]); camera.position.y = inp.cam[1];
    camera.lookAt(carro.pos.x, 0.7, carro.pos.z);
  }
  renderer.render(scene, camera);
  return { kmh: Math.round(carro.kmh), x: +carro.pos.x.toFixed(1), z: +carro.pos.z.toFixed(1), rua: carro.rua && carro.rua.n, tris: renderer.info.render.triangles, calls: renderer.info.render.calls };
};
// teste com a aba escondida (o navegador para o requestAnimationFrame): roda um quadro do jogo na mão
window._quadro = () => loop(performance.now());
