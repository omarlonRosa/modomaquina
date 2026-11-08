import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Mundo } from './mundo.js';
import { criarLockup, areaLivre } from './lockup.js';
import { criarMarcos, areasMarcos } from './marcos.js';
import { Carro, Som } from './carro.js';
import { Controles } from './controles.js';
import { Hud } from './hud.js';
import { Racha } from './racha.js';

const celular = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('toque', celular);

const carregando = document.getElementById('carregando');
const barra = document.getElementById('barra');
const progresso = (f, txt) => { barra.style.width = Math.round(f * 100) + '%'; if (txt) carregando.querySelector('p').textContent = txt; };

const renderer = new THREE.WebGLRenderer({ antialias: !celular, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, celular ? 1.5 : 2));
// tamanho pela área da página e não pela janela visível: se o navegador der zoom, o jogo não encolhe
const tamanho = () => [document.documentElement.clientWidth || innerWidth, document.documentElement.clientHeight || innerHeight];
renderer.setSize(...tamanho());
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

let mundo, carro, hud, racha, lockup, som, controles;
let modo = 'menu', camModo = 0, vidros = [];
const CAMS = [{ d: 6.4, h: 2.3, olhar: 1.0 }, { d: 10, h: 4.2, olhar: 1.2 }, { d: -0.35, h: 1.12, olhar: 1.0, dentro: true }];

async function iniciar() {
  progresso(0.02, 'Baixando o mapa de Parauapebas…');
  const mapa = JSON.parse(new TextDecoder().decode(await baixar('dados/mapa.json', 0.1, 0)));
  progresso(0.1, 'Trazendo o Uno da garagem…');
  const glb = await baixar('modelos/uno-hoje.glb', 0.75, 0.1);
  progresso(0.86, 'Montando a cidade…');
  await new Promise(r => setTimeout(r, 30));
  mundo = new Mundo(mapa, scene, { areaLivre: areaLivre(mapa.lockup), poucosPostes: celular, ocupados: areasMarcos(mapa.lockup) });
  lockup = criarLockup(mapa.lockup, mundo, scene);
  criarMarcos(mapa.lockup, mundo, scene);
  // texturas como <img> (blob: liberado em img-src) e não por fetch, que a CSP do site bloqueia em connect-src
  const loader = new GLTFLoader().register(parser => { parser.textureLoader = new THREE.TextureLoader(parser.options.manager); return { name: 'texturas_por_img' }; });
  const gltf = await loader.parseAsync(glb, '');
  carro = new Carro(gltf, scene);
  // vidros: o insulfilm do modelo (quase preto) deixa a visão do motorista toda escura; por dentro ficam claros
  vidros = [];
  carro.grupo.traverse(o => { if (o.isMesh && o.material && o.material.name === 'glass') vidros.push(o.material); });
  for (const m of vidros) m.userData.opacidade = m.opacity;
  controles = new Controles();
  hud = new Hud(mapa, mapa.lockup, mundo.lotes.concat(areasMarcos(mapa.lockup).slice(0, 2).map(p => ({ p }))));
  racha = new Racha(mapa.racha, scene, mundo);
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
  const jogar = (tipo) => {
    telaCheia();
    som.iniciar();
    menu.classList.remove('on'); fim.classList.remove('on');
    document.body.classList.add('jogando');
    carro.reset(lockup.inicio.x, lockup.inicio.z, lockup.inicio.ang);
    if (tipo === 'racha') {
      modo = 'racha';
      racha.iniciar(hud, controles, (r) => {
        modo = 'livre';
        document.getElementById('fim-tempo').textContent = r.tempo;
        document.getElementById('fim-recorde').textContent = r.novo ? 'Novo recorde neste aparelho!' : `Seu recorde: ${r.recorde}`;
        document.getElementById('fim-dist').textContent = `${(r.metros / 1000).toFixed(1).replace('.', ',')} km saindo da Lock-Up`;
        fim.classList.add('on');
      });
    } else {
      modo = 'livre'; racha.parar();
      hud.aviso('Saindo da Lock-Up Auto Center', 3);
    }
  };
  controles.acoes = {
    livre: () => jogar('livre'),
    racha: () => jogar('racha'),
    camera: () => { camModo = (camModo + 1) % CAMS.length; },
    som: () => { som.iniciar(); som.mudo = !som.mudo; document.querySelector('[data-acao=som]').classList.toggle('mudo', som.mudo); },
    reset: () => {
      const i = mundo.infoRua(carro.pos.x, carro.pos.z, 200);
      if (i.rua) {
        let ang = i.dir; if (Math.cos(ang - carro.ang) < 0) ang += Math.PI;
        carro.reset(i.x, i.z, ang);
      }
    },
    menu: () => {
      if (modo === 'menu') return;
      racha.parar(); modo = 'menu'; som.pausar();
      document.body.classList.remove('jogando'); fim.classList.remove('on'); menu.classList.add('on');
    },
    primeiroToque: () => som.iniciar(),
  };
}

