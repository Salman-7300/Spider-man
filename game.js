/* =========================================================================
   WEB HERO – Open-World-Netzschwung-Spiel im Browser (Three.js)
   Ein Fan-Projekt: eigener Netz-Held im klassischen Rot-Blau-Look.
   ========================================================================= */
(function () {
'use strict';
if (typeof THREE === 'undefined') return;

/* ======================= Konfiguration ======================= */
const CFG = {
  gravity: 30,
  swingGravity: 24,
  runSpeed: 8,
  sprintSpeed: 13,
  airAccel: 10,
  jumpVel: 11.5,
  climbSpeed: 4.5,
  ropeMin: 7,
  playerHP: 100,
  enemyHP: 34,
  civCount: 22,
  carCount: 26,
  maxEnemies: 14,
};

const BLOCKS = 7;           // 7x7 Häuserblöcke
const PITCH = 50;           // Rasterabstand (Block + Straße)
const ORIGIN = -175;        // Rasterursprung (Straßenlinien bei -175..175)
const ROAD_HALF = 6;        // halbe Asphaltbreite
const SLAB_H = 0.25;        // Gehweg-/Blocksockelhöhe
const RIVER_X0 = 186, RIVER_X1 = 330;   // Fluss
const SHORE_X0 = 330, SHORE_X1 = 400;   // gegenüberliegendes Ufer
const BRIDGE_Z = -25, BRIDGE_HW = 7.5;  // Brücke entlang der Straße z=-25
const WATER_Y = -2.6;

/* ======================= Hilfsfunktionen ======================= */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

function dampAngle(cur, target, k) {
  let d = target - cur;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return cur + d * k;
}

/* ======================= Audio (WebAudio, winzig) ======================= */
const SFX = (() => {
  let ctx = null, muted = false;
  function ac() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, slide) {
    const c = ac(); if (!c || muted) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), c.currentTime + dur);
    g.gain.value = vol || 0.15;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, vol, hp) {
    const c = ac(); if (!c || muted) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp || 800;
    const g = c.createGain(); g.gain.value = vol || 0.12;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start();
  }
  return {
    init: ac,
    toggleMute() { muted = !muted; return muted; },
    thwip() { noise(0.09, 0.1, 1800); tone(900, 0.12, 'square', 0.05, 0.3); },
    punch() { tone(120, 0.09, 'sine', 0.3, 0.5); noise(0.05, 0.12, 300); },
    kick() { tone(90, 0.13, 'sine', 0.35, 0.4); noise(0.07, 0.14, 250); },
    hurt() { tone(200, 0.2, 'sawtooth', 0.12, 0.5); },
    swoosh() { noise(0.25, 0.05, 400); },
    ko() { tone(300, 0.3, 'square', 0.1, 0.25); },
    web() { noise(0.15, 0.09, 1200); tone(1400, 0.18, 'sine', 0.05, 0.2); },
    score() { tone(660, 0.09, 'sine', 0.12); setTimeout(() => tone(880, 0.12, 'sine', 0.12), 90); },
    zip() { tone(500, 0.22, 'sine', 0.08, 2.2); },
    splash() { noise(0.4, 0.2, 200); },
  };
})();

/* ======================= Renderer / Szene ======================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const SKY = 0x9fc4e8;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(0xb6cde6, 140, 520);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 900);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* Licht */
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x51452e, 0.85));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0004;
scene.add(sun); scene.add(sun.target);

/* ======================= Canvas-Texturen ======================= */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* Fensterfassaden (3 Varianten) */
const facadeTexes = [
  ['#3d4657', '#28303f'], ['#5d5348', '#3d372f'], ['#6b7683', '#49525c'],
].map(([wall, dark]) => canvasTex(128, 256, (g) => {
  g.fillStyle = wall; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 250; y += 16) {
    for (let x = 6; x < 122; x += 14) {
      const lit = Math.random() < 0.06;
      g.fillStyle = lit ? '#ffe9a8' : dark;
      g.fillRect(x, y, 9, 10);
      if (!lit) { g.fillStyle = 'rgba(170,205,240,0.45)'; g.fillRect(x, y, 9, 4); }
    }
  }
}));

const roofTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#4a4f56'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#41454b';
  for (let i = 0; i < 40; i++) g.fillRect(rand(0, 60), rand(0, 60), rand(2, 6), rand(2, 6));
});

const asphaltTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#33363c'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#2e3137';
  for (let i = 0; i < 160; i++) g.fillRect(rand(0, 126), rand(0, 126), 2, 2);
});
asphaltTex.repeat.set(60, 60);

const sidewalkTex = canvasTex(64, 64, (g) => {
  g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#82888e'; g.lineWidth = 2;
  g.strokeRect(1, 1, 62, 62);
});

const waterTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#20537c'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(255,255,255,${rand(0.03, 0.1)})`;
    g.lineWidth = rand(0.5, 1.5);
    const y = rand(0, 128); g.beginPath();
    g.moveTo(rand(0, 60), y); g.lineTo(rand(60, 128), y + rand(-3, 3)); g.stroke();
  }
});
waterTex.repeat.set(10, 10);

/* Netz-Muster für den Heldenanzug */
const suitTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(20,0,0,0.85)'; g.lineWidth = 1.6;
  for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
  for (let y = 0; y <= 128; y += 14) {
    g.beginPath();
    for (let x = 0; x <= 128; x += 8) {
      const yy = y + Math.sin((x / 16) * Math.PI) * 4;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
});
suitTex.repeat.set(2, 2);

/* ======================= Stadt bauen ======================= */
const colliders = [];          // {x0,x1,z0,z1,h} – Gebäude & Pylonen
const colliderGrid = new Map(); // "ci,cj" -> [collider,...]

function addCollider(c) {
  colliders.push(c);
  const ci0 = Math.floor((c.x0 - 1 - ORIGIN) / PITCH), ci1 = Math.floor((c.x1 + 1 - ORIGIN) / PITCH);
  const cj0 = Math.floor((c.z0 - 1 - ORIGIN) / PITCH), cj1 = Math.floor((c.z1 + 1 - ORIGIN) / PITCH);
  for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) {
    const k = i + ',' + j;
    if (!colliderGrid.has(k)) colliderGrid.set(k, []);
    colliderGrid.get(k).push(c);
  }
}
function collidersNear(x, z) {
  const k = Math.floor((x - ORIGIN) / PITCH) + ',' + Math.floor((z - ORIGIN) / PITCH);
  return colliderGrid.get(k) || [];
}

function onBridge(x, z) {
  return Math.abs(z - BRIDGE_Z) < BRIDGE_HW && x > 175 && x < RIVER_X1 + 4;
}
function inWater(x, z) {
  return x > RIVER_X0 && x < RIVER_X1 && !onBridge(x, z);
}
function groundY(x, z) {
  if (x >= SHORE_X1 || x <= -195 || Math.abs(z) >= 195) return 0;
  if (onBridge(x, z)) return 0.3;
  if (x > RIVER_X0) return x >= SHORE_X0 ? 0 : WATER_Y;
  const GRID_END = ORIGIN + BLOCKS * PITCH;
  if (x < ORIGIN || x > GRID_END || z < ORIGIN || z > GRID_END) return 0;
  // Stadtraster: Gehweg-/Blocksockel
  const u = ((x - ORIGIN) % PITCH + PITCH) % PITCH;
  const v = ((z - ORIGIN) % PITCH + PITCH) % PITCH;
  if (u > ROAD_HALF && u < PITCH - ROAD_HALF && v > ROAD_HALF && v < PITCH - ROAD_HALF) return SLAB_H;
  return 0;
}

const cityGroup = new THREE.Group();
scene.add(cityGroup);

function buildCity() {
  // Boden (Asphalt) – Stadtseite
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ map: asphaltTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-7, 0, 0);
  ground.receiveShadow = true;
  cityGroup.add(ground);

  // Fahrbahnmarkierungen
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9c979 });
  const lineGeoZ = new THREE.PlaneGeometry(0.35, 4);
  const lineGeoX = new THREE.PlaneGeometry(4, 0.35);
  // Striche nur zwischen den Kreuzungen zeichnen
  const nearCrossing = (s) => {
    const u = ((s - ORIGIN) % PITCH + PITCH) % PITCH;
    return u < ROAD_HALF + 3 || u > PITCH - ROAD_HALF - 3;
  };
  for (let i = 0; i <= BLOCKS; i++) {
    const L = ORIGIN + i * PITCH;
    for (let s = -186; s < 186; s += 10) {
      if (nearCrossing(s)) continue;
      const m1 = new THREE.Mesh(lineGeoZ, lineMat);
      m1.rotation.x = -Math.PI / 2; m1.position.set(L, 0.02, s);
      cityGroup.add(m1);
      const m2 = new THREE.Mesh(lineGeoX, lineMat);
      m2.rotation.x = -Math.PI / 2; m2.position.set(s, 0.02, L);
      cityGroup.add(m2);
    }
  }

  // Blöcke: Gehwegsockel + Gebäude
  const slabGeo = new THREE.BoxGeometry(1, SLAB_H * 2, 1);
  const slabMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });
  for (let bi = 0; bi < BLOCKS; bi++) {
    for (let bj = 0; bj < BLOCKS; bj++) {
      const cx = ORIGIN + bi * PITCH + PITCH / 2;
      const cz = ORIGIN + bj * PITCH + PITCH / 2;
      const slab = new THREE.Mesh(slabGeo, slabMat);
      const size = PITCH - ROAD_HALF * 2; // 38
      slab.scale.set(size, 1, size);
      slab.position.set(cx, 0, cz);
      slab.receiveShadow = true;
      cityGroup.add(slab);
      buildBlockBuildings(cx, cz);
      // Straßenlampen an jeder zweiten Ecke
      if ((bi + bj) % 2 === 0) addLamp(cx - size / 2 + 1, cz - size / 2 + 1);
    }
  }

  buildRiverAndBridge();
  buildFarShore();
}

function makeBuildingMesh(w, h, d, x, z) {
  const tex = pick(facadeTexes).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 12)));
  const wallMat = new THREE.MeshLambertMaterial({ map: tex });
  const roofMat = new THREE.MeshLambertMaterial({ map: roofTex });
  const mats = [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  m.position.set(x, SLAB_H + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  cityGroup.add(m);
  addCollider({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: SLAB_H + h });
  // Dachaufbauten
  if (Math.random() < 0.6) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(rand(1.5, 3), rand(1, 2), rand(1.5, 3)),
      new THREE.MeshLambertMaterial({ color: 0x777d84 }));
    b.position.set(x + rand(-w / 4, w / 4), SLAB_H + h + b.geometry.parameters.height / 2, z + rand(-d / 4, d / 4));
    b.castShadow = true;
    cityGroup.add(b);
  }
  if (h > 55 && Math.random() < 0.5) {
    // Wasserturm
    const wt = new THREE.Group();
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 2.6, 10),
      new THREE.MeshLambertMaterial({ color: 0x7a5a3a }));
    tank.position.y = 2.6; tank.castShadow = true;
    wt.add(tank);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1, 10),
      new THREE.MeshLambertMaterial({ color: 0x5d452f }));
    cone.position.y = 4.4; wt.add(cone);
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 5),
        new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
      leg.position.set(Math.cos(i * Math.PI / 2 + 0.8) * 1.1, 0.8, Math.sin(i * Math.PI / 2 + 0.8) * 1.1);
      wt.add(leg);
    }
    wt.position.set(x + rand(-w / 5, w / 5), SLAB_H + h, z + rand(-d / 5, d / 5));
    cityGroup.add(wt);
  }
  return m;
}

