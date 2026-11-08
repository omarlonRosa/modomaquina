// Construções no estilo do Parque dos Carajás:
// - galpões comerciais na rodovia e nas avenidas, com platibanda, letreiro aceso,
//   porta de enrolar e pátio na frente (auto peças, ferramentas, máquinas, oficinas...)
// - casas novas tipo "caixote": fachada reta na calçada, platibanda escondendo o telhado,
//   portão de garagem (branco, cinza-grafite ou de grade), porta, janela alta e arandela acesa
//   (o que mais aparece nos vídeos das ruas em volta da Lock-Up)
// - casas antigas com muro e portão na frente e telhado de duas águas (cerâmica ou fibrocimento)
// - terrenos baldios com muro de tijolo aparente ou rebocado
// Os nomes dos letreiros são genéricos, não são lojas reais.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LETREIROS = [
  ['AUTO PEÇAS', '#c81e1e', '#ffffff'], ['FERRAMENTAS', '#1d4fa8', '#ffd21f'], ['MÁQUINAS E EQUIPAMENTOS', '#f0c419', '#1a1a1a'],
  ['PNEUS', '#111111', '#ffcc00'], ['OFICINA MECÂNICA', '#0f7a3c', '#ffffff'], ['BATERIAS', '#e85d0c', '#ffffff'],
  ['PEÇAS P/ CAMINHÃO', '#1a1a1a', '#ff3b30'], ['LUBRIFICANTES', '#0a6dbf', '#ffffff'], ['TORNEARIA E SOLDA', '#4a4f57', '#ffb000'],
  ['MATERIAL DE CONSTRUÇÃO', '#d62a1f', '#ffe14d'], ['ROLAMENTOS', '#20305a', '#ffffff'], ['RETÍFICA', '#7a1414', '#ffffff'],
  ['HIDRÁULICA', '#0b8f8f', '#ffffff'], ['ELETRO DIESEL', '#f7f7f7', '#c0161c'], ['MOTOPEÇAS', '#ffd400', '#111111'],
  ['CAMBIO & EMBREAGEM', '#262626', '#ff7a1a'],
];
const N = LETREIROS.length;

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function texLetreiros() {
  return tex(1024, N * 96, (g, w) => {
    LETREIROS.forEach(([txt, fundo, cor], i) => {
      const y = i * 96;
      g.fillStyle = fundo; g.fillRect(0, y, w, 96);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y + 6, w, 4); g.fillRect(0, y + 86, w, 4);
      g.fillStyle = cor; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 64; g.font = `italic 900 ${size}px "Arial Black", Impact, sans-serif`;
      while (g.measureText(txt).width > w - 60 && size > 30) { size -= 2; g.font = `italic 900 ${size}px "Arial Black", Impact, sans-serif`; }
      g.fillText(txt, w / 2, y + 50);
    });
  });
}

// metade esquerda: porta de enrolar fechada; metade direita: aberta com o salão aceso
function texPortas() {
  return tex(512, 256, (g) => {
    g.fillStyle = '#9ea2a6'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 8) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, y, 256, 2); }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, 256, 14);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#2c2a26'); gr.addColorStop(1, '#5a5348');
    g.fillStyle = gr; g.fillRect(256, 0, 256, 256);
    g.fillStyle = '#fff3d6'; for (const x of [300, 380, 460]) g.fillRect(x, 18, 30, 6);
    g.fillStyle = 'rgba(30,30,30,0.9)'; g.fillRect(290, 120, 70, 136); g.fillRect(400, 150, 90, 106);   // estantes / balcão
    g.fillStyle = '#c63'; g.fillRect(296, 130, 58, 10); g.fillRect(296, 160, 58, 10); g.fillRect(406, 160, 78, 10);
  });
}
function texPortasLuz() {
  return tex(512, 256, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,230,190,0.55)'; g.fillRect(256, 0, 256, 256);
    g.fillStyle = '#fff3d6'; for (const x of [300, 380, 460]) g.fillRect(x, 18, 30, 6);
  });
}

