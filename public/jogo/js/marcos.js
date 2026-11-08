// Pontos de referência em volta da Lock-Up, posicionados pelos vídeos de 08/11 (referencias/IMG_2230.MOV, ~10:00-10:40):
// - o hotel cinza de dois andares na esquina da Rua Aparaí com a Av. Tupinambá, do lado oeste da Aparaí
//   (letreiro vertical "HOTEL", "ABERTO 24 HORAS"); do lado da PA-160 é terreno vazio (confirmado pelo usuário)
// - barreiras de concreto no canteiro da PA-160 na saída da Tupinambá: a travessia ali é fechada,
//   o retorno fica uns 230 m para o sul
// - o galpão de paredes brancas colado no lado leste da Lock-Up, que fecha a vista de quem sobe a Rua Aparaí
// - a placa da Lock-Up em dois postes na beira da PA-160
// Coordenadas do jogo: x = leste, z = sul, origem na Lock-Up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// hotel: retângulo alinhado aos eixos (a Aparaí corre quase norte-sul aqui), entre a Aparaí (leste) e os vizinhos
const HOTEL = { x0: 3.5, x1: 15.3, z0: 40, z1: 67.5, h: 7.4 };
// terreno vazio entre a Aparaí e a PA-160, do galpão branco até a Tupinambá
const TERRENO = [[27, 12], [41, 12], [41, 70], [27, 70]];
// linha do canteiro da PA-160 na saída da Tupinambá (meio entre as duas pistas)
const BARREIRA = { z0: 64, z1: 106, x: z => 51 - (z - 79) * 0.06 };

// galpão branco: no referencial da Lock-Up, do lado direito dela (quem olha da rua)
function galpaoBranco(lock) {
  const c = Math.cos(lock.ang), s = Math.sin(lock.ang);
  const W = (lx, lz) => [lock.x + lx * c + lz * s, lock.z - lx * s + lz * c];
  return [W(8.4, 10.6), W(36, 10.6), W(36, -15), W(8.4, -15)];
}

const PLACA = { x: 40.8, z: 23, ang: Math.PI / 2 - 0.35 };   // virada para a PA-160, um pouco para o sul (quem sobe a rodovia vê)

// polígonos que o gerador de lotes deve deixar livres
export function areasMarcos(lock) {
  const h = HOTEL;
  return [
    [[h.x0, h.z0], [h.x1, h.z0], [h.x1, h.z1], [h.x0, h.z1]],
    galpaoBranco(lock),
    TERRENO,
  ];
}