function buildBlockBuildings(cx, cz) {
  // Höher Richtung Stadtmitte
  const centerBias = 1 - Math.min(1, (Math.abs(cx) + Math.abs(cz)) / 300);
  const style = Math.random();
  const inner = PITCH - ROAD_HALF * 2 - 8; // bebaubare Fläche (30)
  if (style < 0.3) {
    // Ein großer Turm
    const w = rand(inner * 0.6, inner * 0.9), d = rand(inner * 0.6, inner * 0.9);
    const h = rand(35, 60) + centerBias * rand(20, 55);
    makeBuildingMesh(w, h, d, cx + rand(-2, 2), cz + rand(-2, 2));
  } else if (style < 0.75) {
    // 2x2 Gebäude
    const off = inner / 4 + 1.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (Math.random() < 0.12) continue; // kleine Plaza
      const w = rand(9, 13), d = rand(9, 13);
      const h = rand(16, 40) + centerBias * rand(5, 45);
      makeBuildingMesh(w, h, d, cx + sx * off + rand(-1, 1), cz + sz * off + rand(-1, 1));
    }
  } else {
    // Zeile aus 3 Gebäuden
    const vert = Math.random() < 0.5;
    for (let k = -1; k <= 1; k++) {
      const w = vert ? rand(10, 14) : rand(7, 9.5);
      const d = vert ? rand(7, 9.5) : rand(10, 14);
      const h = rand(14, 34) + centerBias * rand(0, 30);
      makeBuildingMesh(w, h, d, cx + (vert ? rand(-3, 3) : k * 10), cz + (vert ? k * 10 : rand(-3, 3)));
    }
  }
}

function addLamp(x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 6),
    new THREE.MeshLambertMaterial({ color: 0x2c2f33 }));
  pole.position.y = 2.2; g.add(pole);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff1b8 }));
  head.position.y = 4.4; g.add(head);
  g.position.set(x, SLAB_H, z);
  cityGroup.add(g);
}

let waterMesh = null;
function buildRiverAndBridge() {
  // Wasser
  waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(RIVER_X1 - RIVER_X0 + 10, 400),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.93 })
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set((RIVER_X0 + RIVER_X1) / 2, WATER_Y + 0.1, 0);
  cityGroup.add(waterMesh);

  // Uferkante (Kaimauer)
  const quayMat = new THREE.MeshLambertMaterial({ color: 0x6b6f75 });
  const quay = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 400), quayMat);
  quay.position.set(RIVER_X0 - 2, -2, 0);
  cityGroup.add(quay);
  const quay2 = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 400), quayMat);
  quay2.position.set(SHORE_X0 + 2, -2, 0);
  cityGroup.add(quay2);

  // Geländer am Ufer
  const railMat = new THREE.MeshLambertMaterial({ color: 0x22343f });
  for (let z = -190; z < 190; z += 8) {
    if (Math.abs(z - BRIDGE_Z) < BRIDGE_HW + 3) continue;
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1, 7), railMat);
    r.position.set(RIVER_X0 - 0.3, 0.5, z + 3.5);
    cityGroup.add(r);
  }

  // Brücke
  const deck = new THREE.Mesh(new THREE.BoxGeometry(RIVER_X1 - 172, 0.6, BRIDGE_HW * 2),
    new THREE.MeshLambertMaterial({ color: 0x555a61 }));
  deck.position.set((172 + RIVER_X1) / 2 + 2, 0, BRIDGE_Z);
  deck.receiveShadow = true; deck.castShadow = true;
  cityGroup.add(deck);
  for (const s of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(RIVER_X1 - 172, 1.1, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x8e2f2f }));
    rail.position.set((172 + RIVER_X1) / 2 + 2, 0.85, BRIDGE_Z + s * (BRIDGE_HW - 0.3));
    cityGroup.add(rail);
  }
  // Pylonen + Tragseile
  const pylMat = new THREE.MeshLambertMaterial({ color: 0x8e3b3b });
  for (const px of [225, 285]) {
    for (const s of [-1, 1]) {
      const py = new THREE.Mesh(new THREE.BoxGeometry(3, 46, 3), pylMat);
      py.position.set(px, 23 - 2, BRIDGE_Z + s * (BRIDGE_HW + 1));
      py.castShadow = true;
      cityGroup.add(py);
      addCollider({ x0: px - 1.5, x1: px + 1.5, z0: py.position.z - 1.5, z1: py.position.z + 1.5, h: 44 });
    }
    const cross = new THREE.Mesh(new THREE.BoxGeometry(3, 3, BRIDGE_HW * 2 + 5), pylMat);
    cross.position.set(px, 40, BRIDGE_Z);
    cityGroup.add(cross);
  }
  // Seile (einfache Linien)
  const cableMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  for (const s of [-1, 1]) {
    const pts = [];
    for (let x = 178; x <= RIVER_X1; x += 4) {
      let y;
      if (x < 225) y = lerp(6, 40, (x - 178) / (225 - 178));
      else if (x < 285) y = 40 - Math.sin(((x - 225) / 60) * Math.PI) * 0 + (Math.pow((x - 255) / 30, 2) * 22 + 18);
      else y = lerp(40, 6, (x - 285) / (RIVER_X1 - 285));
      pts.push(V3(x, y, BRIDGE_Z + s * (BRIDGE_HW + 1)));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat);
    cityGroup.add(line);
  }
}

function buildFarShore() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SHORE_X1 - SHORE_X0 + 40, 400),
    new THREE.MeshLambertMaterial({ color: 0x565c63 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((SHORE_X0 + SHORE_X1) / 2 + 20, 0, 0);
  ground.receiveShadow = true;
  cityGroup.add(ground);
  for (let i = 0; i < 16; i++) {
    const w = rand(10, 20), d = rand(10, 20), h = rand(25, 90);
    const x = rand(SHORE_X0 + 12, SHORE_X1 - 12), z = rand(-180, 180);
    if (Math.abs(z - BRIDGE_Z) < 16 && x < SHORE_X0 + 30) continue;
    const tex = pick(facadeTexes).clone(); tex.needsUpdate = true;
    tex.repeat.set(Math.round(w / 8), Math.round(h / 12));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ map: tex }));
    m.position.set(x, h / 2, z);
    cityGroup.add(m);
    addCollider({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h: h });
  }
}

buildCity();

/* ======================= GLB-Charaktermodelle (optional) =======================
   Eigene Modelle einfach in den Ordner assets/ legen – z. B. von Mixamo
   (FBX mit Blender zu GLB konvertieren), Ready Player Me oder Sketchfab.
   Slots: hero.glb, civilian.glb (+ civilian2/3.glb für Vielfalt), thug.glb.
   Fehlt eine Datei, wird automatisch die eingebaute Figur verwendet.
   Hinweis: GLB-Laden funktioniert nur über http(s) – also auf der Webseite
   oder mit lokalem Server, nicht bei Doppelklick auf die Datei (file://). */
const GLB_SLOTS = {
  hero: 'assets/hero.glb',
  civilian: 'assets/civilian.glb',
  civilian2: 'assets/civilian2.glb',
  civilian3: 'assets/civilian3.glb',
  thug: 'assets/thug.glb',
};
const glbModels = {}; // Slot -> {scene, clips, scale, yOffset, yaw}

/* Blickrichtungs-Korrektur pro Modell: Das Spiel erwartet Blick nach +Z.
   Läuft ein Modell rückwärts, hier Math.PI eintragen (Standard: 0). */
const GLB_YAW = {};

/* Zusätzliche Animations-Dateien pro Modell: assets/<slot>@<teil>.glb
   (entstehen automatisch aus Mixamo-Downloads „Without Skin“, siehe tools/) */
const GLB_ANIM_PARTS = ['idle', 'walk', 'run', 'jump', 'punch', 'attack', 'kick', 'sit', 'swing', 'climb'];

function loadGlbAssets(done) {
  if (typeof THREE.GLTFLoader !== 'function' || location.protocol === 'file:') { done(); return; }
  const loader = new THREE.GLTFLoader();
  const slots = Object.keys(GLB_SLOTS);
  let pending = slots.length;
  const finish = () => { if (--pending === 0) loadCompanionClips(); };
  for (const slot of slots) {
    loader.load(GLB_SLOTS[slot], (gltf) => {
      try {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const h = box.max.y - box.min.y;
        glbModels[slot] = {
          scene: gltf.scene,
          clips: (gltf.animations || []).slice(),
          scale: h > 0.01 ? 1.76 / h : 1,
          yOffset: -box.min.y,
          yaw: GLB_YAW[slot] || 0,
        };
      } catch (e) { /* unbrauchbares Modell -> eingebaute Figur */ }
      finish();
    }, undefined, finish);
  }
  function loadCompanionClips() {
    const jobs = [];
    for (const slot of slots) {
      if (!glbModels[slot]) continue;
      for (const part of GLB_ANIM_PARTS) jobs.push([slot, part]);
    }
    if (!jobs.length) { done(); return; }
    let pending2 = jobs.length;
    const finish2 = () => { if (--pending2 === 0) done(); };
    for (const [slot, part] of jobs) {
      loader.load(`assets/${slot}@${part}.glb`, (gltf) => {
        try {
          const clip = (gltf.animations || [])[0];
          if (clip) {
            clip.name = part; // Clip nach dem Dateinamens-Teil benennen
            glbModels[slot].clips.push(clip);
          }
        } catch (e) { /* ignorieren */ }
        finish2();
      }, undefined, finish2);
    }
  }
}

/* Animations-Zuordnung: Spielzustand -> Clip-Name (per Muster) */
const GLB_CLIP_PATTERNS = {
  idle: [/idle/i, /stand/i, /breath/i],
  walk: [/walk/i],
  run: [/run/i, /jog/i, /sprint/i],
  air: [/jump/i, /fall/i, /air/i],
  swing: [/swing/i, /fly/i, /hang/i],
  climb: [/climb/i, /crawl/i],
  sit: [/sit/i, /hurt/i, /crouch/i],
  webbed: [/idle/i],
  downed: [/idle/i],
  attack: [/punch/i, /attack/i, /hit/i, /kick/i, /melee/i],
};
const GLB_FALLBACK = {
  walk: ['run', 'idle'], run: ['walk', 'idle'], air: ['run', 'idle'],
  swing: ['air', 'run', 'idle'], climb: ['walk', 'idle'],
  sit: ['idle'], webbed: ['idle'], downed: ['idle'], attack: [],
};

function findClip(clips, key) {
  for (const re of GLB_CLIP_PATTERNS[key] || []) {
    const c = clips.find((cl) => re.test(cl.name) && !/t-?pose/i.test(cl.name));
    if (c) return c;
  }
  return null;
}