function quadVoltado(cx, cz, y, larg, alt, ang, u0, u1, v0, v1, recuo) {
  const g = new THREE.PlaneGeometry(larg, alt);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i));
  g.rotateY(ang); g.translate(cx + Math.sin(ang) * recuo, y, cz + Math.cos(ang) * recuo);
  return g;
}

function caixaVoltada(cx, cz, y, larg, alt, prof, ang, cor) {
  const g = new THREE.BoxGeometry(larg, alt, prof).toNonIndexed();
  g.deleteAttribute('uv');
  const c = new THREE.Color(cor), arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.rotateY(ang); g.translate(cx, y, cz);
  return g;
}

export function construirGalpoes(lista, grupo, rnd) {
  if (!lista.length) return;
  const placas = [], portas = [], solidos = [];
  for (const b of lista) {
    const [a, c] = [b.p[0], b.p[1]];                       // frente
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    const ang = Math.atan2(b.f[0], b.f[1]);                  // +z local olhando para a rua
    const row = Math.floor(rnd() * N);
    // platibanda: sobe acima do telhado e leva o letreiro
    solidos.push(caixaVoltada(mx + b.f[0] * 0.15, mz + b.f[1] * 0.15, b.h + 0.1, L + 0.3, 2.2, 0.3, ang, b.corPlat));
    placas.push(quadVoltado(mx, mz, b.h + 0.15, L * 0.9, 1.5, ang, 0, 1, 1 - (row + 1) / N + 0.004, 1 - row / N - 0.004, 0.32));
    // portas de enrolar (1 a 3), algumas abertas
    const nP = Math.max(1, Math.min(3, Math.floor(L / 6.5)));
    for (let i = 0; i < nP; i++) {
      const off = (i - (nP - 1) / 2) * (L / nP);
      const px = mx + Math.cos(ang) * off, pz = mz - Math.sin(ang) * off;
      const aberta = rnd() < 0.45;
      portas.push(quadVoltado(px, pz, 2.1, Math.min(4.6, L / nP - 1), 4.2, ang, aberta ? 0.5 : 0, aberta ? 1 : 0.5, 0, 1, 0.06));
    }
    // pátio na frente (concreto ou terra batida)
    const pat = b.patio;
    if (pat > 0.5) {
      const g = new THREE.PlaneGeometry(L, pat).rotateX(-Math.PI / 2);
      g.translate(0, 0.03, pat / 2); g.rotateY(ang); g.translate(mx, 0, mz);
      g.deleteAttribute('uv');
      const cor = new THREE.Color(rnd() < 0.55 ? 0x8a8780 : 0x8a4a2c), arr = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < arr.length; i += 3) { arr[i] = cor.r; arr[i + 1] = cor.g; arr[i + 2] = cor.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      g.toNonIndexed && solidos.push(g.toNonIndexed());
    }
  }
  const tl = texLetreiros();
  grupo.add(new THREE.Mesh(mergeGeometries(placas), new THREE.MeshStandardMaterial({ map: tl, emissiveMap: tl, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.6 })));
  const tp = texPortas();
  grupo.add(new THREE.Mesh(mergeGeometries(portas), new THREE.MeshStandardMaterial({ map: tp, emissiveMap: texPortasLuz(), emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.7 })));
  grupo.add(new THREE.Mesh(mergeGeometries(solidos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
}

// Fachadas das casas-caixote: atlas 4x2 (linha de cima = térreo, de baixo = andar de cima).
// Fundo transparente (alphaTest): a cor da parede vem da caixa atrás.
function texFachadasCasa(luz) {
  return tex(1024, 512, (g) => {
    const S = 256;
    const ret = (c, x, y, w, h, cor) => { g.fillStyle = cor; g.fillRect(c * S + x * S, y, w * S, h); };
    const portaoLiso = (c, x, w, cor, linhas) => {
      ret(c, x, 64, w, 192, cor);
      g.fillStyle = linhas; for (let y = 70; y < 256; y += 12) g.fillRect(c * S + x * S, y, w * S, 2);
      ret(c, x - 0.01, 58, w + 0.02, 6, '#2a2c2f');
    };
    const porta = (c, x) => { ret(c, x, 92, 0.085, 164, luz ? '#000' : '#3b3530'); if (!luz) ret(c, x + 0.068, 170, 0.008, 18, '#c9c3b8'); };
    const janelaAlta = (c, x, w, acesa) => {
      if (luz) { ret(c, x, 70, w, 40, acesa ? '#ffcf8a' : '#000'); return; }
      ret(c, x - 0.006, 66, w + 0.012, 48, '#e9e9e6'); ret(c, x, 70, w, 40, '#1d2328');
    };
    const arandela = (c, x) => { ret(c, x, 40, 0.02, 16, luz ? '#ffe0a8' : '#fff3d6'); };
    // térreo 0: portão branco, porta de madeira, janela alta
    if (!luz) portaoLiso(0, 0.07, 0.42, '#eceae6', 'rgba(0,0,0,0.12)'); porta(0, 0.62); janelaAlta(0, 0.76, 0.17, true); arandela(0, 0.55);
    // térreo 1: portão grafite, painel ripado, porta
    if (!luz) { portaoLiso(1, 0.08, 0.44, '#3a3d41', 'rgba(255,255,255,0.08)');
      ret(1, 0.6, 20, 0.16, 236, '#7a5638'); for (let k = 0; k < 9; k++) ret(1, 0.605 + k * 0.017, 20, 0.006, 236, '#5b3f28'); }
    porta(1, 0.8); arandela(1, 0.56);
    // térreo 2: bloco grafite do lado, portão branco, janela
    if (!luz) { ret(2, 0, 0, 0.3, 256, '#55595e'); portaoLiso(2, 0.36, 0.4, '#f0eeea', 'rgba(0,0,0,0.12)'); }
    porta(2, 0.1); janelaAlta(2, 0.82, 0.13, false); arandela(2, 0.79);
    // térreo 3: portão de grade preto (vê o carro escuro atrás), portãozinho
    if (!luz) {
      ret(3, 0.06, 72, 0.5, 184, '#2a2b2d');
      ret(3, 0.06, 64, 0.5, 8, '#111'); for (let k = 0; k < 26; k++) ret(3, 0.07 + k * 0.019, 72, 0.006, 184, '#0e0e0f');
      ret(3, 0.64, 80, 0.14, 176, '#1a1b1c'); for (let k = 0; k < 7; k++) ret(3, 0.645 + k * 0.02, 80, 0.006, 176, '#050505');
    }
    janelaAlta(3, 0.84, 0.1, false); arandela(3, 0.6);
    // andar de cima (linha de baixo do atlas, y 256..512)
    const y0 = 256;
    const janela = (c, x, w, acesa, sacada) => {
      if (luz) { ret(c, x, y0 + 70, w, 110, acesa ? '#ffd39a' : '#000'); return; }
      ret(c, x - 0.008, y0 + 64, w + 0.016, 122, '#e9e9e6'); ret(c, x, y0 + 70, w, 110, '#1b2227');
      if (sacada) { ret(c, x - 0.02, y0 + 140, w + 0.04, 60, 'rgba(160,200,215,0.95)'); ret(c, x - 0.02, y0 + 138, w + 0.04, 4, '#cfd5d8'); }
    };
    janela(0, 0.12, 0.25, true, false); janela(0, 0.6, 0.25, false, false);
    if (!luz) ret(1, 0, y0, 0.45, 256, '#4d5156'); janela(1, 0.55, 0.32, true, true);
    janela(2, 0.3, 0.42, false, true);
    if (!luz) ret(3, 0.55, y0, 0.45, 256, '#8b6a4c'); janela(3, 0.1, 0.18, true, false); janela(3, 0.65, 0.18, false, false);
  });
}

export function construirCasas(lista, terrenos, grupo, mundo, rnd) {
  // casas-caixote: só a fachada da frente (as paredes e o topo vêm de paredes() em mundo.js)
  const caixas = lista.filter(b => b.estilo === 'caixa');
  if (caixas.length) {
    const quads = [];
    for (const b of caixas) {
      const [a, c] = [b.p[0], b.p[1]];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ang = Math.atan2(b.f[0], b.f[1]);
      const terreo = Math.min(b.h, 3.6);
      let u0 = b.modelo / 4 + 0.002, u1 = (b.modelo + 1) / 4 - 0.002;
      if (b.espelho && b.modelo !== 1) [u0, u1] = [u1, u0];
      quads.push(quadVoltado(mx, mz, terreo / 2, L, terreo, ang, u0, u1, 0.5, 1, 0.04));
      if (b.h > 5) {
        const uc0 = b.cima / 4 + 0.002, uc1 = (b.cima + 1) / 4 - 0.002;
        quads.push(quadVoltado(mx, mz, terreo + (b.h - terreo) / 2, L, b.h - terreo, ang, uc0, uc1, 0, 0.5, 0.04));
      }
    }
    grupo.add(new THREE.Mesh(mergeGeometries(quads), new THREE.MeshStandardMaterial({
      map: texFachadasCasa(false), emissiveMap: texFachadasCasa(true), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.8, alphaTest: 0.5,
    })));
  }
  // terrenos baldios murados
  if (terrenos && terrenos.length) {
    const ms = [];
    for (const t of terrenos) {
      const [a, c] = t.muro, L = Math.hypot(c[0] - a[0], c[1] - a[1]), ang = Math.atan2(t.f[0], t.f[1]);
      ms.push(caixaVoltada((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 1.0, L, 2.0, 0.2, ang, t.tijolo ? 0xa4583a : 0xb9b3a8));
      mundo.addSeg(a[0], a[1], c[0], c[1]);
    }
    grupo.add(new THREE.Mesh(mergeGeometries(ms), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  }
  lista = lista.filter(b => b.estilo !== 'caixa');
  if (!lista.length) return;
  const muros = [], telhados = [];
  const CORES_MURO = [0xd8d2c4, 0xc9b79a, 0xe6dfcf, 0xa8a39a, 0xb06a45, 0xd9c08a];
  const tCol = new THREE.Color();
  const tp = [], tc = [], ti = [];
  let v = 0;
  for (const b of lista) {
    // muro com portão de chapa
    if (b.muro) {
      const [a, c] = b.muro;
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]), ang = Math.atan2(b.f[0], b.f[1]);
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      muros.push(caixaVoltada(mx, mz, 1.1, L, 2.2, 0.18, ang, CORES_MURO[Math.floor(rnd() * CORES_MURO.length)]));
      const off = (rnd() - 0.5) * (L - 3.6);
      muros.push(caixaVoltada(mx + Math.cos(ang) * off + b.f[0] * 0.1, mz - Math.sin(ang) * off + b.f[1] * 0.1, 1.05, 3.0, 2.1, 0.06, ang, rnd() < 0.5 ? 0x2b2d30 : 0x6d7178));
      mundo.addSeg(a[0], a[1], c[0], c[1]);
    }
    // telhado de duas águas, cumeeira paralela à rua
    const [p0, p1, p2, p3] = b.p, h = b.h, sobe = 1.0 + rnd() * 0.6;
    const m03 = [(p0[0] + p3[0]) / 2, (p0[1] + p3[1]) / 2], m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    tCol.set(rnd() < 0.62 ? (rnd() < 0.5 ? 0x8c3b22 : 0xa04a2a) : 0x87847d);
    const P = [[p0[0], h, p0[1]], [p1[0], h, p1[1]], [m12[0], h + sobe, m12[1]], [m03[0], h + sobe, m03[1]],   // água da frente
               [p3[0], h, p3[1]], [p2[0], h, p2[1]]];                                                       // fundo
    for (const q of P) { tp.push(...q); tc.push(tCol.r, tCol.g, tCol.b); }
    ti.push(v, v + 1, v + 2, v, v + 2, v + 3,      // frente
            v + 4, v + 3, v + 2, v + 4, v + 2, v + 5,  // fundo
            v, v + 3, v + 4, v + 1, v + 5, v + 2);     // oitões
    v += 6;
  }
  if (muros.length) grupo.add(new THREE.Mesh(mergeGeometries(muros), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
  g.setIndex(ti); g.computeVertexNormals();
  grupo.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true })));
}