function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// fachada do hotel: térreo cinza-escuro com vitrines, andar de cima em placas cinza-claro e escuro,
// janelas com ar-condicionado. "luz" desenha o mapa de emissão (janelas acesas à noite).
function texHotel(metros, luz, esquina) {
  const PX = 64, W = Math.round(metros * PX), H = Math.round(HOTEL.h * PX);
  return canvas(W, H, (g) => {
    const y1 = H - 3.4 * PX;                                  // linha entre os andares
    if (!luz) {
      g.fillStyle = '#3f4348'; g.fillRect(0, 0, W, H);
      // placas do andar de cima, alternando cinza claro e escuro
      for (let x = 0, k = 0; x < W; x += 2.4 * PX, k++) { g.fillStyle = k % 3 === 1 ? '#5b6066' : '#8e949a'; g.fillRect(x, 0.35 * PX, 2.4 * PX - 3, y1 - 0.35 * PX); }
      g.fillStyle = '#2b2e32'; g.fillRect(0, y1 - 8, W, 16);             // laje
      g.fillStyle = '#2b2e32'; g.fillRect(0, 0, W, 0.35 * PX);           // platibanda
    } else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
    // janelas do andar de cima, com ar-condicionado ao lado
    for (let x = 1.0 * PX; x < W - 1.4 * PX; x += 3.2 * PX) {
      const acesa = ((x / PX) * 7 % 5) < 2.2;
      if (luz) { if (acesa) { g.fillStyle = '#ffcf8f'; g.fillRect(x, 1.2 * PX, 1.3 * PX, 1.2 * PX); } continue; }
      g.fillStyle = '#e6e6e3'; g.fillRect(x - 4, 1.2 * PX - 4, 1.3 * PX + 8, 1.2 * PX + 8);
      g.fillStyle = '#1b2227'; g.fillRect(x, 1.2 * PX, 1.3 * PX, 1.2 * PX);
      g.fillStyle = '#f2f2f0'; g.fillRect(x + 1.55 * PX, 1.5 * PX, 0.75 * PX, 0.45 * PX);   // ar-condicionado
    }
    // térreo: vitrines escuras e portas
    for (let x = 0.8 * PX; x < W - 2 * PX; x += 4.2 * PX) {
      if (luz) { g.fillStyle = 'rgba(255,214,160,0.55)'; g.fillRect(x, y1 + 0.7 * PX, 2.6 * PX, 2.3 * PX); continue; }
      g.fillStyle = '#d9dadb'; g.fillRect(x - 5, y1 + 0.65 * PX, 2.6 * PX + 10, 2.4 * PX);
      g.fillStyle = '#20282e'; g.fillRect(x, y1 + 0.7 * PX, 2.6 * PX, 2.3 * PX);
      g.fillStyle = '#8b939a'; g.fillRect(x + 1.3 * PX - 2, y1 + 0.7 * PX, 4, 2.3 * PX);
    }
    if (esquina) {
      // placa "ABERTO 24 HORAS" no térreo, perto da esquina
      const x = W - 3.6 * PX, y = y1 + 0.6 * PX;
      if (luz) { g.fillStyle = '#fff'; g.font = `900 ${0.42 * PX}px Arial, sans-serif`; g.textAlign = 'center'; g.fillText('ABERTO', x + 1.3 * PX, y + 0.75 * PX); g.fillText('24 HORAS', x + 1.3 * PX, y + 1.3 * PX); return; }
      g.fillStyle = '#16181a'; g.fillRect(x, y, 2.6 * PX, 1.6 * PX);
      g.fillStyle = '#f4f4f4'; g.font = `900 ${0.42 * PX}px Arial, sans-serif`; g.textAlign = 'center';
      g.fillText('ABERTO', x + 1.3 * PX, y + 0.75 * PX); g.fillText('24 HORAS', x + 1.3 * PX, y + 1.3 * PX);
    }
  });
}

function texLetreiroHotel(luz) {
  return canvas(128, 512, (g, w, h) => {
    g.fillStyle = luz ? '#000' : '#26292d'; g.fillRect(0, 0, w, h);
    g.fillStyle = luz ? '#fffaf0' : '#f6f6f4'; g.font = '700 92px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    'HOTEL'.split('').forEach((l, i) => g.fillText(l, w / 2, 60 + i * 96));
  });
}

function texPlaca() {
  return canvas(1024, 448, (g, w, h) => {
    g.fillStyle = '#e8541c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#121316'; g.fillRect(14, 14, w - 28, h - 28);
    g.font = 'italic 900 170px "Arial Black", Impact, sans-serif'; g.textBaseline = 'alphabetic';
    const t1 = 'LOCK', t2 = '-UP', w1 = g.measureText(t1).width, w2 = g.measureText(t2).width;
    const x0 = (w - w1 - w2) / 2;
    g.fillStyle = '#f4f4f4'; g.fillText(t1, x0, 230); g.fillStyle = '#e8541c'; g.fillText(t2, x0 + w1, 230);
    g.font = '600 52px Arial, sans-serif'; g.fillStyle = '#f4f4f4'; g.textAlign = 'center';
    g.fillText('A U T O   C E N T E R', w / 2, 310);
    g.fillStyle = '#e8541c'; g.fillRect(w / 2 - 260, 350, 520, 8);
  });
}