function makeGlbVisual(m) {
  const root = new THREE.Group();
  const inner = THREE.SkeletonUtils.clone(m.scene);
  inner.scale.setScalar(m.scale);
  inner.position.y = m.yOffset * m.scale;
  inner.rotation.y = m.yaw;
  inner.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  root.add(inner);
  const mixer = new THREE.AnimationMixer(inner);
  const actions = {};
  function actionFor(key) {
    if (key in actions) return actions[key];
    let clip = findClip(m.clips, key);
    if (!clip) {
      for (const fb of (GLB_FALLBACK[key] || [])) {
        clip = findClip(m.clips, fb);
        if (clip) break;
      }
    }
    actions[key] = clip ? mixer.clipAction(clip) : null;
    return actions[key];
  }
  let current = null;
  let lodAcc = 0, lodFrame = 0;
  return {
    root, procedural: false, mixer,
    play(key, p, dt) {
      /* Detailstufe nach Entfernung: Skelett-Animation ist teuer, deshalb
         weit entfernte Figuren ausblenden bzw. seltener animieren. */
      const dist2 = root.position.distanceToSquared(player.pos);
      if (dist2 > 130 * 130) { root.visible = false; return; }
      root.visible = true;
      if (dist2 > 45 * 45) {
        lodAcc += dt;
        if (++lodFrame % 3) return;      // nur jedes dritte Bild animieren
        dt = lodAcc; lodAcc = 0;
      }
      // 'run' je nach Tempo als Gehen oder Rennen abspielen
      let want = key;
      if (key === 'run' && (p.speed01 || 0) < 0.5 && findClip(m.clips, 'walk')) want = 'walk';
      const a = actionFor(want) || actionFor('idle');
      if (a && a !== current) {
        if (current) current.fadeOut(0.22);
        a.reset().fadeIn(0.22).play();
        current = a;
      }
      if (current && (want === 'run' || want === 'walk')) {
        current.timeScale = 0.6 + (p.speed01 || 0) * 0.8;
      }
      mixer.update(dt);
    },
    attackOneShot() {
      const a = actionFor('attack');
      if (!a) return;
      a.setLoop(THREE.LoopOnce, 1);
      a.reset().play();
    },
  };
}

function makeProceduralVisual(cfg) {
  const human = makeHuman(cfg);
  return {
    root: human.root, procedural: true, human,
    play(key, p, dt) { poseHuman(human, key, p, dt); },
    attackOneShot() {},
  };
}

/** Erzeugt die Optik einer Figur: GLB-Modell falls geladen, sonst eingebaute Figur. */
function makeCharacterVisual(kind, cfg) {
  let m = null;
  if (kind === 'civilian') {
    const variants = ['civilian', 'civilian2', 'civilian3'].filter((s) => glbModels[s]);
    if (variants.length) m = glbModels[pick(variants)];
  } else if (glbModels[kind]) {
    m = glbModels[kind];
  }
  const v = m ? makeGlbVisual(m) : makeProceduralVisual(cfg);
  scene.add(v.root);
  return v;
}

/* ======================= Menschen-Baukasten ======================= */
const SKINS = ['#e8b48c', '#d29b6e', '#a86e4b', '#7c4f33', '#f0c9a0'];
const SHIRTS = ['#c0554e', '#4d7dc4', '#58a15c', '#c9a23f', '#8e5fae', '#d97c33', '#4ea9a5', '#c45a8c', '#e6e2d8'];
const PANTS = ['#2f3b52', '#4a4a4a', '#5b4632', '#31543c', '#233042', '#6b6560'];
const HAIRS = ['#2a2119', '#4d3521', '#7a5a35', '#1b1b1e', '#8a8a8a', '#b06c34'];

function limb(mat, r0, r1, len) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 7), mat);
  m.position.y = -len / 2;
  m.castShadow = true;
  g.add(m);
  return g;
}

/**
 * Baut eine Menschfigur (~1,78 m). Blickrichtung: +Z.
 * cfg.hero = true → Netz-Held im Rot-Blau-Anzug.
 */
function makeHuman(cfg) {
  cfg = cfg || {};
  const root = new THREE.Group();
  let suitMat = null, blueMat = null, skinMat, shirtMat, pantsMat, shoeMat, headMat;

  if (cfg.hero) {
    suitMat = new THREE.MeshLambertMaterial({ map: suitTex });
    blueMat = new THREE.MeshLambertMaterial({ color: 0x1b3fa0 });
    skinMat = suitMat; shirtMat = suitMat; pantsMat = blueMat;
    shoeMat = suitMat; headMat = suitMat;
  } else {
    skinMat = new THREE.MeshLambertMaterial({ color: cfg.skin || pick(SKINS) });
    shirtMat = new THREE.MeshLambertMaterial({ color: cfg.shirt || pick(SHIRTS) });
    pantsMat = new THREE.MeshLambertMaterial({ color: cfg.pants || pick(PANTS) });
    shoeMat = new THREE.MeshLambertMaterial({ color: 0x26262a });
    headMat = skinMat;
  }

  // Becken
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), pantsMat);
  pelvis.position.y = 1.0; pelvis.castShadow = true;
  root.add(pelvis);

  // Brustkorb (Pivot an der Hüfte)
  const chest = new THREE.Group();
  chest.position.y = 1.08;
  root.add(chest);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.52, 0.24), shirtMat);
  torso.position.y = 0.28; torso.castShadow = true;
  chest.add(torso);

  // Kopf
  const headG = new THREE.Group();
  headG.position.y = 0.56;
  chest.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), headMat);
  head.position.y = 0.14; head.scale.set(0.92, 1.05, 0.98); head.castShadow = true;
  headG.add(head);
  if (cfg.hero) {
    // Große weiße Augenlinsen
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), eyeMat);
      eye.scale.set(1.15, 1.5, 0.5);
      eye.position.set(s * 0.062, 0.16, 0.125);
      eye.rotation.y = s * 0.35; eye.rotation.z = s * -0.35;
      headG.add(eye);
    }
  } else if (!cfg.thug) {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshLambertMaterial({ color: cfg.hair || pick(HAIRS) }));
    hair.scale.set(0.95, 0.75, 0.95);
    hair.position.y = 0.21; hair.position.z = -0.02;
    headG.add(hair);
  } else {
    // Sturmhaube
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x1d1f26 }));
    mask.scale.set(0.95, 1.02, 0.95);
    mask.position.y = 0.15; mask.position.z = -0.02;
    headG.add(mask);
  }

  // Arme
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.27, 0.5, 0);
    chest.add(sh);
    const upper = limb(cfg.hero ? suitMat : shirtMat, 0.062, 0.055, 0.3);
    sh.add(upper);
    const el = new THREE.Group();
    el.position.y = -0.3;
    sh.add(el);
    const fore = limb(cfg.hero ? suitMat : skinMat, 0.052, 0.045, 0.28);
    el.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), cfg.hero ? suitMat : skinMat);
    hand.position.y = -0.31; hand.castShadow = true;
    el.add(hand);
    return { sh, el, hand };
  }
  const armL = makeArm(-1), armR = makeArm(1);

  // Waffe für Ganoven
  let weapon = null;
  if (cfg.thug) {
    weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.7, 6),
      new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
    weapon.position.y = -0.55; weapon.rotation.x = 0.3;
    armR.el.add(weapon);
  }

  // Beine
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.11, 1.0, 0);
    root.add(hip);
    const thigh = limb(pantsMat, 0.085, 0.07, 0.46);
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.46;
    hip.add(knee);
    const calf = limb(pantsMat, 0.065, 0.05, 0.44);
    knee.add(calf);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.26), cfg.hero ? blueMat : shoeMat);
    foot.position.set(0, -0.48, 0.06); foot.castShadow = true;
    knee.add(foot);
    return { hip, knee };
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  return {
    root, chest, headG,
    shL: armL.sh, elL: armL.el, shR: armR.sh, elR: armR.el,
    handR: armR.hand, handL: armL.hand,
    hipL: legL.hip, kneeL: legL.knee, hipR: legR.hip, kneeR: legR.knee,
    weapon,
  };
}

/* Pose-System: Zielwinkel weich anfahren */
function setRot(part, x, y, z, k) {
  part.rotation.x = lerp(part.rotation.x, x, k);
  part.rotation.y = lerp(part.rotation.y, y || 0, k);
  part.rotation.z = lerp(part.rotation.z, z || 0, k);
}

/**
 * anim: 'idle' | 'run' | 'air' | 'swing' | 'climb' | 'downed' | 'webbed' | 'sit'
 * p: {phase, speed01, t (Zeit), lean}
 */
function poseHuman(h, anim, p, dt) {
  const k = Math.min(1, dt * 14);
  const ph = p.phase || 0, sp = p.speed01 || 0, t = p.t || 0;
  switch (anim) {
    case 'run': {
      const a = 0.95 * sp;
      setRot(h.hipL, Math.sin(ph) * a, 0, 0, k);
      setRot(h.hipR, Math.sin(ph + Math.PI) * a, 0, 0, k);
      setRot(h.kneeL, Math.max(0, Math.sin(ph - 1.9)) * 1.5 * sp, 0, 0, k);
      setRot(h.kneeR, Math.max(0, Math.sin(ph + Math.PI - 1.9)) * 1.5 * sp, 0, 0, k);
      setRot(h.shL, Math.sin(ph + Math.PI) * 0.75 * sp, 0, 0.1, k);
      setRot(h.shR, Math.sin(ph) * 0.75 * sp, 0, -0.1, k);
      setRot(h.elL, -0.5 - 0.3 * sp, 0, 0, k);
      setRot(h.elR, -0.5 - 0.3 * sp, 0, 0, k);
      setRot(h.chest, 0.18 * sp + (p.lean || 0), Math.sin(ph) * 0.06, 0, k);
      setRot(h.headG, -0.12 * sp, 0, 0, k);
      break;
    }
    case 'air':
      setRot(h.hipL, -0.55, 0, 0, k); setRot(h.kneeL, 1.0, 0, 0, k);
      setRot(h.hipR, 0.35, 0, 0, k); setRot(h.kneeR, 0.4, 0, 0, k);
      setRot(h.shL, -0.6, 0, 0.55, k); setRot(h.shR, -0.6, 0, -0.55, k);
      setRot(h.elL, -0.5, 0, 0, k); setRot(h.elR, -0.5, 0, 0, k);
      setRot(h.chest, 0.12, 0, 0, k);
      break;
    case 'swing':
      setRot(h.shR, Math.PI - 0.25, 0, -0.18, k);       // Arm nach oben zum Seil
      setRot(h.elR, -0.15, 0, 0, k);
      setRot(h.shL, -0.7, 0, 0.7, k); setRot(h.elL, -0.9, 0, 0, k);
      setRot(h.hipL, -0.75, 0, 0, k); setRot(h.kneeL, 1.15, 0, 0, k);
      setRot(h.hipR, -0.35, 0, 0, k); setRot(h.kneeR, 0.75, 0, 0, k);
      setRot(h.chest, -0.25, 0, 0, k);
      setRot(h.headG, 0.25, 0, 0, k);
      break;
    case 'climb': {
      const c = Math.sin(ph);
      setRot(h.shL, Math.PI - 0.6 + c * 0.45, 0, 0.25, k);
      setRot(h.shR, Math.PI - 0.6 - c * 0.45, 0, -0.25, k);
      setRot(h.elL, -0.4, 0, 0, k); setRot(h.elR, -0.4, 0, 0, k);
      setRot(h.hipL, -0.7 - c * 0.3, 0, 0.15, k);
      setRot(h.hipR, -0.7 + c * 0.3, 0, -0.15, k);
      setRot(h.kneeL, 1.1, 0, 0, k); setRot(h.kneeR, 1.1, 0, 0, k);
      setRot(h.chest, 0.35, 0, 0, k);
      setRot(h.headG, -0.5, 0, 0, k);
      break;
    }
    case 'downed':
      setRot(h.hipL, 0.3, 0, 0.2, k); setRot(h.hipR, 0.15, 0, -0.25, k);
      setRot(h.kneeL, 0.4, 0, 0, k); setRot(h.kneeR, 0.2, 0, 0, k);
      setRot(h.shL, 0.4, 0, 0.9, k); setRot(h.shR, 0.3, 0, -1.1, k);
      setRot(h.chest, 0, 0, 0, k);
      break;
    case 'webbed':
      setRot(h.shL, 0, 0, 0.12, k); setRot(h.shR, 0, 0, -0.12, k);
      setRot(h.elL, -0.9, 0, 0, k); setRot(h.elR, -0.9, 0, 0, k);
      setRot(h.hipL, 0, 0, 0.05, k); setRot(h.hipR, 0, 0, -0.05, k);
      setRot(h.kneeL, 0.1, 0, 0, k); setRot(h.kneeR, 0.1, 0, 0, k);
      break;
    case 'sit':
      setRot(h.hipL, -1.5, 0, 0.1, k); setRot(h.hipR, -1.5, 0, -0.1, k);
      setRot(h.kneeL, 1.5, 0, 0, k); setRot(h.kneeR, 1.5, 0, 0, k);
      setRot(h.shL, -0.9, 0, 0.2, k); setRot(h.shR, -0.9, 0, -0.2, k);
      setRot(h.elL, -1.2, 0, 0, k); setRot(h.elR, -1.2, 0, 0, k);
      setRot(h.chest, 0.35, 0, 0, k);
      break;
    default: // idle
      setRot(h.hipL, 0, 0, 0.02, k); setRot(h.hipR, 0, 0, -0.02, k);
      setRot(h.kneeL, 0.06, 0, 0, k); setRot(h.kneeR, 0.06, 0, 0, k);
      setRot(h.shL, Math.sin(t * 1.7) * 0.04, 0, 0.09, k);
      setRot(h.shR, Math.sin(t * 1.7 + 1) * 0.04, 0, -0.09, k);
      setRot(h.elL, -0.25, 0, 0, k); setRot(h.elR, -0.25, 0, 0, k);
      setRot(h.chest, 0.02 + Math.sin(t * 1.7) * 0.015, 0, 0, k);
      setRot(h.headG, 0, Math.sin(t * 0.6) * 0.25, 0, k);
  }
}

