// Construções no estilo do Parque dos Carajás:
// - galpões comerciais na rodovia e nas avenidas, com platibanda, letreiro aceso,
//   porta de enrolar e pátio na frente (auto peças, ferramentas, máquinas, oficinas...)
// - casas térreas com muro e portão na frente e telhado de duas águas (cerâmica ou fibrocimento)
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

export function construirCasas(lista, grupo, mundo, rnd) {
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