const alvoCam = new THREE.Vector3(), olharCam = new THREE.Vector3(), olharSuave = new THREE.Vector3();
function posicionarCamera(dt, instantaneo) {
  const c = CAMS[camModo];
  const porDentro = !!c.dentro && modo !== 'menu';
  for (const m of vidros) m.opacity = porDentro ? 0.12 : m.userData.opacidade;
  const f = new THREE.Vector3(Math.sin(carro.ang), 0, Math.cos(carro.ang));
  if (modo === 'menu') {
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
  if (carro.choque > 0) camera.position.add(new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).multiplyScalar(carro.choque * 0.25));
  camera.lookAt(olharSuave);
  const fov = (c.dentro ? 70 : 60) + Math.min(14, carro.kmh / 12);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
}

let ultimo = 0, acc = 0, choqueAntes = 0, fpsT = 0, fpsN = 0;
const PASSO = 1 / 120;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - ultimo) / 1000); ultimo = t;
  if (document.hidden) return;
  const inp = modo === 'menu' ? { acel: 0, freio: 0, dir: 0, mao: false } : controles.ler(dt, carro.kmh);
  if (modo !== 'menu') {
    acc += dt;
    while (acc >= PASSO) { carro.update(PASSO, inp, mundo); acc -= PASSO; }
    if (carro.choque > choqueAntes + 0.15) som.batida(carro.choque);
    choqueAntes = carro.choque;
    racha.camDentro = !!CAMS[camModo].dentro;
    racha.update(dt, carro);
    hud.update(dt, carro, racha.ativo ? racha.infoMapa() : null);
    som.update(carro, inp.acel);
  } else carro.atualizarModelo(dt);
  posicionarCamera(dt);
  renderer.render(scene, camera);
  fpsN++; fpsT += dt; if (fpsT > 1) { window._fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
}

function redimensionar() {
  const [w, h] = tamanho();
  renderer.setSize(w, h);
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
window._jogo = () => ({ carro, mundo, camera, scene, renderer, racha, controles });
// teste sem a aba visível: simula N segundos com uma entrada fixa e desenha um quadro
window._simular = (seg, inp = {}) => {
  const e = { acel: 0, freio: 0, dir: 0, mao: false, ...inp };
  for (let t = 0; t < seg; t += PASSO) { carro.update(PASSO, e, mundo); racha.update(PASSO, carro); posicionarCamera(PASSO); }
  hud.update(0.016, carro, racha.ativo ? racha.infoMapa() : null);
  if (inp.cam) {   // [lado, altura, frente] em relação ao carro
    const f = new THREE.Vector3(Math.sin(carro.ang), 0, Math.cos(carro.ang)), l = new THREE.Vector3(Math.cos(carro.ang), 0, -Math.sin(carro.ang));
    camera.position.copy(carro.pos).addScaledVector(l, inp.cam[0]).addScaledVector(f, inp.cam[2]); camera.position.y = inp.cam[1];
    camera.lookAt(carro.pos.x, 0.7, carro.pos.z);
  }
  renderer.render(scene, camera);
  return { kmh: Math.round(carro.kmh), x: +carro.pos.x.toFixed(1), z: +carro.pos.z.toFixed(1), rua: carro.rua && carro.rua.n, tris: renderer.info.render.triangles, calls: renderer.info.render.calls };
};