/* Angriffs-Animation überlagern (Held & Ganoven) */
function overlayAttack(h, atk, k) {
  if (!atk) return;
  const t = atk.t; // 0..1
  const wind = Math.min(1, t / 0.3);
  const strike = clamp((t - 0.3) / 0.25, 0, 1);
  const rec = clamp((t - 0.65) / 0.35, 0, 1);
  if (atk.type === 'punch') {
    const arm = atk.arm === 'L' ? { sh: h.shL, el: h.elL } : { sh: h.shR, el: h.elR };
    const shx = lerp(lerp(0.35, -1.65, strike), -0.2, rec);
    const elx = lerp(lerp(-1.8, -0.05, strike), -0.4, rec);
    arm.sh.rotation.x = shx * wind + arm.sh.rotation.x * (1 - wind);
    arm.el.rotation.x = elx * wind + arm.el.rotation.x * (1 - wind);
    h.chest.rotation.y = (atk.arm === 'L' ? 0.45 : -0.45) * (strike - rec);
  } else if (atk.type === 'kick') {
    const leg = { hip: h.hipR, knee: h.kneeR };
    leg.hip.rotation.x = lerp(lerp(0.5, -1.8, strike), 0, rec);
    leg.knee.rotation.x = lerp(lerp(1.8, 0.15, strike), 0.1, rec);
    h.chest.rotation.x = -0.35 * (strike - rec);
  } else if (atk.type === 'web') {
    h.shR.rotation.x = lerp(-1.55, -0.3, rec);
    h.elR.rotation.x = lerp(-0.05, -0.4, rec);
  } else if (atk.type === 'thugSwing') {
    h.shR.rotation.x = lerp(lerp(-2.5, -0.4, strike), -0.3, rec);
    h.elR.rotation.x = -0.3;
  }
}

/* ======================= Netz-Visuals ======================= */
const webMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });
function makeWebStrand() {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 1, 5), webMat);
  m.visible = false;
  scene.add(m);
  return m;
}
const swingStrand = makeWebStrand();
const shotStrands = [makeWebStrand(), makeWebStrand(), makeWebStrand()];
let shotIdx = 0;
const activeShots = []; // {mesh, life, from, to}

function placeStrand(mesh, from, to) {
  const d = _v1.subVectors(to, from);
  const len = d.length();
  if (len < 0.01) { mesh.visible = false; return; }
  mesh.visible = true;
  mesh.scale.set(1, len, 1);
  mesh.position.copy(from).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), d.normalize());
}

function flashWebShot(from, to) {
  const mesh = shotStrands[shotIdx = (shotIdx + 1) % shotStrands.length];
  placeStrand(mesh, from, to);
  activeShots.push({ mesh, life: 0.18 });
}

/* ======================= Spieler ======================= */
let heroVisual = null; // wird nach dem Laden der GLB-Assets erzeugt

const player = {
  pos: V3(25, 0.05, 25),
  vel: V3(0, 0, 0),
  radius: 0.45,
  height: 1.75,
  hp: CFG.playerHP,
  facing: 0,
  state: 'ground',        // ground | air | swing | climb | zip
  onGround: true,
  jumps: 0,
  phase: 0,
  wall: null,             // {col, nx, nz}
  swing: null,            // {anchor, len}
  zip: null,              // {target, t, enemy}
  attack: null,           // {type, t, arm, hitDone}
  combo: 0, comboTimer: 0,
  attackCd: 0,
  dodgeT: 0, iFrames: 0,
  hurtCd: 0, regenCd: 0,
  platform: null,
  lastDamageFrom: null,
  dead: false,
  score: 0,
  anim: 'idle',
};

function heroHandPos(out) {
  if (heroVisual && heroVisual.procedural) {
    heroVisual.human.root.updateMatrixWorld(true);
    return heroVisual.human.handR.getWorldPosition(out);
  }
  // Näherung für GLB-Modelle (rechte Hand auf Schulterhöhe)
  return out.set(
    player.pos.x + Math.sin(player.facing) * 0.3,
    player.pos.y + 1.5,
    player.pos.z + Math.cos(player.facing) * 0.3
  );
}

/* ======================= Eingabe ======================= */
const keys = {};
let mouseDX = 0, mouseDY = 0;
let pointerLocked = false;
let swingHeld = false; // rechte Maustaste

// Testmodus: erlaubt automatisierte Läufe ohne Pointer-Lock
function isActive() { return pointerLocked || window.__WEBHERO_TEST__ === true; }

const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const helpBox = document.getElementById('help');

overlay.addEventListener('click', () => {
  SFX.init();
  renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  overlay.style.display = pointerLocked ? 'none' : 'flex';
  hud.style.display = pointerLocked ? 'block' : 'none';
  if (pointerLocked) document.getElementById('clickmsg').textContent = '▶ Klicken zum Fortsetzen';
});
document.addEventListener('mousemove', (e) => {
  if (!isActive()) return;
  mouseDX += e.movementX; mouseDY += e.movementY;
});
document.addEventListener('mousedown', (e) => {
  if (!isActive()) return;
  if (e.button === 0) tryAttack('punch');
  if (e.button === 2) swingHeld = true;
});
document.addEventListener('mouseup', (e) => { if (e.button === 2) swingHeld = false; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.code === 'F5' || (e.ctrlKey && e.code === 'KeyR')) return;
  keys[e.code] = true;
  if (!isActive()) return;
  if (e.repeat) return;
  switch (e.code) {
    case 'Space': tryJump(); break;
    case 'KeyF': tryAttack('kick'); break;
    case 'KeyQ': webShot(); break;
    case 'KeyE': webZip(); break;
    case 'ControlLeft': case 'ControlRight': dodge(); e.preventDefault(); break;
    case 'KeyH': helpBox.style.display = helpBox.style.display === 'block' ? 'none' : 'block'; break;
    case 'KeyM': { const m = SFX.toggleMute(); popupScreen(m ? '🔇 Ton aus' : '🔊 Ton an'); break; }
    case 'KeyR': respawn(); break;
  }
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

function inputDir() {
  // Bewegungsrichtung relativ zur Kamera (Bodenebene)
  let fx = 0, fz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) fz += 1;
  if (keys['KeyS'] || keys['ArrowDown']) fz -= 1;
  if (keys['KeyA'] || keys['ArrowLeft']) fx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) fx += 1;
  if (!fx && !fz) return null;
  const len = Math.hypot(fx, fz); fx /= len; fz /= len;
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  return { x: fz * -sin + fx * cos, z: fz * -cos - fx * sin };
}

/* ======================= Kamera ======================= */
let camYaw = Math.PI * 0.85, camPitch = 0.22, camDist = 5.6, camShake = 0;
const camPos = V3(0, 8, 20);

function camForward() {
  return _v3.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize().clone();
}

function updateCamera(dt) {
  camYaw -= mouseDX * 0.0023;
  camPitch = clamp(camPitch + mouseDY * 0.0023, -1.15, 1.25);
  mouseDX = 0; mouseDY = 0;

  const speed = player.vel.length();
  const targetDist = player.state === 'swing' ? 7.2 : lerp(5.2, 6.6, clamp(speed / 25, 0, 1));
  camDist = lerp(camDist, targetDist, dt * 3);
  const targetFov = lerp(70, 84, clamp(speed / 30, 0, 1));
  camera.fov = lerp(camera.fov, targetFov, dt * 4);
  camera.updateProjectionMatrix();

  const target = _v1.copy(player.pos); target.y += 1.7;
  const dir = _v2.set(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  );
  // Kamerakollision mit Gebäuden (abtasten)
  let d = camDist;
  for (let i = 1; i <= 10; i++) {
    const t = (camDist * i) / 10;
    const px = target.x + dir.x * t, py = target.y + dir.y * t, pz = target.z + dir.z * t;
    let blocked = py < groundY(px, pz) + 0.3;
    if (!blocked) {
      const cols = collidersNear(px, pz);
      for (const c of cols) {
        if (px > c.x0 - 0.3 && px < c.x1 + 0.3 && pz > c.z0 - 0.3 && pz < c.z1 + 0.3 && py < c.h + 0.2) { blocked = true; break; }
      }
    }
    if (blocked) { d = Math.max(1.2, t - 0.5); break; }
  }
  const desired = _v3.copy(target).addScaledVector(dir, d);
  camPos.lerp(desired, Math.min(1, dt * 12));
  camera.position.copy(camPos);
  if (camShake > 0) {
    camera.position.x += rand(-1, 1) * camShake;
    camera.position.y += rand(-1, 1) * camShake;
    camShake = Math.max(0, camShake - dt * 1.6);
  }
  camera.lookAt(target);

  // Sonne folgt dem Spieler (Schattenausschnitt)
  sun.position.set(player.pos.x + 60, 120, player.pos.z + 40);
  sun.target.position.copy(player.pos);
}

/* ======================= Kollision Figur <-> Welt ======================= */
function collideBody(body, prevY) {
  // body: {pos, vel, radius, onGround, wall, platform}
  const p = body.pos, r = body.radius;
  body.wall = null;
  const cols = collidersNear(p.x, p.z);
  for (const c of cols) {
    if (p.x > c.x0 - r && p.x < c.x1 + r && p.z > c.z0 - r && p.z < c.z1 + r && p.y < c.h - 0.001) {
      // Auf dem Dach landen?
      if (prevY !== undefined && prevY >= c.h - 0.05 && body.vel.y <= 0.01) {
        p.y = c.h; body.vel.y = 0; body.onGround = true; body.groundTop = c.h;
        continue;
      }
      // horizontal herausdrücken
      const dxL = p.x - (c.x0 - r), dxR = (c.x1 + r) - p.x;
      const dzL = p.z - (c.z0 - r), dzR = (c.z1 + r) - p.z;
      const m = Math.min(dxL, dxR, dzL, dzR);
      let nx = 0, nz = 0;
      if (m === dxL) { p.x = c.x0 - r; nx = -1; }
      else if (m === dxR) { p.x = c.x1 + r; nx = 1; }
      else if (m === dzL) { p.z = c.z0 - r; nz = -1; }
      else { p.z = c.z1 + r; nz = 1; }
      const into = body.vel.x * -nx + body.vel.z * -nz;
      if (into > 0) { body.vel.x += nx * into; body.vel.z += nz * into; }
      body.wall = { col: c, nx, nz };
    }
  }
  // Boden
  const gy = groundY(p.x, p.z);
  if (p.y <= gy + 0.001 && body.vel.y <= 0.01 && !inWater(p.x, p.z)) {
    p.y = gy; body.vel.y = 0; body.onGround = true;
  }
}

