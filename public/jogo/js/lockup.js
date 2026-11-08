// Lock-Up Auto Center, recriada pelas fotos: galpão de teto em arco com treliça,
// fachada preta com colunas laranja e placa grande, elevadores vermelhos de 2 colunas,
// parede do fundo preta com balcão de ripas e pátio de terra com cobertura ao lado.
// Frente local = +z (virada para a rua). Largura 16 m (x), fundo 22 m (z).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LARG = 16, FUNDO = 22, PAREDE = 6, TOPO = 8.2;
const X0 = -LARG / 2, X1 = LARG / 2, Z0 = -FUNDO / 2, Z1 = FUNDO / 2;
const PORTA = [-7.2, 2.2], ALT_PORTA = 5.3;          // vão aberto, à esquerda de quem olha da rua

const LARANJA = 0xe8541c, PRETO = 0x111214;

function placaTex() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 560;
  const g = c.getContext('2d');
  g.fillStyle = '#e8541c'; g.fillRect(0, 0, 2048, 560);
  g.fillStyle = '#16171a'; g.fillRect(28, 28, 1992, 504);
  // engrenagens estilizadas nas pontas (lembram o câmbio da placa)
  for (const cx of [270, 1780]) {
    g.save(); g.translate(cx, 280);
    g.strokeStyle = '#7d8187'; g.lineWidth = 14;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-90 + i * 60, 0, 70 - i * 8, 0, 7); g.stroke(); }
    g.fillStyle = '#5c6066'; g.fillRect(-190, -20, 380, 40);
    g.restore();
  }
  // arco de conta-giros
  g.lineWidth = 22; g.strokeStyle = '#f2f2f2'; g.beginPath(); g.arc(1110, 260, 230, Math.PI * 1.12, Math.PI * 1.55); g.stroke();
  g.strokeStyle = '#e8541c'; g.beginPath(); g.arc(1110, 260, 230, Math.PI * 1.58, Math.PI * 1.85); g.stroke();
  g.font = 'italic 900 230px "Arial Black", Impact, sans-serif'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#f4f4f4'; g.fillText('LOCK', 470, 360);
  const w = g.measureText('LOCK').width;
  g.fillStyle = '#e8541c'; g.fillText('-UP', 470 + w, 360);
  g.font = '600 74px "Arial", sans-serif'; g.fillStyle = '#f4f4f4';
  g.textAlign = 'center'; g.fillText('A U T O   C E N T E R', 1110, 470);
  g.fillStyle = '#e8541c'; g.fillRect(620, 440, 120, 12); g.fillRect(1480, 440, 120, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function caixa(w, h, d, x, y, z) { return new THREE.BoxGeometry(w, h, d).translate(x, y, z); }

export function criarLockup(lock, mundo, scene) {
  const g = new THREE.Group();
  g.position.set(lock.x, 0, lock.z);
  g.rotation.y = lock.ang;
  scene.add(g);

  const mat = {
    laranja: new THREE.MeshStandardMaterial({ color: LARANJA, roughness: 0.7 }),
    preto: new THREE.MeshStandardMaterial({ color: PRETO, roughness: 0.8 }),
    paredeIn: new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
    trelica: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.7 }),
    piso: new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85 }),
    vermelho: new THREE.MeshStandardMaterial({ color: 0xb3161b, roughness: 0.45, metalness: 0.2 }),
    madeira: new THREE.MeshStandardMaterial({ color: 0x9a6a43, roughness: 0.8 }),
    led: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    fibro: new THREE.MeshStandardMaterial({ color: 0x8e8a80, roughness: 1, side: THREE.DoubleSide }),
  };

  // piso interno e calçada até a rua
  g.add(new THREE.Mesh(caixa(LARG, 0.06, FUNDO, 0, 0.03, 0), mat.piso));
  g.add(new THREE.Mesh(caixa(LARG + 2, 0.05, 4.4, 0, 0.025, Z1 + 2.2), mat.piso));

  // paredes laterais (cinza por fora, clara por dentro) e fundo preto
  const lat = [];
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(caixa(0.2, PAREDE, FUNDO, s * (X1 + 0.1), PAREDE / 2, 0), mat.metal));
    lat.push(caixa(0.05, 2.6, FUNDO - 0.4, s * (X1 - 0.03), 1.3, 0));
  }
  g.add(new THREE.Mesh(mergeGeometries(lat), mat.paredeIn));
  // faixa laranja no fundo e balcão de ripas
  g.add(new THREE.Mesh(caixa(LARG - 0.4, 0.35, 0.05, 0, 1.25, Z0 + 0.03), mat.laranja));
  const ripas = [];
  for (let i = 0; i < 26; i++) ripas.push(caixa(0.12, 1.1, 0.5, -1 + i * 0.2, 0.55, Z0 + 1.6));
  g.add(new THREE.Mesh(mergeGeometries(ripas), mat.madeira));

  // teto em arco (corda 16 m, flecha 2,2 m) e treliças
  const flecha = TOPO - PAREDE, R = (X1 * X1 + flecha * flecha) / (2 * flecha), cy = TOPO - R;
  // parede com o topo acompanhando o arco do teto (não sobra nada acima dele)
  const paredeArco = (yBase, z, prof) => {
    const sh = new THREE.Shape(); sh.moveTo(X0, yBase); sh.lineTo(X1, yBase);
    for (let i = 0; i <= 24; i++) { const x = X1 - LARG * i / 24; sh.lineTo(x, cy + Math.sqrt(R * R - x * x) - 0.02); }
    sh.lineTo(X0, yBase);
    return new THREE.ExtrudeGeometry(sh, { depth: prof, bevelEnabled: false }).translate(0, 0, z);
  };
  g.add(new THREE.Mesh(paredeArco(0, Z0 - 0.2, 0.2), mat.preto));
  const N = 24, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const x = X0 + LARG * i / N, y = cy + Math.sqrt(R * R - x * x);
    pos.push(x, y, Z0, x, y, Z1);
    if (i) { const o = i * 2; idx.push(o - 2, o, o - 1, o - 1, o, o + 1); }
  }
  const teto = new THREE.BufferGeometry();
  teto.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); teto.setIndex(idx); teto.computeVertexNormals();
  g.add(new THREE.Mesh(teto, mat.metal));
  const tr = [];
  for (const z of [-8, -3.5, 1, 5.5, 10]) {
    for (let i = 0; i < 16; i++) {
      const xa = X0 + LARG * i / 16, xb = X0 + LARG * (i + 1) / 16;
      const ya = cy + Math.sqrt(R * R - xa * xa) - 0.25, yb = cy + Math.sqrt(R * R - xb * xb) - 0.25;
      const L = Math.hypot(xb - xa, yb - ya);
      const b = new THREE.BoxGeometry(L, 0.12, 0.12);
      b.rotateZ(Math.atan2(yb - ya, xb - xa)); b.translate((xa + xb) / 2, (ya + yb) / 2, z);
      tr.push(b, b.clone().translate(0, -0.55, 0));
      // diagonais da treliça
      const d = new THREE.BoxGeometry(0.05, 0.5, 0.05); d.rotateZ(i % 2 ? 0.6 : -0.6); d.translate((xa + xb) / 2, (ya + yb) / 2 - 0.36, z);
      tr.push(d);
    }
  }
  g.add(new THREE.Mesh(mergeGeometries(tr), mat.trelica));
  // linha de LED acompanhando o arco e luminárias pendentes
  const leds = [];
  for (let i = 0; i < 20; i++) {
    const xa = X0 + 0.6 + (LARG - 1.2) * i / 20, xb = X0 + 0.6 + (LARG - 1.2) * (i + 1) / 20;
    const ya = cy + Math.sqrt(R * R - xa * xa) - 0.9, yb = cy + Math.sqrt(R * R - xb * xb) - 0.9;
    const b = new THREE.BoxGeometry(Math.hypot(xb - xa, yb - ya), 0.06, 0.06); b.rotateZ(Math.atan2(yb - ya, xb - xa));
    b.translate((xa + xb) / 2, (ya + yb) / 2, Z1 - 1.2); leds.push(b);
  }
  for (const [x, z] of [[-4, -6], [3, -6], [-4, 2], [3, 2]]) leds.push(new THREE.CylinderGeometry(0.25, 0.35, 0.2, 10).translate(x, 6.1, z));
  g.add(new THREE.Mesh(mergeGeometries(leds), mat.led));
  const luz = new THREE.PointLight(0xfff2dd, 60, 26, 1.6); luz.position.set(-1, 5.4, -2); g.add(luz);
  const luz2 = new THREE.PointLight(0xfff2dd, 30, 18, 1.6); luz2.position.set(-2, 4.5, 8); g.add(luz2);

  // fachada: colunas laranja, parede preta à direita do portão e placa com topo em arco
  const fach = [];
  fach.push(caixa(0.7, 8.0, 0.7, X0 - 0.15, 4.0, Z1), caixa(0.7, 8.0, 0.7, X1 + 0.15, 4.0, Z1), caixa(0.6, ALT_PORTA, 0.6, PORTA[1] + 0.3, ALT_PORTA / 2, Z1));
  g.add(new THREE.Mesh(mergeGeometries(fach), mat.laranja));
  g.add(new THREE.Mesh(caixa(X1 - PORTA[1] - 0.6, ALT_PORTA, 0.25, (PORTA[1] + 0.6 + X1) / 2, ALT_PORTA / 2, Z1), mat.preto));
  // portão de grade aberto, encostado na coluna da esquerda
  const grade = [];
  for (let i = 0; i < 14; i++) grade.push(caixa(0.05, ALT_PORTA - 0.3, 0.05, X0 + 0.5, (ALT_PORTA - 0.3) / 2, Z1 - 0.4 - i * 0.22));
  g.add(new THREE.Mesh(mergeGeometries(grade), mat.preto));
  // placa: frente com textura, laterais/topo laranja
  const shp = new THREE.Shape();
  shp.moveTo(X0 - 0.5, ALT_PORTA); shp.lineTo(X1 + 0.5, ALT_PORTA); shp.lineTo(X1 + 0.5, 8.0);
  shp.quadraticCurveTo(0, 9.6, X0 - 0.5, 8.0); shp.lineTo(X0 - 0.5, ALT_PORTA);
  const placaGeo = new THREE.ExtrudeGeometry(shp, { depth: 0.3, bevelEnabled: false });
  placaGeo.translate(0, 0, Z1 + 0.05);
  // UV da frente: mapeia o retângulo da placa para a textura
  const uv = placaGeo.attributes.uv, p = placaGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - (X0 - 0.5)) / (LARG + 1), (p.getY(i) - ALT_PORTA - 0.05) / 4.25);
  const tex = placaTex();
  g.add(new THREE.Mesh(placaGeo, [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 }), mat.laranja]));
  // parede interna atrás da placa (esconde o verso)
  g.add(new THREE.Mesh(paredeArco(ALT_PORTA, Z1 - 0.12, 0.1), mat.preto));
  // refletor iluminando a placa
  const refl = new THREE.SpotLight(0xffffff, 80, 22, 0.75, 0.6, 1.5); refl.position.set(0, 3, Z1 + 6); refl.target.position.set(0, 7, Z1); g.add(refl, refl.target);

  // elevadores vermelhos de 2 colunas
  const elev = [];
  for (const [x, z] of [[-5.6, -4.5], [4.6, -4.5], [4.6, 3.5]]) {
    for (const s of [-1, 1]) {
      elev.push(caixa(0.4, 4.2, 0.45, x + s * 1.75, 2.1, z));
      elev.push(caixa(0.12, 0.12, 1.3, x + s * 1.2, 0.35, z - 0.5), caixa(0.12, 0.12, 1.3, x + s * 1.2, 0.35, z + 0.5));
    }
    elev.push(caixa(3.9, 0.25, 0.3, x, 4.1, z));
  }
  g.add(new THREE.Mesh(mergeGeometries(elev), mat.vermelho));

  // pátio de terra com cobertura de fibrocimento, ao lado esquerdo
  const cob = new THREE.Group(); cob.position.set(X0 - 7, 0, -1);
  cob.add(new THREE.Mesh(caixa(9, 0.08, 14, 0, 2.7, 0).rotateX(0.04), mat.fibro));
  const postes = [];
  for (const [x, z] of [[-4.2, -6.6], [-4.2, 0], [-4.2, 6.6], [4.2, -6.6], [4.2, 6.6]]) postes.push(caixa(0.14, 2.7, 0.14, x, 1.35, z));
  cob.add(new THREE.Mesh(mergeGeometries(postes), mat.madeira));
  g.add(cob);

  // colisão (em coordenadas do mundo)
  const m = g.matrixWorld; g.updateMatrixWorld(true);
  const W = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(m); return [v.x, v.z]; };
  const seg = (a, b) => { const A = W(...a), B = W(...b); mundo.addSeg(A[0], A[1], B[0], B[1]); };
  seg([X0, Z0], [X1, Z0]); seg([X0, Z0], [X0, Z1]); seg([X1, Z0], [X1, Z1]);
  seg([PORTA[1], Z1], [X1, Z1]); seg([X0 - 0.5, Z1], [PORTA[0], Z1]);
  for (const [x, z] of [[-5.6, -4.5], [4.6, -4.5], [4.6, 3.5]]) for (const s of [-1, 1]) { const c = W(x + s * 1.75, z); mundo.addCirculo(c[0], c[1], 0.35); }
  for (const [x, z] of [[-4.2, -6.6], [-4.2, 0], [-4.2, 6.6], [4.2, -6.6], [4.2, 6.6]]) { const c = W(X0 - 7 + x, z - 1); mundo.addCirculo(c[0], c[1], 0.12); }

  // ponto de partida: dentro do galpão, de frente para o portão
  const ini = W(-2.6, -1.5);
  // racha contra o rival: lado a lado no portão (o rival do lado de dentro da curva da saída)
  const j = W(-5.0, 0.5), rv = W(-0.6, 0.5);
  return { grupo: g, inicio: { x: ini[0], z: ini[1], ang: lock.ang },
    largada: { jogador: { x: j[0], z: j[1], ang: lock.ang }, rival: { x: rv[0], z: rv[1], ang: lock.ang } } };
}

// área ocupada pela oficina e pelo pátio (para tirar prédios do mapa que caem em cima)
export function areaLivre(lock) {
  const c = Math.cos(-lock.ang), s = Math.sin(-lock.ang);
  return (x, z) => {
    const dx = x - lock.x, dz = z - lock.z;
    const lx = dx * c + dz * s, lz = -dx * s + dz * c;
    return !(lx > X0 - 13 && lx < X1 + 2 && lz > Z0 - 2 && lz < Z1 + 5);
  };
}