// faces de um prisma (polígono no chão, altura h): paredes com UV em metros e topo
function prisma(pts, h) {
  const pos = [], uv = [], idx = [];
  let v = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    pos.push(a[0], 0, a[1], b[0], 0, b[1], b[0], h, b[1], a[0], h, a[1]);
    uv.push(0, 0, L, 0, L, h, 0, h);
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  }
  const top = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
  for (const p of pts) { pos.push(p[0], h, p[1]); uv.push(0, 0); }
  for (const t of top) idx.push(v + t[0], v + t[2], v + t[1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function palmeira(x, z, alt) {
  const grupo = new THREE.Group();
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, alt, 7).translate(0, alt / 2, 0), new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.9 }));
  grupo.add(tronco);
  const folha = new THREE.MeshStandardMaterial({ color: 0x2f6a2a, roughness: 0.9, side: THREE.DoubleSide });
  const fs = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.PlaneGeometry(0.55, 2.6).translate(0, 1.3, 0).rotateX(-1.0 - (i % 2) * 0.35).rotateY(i / 9 * Math.PI * 2);
    fs.push(f);
  }
  const copa = new THREE.Mesh(mergeGeometries(fs), folha); copa.position.y = alt;
  grupo.add(copa);
  grupo.position.set(x, 0, z);
  return grupo;
}