/* ======================= Netzschwung & Netz-Aktionen ======================= */
function findAnchor() {
  // Bevorzugt: hohes Gebäude vor dem Spieler; sonst Himmelspunkt
  const f = camForward();
  const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
  let best = null, bestScore = -1;
  for (const c of colliders) {
    if (c.h < py + 9) continue;
    const cx = clamp(px + f.x * 18, c.x0, c.x1);
    const cz = clamp(pz + f.z * 18, c.z0, c.z1);
    const dx = cx - px, dz = cz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > 55 || dist < 2) continue;
    const dot = (dx * f.x + dz * f.z) / (dist || 1);
    if (dot < 0.25) continue;
    const anchorY = Math.min(c.h, py + 14 + dist * 0.6);
    const score = dot * 2 - dist / 55 + Math.min(1, (anchorY - py) / 40);
    if (score > bestScore) {
      bestScore = score;
      best = V3(cx, anchorY, cz);
    }
  }
  if (best) return best;
  // Himmelsanker als Fallback (hält den Fluss überquerbar)
  return V3(px + f.x * 7, py + 24, pz + f.z * 7);
}

function startSwing() {
  const anchor = findAnchor();
  const len = Math.max(CFG.ropeMin, anchor.distanceTo(player.pos) * 0.98);
  player.swing = { anchor, len };
  player.state = 'swing';
  SFX.thwip();
}

function stopSwing(boost) {
  if (player.state !== 'swing') return;
  player.swing = null;
  player.state = 'air';
  if (boost) {
    player.vel.multiplyScalar(1.06);
    if (player.vel.y > 0) player.vel.y += 1.5;
  }
  swingStrand.visible = false;
  SFX.swoosh();
}

function coneTargetEnemy(maxDist, minDot) {
  const f = camForward();
  let best = null, bestD = maxDist;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - player.pos.x, dy = (e.pos.y + 1) - (player.pos.y + 1.4), dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > bestD) continue;
    const dot = (dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1);
    if (dot < minDot) continue;
    best = e; bestD = d;
  }
  return best;
}

function webShot() {
  if (!heroVisual || player.dead || player.attackCd > 0.05) return;
  player.attack = { type: 'web', t: 0, hitDone: true };
  player.attackCd = 0.45;
  const from = heroHandPos(_v1).clone();
  const target = coneTargetEnemy(26, 0.55);
  SFX.web();
  if (target) {
    flashWebShot(from, _v2.set(target.pos.x, target.pos.y + 1.1, target.pos.z).clone());
    applyWeb(target);
    popupWorld('Eingewickelt!', target.pos, '#bfe8ff');
  } else {
    const f = camForward();
    flashWebShot(from, from.clone().addScaledVector(f, 22).add(_v3.set(0, 3, 0)));
  }
}

function webZip() {
  if (player.dead) return;
  const enemy = coneTargetEnemy(30, 0.5);
  let target;
  if (enemy) {
    target = V3(enemy.pos.x, enemy.pos.y + 1.2, enemy.pos.z);
  } else {
    const f = camForward();
    target = V3(player.pos.x + f.x * 22, player.pos.y + 9 + camPitch * 18, player.pos.z + f.z * 22);
    // an Gebäudekante klemmen, falls eine im Weg liegt
    for (const c of collidersNear(target.x, target.z)) {
      if (target.x > c.x0 && target.x < c.x1 && target.z > c.z0 && target.z < c.z1 && target.y < c.h) {
        target.y = c.h + 0.2;
      }
    }
  }
  stopSwing(false);
  player.state = 'zip';
  player.zip = { target, enemy: enemy || null, t: 0.6 };
  const dir = _v1.copy(target).sub(player.pos).sub(_v2.set(0, 1.2, 0)).normalize();
  player.vel.copy(dir).multiplyScalar(27);
  flashWebShot(heroHandPos(_v3).clone(), target.clone());
  SFX.zip();
}

/* ======================= Spieler-Aktionen ======================= */
function tryJump() {
  if (player.dead) return;
  if (player.state === 'climb') {
    // Wandabsprung
    const w = player.wallInfo;
    player.state = 'air';
    player.jumps = 1;
    const dir = inputDir();
    player.vel.set(w.nx * 7.5, 9.5, w.nz * 7.5);
    if (dir) { player.vel.x += dir.x * 3; player.vel.z += dir.z * 3; }
    player.wallInfo = null;
    SFX.swoosh();
    return;
  }
  if (player.state === 'swing') { stopSwing(true); return; }
  if (player.onGround) {
    player.vel.y = CFG.jumpVel;
    player.onGround = false;
    player.state = 'air';
    player.jumps = 1;
  } else if (player.jumps < 2) {
    player.vel.y = CFG.jumpVel * 0.92;
    player.jumps = 2;
    SFX.swoosh();
  }
}

function dodge() {
  if (player.dead || player.dodgeT > 0 || player.state === 'climb') return;
  const dir = inputDir() || { x: -Math.sin(player.facing), z: -Math.cos(player.facing) };
  player.vel.x = dir.x * 16;
  player.vel.z = dir.z * 16;
  player.dodgeT = 0.42;
  player.iFrames = 0.5;
  SFX.swoosh();
}

function tryAttack(type) {
  if (!heroVisual || player.dead || player.attackCd > 0) return;
  if (player.state === 'climb') return;
  player.combo = player.comboTimer > 0 ? player.combo : 0;
  const arm = (player.combo % 2 === 0) ? 'R' : 'L';
  const finisher = type === 'punch' && player.combo > 0 && (player.combo + 1) % 4 === 0;
  player.attack = { type: finisher ? 'kick' : type, t: 0, arm, hitDone: false, finisher };
  heroVisual.attackOneShot();
  player.attackCd = type === 'kick' || finisher ? 0.55 : 0.38;
  // Magnetismus: zum nächsten Gegner ziehen
  const target = nearestEnemy(4.2, 0.2);
  if (target) {
    const dx = target.pos.x - player.pos.x, dz = target.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.3) {
      player.vel.x += (dx / d) * Math.min(9, d * 4);
      player.vel.z += (dz / d) * Math.min(9, d * 4);
    }
    player.facing = Math.atan2(dx, dz);
  }
}

function nearestEnemy(maxDist, minDot) {
  let best = null, bestD = maxDist;
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD || Math.abs(e.pos.y - player.pos.y) > 2.5) continue;
    const dot = (dx * fx + dz * fz) / (d || 1);
    if (d > 1 && dot < minDot) continue;
    best = e; bestD = d;
  }
  return best;
}

function resolveAttackHit() {
  const a = player.attack;
  const range = a.type === 'kick' ? 2.8 : 2.5;
  const e = nearestEnemy(range, 0.1);
  if (!e) return;
  let dmg = a.type === 'kick' ? 16 : 11;
  if (e.webT > 0) dmg *= 2;
  damageEnemy(e, dmg, a.type);
  player.combo++;
  player.comboTimer = 3;
  hitstop(a.type === 'kick' ? 0.07 : 0.045);
  camShake = Math.max(camShake, 0.05);
  (a.type === 'kick' ? SFX.kick : SFX.punch)();
  // Rückstoß
  const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  const kb = a.type === 'kick' ? 9 : 5.5;
  e.vel.x += (dx / d) * kb; e.vel.z += (dz / d) * kb;
  e.vel.y += a.type === 'kick' ? 4 : 2;
  e.staggerT = Math.max(e.staggerT, 0.5);
}

function damagePlayer(dmg, srcPos) {
  if (player.iFrames > 0 || player.dead) return;
  player.hp -= dmg;
  player.hurtCd = 0.4; player.regenCd = 5;
  camShake = Math.max(camShake, 0.09);
  SFX.hurt();
  vignette(0.7);
  if (srcPos) {
    const dx = player.pos.x - srcPos.x, dz = player.pos.z - srcPos.z;
    const d = Math.hypot(dx, dz) || 1;
    player.vel.x += (dx / d) * 6; player.vel.z += (dz / d) * 6; player.vel.y += 2.5;
  }
  if (player.hp <= 0) {
    player.hp = 0; player.dead = true;
    document.getElementById('msg').style.display = 'flex';
    SFX.ko();
  }
  updateHUD();
}

function respawn() {
  player.pos.set(25, 0.05, 25);
  player.vel.set(0, 0, 0);
  player.hp = CFG.playerHP;
  player.dead = false;
  player.state = 'ground';
  stopSwing(false);
  player.zip = null;
  document.getElementById('msg').style.display = 'none';
  updateHUD();
}

function addScore(n, label, worldPos) {
  player.score += n;
  if (label) popupWorld(`${label} +${n}`, worldPos || player.pos, '#ffd23c');
  if (player.score > bestScore) {
    bestScore = player.score;
    try { localStorage.setItem('webhero_best', String(bestScore)); } catch (e) {}
  }
  SFX.score();
  updateHUD();
}

/* ======================= Spieler-Update ======================= */
let onWallTimer = 0;

function updatePlayer(dt) {
  if (!heroVisual) return;
  if (player.dead) { heroVisual.play('downed', { t: elapsed }, dt); return; }

  const dir = inputDir();
  const wantSwing = (keys['Space'] || swingHeld);

  /* ---- Klettern ---- */
  if (player.state === 'climb') {
    const w = player.wallInfo;
    const c = w.col;
    // an der Wand halten
    if (w.nx !== 0) player.pos.x = (w.nx > 0 ? c.x1 : c.x0) + w.nx * player.radius;
    else player.pos.z = (w.nz > 0 ? c.z1 : c.z0) + w.nz * player.radius;
    // Bewegung an der Wand: W=hoch, S=runter, A/D=seitlich
    let up = 0, side = 0;
    if (keys['KeyW'] || keys['ArrowUp']) up += 1;
    if (keys['KeyS'] || keys['ArrowDown']) up -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) side += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) side -= 1;
    // Tangente: rechts entlang der Wand
    const tx = -w.nz, tz = w.nx;
    player.vel.set(tx * side * CFG.climbSpeed, up * CFG.climbSpeed, tz * side * CFG.climbSpeed);
    player.pos.addScaledVector(player.vel, dt);
    // seitlich begrenzen
    if (w.nx !== 0) player.pos.z = clamp(player.pos.z, c.z0 + 0.2, c.z1 - 0.2);
    else player.pos.x = clamp(player.pos.x, c.x0 + 0.2, c.x1 - 0.2);
    player.phase += dt * (Math.abs(up) + Math.abs(side)) * 6;
    // Oben angekommen → aufs Dach ziehen
    if (player.pos.y + 1.3 > c.h && up > 0) {
      player.pos.y = c.h;
      player.pos.x -= w.nx * (player.radius + 0.5);
      player.pos.z -= w.nz * (player.radius + 0.5);
      player.vel.set(-w.nx * 3, 5, -w.nz * 3);
      player.state = 'air';
      player.wallInfo = null;
    } else if (player.pos.y <= groundY(player.pos.x, player.pos.z) + 0.05 && up <= 0) {
      player.state = 'ground';
      player.wallInfo = null;
    } else if (wantSwing && !keys['Space']) {
      // RMT: von der Wand in den Schwung
      player.state = 'air';
      player.wallInfo = null;
    }
    player.facing = dampAngle(player.facing, Math.atan2(-w.nx, -w.nz), dt * 14);
    player.anim = 'climb';
    updateHeroVisual(dt);
    return;
  }

  /* ---- Zip ---- */
  if (player.state === 'zip' && player.zip) {
    player.zip.t -= dt;
    const t = player.zip.target;
    const d = _v1.set(t.x - player.pos.x, t.y - player.pos.y, t.z - player.pos.z);
    const dist = d.length();
    placeStrand(swingStrand, heroHandPos(_v2), t);
    if (dist < 2 || player.zip.t <= 0) {
      swingStrand.visible = false;
      if (player.zip.enemy && !player.zip.enemy.dead && dist < 3.5) {
        // Netz-Angriff: Tritt beim Eintreffen
        const e = player.zip.enemy;
        damageEnemy(e, 14, 'kick');
        e.vel.x += d.x / (dist || 1) * 10; e.vel.z += d.z / (dist || 1) * 10; e.vel.y += 5;
        SFX.kick();
        hitstop(0.06);
        popupWorld('Netz-Angriff!', e.pos, '#bfe8ff');
        player.vel.multiplyScalar(0.25);
        player.vel.y = 4;
        player.combo++; player.comboTimer = 3;
      } else {
        player.vel.multiplyScalar(0.45);
      }
      player.zip = null;
      player.state = 'air';
    } else {
      player.pos.addScaledVector(player.vel, dt);
      const prevY = player.pos.y;
      player.onGround = false;
      collideBody(player, prevY);
      if (player.wall) { player.zip = null; player.state = 'air'; swingStrand.visible = false; }
      updateHeroVisual(dt);
      return;
    }
  }

  /* ---- Schwingen starten/stoppen ---- */
  if (player.state === 'swing') {
    if (!wantSwing) stopSwing(true);
  } else if (wantSwing && player.state === 'air' && player.vel.y < 6 && !player.swingLock) {
    startSwing();
  }
  if (!keys['Space'] && !swingHeld) player.swingLock = false;

  /* ---- Physik ---- */
  const grav = player.state === 'swing' ? CFG.swingGravity : CFG.gravity;
  player.vel.y -= grav * dt;

  if (player.onGround && player.state !== 'swing') {
    const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
    const speed = sprint ? CFG.sprintSpeed : CFG.runSpeed;
    if (player.dodgeT > 0) {
      player.dodgeT -= dt;
    } else if (dir) {
      player.vel.x = lerp(player.vel.x, dir.x * speed, Math.min(1, dt * 10));
      player.vel.z = lerp(player.vel.z, dir.z * speed, Math.min(1, dt * 10));
      player.facing = dampAngle(player.facing, Math.atan2(dir.x, dir.z), Math.min(1, dt * 12));
    } else {
      player.vel.x = lerp(player.vel.x, 0, Math.min(1, dt * 12));
      player.vel.z = lerp(player.vel.z, 0, Math.min(1, dt * 12));
    }
  } else {
    // Luftsteuerung
    if (player.dodgeT > 0) player.dodgeT -= dt;
    if (dir) {
      player.vel.x += dir.x * CFG.airAccel * dt;
      player.vel.z += dir.z * CFG.airAccel * dt;
      const hs = Math.hypot(player.vel.x, player.vel.z);
      const maxH = player.state === 'swing' ? 34 : 18;
      if (hs > maxH) { player.vel.x *= maxH / hs; player.vel.z *= maxH / hs; }
    }
  }

  // Plattform (Autodach) mitbewegen
  if (player.platform && player.onGround) {
    player.pos.x += player.platform.vx * dt;
    player.pos.z += player.platform.vz * dt;
  }

  const prevY = player.pos.y;
  player.pos.addScaledVector(player.vel, dt);

  /* ---- Seil-Constraint ---- */
  if (player.state === 'swing' && player.swing) {
    const s = player.swing;
    const d = _v1.copy(player.pos).sub(s.anchor);
    const dist = d.length();
    if (dist > s.len) {
      d.multiplyScalar(s.len / dist);
      player.pos.copy(s.anchor).add(d);
      const n = d.normalize();
      const vn = player.vel.dot(n);
      if (vn > 0) player.vel.addScaledVector(n, -vn);
    }
    // Pump-Boost in Blickrichtung
    if (keys['KeyW'] || keys['ArrowUp']) {
      const f = camForward();
      player.vel.addScaledVector(f, 9 * dt);
    }
    // leichtes Einholen des Seils
    s.len = Math.max(CFG.ropeMin, s.len - dt * 1.5);
    player.vel.multiplyScalar(1 - 0.03 * dt);
    if (player.vel.length() > 2) {
      player.facing = dampAngle(player.facing, Math.atan2(player.vel.x, player.vel.z), dt * 8);
    }
    placeStrand(swingStrand, heroHandPos(_v2), s.anchor);
    if (Math.random() < dt * 1.2) SFX.swoosh();
  }

  /* ---- Kollisionen ---- */
  const wasOnGround = player.onGround;
  player.onGround = false;
  player.platform = null;
  collideBody(player, prevY);
  collidePlayerCars(prevY);

  if (player.onGround) {
    if (player.state === 'swing') stopSwing(false);
    if (!wasOnGround && player.vel.length() < 4) SFX.swoosh();
    player.state = 'ground';
    player.jumps = 0;
    player.swingLock = keys['Space'] || swingHeld; // Space am Boden gedrückt → erst loslassen
  } else if (player.state === 'ground') {
    player.state = 'air';
    if (player.jumps === 0) player.jumps = 1;
  }

  /* ---- automatisches Klettern ---- */
  if (player.wall && !player.onGround && player.state !== 'swing' && player.state !== 'zip') {
    const w = player.wall;
    const movingIn = dir && (dir.x * -w.nx + dir.z * -w.nz) > 0.3;
    onWallTimer = movingIn || keys['KeyC'] ? onWallTimer + dt : 0;
    if ((movingIn || keys['KeyC']) && onWallTimer >= 0) {
      player.state = 'climb';
      player.wallInfo = w;
      player.vel.set(0, 0, 0);
      player.jumps = 0;
    }
  } else onWallTimer = 0;

  /* ---- Wasser ---- */
  if (player.pos.y < WATER_Y + 1 && inWater(player.pos.x, player.pos.z)) {
    SFX.splash();
    popupScreen('💦 Platsch! Zurück ans Ufer...');
    player.pos.set(RIVER_X0 - 6, 0.1, clamp(player.pos.z, -180, 180));
    player.vel.set(0, 0, 0);
    player.hp = Math.max(1, player.hp - 5);
    player.state = 'ground';
    updateHUD();
  }
  // Spielfeldgrenzen
  player.pos.x = clamp(player.pos.x, -193, SHORE_X1 - 5);
  player.pos.z = clamp(player.pos.z, -193, 193);

  /* ---- Timer ---- */
  if (player.attackCd > 0) player.attackCd -= dt;
  if (player.iFrames > 0) player.iFrames -= dt;
  if (player.hurtCd > 0) player.hurtCd -= dt;
  if (player.comboTimer > 0) {
    player.comboTimer -= dt;
    if (player.comboTimer <= 0) { player.combo = 0; updateHUD(); }
  }
  if (player.regenCd > 0) player.regenCd -= dt;
  else if (player.hp < CFG.playerHP) { player.hp = Math.min(CFG.playerHP, player.hp + dt * 4); updateHUD(); }

  /* ---- Angriff auswerten ---- */
  if (player.attack) {
    const a = player.attack;
    a.t += dt / (a.type === 'kick' ? 0.55 : 0.4);
    if (!a.hitDone && a.t > 0.38) { a.hitDone = true; resolveAttackHit(); }
    if (a.t >= 1) player.attack = null;
  }

  /* ---- Animation wählen ---- */
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.state === 'swing') player.anim = 'swing';
  else if (player.state === 'zip') player.anim = 'air';
  else if (!player.onGround) player.anim = 'air';
  else if (hSpeed > 0.6) {
    player.anim = 'run';
    player.phase += dt * (5 + hSpeed * 1.15);
    if (dir) { /* facing schon gesetzt */ }
  } else player.anim = 'idle';

  if (player.anim !== 'run' && player.anim !== 'idle' && player.vel.lengthSq() > 4 && player.state !== 'climb') {
    player.facing = dampAngle(player.facing, Math.atan2(player.vel.x, player.vel.z), dt * 6);
  }

  updateHeroVisual(dt);
}

function updateHeroVisual(dt) {
  if (!heroVisual) return;
  const r = heroVisual.root;
  r.position.copy(player.pos);
  r.rotation.y = player.facing;
  // Körperneigung beim Schwingen/Fallen
  let tilt = 0;
  if (player.state === 'swing') tilt = clamp(player.vel.y * 0.02, -0.5, 0.4) - 0.5;
  else if (player.state === 'air') tilt = clamp(-player.vel.y * 0.015, -0.25, 0.3);
  else if (player.dodgeT > 0) tilt = -0.9;
  r.rotation.x = lerp(r.rotation.x, tilt, Math.min(1, dt * 8));

  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  heroVisual.play(player.anim, {
    phase: player.phase,
    speed01: clamp(hSpeed / CFG.sprintSpeed, 0, 1),
    t: elapsed,
  }, dt);
  if (heroVisual.procedural) overlayAttack(heroVisual.human, player.attack, dt);
}

/* ======================= Autos / Verkehr ======================= */
const cars = [];
const CAR_COLORS = [0xc23b30, 0x3059b5, 0xd8d8d8, 0x2c2c30, 0xd5a021, 0x3b7a3f, 0x8446a8, 0x9fa8b5];

function makeCarMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.4), bodyMat);
  body.position.y = 0.62; body.castShadow = true;
  g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.2), bodyMat);
  cab.position.set(0, 1.15, -0.2); cab.castShadow = true;
  g.add(cab);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd2e8 });
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.4, 0.08), glassMat);
  wind.position.set(0, 1.15, 0.95); wind.rotation.x = -0.35;
  g.add(wind);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x17181c });
  for (const [sx, sz] of [[-1, 1.35], [1, 1.35], [-1, -1.35], [1, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * 0.95, 0.34, sz);
    g.add(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.08), lightMat);
    l.position.set(sx * 0.6, 0.7, 2.2);
    g.add(l);
  }
  scene.add(g);
  return g;
}

function spawnCars() {
  const lines = [];
  for (let i = 0; i <= BLOCKS; i++) lines.push(ORIGIN + i * PITCH);
  for (let n = 0; n < CFG.carCount; n++) {
    const axis = Math.random() < 0.5 ? 'x' : 'z';
    const line = pick(lines);
    const laneSign = Math.random() < 0.5 ? 1 : -1;
    const lane = line + laneSign * 3;
    const isBridgeRoad = axis === 'x' && line === BRIDGE_Z;
    const sMin = -186, sMax = isBridgeRoad ? SHORE_X1 - 10 : 186;
    cars.push({
      axis, lane, dir: laneSign, // Rechtsverkehr angenähert
      s: rand(sMin, sMax), sMin, sMax,
      speed: rand(8, 13),
      mesh: makeCarMesh(pick(CAR_COLORS)),
      vx: 0, vz: 0,
      hitCd: 0,
    });
  }
}
spawnCars();