export function criarMarcos(lock, mundo, scene) {
  const g = new THREE.Group(); scene.add(g);

  // ---------- hotel
  const H = HOTEL, eps = 0.03;
  const corpo = prisma([[H.x0, H.z0], [H.x1, H.z0], [H.x1, H.z1], [H.x0, H.z1]], H.h);
  g.add(new THREE.Mesh(corpo, new THREE.MeshStandardMaterial({ color: 0x484c52, roughness: 0.85, side: THREE.DoubleSide })));
  const face = (metros, esquina, x, z, ang) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(metros, H.h),
      new THREE.MeshStandardMaterial({ map: texHotel(metros, false, esquina), emissiveMap: texHotel(metros, true, esquina), emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.8 }));
    m.position.set(x, H.h / 2, z); m.rotation.y = ang; g.add(m);
  };
  face(H.x1 - H.x0, true, (H.x0 + H.x1) / 2, H.z1 + eps, 0);                       // sul: Av. Tupinambá
  face(H.z1 - H.z0, true, H.x1 + eps, (H.z0 + H.z1) / 2, Math.PI / 2);             // leste: PA-160
  face(H.z1 - H.z0, false, H.x0 - eps, (H.z0 + H.z1) / 2, -Math.PI / 2);           // oeste: Rua Aparaí
  // letreiro vertical na quina da esquina (as duas faces de fora)
  const matL = new THREE.MeshStandardMaterial({ map: texLetreiroHotel(false), emissiveMap: texLetreiroHotel(true), emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.6 });
  const torre = new THREE.Mesh(new THREE.BoxGeometry(1.5, H.h + 1.4, 1.5), [matL, matL, new THREE.MeshStandardMaterial({ color: 0x26292d }), new THREE.MeshStandardMaterial({ color: 0x26292d }), matL, matL]);
  torre.position.set(H.x1 - 0.55, (H.h + 1.4) / 2, H.z1 - 0.55); g.add(torre);
  // sacada de vidro no andar de cima, voltada para a Tupinambá
  const vidro = new THREE.Mesh(new THREE.BoxGeometry(H.x1 - H.x0 - 3, 1.1, 0.05), new THREE.MeshStandardMaterial({ color: 0x9fc4d0, transparent: true, opacity: 0.45, roughness: 0.1 }));
  vidro.position.set((H.x0 + H.x1) / 2 - 1, 4.1, H.z1 + 1.2); g.add(vidro);
  const laje = new THREE.Mesh(new THREE.BoxGeometry(H.x1 - H.x0 - 2.6, 0.2, 1.3), new THREE.MeshStandardMaterial({ color: 0x2b2e32 }));
  laje.position.set((H.x0 + H.x1) / 2 - 1, 3.5, H.z1 + 0.65); g.add(laje);
  // calçada de lajota na frente e palmeiras
  const calc = new THREE.Mesh(new THREE.PlaneGeometry(H.x1 - H.x0 + 2, 2.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x9a9894, roughness: 0.9 }));
  calc.position.set((H.x0 + H.x1) / 2, 0.08, H.z1 + 1.1); g.add(calc);
  for (const [x, z, a] of [[H.x1 + 0.9, H.z1 - 4, 5.2], [H.x0 + 3, H.z1 + 1.5, 4.6], [H.x1 + 0.9, H.z0 + 9, 5]]) { g.add(palmeira(x, z, a)); mundo.addCirculo(x, z, 0.25); }
  mundo.addPoligono([[H.x0, H.z0], [H.x1, H.z0], [H.x1, H.z1], [H.x0, H.z1]]);

  // ---------- galpão branco ao lado da Lock-Up
  const gb = galpaoBranco(lock), hG = 7.6;
  const texBranco = canvas(256, 256, (c, w, h) => {
    c.fillStyle = '#eeeeea'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    c.fillStyle = 'rgba(80,60,40,0.18)'; c.fillRect(0, h - 22, w, 22);   // barro respingado embaixo
  });
  texBranco.wrapS = texBranco.wrapT = THREE.RepeatWrapping; texBranco.repeat.set(1 / 8, 1 / 8);
  g.add(new THREE.Mesh(prisma(gb, hG), new THREE.MeshStandardMaterial({ map: texBranco, roughness: 0.9, side: THREE.DoubleSide })));
  // degrau na platibanda numa ponta (como no vídeo)
  const c = Math.cos(lock.ang), s = Math.sin(lock.ang);
  const deg = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 25.6), new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.9 }));
  deg.position.set(gb[1][0] - c * 1.5 + s * -12.8, hG + 0.6, gb[1][1] + s * 1.5 + c * -12.8); deg.rotation.y = lock.ang; g.add(deg);
  mundo.addPoligono(gb);

  // ---------- placa da Lock-Up na beira da PA-160
  const placa = new THREE.Group();
  const tp = texPlaca();
  const matP = new THREE.MeshStandardMaterial({ map: tp, emissiveMap: tp, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 });
  const quadro = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.8, 0.18), [new THREE.MeshStandardMaterial({ color: 0x111214 }), new THREE.MeshStandardMaterial({ color: 0x111214 }),
    new THREE.MeshStandardMaterial({ color: 0x111214 }), new THREE.MeshStandardMaterial({ color: 0x111214 }), matP, matP]);
  quadro.position.y = 5.6; placa.add(quadro);
  const postes = mergeGeometries([new THREE.BoxGeometry(0.22, 4.4, 0.22).translate(-2.2, 2.2, -0.15), new THREE.BoxGeometry(0.22, 4.4, 0.22).translate(2.2, 2.2, -0.15)]);
  placa.add(new THREE.Mesh(postes, new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.4 })));
  const refletor = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff3dc }));
  refletor.position.set(0, 7.1, 0.35); placa.add(refletor);
  placa.position.set(PLACA.x, 0, PLACA.z); placa.rotation.y = PLACA.ang;
  g.add(placa);
  for (const sx of [-2.2, 2.2]) mundo.addCirculo(PLACA.x + Math.cos(PLACA.ang) * sx, PLACA.z - Math.sin(PLACA.ang) * sx, 0.2);

  // ---------- barreiras de concreto (tipo New Jersey) fechando a travessia do canteiro
  const blocos = [];
  const perfil = new THREE.Shape([new THREE.Vector2(-0.3, 0), new THREE.Vector2(0.3, 0), new THREE.Vector2(0.24, 0.25), new THREE.Vector2(0.1, 0.8), new THREE.Vector2(-0.1, 0.8), new THREE.Vector2(-0.24, 0.25)]);
  for (let z = BARREIRA.z0; z + 2 <= BARREIRA.z1; z += 2.25) {
    const b = new THREE.ExtrudeGeometry(perfil, { depth: 2, bevelEnabled: false });   // perfil no plano XY, comprimento em z
    const xa = BARREIRA.x(z), xb = BARREIRA.x(z + 2);
    b.rotateY(Math.atan2(xb - xa, 2)); b.translate(xa, 0, z);
    blocos.push(b);
  }
  const mb = new THREE.Mesh(mergeGeometries(blocos), new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.95 }));
  g.add(mb);
  mundo.addSeg(BARREIRA.x(BARREIRA.z0), BARREIRA.z0, BARREIRA.x(BARREIRA.z1), BARREIRA.z1);

  return g;
}