function updateCars(dt) {
  for (const car of cars) {
    // langsamer werden, wenn ein Auto in derselben Spur dicht voraus ist
    let speed = car.speed;
    for (const o of cars) {
      if (o === car || o.axis !== car.axis || Math.abs(o.lane - car.lane) > 0.5) continue;
      const gap = (o.s - car.s) * car.dir;
      if (gap > 0 && gap < 7) { speed = Math.min(speed, o.speed * 0.8); }
    }
    car.s += car.dir * speed * dt;
    if (car.s > car.sMax) car.s = car.sMin;
    if (car.s < car.sMin) car.s = car.sMax;
    if (car.hitCd > 0) car.hitCd -= dt;

    if (car.axis === 'x') {
      car.mesh.position.set(car.s, 0, car.lane);
      car.mesh.rotation.y = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.vx = car.dir * speed; car.vz = 0;
    } else {
      car.mesh.position.set(car.lane, 0, car.s);
      car.mesh.rotation.y = car.dir > 0 ? 0 : Math.PI;
      car.vx = 0; car.vz = car.dir * speed;
    }
  }
}

function carAABB(car) {
  const hx = car.axis === 'x' ? 2.3 : 1.05;
  const hz = car.axis === 'x' ? 1.05 : 2.3;
  const cx = car.mesh.position.x, cz = car.mesh.position.z;
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, top: 1.32 };
}

function collidePlayerCars(prevY) {
  const p = player.pos, r = player.radius;
  for (const car of cars) {
    const b = carAABB(car);
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r && p.y < b.top) {
      if (prevY >= b.top - 0.15 && player.vel.y <= 0.01) {
        p.y = b.top;
        player.vel.y = 0;
        player.onGround = true;
        player.platform = car;
      } else if (p.y < b.top - 0.3) {
        // seitlicher Rempler
        const dx = p.x - car.mesh.position.x, dz = p.z - car.mesh.position.z;
        const d = Math.hypot(dx, dz) || 1;
        player.vel.x += (dx / d) * 7 + car.vx * 0.6;
        player.vel.z += (dz / d) * 7 + car.vz * 0.6;
        player.vel.y = Math.max(player.vel.y, 4);
        if (car.hitCd <= 0 && Math.hypot(car.vx, car.vz) > 5) {
          car.hitCd = 1;
          damagePlayer(3, car.mesh.position);
        }
      }
    }
  }
}

/* ======================= Zivilisten ======================= */
const civilians = [];

function sidewalkLoop(bi, bj) {
  // Rechteckiger Gehwegpfad um Block (bi,bj)
  const x0 = ORIGIN + bi * PITCH + ROAD_HALF + 2, x1 = ORIGIN + (bi + 1) * PITCH - ROAD_HALF - 2;
  const z0 = ORIGIN + bj * PITCH + ROAD_HALF + 2, z1 = ORIGIN + (bj + 1) * PITCH - ROAD_HALF - 2;
  return [V3(x0, 0, z0), V3(x1, 0, z0), V3(x1, 0, z1), V3(x0, 0, z1)];
}

function spawnCivilian() {
  const bi = randi(0, BLOCKS - 1), bj = randi(0, BLOCKS - 1);
  const loop = sidewalkLoop(bi, bj);
  const wp = randi(0, 3);
  const visual = makeCharacterVisual('civilian', {});
  const start = loop[wp];
  civilians.push({
    visual, loop, wp,
    pos: V3(start.x + rand(-1, 1), 0, start.z + rand(-1, 1)),
    vel: V3(0, 0, 0),
    radius: 0.35,
    facing: rand(0, TAU),
    phase: rand(0, TAU),
    speed: rand(1.6, 2.6),
    state: 'walk',       // walk | flee | hurt
    fleeT: 0, hurtT: 0, hp: 20,
    savedCd: 0,
    onGround: true, wall: null,
  });
}

function nearestThreatTo(pos, maxDist) {
  let best = null, bestD = maxDist;
  for (const e of enemies) {
    if (e.dead || e.webT > 0) continue;
    const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

function updateCivilians(dt) {
  for (const c of civilians) {
    if (c.savedCd > 0) c.savedCd -= dt;
    if (c.state === 'hurt') {
      c.hurtT -= dt;
      c.visual.root.position.copy(c.pos);
      c.visual.play('sit', { t: elapsed }, dt);
      if (c.hurtT <= 0) { c.state = 'walk'; c.hp = 20; }
      continue;
    }
    const threat = nearestThreatTo(c.pos, 13);
    if (threat && c.state !== 'flee') { c.state = 'flee'; c.fleeT = 3.5; }

    let dirX = 0, dirZ = 0, speed = c.speed;
    if (c.state === 'flee') {
      c.fleeT -= dt;
      const t = threat || nearestThreatTo(c.pos, 25);
      if (t) {
        const dx = c.pos.x - t.pos.x, dz = c.pos.z - t.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        dirX = dx / d; dirZ = dz / d;
        c.fleeT = Math.max(c.fleeT, 0.5);
      } else {
        const wpT = c.loop[c.wp];
        const dx = wpT.x - c.pos.x, dz = wpT.z - c.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        dirX = dx / d; dirZ = dz / d;
      }
      speed = 5.2;
      if (c.fleeT <= 0) c.state = 'walk';
    } else {
      const wpT = c.loop[c.wp];
      const dx = wpT.x - c.pos.x, dz = wpT.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) c.wp = (c.wp + 1) % 4;
      else { dirX = dx / d; dirZ = dz / d; }
      if (Math.random() < dt * 0.02) speed = 0; // kurz stehenbleiben
    }

    c.vel.x = dirX * speed; c.vel.z = dirZ * speed;
    c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
    collideBody(c);
    c.pos.y = groundY(c.pos.x, c.pos.z);
    if (speed > 0.1) {
      c.facing = dampAngle(c.facing, Math.atan2(dirX, dirZ), dt * 8);
      c.phase += dt * (4 + speed * 1.6);
    }

    // von Autos erwischt? → weggestoßen
    for (const car of cars) {
      const b = carAABB(car);
      if (c.pos.x > b.x0 && c.pos.x < b.x1 && c.pos.z > b.z0 && c.pos.z < b.z1) {
        c.pos.x += (c.pos.x - car.mesh.position.x) * 0.5;
        c.pos.z += (c.pos.z - car.mesh.position.z) * 0.5;
        c.state = 'flee'; c.fleeT = 2;
      }
    }

    c.visual.root.position.copy(c.pos);
    c.visual.root.rotation.y = c.facing;
    c.visual.play(speed > 0.1 ? 'run' : 'idle',
      { phase: c.phase, speed01: clamp(speed / 5.2, 0, 1), t: elapsed + c.phase }, dt);
  }
}

function hurtCivilian(c, attacker) {
  c.hp -= 10;
  popupWorld('Hilfe!', c.pos, '#ff9b9b');
  if (c.hp <= 0) {
    c.state = 'hurt';
    c.hurtT = 12;
  } else {
    c.state = 'flee'; c.fleeT = 4;
  }
}

/* ======================= Gegner (Gangs) ======================= */
const enemies = [];
const gangs = [];
let crimeGang = null, crimeTimer = 20;

const cocoonGeo = new THREE.SphereGeometry(0.5, 10, 8);
const cocoonMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.88 });

function makeHPBar() {
  const g = new THREE.Group();
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x330a0a }));
  bg.scale.set(1.1, 0.12, 1);
  g.add(bg);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x59d95c }));
  fg.center.set(0, 0.5);
  fg.position.x = -0.55;
  fg.scale.set(1.1, 0.12, 1);
  g.add(fg);
  g.position.y = 2.15;
  return { g, fg };
}

function spawnGang(cx, cz, n) {
  const gang = { enemies: [], home: V3(cx, 0, cz), cleared: false };
  for (let i = 0; i < n; i++) {
    const visual = makeCharacterVisual('thug', {
      thug: true,
      shirt: pick(['#3a3f4a', '#54303a', '#2e4038', '#463a2e']),
      pants: pick(['#26262e', '#3a3630', '#2e3440']),
    });
    const hpBar = makeHPBar();
    visual.root.add(hpBar.g);
    const cocoon = new THREE.Mesh(cocoonGeo, cocoonMat);
    cocoon.scale.set(1.1, 1.9, 1.1);
    cocoon.position.y = 0.95;
    cocoon.visible = false;
    visual.root.add(cocoon);
    const e = {
      visual, hpBar, cocoon,
      pos: V3(cx + rand(-4, 4), 0, cz + rand(-4, 4)),
      vel: V3(0, 0, 0),
      radius: 0.4,
      facing: rand(0, TAU),
      phase: rand(0, TAU),
      hp: CFG.enemyHP,
      state: 'patrol',
      target: null,        // 'player' | Zivilist
      waypoint: null, waitT: rand(0, 2),
      attackT: 0, attackCd: 0, attack: null,
      staggerT: 0, webT: 0,
      dead: false, deadT: 0,
      gang,
      onGround: true, wall: null,
    };
    gang.enemies.push(e);
    enemies.push(e);
  }
  gangs.push(gang);
  return gang;
}

function gangSpawnSpots() {
  const spots = [];
  for (let bi = 0; bi < BLOCKS; bi++) for (let bj = 0; bj < BLOCKS; bj++) {
    spots.push([ORIGIN + bi * PITCH + PITCH / 2, ORIGIN + bj * PITCH + ROAD_HALF + 3]);
    spots.push([ORIGIN + bi * PITCH + ROAD_HALF + 3, ORIGIN + bj * PITCH + PITCH / 2]);
  }
  return spots;
}
const SPOTS = gangSpawnSpots();

function spawnGangAwayFromPlayer() {
  for (let tries = 0; tries < 20; tries++) {
    const [x, z] = pick(SPOTS);
    const d = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (d > 55 && d < 220) return spawnGang(x, z, randi(3, 5));
  }
  const [x, z] = pick(SPOTS);
  return spawnGang(x, z, randi(3, 4));
}


function applyWeb(e) {
  if (e.dead) return;
  e.webT = 5;
  e.vel.set(0, 0, 0);
  e.attack = null;
}

function damageEnemy(e, dmg, kind) {
  if (e.dead) return;
  e.hp -= dmg;
  e.target = 'player';
  e.state = 'chase';
  // Kumpels alarmieren
  for (const o of e.gang.enemies) {
    if (!o.dead && o.state === 'patrol' && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 20) {
      o.state = 'chase'; o.target = 'player';
    }
  }
  if (e.hp <= 0) {
    e.dead = true; e.deadT = 2.5;
    e.webT = 0; e.cocoon.visible = false;
    e.hpBar.g.visible = false;
    addScore(50, 'K.O.!', e.pos);
    checkGangCleared(e.gang);
    checkCivilianSaved(e);
  } else {
    e.hpBar.fg.scale.x = 1.1 * clamp(e.hp / CFG.enemyHP, 0, 1);
    e.hpBar.g.visible = true;
  }
}

function checkGangCleared(gang) {
  if (gang.cleared) return;
  if (gang.enemies.every((e) => e.dead)) {
    gang.cleared = true;
    addScore(200, 'Gang besiegt!', player.pos);
    if (crimeGang === gang) {
      crimeGang = null;
      addScore(150, 'Überfall gestoppt!', player.pos);
      hideObjective();
    }
  }
}

function checkCivilianSaved(deadEnemy) {
  for (const c of civilians) {
    if (c.savedCd > 0) continue;
    const d = Math.hypot(c.pos.x - deadEnemy.pos.x, c.pos.z - deadEnemy.pos.z);
    if (d < 12 && (c.state === 'flee' || c.state === 'hurt')) {
      if (!nearestThreatTo(c.pos, 12)) {
        c.savedCd = 20;
        addScore(100, 'Zivilist gerettet!', c.pos);
      }
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) {
      e.deadT -= dt;
      e.visual.root.position.copy(e.pos);
      e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, -Math.PI / 2 * 0.94, dt * 6);
      e.visual.root.position.y = e.pos.y + 0.15;
      e.visual.play('downed', { t: elapsed }, dt);
      if (e.deadT <= 0) {
        scene.remove(e.visual.root);
        enemies.splice(i, 1);
      }
      continue;
    }

    if (e.webT > 0) {
      e.webT -= dt;
      e.cocoon.visible = true;
      e.visual.root.position.copy(e.pos);
      e.visual.play('webbed', { t: elapsed }, dt);
      if (e.webT <= 0) e.cocoon.visible = false;
      continue;
    }

    if (e.staggerT > 0) {
      e.staggerT -= dt;
      // Rückstoß ausklingen lassen
      e.vel.x = lerp(e.vel.x, 0, dt * 6);
      e.vel.z = lerp(e.vel.z, 0, dt * 6);
      e.vel.y -= CFG.gravity * dt;
      e.pos.addScaledVector(e.vel, dt);
      const gy = groundY(e.pos.x, e.pos.z);
      if (e.pos.y < gy) { e.pos.y = gy; e.vel.y = 0; }
      collideBody(e);
      e.visual.root.position.copy(e.pos);
      e.visual.play('air', { t: elapsed }, dt);
      continue;
    }

    const dp = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
    const dpy = Math.abs(player.pos.y - e.pos.y);

    /* Zielwahl */
    if (e.state === 'patrol') {
      if (dp < 11 && dpy < 3 && !player.dead) { e.state = 'chase'; e.target = 'player'; }
      else {
        let civ = null, civD = 14;
        for (const c of civilians) {
          if (c.state === 'hurt') continue;
          const d = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
          if (d < civD) { civ = c; civD = d; }
        }
        if (civ && Math.random() < dt * 0.7) { e.state = 'chase'; e.target = civ; }
      }
    }
    if (e.target === 'player' && (player.dead || (dp > 40 || dpy > 12))) {
      e.state = 'patrol'; e.target = null;
    }

    let moveX = 0, moveZ = 0, speed = 0, anim = 'idle';

    if (e.state === 'chase') {
      const tp = e.target === 'player' ? player.pos : (e.target ? e.target.pos : null);
      if (!tp || (e.target !== 'player' && e.target.state === 'hurt')) {
        e.state = 'patrol'; e.target = null;
      } else {
        const dx = tp.x - e.pos.x, dz = tp.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        const dy = Math.abs(tp.y - e.pos.y);
        e.facing = dampAngle(e.facing, Math.atan2(dx, dz), dt * 8);
        if (d > 1.7 || dy > 1.6) {
          moveX = dx / (d || 1); moveZ = dz / (d || 1);
          speed = e.target === 'player' ? 5 : 4.2;
          anim = 'run';
          if (e.target === 'player' && dy > 3 && d < 4) { anim = 'idle'; speed = 0; } // kommt nicht hoch
        } else if (e.attackCd <= 0 && !e.attack) {
          e.attack = { type: 'thugSwing', t: 0, hitDone: false };
          e.attackCd = rand(1.1, 1.8);
          e.visual.attackOneShot();
        }
      }
    } else {
      // Patrouille rund ums Revier
      if (!e.waypoint || Math.hypot(e.waypoint.x - e.pos.x, e.waypoint.z - e.pos.z) < 1) {
        e.waitT -= dt;
        if (e.waitT <= 0) {
          e.waypoint = V3(e.gang.home.x + rand(-12, 12), 0, e.gang.home.z + rand(-12, 12));
          e.waitT = rand(1, 3.5);
        }
      } else {
        const dx = e.waypoint.x - e.pos.x, dz = e.waypoint.z - e.pos.z;
        const d = Math.hypot(dx, dz);
        moveX = dx / d; moveZ = dz / d;
        speed = 1.8; anim = 'run';
        e.facing = dampAngle(e.facing, Math.atan2(dx, dz), dt * 6);
      }
    }

    /* Angriff ausführen */
    if (e.attack) {
      const a = e.attack;
      a.t += dt / 0.6;
      anim = 'idle'; speed = 0;
      if (!a.hitDone && a.t > 0.45) {
        a.hitDone = true;
        if (e.target === 'player') {
          if (dp < 2.3 && dpy < 2) damagePlayer(8, e.pos);
        } else if (e.target && Math.hypot(e.target.pos.x - e.pos.x, e.target.pos.z - e.pos.z) < 2.3) {
          hurtCivilian(e.target, e);
        }
      }
      if (a.t >= 1) e.attack = null;
    }
    if (e.attackCd > 0) e.attackCd -= dt;

    /* Abstand zu anderen Ganoven */
    for (const o of e.gang.enemies) {
      if (o === e || o.dead) continue;
      const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 0.01) {
        e.pos.x += (dx / d) * (1.1 - d) * 0.5;
        e.pos.z += (dz / d) * (1.1 - d) * 0.5;
      }
    }

    e.vel.x = moveX * speed; e.vel.z = moveZ * speed;
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    collideBody(e);
    e.pos.y = groundY(e.pos.x, e.pos.z);
    if (speed > 0.1) e.phase += dt * (4 + speed * 1.7);

    e.visual.root.position.copy(e.pos);
    e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, 0, dt * 8);
    e.visual.root.rotation.y = e.facing;
    e.visual.play(anim === 'run' ? 'run' : 'idle',
      { phase: e.phase, speed01: clamp(speed / 5, 0, 1), t: elapsed + e.phase }, dt);
    if (e.visual.procedural) overlayAttack(e.visual.human, e.attack, dt);
    // HP-Balken zur Kamera & ausblenden wenn voll
    e.hpBar.g.visible = e.hp < CFG.enemyHP;
  }

  /* Nachschub */
  const alive = enemies.filter((e) => !e.dead).length;
  gangRespawnT -= dt;
  if (alive < CFG.maxEnemies - 3 && gangRespawnT <= 0) {
    spawnGangAwayFromPlayer();
    gangRespawnT = 12;
  }

  /* Verbrechens-Event */
  crimeTimer -= dt;
  if (!crimeGang && crimeTimer <= 0) {
    const candidates = gangs.filter((g) => !g.cleared && g.enemies.some((e) => !e.dead));
    if (candidates.length) {
      crimeGang = pick(candidates);
      for (const e of crimeGang.enemies) if (!e.dead) { e.state = 'chase'; e.target = 'player'; }
      showObjective('🚨 Überfall! Schalte die markierte Gang aus!');
      updateCrimeBeacon();
    }
    crimeTimer = 45;
  }
  if (crimeGang) updateCrimeBeacon();
}

let gangRespawnT = 8;

/* Roter Lichtstrahl über der Verbrechens-Gang */
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(0.6, 1.4, 60, 10, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
);
beacon.visible = false;
scene.add(beacon);

function updateCrimeBeacon() {
  const alive = crimeGang ? crimeGang.enemies.filter((e) => !e.dead) : [];
  if (!alive.length) { beacon.visible = false; return; }
  const c = alive[0];
  beacon.visible = true;
  beacon.position.set(c.pos.x, c.pos.y + 30, c.pos.z);
  beacon.material.opacity = 0.22 + Math.sin(elapsed * 5) * 0.08;
}

/* ======================= HUD & Popups ======================= */
const hpbarEl = document.getElementById('hpbar');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const comboEl = document.getElementById('combo');
const comboNEl = document.getElementById('comboN');
const objectiveEl = document.getElementById('objective');
const vignetteEl = document.getElementById('vignette');

let bestScore = 0;
try { bestScore = parseInt(localStorage.getItem('webhero_best') || '0', 10) || 0; } catch (e) {}

function updateHUD() {
  hpbarEl.style.width = `${clamp(player.hp / CFG.playerHP * 100, 0, 100)}%`;
  scoreEl.textContent = `Punkte: ${player.score}`;
  bestEl.textContent = bestScore > 0 ? `Rekord: ${bestScore}` : '';
  if (player.combo >= 2) {
    comboEl.style.opacity = 1;
    comboNEl.textContent = `${player.combo}×`;
  } else comboEl.style.opacity = 0;
}
updateHUD();

function vignette(strength) {
  vignetteEl.style.boxShadow = `inset 0 0 140px rgba(227,33,45,${strength})`;
  setTimeout(() => { vignetteEl.style.boxShadow = 'inset 0 0 140px rgba(227,33,45,0)'; }, 220);
}

function popupWorld(text, worldPos, color) {
  const v = _v1.set(worldPos.x, worldPos.y + 2.2, worldPos.z).project(camera);
  if (v.z > 1) return;
  const x = (v.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  spawnPopup(text, x, y, color);
}
function popupScreen(text) {
  spawnPopup(text, window.innerWidth / 2, window.innerHeight * 0.32, '#fff');
}
function spawnPopup(text, x, y, color) {
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.color = color || '#ffd23c';
  hud.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = 0; el.style.marginTop = '-46px'; });
  setTimeout(() => el.remove(), 950);
}

function showObjective(text) {
  objectiveEl.textContent = text;
  objectiveEl.style.display = 'block';
}
function hideObjective() {
  objectiveEl.style.display = 'none';
  beacon.visible = false;
}

/* ======================= Hitstop / Zeit ======================= */
let hitstopT = 0;
function hitstop(sec) { hitstopT = Math.max(hitstopT, sec); }

/* ======================= Startaufbau der Figuren ======================= */
let actorsReady = false;
function initActors() {
  heroVisual = makeCharacterVisual('hero', { hero: true });
  for (let i = 0; i < CFG.civCount; i++) spawnCivilian();
  // Startgangs (auf Gehwegen, mit Abstand zum Startpunkt)
  spawnGangAwayFromPlayer();
  spawnGangAwayFromPlayer();
  spawnGangAwayFromPlayer();
  actorsReady = true;
}
loadGlbAssets(initActors);

/* ======================= Hauptschleife ======================= */
const clock = new THREE.Clock();
let elapsed = 0;

function animate() {
  requestAnimationFrame(animate);
  let dt = Math.min(clock.getDelta(), 0.05);
  if (!isActive() || !actorsReady) { renderer.render(scene, camera); return; }
  if (hitstopT > 0) { hitstopT -= dt; dt *= 0.12; }
  elapsed += dt;

  updatePlayer(dt);
  updateCars(dt);
  updateCivilians(dt);
  updateEnemies(dt);
  updateCamera(dt);

  // Wasser-Animation
  if (waterMesh) waterTex.offset.x = elapsed * 0.015;

  // Netzschuss-Blitze ausblenden
  for (let i = activeShots.length - 1; i >= 0; i--) {
    const s = activeShots[i];
    s.life -= dt;
    if (s.life <= 0) { s.mesh.visible = false; activeShots.splice(i, 1); }
  }
  if (player.state !== 'swing' && player.state !== 'zip') swingStrand.visible = false;

  updateHUD();
  renderer.render(scene, camera);
}
animate();

// Nur für automatisierte Tests sichtbar
if (window.__WEBHERO_TEST__ === true) {
  window.__dbg = {
    player, enemies, civilians, cars, glbModels, camera,
    get actorsReady() { return actorsReady; },
    // Kamera auf einen Punkt ausrichten (nur für automatisierte Aufnahmen)
    lookAt(x, z) { camYaw = Math.atan2(-(x - player.pos.x), -(z - player.pos.z)); },
  };
}

})();
