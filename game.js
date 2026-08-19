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
  rollDauer: 0.45,
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
const GLB_ANIM_PARTS = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'punch',
  'attack', 'kick', 'hit', 'roll', 'sit', 'swing', 'climb'];

/* Höhe eines Modells bestimmen.
   Bei geskinnten Modellen taugt die Mesh-Box oft nichts: Manche Exporte
   (z. B. aus Sketchfab) hängen das Netz unter Knoten mit winziger Skalierung,
   die beim Skinning gar nicht wirkt – die Box wird dann fast null groß.
   Deshalb in so einem Fall über die Knochen messen. */
function messeModell(scene) {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  let h = box.max.y - box.min.y;
  if (h > 0.05) return { minY: box.min.y, maxY: box.max.y, quelle: 'netz' };

  const p = new THREE.Vector3();
  let lo = Infinity, hi = -Infinity;
  scene.traverse((o) => {
    if (!o.isBone) return;
    o.getWorldPosition(p);
    if (p.y < lo) lo = p.y;
    if (p.y > hi) hi = p.y;
  });
  h = hi - lo;
  if (!isFinite(h) || h <= 0.05) return { minY: 0, maxY: 0, quelle: 'unbrauchbar' };
  /* Knochen enden im Fuß bzw. im Scheitelknochen – Sohle und Kopfoberkante
     liegen etwas außerhalb. Ein kleiner Zuschlag gleicht das aus. */
  const rand = h * 0.03;
  return { minY: lo - rand, maxY: hi + rand, quelle: 'knochen' };
}

function loadGlbAssets(done) {
  if (typeof THREE.GLTFLoader !== 'function' || location.protocol === 'file:') { done(); return; }
  const loader = new THREE.GLTFLoader();
  const slots = Object.keys(GLB_SLOTS);
  let pending = slots.length;
  const finish = () => { if (--pending === 0) loadCompanionClips(); };
  for (const slot of slots) {
    loader.load(GLB_SLOTS[slot], (gltf) => {
      try {
        /* Manche Modelle bringen durchnummerierte Knochennamen mit
           ("mixamorig:Hips_98"). Die Bewegungsdateien sprechen aber die
           reinen Mixamo-Namen an – deshalb hier die Nummern entfernen,
           sonst greift keine Animation. */
        gltf.scene.traverse((o) => {
          if (o.isBone && /_\d+$/.test(o.name)) o.name = o.name.replace(/_\d+$/, '');
        });
        bindeSteuerteileAnSkelett(gltf.scene);
        const mass = messeModell(gltf.scene);
        const h = mass.maxY - mass.minY;
        glbModels[slot] = {
          scene: gltf.scene,
          clips: (gltf.animations || []).slice(),
          scale: h > 0.01 ? 1.76 / h : 1,
          yOffset: -mass.minY,
          yaw: GLB_YAW[slot] || 0,
          aufhellen: slot === 'hero',
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
    if (!jobs.length) { teileBewegungen(); done(); return; }
    let pending2 = jobs.length;
    const finish2 = () => { if (--pending2 === 0) { teileBewegungen(); done(); } };
    for (const [slot, part] of jobs) {
      loader.load(`assets/${slot}@${part}.glb`, (gltf) => {
        try {
          const clip = (gltf.animations || [])[0];
          if (clip) {
            clip.name = part; // Clip nach dem Dateinamens-Teil benennen
            glbModels[slot].clips.push(entferneVersatz(clip));
          }
        } catch (e) { /* ignorieren */ }
        finish2();
      }, undefined, finish2);
    }
  }
}

/* Mixamo-Bewegungen stammen oft von einem anderen Charakter als das Modell.
   Ihre Hüft-Positionsspur ist dann in fremden Maßen und würde die Figur in
   den Boden ziehen oder schweben lassen. Deshalb bleiben nur die Drehungen
   erhalten – die passen bei jedem Mixamo-Skelett. */
function entferneVersatz(clip) {
  clip.tracks = clip.tracks.filter((t) => !/\.position$/.test(t.name));
  return clip;
}

/* Manche Modelle bringen neben dem Skelett noch ein zweites Steuer-Rig mit
   (Ctrl_Head, Ctrl_Spine ...). Teile, die dort hängen – bei diesem Modell die
   Augenlinsen –, folgen den Bewegungen nicht und bleiben im Gesicht stehen
   bzw. schweben daneben. Hier werden sie an den passenden echten Knochen
   umgehängt, ohne ihre Lage zu verändern. */
function bindeSteuerteileAnSkelett(scene) {
  const knochen = {};
  scene.traverse((o) => { if (o.isBone) knochen[knochenSchluessel(o.name)] = o; });
  const steuer = [];
  scene.traverse((o) => { if (!o.isBone && /^ctrl_/i.test(o.name || '')) steuer.push(o); });
  if (!steuer.length) return;
  scene.updateMatrixWorld(true);
  for (const c of steuer) {
    const schluessel = c.name.replace(/^ctrl_/i, '').replace(/_\d+$/, '')
                             .replace(/\s+/g, '').toLowerCase();
    const ziel = knochen[schluessel];
    if (!ziel) continue;
    for (const kind of c.children.slice()) {
      let hatMesh = false;
      kind.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) hatMesh = true; });
      if (!hatMesh) continue;
      /* Die örtliche Lage relativ zum Steuerknochen bleibt erhalten. Die
         Ruhepose beider Skelette unterscheidet sich; würde man stattdessen
         die Weltlage einfrieren, säßen die Teile schief. */
      ziel.add(kind);
    }
  }
}

/* Modelle ohne eigene Bewegungen bekommen die eines anderen Modells.
   Alle Figuren nutzen dasselbe Mixamo-Skelett, deshalb passen die Clips
   überall – so braucht ein mitgebrachtes Heldenmodell keine eigenen
   Animationsdateien. */
function teileBewegungen() {
  const echte = (m) => m.clips.filter((c) => !/t-?pose|mixamo\.com/i.test(c.name));
  const alle = Object.keys(glbModels).map((k) => glbModels[k]).filter(Boolean);
  const spender = alle.find((m) => echte(m).length >= 2);
  if (!spender) return;
  for (const m of alle) {
    if (m === spender || echte(m).length >= 2) continue;
    for (const c of echte(spender)) if (m.clips.indexOf(c) < 0) m.clips.push(c);
  }
}

/* Animations-Zuordnung: Spielzustand -> Clip-Name (per Muster) */
const GLB_CLIP_PATTERNS = {
  idle: [/idle/i, /stand/i, /breath/i],
  walk: [/walk/i],
  run: [/run/i, /jog/i, /sprint/i],
  /* Steigen und Fallen sind zwei verschiedene Bewegungen – erst die
     passende suchen, sonst rudert die Figur beim Fallen mit den Beinen. */
  jump: [/jump/i, /leap/i],
  air: [/fall/i, /air/i, /jump/i],
  land: [/land/i, /landing/i],
  swing: [/swing/i, /hang/i, /fly/i, /brachiat/i],
  climb: [/climb/i, /crawl/i, /ladder/i],
  roll: [/roll/i, /dodge/i, /dive/i, /evade/i],
  hit: [/hit/i, /impact/i, /react/i, /stagger/i],
  sit: [/sit/i, /hurt/i, /crouch/i, /dying/i, /death/i],
  webbed: [/idle/i],
  downed: [/dying/i, /death/i, /sit/i, /idle/i],
  attack: [/punch/i, /attack/i, /kick/i, /melee/i, /combat/i],
};
const GLB_FALLBACK = {
  walk: ['run', 'idle'], run: ['walk', 'idle'],
  jump: ['air', 'run', 'idle'], air: ['jump', 'run', 'idle'],
  land: ['idle'], roll: ['run', 'idle'], hit: ['idle'],
  swing: ['air', 'run', 'idle'], climb: ['walk', 'idle'],
  sit: ['idle'], webbed: ['idle'], downed: ['sit', 'idle'], attack: [],
};

function findClip(clips, key) {
  for (const re of GLB_CLIP_PATTERNS[key] || []) {
    const c = clips.find((cl) => re.test(cl.name) && !/t-?pose/i.test(cl.name));
    if (c) return c;
  }
  return null;
}

/* ---- Netz-Kostüm: färbt ein Menschmodell zum Helden um ----
   Rot am Oberkörper, Blau an Beinen und Oberarmen, dunkle Netzlinien –
   alles über Vertexfarben, damit es ohne passende Textur funktioniert. */
const SUIT_ROT = new THREE.Color(0xc8102e);
const SUIT_BLAU = new THREE.Color(0x1b3fa0);
const SUIT_NETZ = new THREE.Color(0x2a0409);

/* Welche Körperpartie gehört zu welchem Knochen?
   So sitzen die Farbgrenzen exakt an Schulter, Hüfte und Handgelenk –
   unabhängig davon, welche Kleidung das Ausgangsmodell trägt. */
function partieFuerKnochen(name) {
  const n = name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
  if (/toe|foot/.test(n)) return 'rot';        // Stiefel
  if (/leg/.test(n)) return 'blau';            // Beine
  if (/hand|thumb|index|middle|ring|pinky/.test(n)) return 'rot';   // Handschuhe
  if (/forearm|arm$/.test(n) && /left|right/.test(n)) return 'blau';// Arme
  return 'rot';                                // Rumpf, Kopf, Schultern
}

function faerbeAlsKostuem(mesh, bbox) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  if (!pos) return;
  const skinIndex = geo.attributes.skinIndex;
  const skinWeight = geo.attributes.skinWeight;
  const knochenNamen = (mesh.skeleton && mesh.skeleton.bones)
    ? mesh.skeleton.bones.map((b) => partieFuerKnochen(b.name)) : null;
  const hoehe = bbox.max.y - bbox.min.y || 1;
  const mitteX = (bbox.max.x + bbox.min.x) / 2;
  const mitteZ = (bbox.max.z + bbox.min.z) / 2;
  const farben = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let rot = true;
    if (knochenNamen && skinIndex && skinWeight) {
      // Der Knochen mit dem größten Gewicht bestimmt die Partie
      let bestIdx = skinIndex.getX(i), bestW = skinWeight.getX(i);
      const paare = [[skinIndex.getY(i), skinWeight.getY(i)],
                     [skinIndex.getZ(i), skinWeight.getZ(i)],
                     [skinIndex.getW(i), skinWeight.getW(i)]];
      for (const [idx, w] of paare) if (w > bestW) { bestW = w; bestIdx = idx; }
      rot = knochenNamen[bestIdx] !== 'blau';
    } else {
      rot = (pos.getY(i) - bbox.min.y) / hoehe > 0.52;   // Notfall ohne Skelett
    }
    c.copy(rot ? SUIT_ROT : SUIT_BLAU);
    /* Feines Netzmuster nur auf Rot – Ringe und Speichen um die Körperachse */
    if (rot) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const t = (y - bbox.min.y) / hoehe;
      const winkel = Math.atan2(x - mitteX, z - mitteZ);
      const ring = Math.abs(((t * 20) % 1) - 0.5) * 2;
      const speiche = Math.abs((((winkel / Math.PI) * 7) % 1) - 0.5) * 2;
      if (ring > 0.92 || speiche > 0.94) c.lerp(SUIT_NETZ, 0.55);
    }
    farben[i * 3] = c.r; farben[i * 3 + 1] = c.g; farben[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  /* Leicht glänzend, damit es nach Anzugstoff aussieht und nicht nach Hemd.
     skinning muss in Three.js r128 ausdrücklich an sein. */
  mesh.material = new THREE.MeshPhongMaterial({
    vertexColors: true,
    skinning: !!mesh.isSkinnedMesh,
    shininess: 22,
    specular: 0x222226,
  });
}

/* ---- Anliegender Anzugkörper ----
   Die Mixamo-Alltagsmodelle tragen T-Shirt und Shorts – umfärben allein
   ergibt keinen Superhelden. Deshalb wird hier ein eigener, schlanker
   Körper direkt auf das vorhandene Skelett gebaut: für jeden Knochen ein
   sich verjüngendes Rohr plus Kugeln an den Gelenken. Das Ergebnis ist
   hauteng, bewegt sich mit den geladenen Animationen und sieht nach Anzug
   aus statt nach Freizeitkleidung. */

/* ---- Anzugkörper ----
   Der Körper wird als durchgehende Hülle um die Knochenketten gelegt:
   entlang jeder Kette (Rumpf, Arme, Beine) laufen Ringe, deren Radius weich
   überblendet und deren Gewichte zwischen zwei Nachbarknochen verteilt sind.
   Dadurch gibt es keine sichtbaren Segmentkanten und keine Kugelgelenke
   mehr – die Figur wirkt wie ein Mensch im hautengen Anzug. */

/* Ketten mit Radien in Metern, bezogen auf eine 1,76 m große Figur */
const KOERPER_KETTEN = [
  { knochen: ['hips', 'spine', 'spine1', 'spine2', 'neck', 'head'],
    radien: [0.150, 0.122, 0.142, 0.168, 0.064, 0.072],
    breit: 1.18, tief: 0.82, kappeAnfang: true },
  { knochen: ['leftshoulder', 'leftarm', 'leftforearm', 'lefthand'],
    radien: [0.082, 0.072, 0.052, 0.044], breit: 1, tief: 1, kappeEnde: true },
  { knochen: ['rightshoulder', 'rightarm', 'rightforearm', 'righthand'],
    radien: [0.082, 0.072, 0.052, 0.044], breit: 1, tief: 1, kappeEnde: true },
  { knochen: ['leftupleg', 'leftleg', 'leftfoot', 'lefttoebase'],
    radien: [0.108, 0.072, 0.055, 0.042], breit: 1, tief: 1, kappeEnde: true },
  { knochen: ['rightupleg', 'rightleg', 'rightfoot', 'righttoebase'],
    radien: [0.108, 0.072, 0.055, 0.042], breit: 1, tief: 1, kappeEnde: true },
];
const RING_ECKEN = 14;      // Auflösung rund um den Körper
const RING_PRO_TEIL = 5;    // Zwischenringe je Knochenabschnitt

function knochenSchluessel(name) {
  return name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
}

function baueAnzugKoerper(quelle, einheit) {
  const skeleton = quelle.skeleton;
  if (!skeleton || !skeleton.bones.length) return null;
  const index = {};
  skeleton.bones.forEach((b, i) => { const k = knochenSchluessel(b.name); if (!(k in index)) index[k] = i; });
  if (index.hips === undefined || index.head === undefined) return null;

  /* Bindepose: Lage jedes Knochens im Geometrieraum */
  const bindInv = new THREE.Matrix4().copy(quelle.bindMatrix).invert();
  const knochenPos = skeleton.bones.map((b, i) => new THREE.Vector3().setFromMatrixPosition(
    new THREE.Matrix4().copy(bindInv).multiply(
      new THREE.Matrix4().copy(skeleton.boneInverses[i]).invert())));

  let minY = Infinity, maxY = -Infinity;
  for (const p of knochenPos) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const hoehe = Math.max(0.001, maxY - minY);
  const brust = knochenPos[index.spine2 !== undefined ? index.spine2 : index.spine1];

  const pos = [], farb = [], sIdx = [], sGew = [], idx = [];

  function farbeFuer(bone, punkt) {
    const partie = partieFuerKnochen(skeleton.bones[bone].name);
    const c = new THREE.Color(partie === 'blau' ? SUIT_BLAU : SUIT_ROT);
    if (partie !== 'blau') {
      const t = (punkt.y - minY) / hoehe;
      const winkel = Math.atan2(punkt.x, punkt.z);
      const ring = Math.abs(((t * 30) % 1) - 0.5) * 2;
      const speiche = Math.abs((((winkel / Math.PI) * 9) % 1) - 0.5) * 2;
      if (ring > 0.9 || speiche > 0.92) c.lerp(SUIT_NETZ, 0.65);
    }
    if (brust && punkt.z > brust.z) {   // Spinnenzeichen auf der Brust
      const dy = (punkt.y - brust.y) / einheit, dx = (punkt.x - brust.x) / einheit;
      if ((Math.abs(dx) < 0.026 && dy > -0.10 && dy < 0.015) ||
          (Math.abs(dy + 0.042) < 0.011 && Math.abs(dx) < 0.07)) c.setHex(0x140609);
    }
    return c;
  }

  function punktAnhaengen(p, bone, gewicht2, bone2) {
    pos.push(p.x, p.y, p.z);
    const c = farbeFuer(gewicht2 > 0.5 && bone2 !== undefined ? bone2 : bone, p);
    farb.push(c.r, c.g, c.b);
    sIdx.push(bone, bone2 === undefined ? 0 : bone2, 0, 0);
    sGew.push(1 - gewicht2, gewicht2, 0, 0);
    return pos.length / 3 - 1;
  }

  const hoch = new THREE.Vector3(0, 1, 0);
  const vorne = new THREE.Vector3(0, 0, 1);

  for (const kette of KOERPER_KETTEN) {
    const bones = kette.knochen.map((k) => index[k]);
    if (bones.some((b) => b === undefined)) continue;
    const punkte = bones.map((b) => knochenPos[b]);

    /* Stationen entlang der Kette aufbauen */
    const stationen = [];
    for (let i = 0; i < punkte.length - 1; i++) {
      const teile = RING_PRO_TEIL;
      for (let j = 0; j < teile; j++) {
        const t = j / teile;
        const glatt = t * t * (3 - 2 * t);          // weicher Übergang
        stationen.push({
          p: new THREE.Vector3().lerpVectors(punkte[i], punkte[i + 1], t),
          r: lerp(kette.radien[i], kette.radien[i + 1], glatt) * einheit,
          b1: bones[i], b2: bones[i + 1], w: t,
        });
      }
    }
    const letzte = punkte.length - 1;
    stationen.push({ p: punkte[letzte].clone(), r: kette.radien[letzte] * einheit,
                     b1: bones[letzte], b2: bones[letzte], w: 0 });

    /* Ringe mit mitgeführter Normale erzeugen (verhindert Verdrehen) */
    let normale = null;
    const ringe = [];
    for (let i = 0; i < stationen.length; i++) {
      const st = stationen[i];
      const vor = stationen[Math.min(i + 1, stationen.length - 1)].p;
      const zurueck = stationen[Math.max(i - 1, 0)].p;
      const richtung = new THREE.Vector3().subVectors(vor, zurueck);
      if (richtung.lengthSq() < 1e-10) richtung.copy(hoch);
      richtung.normalize();
      if (!normale) {
        normale = Math.abs(richtung.dot(vorne)) < 0.9
          ? new THREE.Vector3().crossVectors(richtung, vorne).normalize()
          : new THREE.Vector3().crossVectors(richtung, hoch).normalize();
      } else {
        normale.addScaledVector(richtung, -normale.dot(richtung));
        if (normale.lengthSq() < 1e-8) normale.crossVectors(richtung, hoch);
        normale.normalize();
      }
      const binormale = new THREE.Vector3().crossVectors(richtung, normale).normalize();
      const ring = [];
      for (let k = 0; k < RING_ECKEN; k++) {
        const a = (k / RING_ECKEN) * TAU;
        const p = st.p.clone()
          .addScaledVector(normale, Math.cos(a) * st.r * (kette.tief || 1))
          .addScaledVector(binormale, Math.sin(a) * st.r * (kette.breit || 1));
        ring.push(punktAnhaengen(p, st.b1, st.w, st.b2));
      }
      ringe.push({ ecken: ring, st });
    }

    for (let i = 0; i < ringe.length - 1; i++) {
      const a = ringe[i].ecken, b = ringe[i + 1].ecken;
      for (let k = 0; k < RING_ECKEN; k++) {
        const k2 = (k + 1) % RING_ECKEN;
        idx.push(a[k], b[k], b[k2]);
        idx.push(a[k], b[k2], a[k2]);
      }
    }
    /* Enden schließen */
    if (kette.kappeEnde) {
      const r = ringe[ringe.length - 1];
      const m = punktAnhaengen(r.st.p, r.st.b1, r.st.w, r.st.b2);
      for (let k = 0; k < RING_ECKEN; k++) idx.push(r.ecken[k], m, r.ecken[(k + 1) % RING_ECKEN]);
    }
    if (kette.kappeAnfang) {
      const r = ringe[0];
      const m = punktAnhaengen(r.st.p, r.st.b1, r.st.w, r.st.b2);
      for (let k = 0; k < RING_ECKEN; k++) idx.push(r.ecken[(k + 1) % RING_ECKEN], m, r.ecken[k]);
    }
  }

  /* Kopf als eigene Kugel (der Kopfknochen sitzt am Halsansatz) */
  if (index.head !== undefined) {
    const kp = knochenPos[index.head];
    const auf = index.neck !== undefined
      ? new THREE.Vector3().subVectors(kp, knochenPos[index.neck]).normalize() : hoch.clone();
    const geo = new THREE.SphereGeometry(0.115 * einheit, 18, 14);
    geo.scale(0.92, 1.12, 1.02);
    geo.translate(kp.x + auf.x * 0.09 * einheit, kp.y + auf.y * 0.09 * einheit, kp.z + auf.z * 0.09 * einheit);
    const gp = geo.attributes.position, basis = pos.length / 3;
    const v = new THREE.Vector3();
    for (let i = 0; i < gp.count; i++) {
      v.set(gp.getX(i), gp.getY(i), gp.getZ(i));
      punktAnhaengen(v, index.head, 0, index.head);
    }
    for (let i = 0; i < geo.index.count; i++) idx.push(basis + geo.index.getX(i));
    geo.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(farb, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(sIdx, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sGew, 4));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();

  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshPhongMaterial({
    vertexColors: true, skinning: true, shininess: 40, specular: 0x33333a,
  }));
  mesh.position.copy(quelle.position);
  mesh.quaternion.copy(quelle.quaternion);
  mesh.scale.copy(quelle.scale);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  mesh.bind(skeleton, quelle.bindMatrix);
  return mesh;
}

/* Augenlinsen sauber auf die Maske setzen.
   Die mitgelieferten Augen dieses Modells hängen an einem eigenen Steuer-Rig
   und sitzen schon in der Ruhepose neben dem Gesicht. Sie werden deshalb
   ausgeblendet und durch zwei Linsen ersetzt, die fest am Kopfknochen sitzen. */
function setzeMaskenAugen(inner) {
  let kopf = null;
  inner.traverse((o) => { if (!kopf && o.isBone && /head$/i.test(o.name)) kopf = o; });
  if (!kopf) return;
  // vorhandene Augen des Modells ausblenden
  inner.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => m && /eye|auge/i.test(m.name || ''))) o.visible = false;
  });
  /* Die lokalen Achsen eines Kopfknochens zeigen je nach Modell in beliebige
     Richtungen. Deshalb werden Lage und Ausrichtung in Weltkoordinaten
     bestimmt (Modell schaut nach +Z) und danach in den Knochenraum
     umgerechnet – so sitzen die Linsen bei jedem Rig im Gesicht. */
  inner.updateMatrixWorld(true);
  const kopfInv = new THREE.Matrix4().copy(kopf.matrixWorld).invert();
  /* Den echten Schädel ausmessen: alle Vertices, deren stärkster Knochen der
     Kopf ist. Daraus ergibt sich, wo vorne, oben und seitlich wirklich ist –
     unabhängig davon, wie das Rig aufgebaut ist. */
  const schaedel = new THREE.Box3();
  schaedel.makeEmpty();
  const _pv = new THREE.Vector3();
  inner.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry.attributes.skinIndex) return;
    const kopfNr = o.skeleton.bones.indexOf(kopf);
    if (kopfNr < 0) return;
    const pos = o.geometry.attributes.position;
    const si = o.geometry.attributes.skinIndex, sw = o.geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      let bi = si.getX(i), bw = sw.getX(i);
      if (sw.getY(i) > bw) { bw = sw.getY(i); bi = si.getY(i); }
      if (sw.getZ(i) > bw) { bw = sw.getZ(i); bi = si.getZ(i); }
      if (sw.getW(i) > bw) { bw = sw.getW(i); bi = si.getW(i); }
      if (bi !== kopfNr) continue;
      _pv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      schaedel.expandByPoint(_pv);
    }
  });
  const kopfMitte = new THREE.Vector3().setFromMatrixPosition(kopf.matrixWorld);
  let breite = 0.16, augenY = kopfMitte.y + 0.075, augenZ = kopfMitte.z + 0.079;
  if (!schaedel.isEmpty()) {
    const mitte = schaedel.getCenter(new THREE.Vector3());
    const groesse = schaedel.getSize(new THREE.Vector3());
    breite = groesse.x;
    kopfMitte.x = mitte.x;
    augenY = mitte.y + groesse.y * 0.09;
    augenZ = schaedel.max.z - groesse.z * 0.13;
  }
  const kopfDreh = new THREE.Quaternion();
  kopf.getWorldQuaternion(kopfDreh);
  const drehInv = kopfDreh.clone().invert();
  const skal = new THREE.Vector3();
  kopf.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), skal);
  const sk = skal.x || 1;
  const weiss = new THREE.MeshBasicMaterial({ color: 0xf4f8ff });
  const rand = new THREE.MeshBasicMaterial({ color: 0x08080a });
  for (const seite of [-1, 1]) {
    const stelle = new THREE.Vector3(kopfMitte.x + seite * breite * 0.23, augenY, augenZ);
    const dreh = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.1, seite * 0.33, seite * -0.30));
    const auge = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), weiss);
    auge.position.copy(stelle.clone().applyMatrix4(kopfInv));
    auge.quaternion.copy(drehInv.clone().multiply(dreh));
    const gr = (breite / 0.16);
    auge.scale.set(1.3 * gr / sk, 1.75 * gr / sk, 0.34 * gr / sk);
    kopf.add(auge);
    const umriss = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 10), rand);
    umriss.position.copy(auge.position);
    umriss.quaternion.copy(auge.quaternion);
    umriss.scale.set(1.3 * gr / sk, 1.75 * gr / sk, 0.30 * gr / sk);
    kopf.add(umriss);
  }
}

/* Weiße Augenlinsen an den Kopfknochen hängen (alte Fassung) */
function setzeAugen(inner) {
  let kopf = null;
  inner.traverse((o) => { if (!kopf && o.isBone && /head$/i.test(o.name)) kopf = o; });
  if (!kopf) return;
  inner.updateMatrixWorld(true);
  const skal = new THREE.Vector3();
  kopf.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), skal);
  const gruppe = new THREE.Group();
  gruppe.scale.setScalar(1 / (skal.x || 1));    // ab hier in Metern rechnen
  kopf.add(gruppe);
  const weiss = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rand = new THREE.MeshBasicMaterial({ color: 0x14060a });
  for (const seite of [-1, 1]) {
    const auge = new THREE.Mesh(new THREE.SphereGeometry(0.044, 10, 8), weiss);
    auge.scale.set(1.3, 1.7, 0.5);
    auge.position.set(seite * 0.05, 0.095, 0.088);
    auge.rotation.set(0.1, seite * 0.34, seite * -0.36);
    gruppe.add(auge);
    const umriss = new THREE.Mesh(new THREE.SphereGeometry(0.051, 10, 8), rand);
    umriss.scale.set(1.3, 1.7, 0.46);
    umriss.position.copy(auge.position).multiplyScalar(0.985);
    umriss.rotation.copy(auge.rotation);
    gruppe.add(umriss);
  }
}

function makeGlbVisual(m) {
  const root = new THREE.Group();
  const inner = THREE.SkeletonUtils.clone(m.scene);
  inner.scale.setScalar(m.scale);
  inner.position.y = m.yOffset * m.scale;
  inner.rotation.y = m.yaw;
  const bbox = new THREE.Box3().setFromObject(m.scene);
  const originale = [];
  inner.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      o.castShadow = true; o.frustumCulled = false;
      originale.push(o);
      /* Sehr dunkle Anzüge verschwinden im Schatten der Häuserschluchten –
         ein Hauch Eigenleuchten hält die Silhouette sichtbar. */
      if (m.aufhellen) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat && mat.emissive) mat.emissive.setHex(0x14141a);
        }
      }
    }
  });
  if (m.suit) {
    /* Zuerst versuchen, einen anliegenden Anzugkörper zu bauen. Klappt das,
       verschwindet die Alltagskleidung des Ausgangsmodells komplett. */
    let ersetzt = false;
    /* Modelle bestehen oft aus mehreren Teilen (Körper, Haare, Schuhe) mit
       jeweils eigenem Teilskelett. Für den Anzug wird das Teil mit den
       meisten Knochen gebraucht – nur das kennt Arme UND Beine. */
    const kandidaten = originale
      .filter((o) => o.isSkinnedMesh && o.skeleton && o.skeleton.bones.length)
      .sort((a, b) => b.skeleton.bones.length - a.skeleton.bones.length);
    if (kandidaten.length) {
      const anzug = baueAnzugKoerper(kandidaten[0], 1 / (m.scale || 1));
      if (anzug) { kandidaten[0].parent.add(anzug); ersetzt = true; }
    }
    if (ersetzt) {
      for (const o of originale) o.visible = false;
    } else {
      // Notfall: wenigstens einfärben
      for (const o of originale) { o.geometry = o.geometry.clone(); faerbeAlsKostuem(o, bbox); }
    }
    setzeAugen(inner);
  }
  root.add(inner);
  /* Fußknochen merken – damit die Figur nie im Boden versinkt */
  const fuesse = [];
  inner.traverse((o) => {
    if (o.isBone && /(left|right) ?foot$/i.test(o.name.replace(/mixamorig:?/i, ''))) fuesse.push(o);
  });
  const basisY = inner.position.y;
  let fussRuhe = null, bodenKorrektur = 0;

  /* Handknochen merken – daran hängt später der Netzfaden */
  const haende = { L: null, R: null };
  inner.traverse((o) => {
    if (!o.isBone) return;
    if (!haende.R && /right ?hand$/i.test(o.name.replace(/mixamorig:?/i, ''))) haende.R = o;
    if (!haende.L && /left ?hand$/i.test(o.name.replace(/mixamorig:?/i, ''))) haende.L = o;
  });
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
  /* Knochen für die Pose-Korrekturen merken */
  const knochen = {};
  inner.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name.replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();
    if (!knochen[n]) knochen[n] = o;
  });
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _va = new THREE.Vector3(), _vb = new THREE.Vector3();

  /* Einen Knochen auf einen Weltpunkt ausrichten (einfache Ziel-Kinematik).
     Die Knochenachse ergibt sich aus der Lage des Kindknochens. */
  function zieleKnochen(bone, child, zielWelt, staerke) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    _va.copy(child.position).normalize();                       // Knochenachse (lokal)
    _vb.setFromMatrixPosition(bone.matrixWorld);
    _vb.subVectors(zielWelt, _vb).normalize();                  // Zielrichtung (Welt)
    bone.parent.getWorldQuaternion(_q2);
    _vb.applyQuaternion(_q2.invert());                          // in Elternraum
    _q.setFromUnitVectors(_va, _vb);
    bone.quaternion.slerp(_q, staerke === undefined ? 1 : staerke);
    bone.updateMatrixWorld(true);
  }

  function drehe(bone, x, y, z, k) {
    if (!bone) return;
    bone.rotation.x = lerp(bone.rotation.x, x, k);
    bone.rotation.y = lerp(bone.rotation.y, y || 0, k);
    bone.rotation.z = lerp(bone.rotation.z, z || 0, k);
  }

  let current = null;
  let lodAcc = 0, lodFrame = 0;
  let angriff = null, angriffT = 0;
  return {
    root, procedural: false, mixer,
    /* Schwung-Pose: Arm zum Netzanker strecken, Beine anziehen, Rumpf neigen.
       Die Beine werden vollständig gesetzt (nicht angenähert) – sonst kämpft
       die laufende Geh-Animation dagegen an und die Beine zappeln. */
    poseSchwung(zielWelt, seite, t) {
      const gross = seite === 'L' ? 'leftarm' : 'rightarm';
      const klein = seite === 'L' ? 'leftforearm' : 'rightforearm';
      const andere = seite === 'L' ? 'rightarm' : 'leftarm';
      const andereK = seite === 'L' ? 'rightforearm' : 'leftforearm';
      /* Nur der Netzarm wird geführt. Die Beine überlässt der Schwung der
         laufenden Animation – eigene Beinposen haben gegen sie gearbeitet
         und zu zuckenden Beinen geführt. */
      zieleKnochen(knochen[gross], knochen[klein], zielWelt, 1);
      drehe(knochen[klein], -0.12, 0, 0, 1);
      const wiegen = Math.sin((t || 0) * 1.6) * 0.1;
      drehe(knochen[andere], -0.3 + wiegen, 0, seite === 'L' ? -0.7 : 0.7, 0.5);
      drehe(knochen[andereK], -0.5, 0, 0, 0.5);
    },
    /* Schlagbewegung: Ausholen, Durchziehen, Zurücknehmen.
       Jeder Treffer der Kette sieht anders aus – Jab, Haken, Tritt und
       Abschluss-Schlag – statt immer derselben Animation. */
    poseSchlag(t, art, arm, stufe) {
      const links = arm === 'L';
      const sh = links ? 'leftarm' : 'rightarm';
      const el = links ? 'leftforearm' : 'rightforearm';
      const shA = links ? 'rightarm' : 'leftarm';
      const elA = links ? 'rightforearm' : 'leftforearm';
      const seite = links ? 1 : -1;
      const aus = clamp(t / 0.3, 0, 1);            // Ausholen
      const zieh = clamp((t - 0.28) / 0.22, 0, 1); // Durchziehen
      const zurueck = clamp((t - 0.58) / 0.42, 0, 1);
      const stoss = zieh - zurueck;                // 0..1..0

      if (art === 'kick') {
        const bein = links ? 'leftupleg' : 'rightupleg';
        const knie = links ? 'leftleg' : 'rightleg';
        drehe(knochen[bein], lerp(0.45 * aus, -1.75, stoss), 0, 0, 1);
        drehe(knochen[knie], lerp(1.7 * aus, 0.12, stoss), 0, 0, 1);
        drehe(knochen.spine1, -0.3 * stoss, 0, 0, 1);
        drehe(knochen[sh], -0.5, 0, seite * -0.7, 1);
        drehe(knochen[shA], -0.5, 0, seite * 0.7, 1);
        return;
      }
      /* Faustschlag: Schulter dreht mit, Arm streckt sich beim Treffer */
      const haken = stufe % 2 === 1;               // abwechselnd gerade / Haken
      drehe(knochen[sh], lerp(0.5 * aus, -1.55, stoss), haken ? seite * -0.5 * stoss : 0,
            seite * (haken ? -0.5 : -0.12) * stoss, 1);
      drehe(knochen[el], lerp(-1.9 * aus, -0.06, stoss), 0, 0, 1);
      drehe(knochen[shA], -0.45 + 0.3 * stoss, 0, seite * 0.55, 1);
      drehe(knochen[elA], -1.1, 0, 0, 1);
      drehe(knochen.spine1, 0.12 * stoss, seite * 0.42 * stoss, 0, 1);
      drehe(knochen.spine2, 0, seite * 0.3 * stoss, 0, 1);
      drehe(knochen.head, 0, seite * -0.2 * stoss, 0, 1);
    },
    /* Getroffen: kurzes Zurückzucken */
    poseTreffer(t) {
      const z = Math.sin(clamp(t, 0, 1) * Math.PI);
      drehe(knochen.spine1, -0.45 * z, 0, 0, 1);
      drehe(knochen.spine2, -0.3 * z, 0, 0, 1);
      drehe(knochen.head, -0.35 * z, 0, 0, 1);
      drehe(knochen.leftarm, -0.4 * z, 0, 0.6 * z, 1);
      drehe(knochen.rightarm, -0.4 * z, 0, -0.6 * z, 1);
    },
    /* Kletter-Pose: flach an der Wand, Arme und Beine greifen abwechselnd */
    poseKlettern(phase) {
      const g = Math.sin(phase);          // Greifzyklus
      drehe(knochen.spine, 0.22, 0, 0, 1);
      drehe(knochen.spine1, 0.16, 0, 0, 1);
      drehe(knochen.head, -0.75, 0, 0, 1);        // Kopf schaut nach oben
      // Arme über Kopf, wechselseitig weiter greifend
      drehe(knochen.leftarm, -2.5 - g * 0.45, 0, 0.55, 1);
      drehe(knochen.rightarm, -2.5 + g * 0.45, 0, -0.55, 1);
      drehe(knochen.leftforearm, -0.55 + g * 0.3, 0, 0, 1);
      drehe(knochen.rightforearm, -0.55 - g * 0.3, 0, 0, 1);
      // Beine angewinkelt wie beim Krabbeln
      drehe(knochen.leftupleg, -1.15 + g * 0.5, 0, 0.4, 1);
      drehe(knochen.rightupleg, -1.15 - g * 0.5, 0, -0.4, 1);
      drehe(knochen.leftleg, 1.5 - g * 0.35, 0, 0, 1);
      drehe(knochen.rightleg, 1.5 + g * 0.35, 0, 0, 1);
      drehe(knochen.leftfoot, 0.5, 0, 0, 1);
      drehe(knochen.rightfoot, 0.5, 0, 0, 1);
    },
    /* Netzschuss-Pose: Arm nach vorn strecken */
    poseSchuss(zielWelt, seite, k) {
      const gross = seite === 'L' ? 'leftarm' : 'rightarm';
      const klein = seite === 'L' ? 'leftforearm' : 'rightforearm';
      zieleKnochen(knochen[gross], knochen[klein], zielWelt, k);
      drehe(knochen[klein], 0, 0, 0, k);
    },
    /* Weltposition einer Hand – für den Netzfaden */
    handPos(seite, out) {
      const bone = haende[seite] || haende.R || haende.L;
      if (!bone) return null;
      root.updateMatrixWorld(true);
      return bone.getWorldPosition(out);
    },
    /* Fremde Animationen stammen von anders proportionierten Figuren.
       Ohne Ausgleich stechen die Füße in den Boden (z. B. beim Schlagen).
       Hier wird der tiefste Fuß gemessen und der Körper so weit angehoben,
       dass er auf dem Boden bleibt. */
    bodenAusgleich(k) {
      if (!fuesse.length) return;
      root.updateMatrixWorld(true);
      let tiefster = Infinity;
      for (const f of fuesse) { f.getWorldPosition(_vb); tiefster = Math.min(tiefster, _vb.y); }
      const relativ = tiefster - root.position.y;
      if (fussRuhe === null) { fussRuhe = relativ; return; }   // Ruhehöhe merken
      /* relativ enthält bereits die bisherige Korrektur – der Fehler wird
         deshalb auf sie aufaddiert, sonst pendelt sich der Fuß zu tief ein. */
      const fehler = (fussRuhe - 0.07) - relativ;
      const ziel = Math.max(0, bodenKorrektur + fehler);
      /* Nach oben sofort ausgleichen (sonst sinkt die Figur kurz ein),
         nach unten weich zurückgleiten. */
      bodenKorrektur = ziel > bodenKorrektur
        ? ziel
        : lerp(bodenKorrektur, ziel, k === undefined ? 0.4 : k);
      inner.position.y = basisY + bodenKorrektur;
    },
    play(key, p, dt) {
      /* Detailstufe nach Entfernung: Skelett-Animation ist teuer, deshalb
         weit entfernte Figuren ausblenden bzw. seltener animieren. */
      const dist2 = root.position.distanceToSquared(player.pos);
      if (dist2 > 130 * 130) { root.visible = false; return; }
      root.visible = true;
      /* Läuft gerade ein Angriff, hat der Vorrang vor Laufen/Stehen */
      if (angriff) {
        angriffT -= dt;
        if (angriffT > 0) { mixer.update(dt); return; }
        /* Gleiche Blenddauer wie beim Einblenden der Grundanimation – sonst
           sinkt die Gesamtgewichtung kurz unter 1 und das Modell rutscht
           sichtbar in die T-Pose zurück. */
        angriff.fadeOut(0.22); angriff = null; current = null;
      }
      if (dist2 > 45 * 45) {
        lodAcc += dt;
        if (++lodFrame % 3) return;      // nur jedes dritte Bild animieren
        dt = lodAcc; lodAcc = 0;
      }
      // Beim Schwingen und Klettern übernimmt die Pose die Führung – als
      // Grundlage dient dann die ruhige Steh-Animation statt des Laufzyklus.
      let want = key;
      if (key === 'swing' || key === 'climb') want = 'idle';
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
    attackOneShot(tempo) {
      const a = actionFor('attack');
      if (!a) return;
      const v = tempo || 1.7;
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      if (current) current.fadeOut(0.1);
      a.reset(); a.timeScale = v; a.fadeIn(0.1); a.play();
      angriff = a;
      angriffT = a.getClip().duration / v;
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
    case 'swing': {
      /* Die Schwunghand wechselt – die Pose spiegelt sich entsprechend. */
      const links = p.hand === 'L';
      const zug = links ? h.shL : h.shR;      // Arm am Seil
      const zugE = links ? h.elL : h.elR;
      const frei = links ? h.shR : h.shL;     // freier Arm
      const freiE = links ? h.elR : h.elL;
      setRot(zug, Math.PI - 0.2, 0, links ? 0.14 : -0.14, k);
      setRot(zugE, -0.12, 0, 0, k);
      // freier Arm deutlich vom Körper weg, sonst steckt er im Rumpf
      setRot(frei, -0.55, 0, links ? -1.15 : 1.15, k);
      setRot(freiE, -0.65, 0, 0, k);
      setRot(h.hipL, -0.85, 0, 0.1, k); setRot(h.kneeL, 1.25, 0, 0, k);
      setRot(h.hipR, -0.3, 0, -0.1, k); setRot(h.kneeR, 0.7, 0, 0, k);
      setRot(h.chest, -0.28, links ? 0.12 : -0.12, 0, k);
      setRot(h.headG, 0.25, 0, 0, k);
      break;
    }
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

/* ======================= Treffer-Effekte ======================= */
/* Kleine Sammlung wiederverwendbarer Effekte: ein aufblitzender Ring und
   ein paar Funken. Das gibt Schlägen spürbares Gewicht. */
const effektRinge = [];
const effektFunken = [];
const ringGeo = new THREE.RingGeometry(0.25, 0.42, 14);
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
  }));
  m.visible = false; scene.add(m);
  effektRinge.push({ mesh: m, t: 0 });
}
const funkenGeo = new THREE.SphereGeometry(0.07, 5, 4);
for (let i = 0; i < 30; i++) {
  const m = new THREE.Mesh(funkenGeo, new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false,
  }));
  m.visible = false; scene.add(m);
  effektFunken.push({ mesh: m, t: 0, vel: V3(0, 0, 0) });
}

function treffEffekt(pos, staerke, farbe) {
  const ring = effektRinge.find((r) => r.t <= 0) || effektRinge[0];
  ring.t = 0.26;
  ring.mesh.visible = true;
  ring.mesh.position.copy(pos);
  ring.mesh.lookAt(camera.position);
  ring.mesh.scale.setScalar(0.5 * staerke);
  ring.mesh.material.color.setHex(farbe || 0xffffff);
  ring.mesh.material.opacity = 0.95;
  let n = 0;
  for (const f of effektFunken) {
    if (f.t > 0) continue;
    f.t = rand(0.22, 0.4);
    f.mesh.visible = true;
    f.mesh.position.copy(pos);
    f.mesh.material.color.setHex(farbe || 0xffe9a8);
    f.vel.set(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).normalize().multiplyScalar(rand(4, 9) * staerke);
    if (++n >= 6 + Math.round(staerke * 3)) break;
  }
}

function updateEffekte(dt) {
  for (const r of effektRinge) {
    if (r.t <= 0) continue;
    r.t -= dt;
    const f = clamp(1 - r.t / 0.26, 0, 1);
    r.mesh.scale.setScalar(0.5 + f * 2.6);
    r.mesh.material.opacity = 0.95 * (1 - f);
    if (r.t <= 0) r.mesh.visible = false;
  }
  for (const f of effektFunken) {
    if (f.t <= 0) continue;
    f.t -= dt;
    f.vel.y -= 22 * dt;
    f.mesh.position.addScaledVector(f.vel, dt);
    f.mesh.material.opacity = clamp(f.t * 4, 0, 1);
    if (f.t <= 0) f.mesh.visible = false;
  }
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
  attackBuffer: null,     // gepufferte Eingabe für flüssige Ketten
  fadenZiel: null, fadenHand: 'R',   // wohin der Netzfaden zeigt
  combo: 0, comboTimer: 0,
  attackCd: 0,
  dodgeT: 0, iFrames: 0, rollT: 0,
  schussT: 0, schussZiel: V3(0, 0, 0),
  hurtCd: 0, regenCd: 0,
  platform: null,
  lastDamageFrom: null,
  dead: false,
  score: 0,
  anim: 'idle',
};

/* Welche Hand gerade schießt – wechselt bei jedem Netzeinsatz */
let netzHand = 'R';
function wechsleNetzHand() { netzHand = netzHand === 'R' ? 'L' : 'R'; return netzHand; }

function heroHandPos(out, seite) {
  const s = seite || netzHand;
  if (heroVisual && heroVisual.procedural) {
    heroVisual.human.root.updateMatrixWorld(true);
    const hand = s === 'L' ? heroVisual.human.handL : heroVisual.human.handR;
    return hand.getWorldPosition(out);
  }
  if (heroVisual && heroVisual.handPos) {
    const p = heroVisual.handPos(s, out);
    if (p) return p;
  }
  // Notfall-Näherung
  const seitlich = s === 'L' ? -0.28 : 0.28;
  return out.set(
    player.pos.x + Math.cos(player.facing) * seitlich + Math.sin(player.facing) * 0.15,
    player.pos.y + 1.45,
    player.pos.z - Math.sin(player.facing) * seitlich + Math.cos(player.facing) * 0.15
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
  /* Guter Ankerpunkt: möglichst weit VOR dem Spieler und deutlich über ihm –
     dann entsteht ein weiter Bogen statt eines abrupten Rucks.
     Die Flugrichtung zählt mit, damit der Schwung nicht bei jedem Kameraruck
     die Richtung wechselt. */
  const f = camForward();
  const vh = Math.hypot(player.vel.x, player.vel.z);
  let rx = f.x, rz = f.z;
  if (vh > 4) {                       // Flugrichtung einmischen
    rx = f.x * 0.55 + (player.vel.x / vh) * 0.45;
    rz = f.z * 0.55 + (player.vel.z / vh) * 0.45;
    const l = Math.hypot(rx, rz) || 1; rx /= l; rz /= l;
  }
  const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
  const wunschWeite = clamp(12 + vh * 1.1, 14, 34);   // schneller = weiter greifen
  let best = null, bestScore = -1e9;
  for (const c of colliders) {
    if (c.h < py + 7) continue;
    const cx = clamp(px + rx * wunschWeite, c.x0, c.x1);
    const cz = clamp(pz + rz * wunschWeite, c.z0, c.z1);
    const dx = cx - px, dz = cz - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > 60 || dist < 3) continue;
    const dot = (dx * rx + dz * rz) / (dist || 1);
    if (dot < 0.3) continue;
    const anchorY = Math.min(c.h - 0.5, py + 16 + dist * 0.55);
    if (anchorY < py + 6) continue;                  // zu flach -> kein Bogen
    const hoehe = anchorY - py;
    const score = dot * 3
                - Math.abs(dist - wunschWeite) / 18   // Wunschweite bevorzugen
                + clamp(hoehe / 26, 0, 1.4);
    if (score > bestScore) { bestScore = score; best = V3(cx, anchorY, cz); }
  }
  if (best) return best;
  // Himmelsanker: hält auch über dem Fluss einen sauberen Bogen
  return V3(px + rx * wunschWeite * 0.55, py + 22, pz + rz * wunschWeite * 0.55);
}

function startSwing() {
  const anchor = findAnchor();
  const abstand = anchor.distanceTo(player.pos);
  const hand = wechsleNetzHand();             // Hände wechseln sich ab
  player.swing = {
    anchor, hand,
    len: Math.max(CFG.ropeMin, abstand),
    zielLen: Math.max(CFG.ropeMin, abstand),
    t: 0,
  };
  player.state = 'swing';
  SFX.thwip();
}

function stopSwing(boost) {
  if (player.state !== 'swing') return;
  player.swing = null;
  player.state = 'air';
  if (boost) {
    /* Am tiefsten Punkt loslassen gibt den größten Schub – wie beim
       echten Pendel wird die Drehbewegung in Weite umgesetzt. */
    const vh = Math.hypot(player.vel.x, player.vel.z);
    player.vel.multiplyScalar(1.05);
    if (player.vel.y > -2) player.vel.y += 2.6;
    else player.vel.y += 1.2;
    if (vh > 6) { player.vel.x *= 1.04; player.vel.z *= 1.04; }
  }
  swingStrand.visible = false;
  SFX.swoosh();
}

function coneTargetEnemy(maxDist, minDot) {
  /* Es gewinnt der Gegner, auf den am genauesten gezielt wird – nicht
     einfach der nächste. So landen mehrere Netzschüsse auch wirklich auf
     demselben Gegner und wickeln ihn Stück für Stück ein. */
  const f = camForward();
  let best = null, bestScore = -1e9;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.pos.x - player.pos.x, dy = (e.pos.y + 1) - (player.pos.y + 1.4), dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist) continue;
    const dot = (dx * f.x + dz * f.z) / (Math.hypot(dx, dz) || 1);
    if (dot < minDot) continue;
    const score = dot * 3 - d / maxDist;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}

function webShot() {
  if (!heroVisual || player.dead || player.attackCd > 0.05) return;
  player.attack = { type: 'web', t: 0, hitDone: true };
  player.attackCd = 0.34;
  const hand = wechsleNetzHand();
  const target = coneTargetEnemy(26, 0.55);
  const ziel = target
    ? V3(target.pos.x, target.pos.y + 1.1, target.pos.z)
    : (() => { const f = camForward();
               return V3(player.pos.x + f.x * 22, player.pos.y + 3.5, player.pos.z + f.z * 22); })();
  // Arm zeigt ab sofort kurz auf das Ziel
  player.schussZiel.copy(ziel);
  player.schussT = 0.3;
  if (heroVisual.poseSchuss) heroVisual.poseSchuss(ziel, hand, 1);
  flashWebShot(heroHandPos(_v1, hand).clone(), ziel);
  SFX.web();
  if (target) {
    applyWeb(target);
    treffEffekt(ziel, 0.8, 0xbfe8ff);
    popupWorld('Eingewickelt!', target.pos, '#bfe8ff');
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
  const hand = wechsleNetzHand();
  player.state = 'zip';
  player.zip = { target, enemy: enemy || null, t: 0.6, hand };
  const dir = _v1.copy(target).sub(player.pos).sub(_v2.set(0, 1.2, 0)).normalize();
  player.vel.copy(dir).multiplyScalar(27);
  flashWebShot(heroHandPos(_v3, hand).clone(), target.clone());
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
    /* Leertaste gedrückt halten soll direkt in den Schwung übergehen –
       ohne diese Freigabe müsste man erst loslassen und neu drücken. */
    player.swingLock = false;
  } else if (player.jumps < 2) {
    player.vel.y = CFG.jumpVel * 0.92;
    player.jumps = 2;
    SFX.swoosh();
  }
}

function dodge() {
  if (player.dead || player.dodgeT > 0 || player.state === 'climb') return;
  const dir = inputDir() || { x: -Math.sin(player.facing), z: -Math.cos(player.facing) };
  /* Kurzer, kräftiger Satz in Bewegungsrichtung; der Körper rollt sich dabei
     einmal ab und ist währenddessen unverwundbar. */
  const tempo = player.onGround ? 19 : 15;
  player.vel.x = dir.x * tempo;
  player.vel.z = dir.z * tempo;
  if (player.onGround) player.vel.y = 3.2;      // kleiner Hüpfer, wirkt sprungiger
  player.facing = Math.atan2(dir.x, dir.z);
  player.dodgeT = CFG.rollDauer;
  player.rollT = CFG.rollDauer;
  player.iFrames = CFG.rollDauer + 0.12;
  player.attack = null;                          // Angriff sauber abbrechen
  player.attackCd = Math.min(player.attackCd, 0.12);
  camShake = Math.max(camShake, 0.03);
  SFX.swoosh();
}

function tryAttack(type) {
  if (!heroVisual || player.dead || player.state === 'climb') return;
  if (player.rollT > 0) return;
  /* Zu früh gedrückt? Eingabe kurz merken und automatisch nachziehen –
     dadurch fühlt sich die Schlagfolge zusammenhängend an. */
  if (player.attackCd > 0) {
    if (player.attackCd < 0.22) player.attackBuffer = { type, t: 0.22 };
    return;
  }
  player.attackBuffer = null;
  player.combo = player.comboTimer > 0 ? player.combo : 0;
  const arm = (player.combo % 2 === 0) ? 'R' : 'L';
  const finisher = type === 'punch' && player.combo > 0 && (player.combo + 1) % 4 === 0;
  player.attack = { type: finisher ? 'kick' : type, t: 0, arm, hitDone: false,
                    finisher, stufe: player.combo };
  heroVisual.attackOneShot(finisher ? 1.35 : (type === 'kick' ? 1.5 : 2.0));
  player.attackCd = finisher ? 0.46 : (type === 'kick' ? 0.38 : 0.27);
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
  const range = a.type === 'kick' ? 3.0 : 2.6;
  const e = nearestEnemy(range, 0.05);
  if (!e) {
    player.combo = 0;                 // Luftschlag bricht die Kombo
    return;
  }
  const wucht = a.finisher ? 1.9 : (a.type === 'kick' ? 1.5 : 1);
  let dmg = (a.type === 'kick' ? 16 : 11) * (a.finisher ? 1.5 : 1);
  if (e.webT > 0) dmg *= 2;           // eingewickelte Gegner sind wehrlos
  dmg *= 1 + Math.min(player.combo, 6) * 0.06;   // Kombo steigert den Schaden

  const treffer = _v1.set(
    (player.pos.x + e.pos.x) / 2,
    Math.max(player.pos.y, e.pos.y) + 1.15,
    (player.pos.z + e.pos.z) / 2
  );
  treffEffekt(treffer, wucht, a.finisher ? 0xffd23c : 0xffffff);

  damageEnemy(e, dmg, a.type);
  player.combo++;
  player.comboTimer = 3;
  hitstop(a.finisher ? 0.11 : (a.type === 'kick' ? 0.075 : 0.05));
  camShake = Math.max(camShake, 0.05 + wucht * 0.035);
  (a.type === 'kick' ? SFX.kick : SFX.punch)();

  // Rückstoß – Finisher schleudert den Gegner richtig weg
  const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  const kb = (a.type === 'kick' ? 9 : 5.5) * wucht;
  e.vel.x += (dx / d) * kb; e.vel.z += (dz / d) * kb;
  e.vel.y += (a.type === 'kick' ? 4 : 2) * wucht;
  e.staggerT = Math.max(e.staggerT, a.finisher ? 0.9 : 0.5);
  if (e.visual && e.visual.attackOneShot && !e.dead) e.visual.attackOneShot(2.2);

  /* Leichter Vorwärtsschub des Helden: die Schläge "greifen" dadurch */
  player.vel.x += (dx / d) * 2.2;
  player.vel.z += (dz / d) * 2.2;
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
    player.phase += dt * (1 + (Math.abs(up) + Math.abs(side)) * 6);
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
    player.fadenZiel = t; player.fadenHand = player.zip.hand;
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
  } else if (wantSwing && player.state === 'air' && !player.swingLock) {
    /* Direkt über dem Boden gibt es keinen brauchbaren Bogen – erst ab etwas
       Höhe oder im Fallen greift das Netz. Startet man tief, gibt es einen
       kräftigen Satz nach oben, damit der Schwung Platz hat. */
    const hoehe = player.pos.y - groundY(player.pos.x, player.pos.z);
    if (hoehe > 2.0 || player.vel.y < 0) {
      if (hoehe < 7 && player.vel.y < 4) player.vel.y = Math.max(player.vel.y, 5.5);
      startSwing();
    }
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
      /* Kräftige Bodenreibung: ohne Eingabe steht die Figur zügig still,
         statt noch meterweit zu schlittern. */
      player.vel.x = lerp(player.vel.x, 0, Math.min(1, dt * 22));
      player.vel.z = lerp(player.vel.z, 0, Math.min(1, dt * 22));
      if (Math.hypot(player.vel.x, player.vel.z) < 0.35) { player.vel.x = 0; player.vel.z = 0; }
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

  /* ---- Seil ----
     Das Seil wird in mehreren Teilschritten gelöst. Ein einziger Schritt pro
     Bild lässt das Pendel bei hohem Tempo hart anschlagen – genau das hat den
     Schwung ruckeln lassen. */
  if (player.state === 'swing' && player.swing) {
    const s = player.swing;
    s.t += dt;
    /* Seil sanft auf die Wunschlänge bringen statt ruckartig einzuholen */
    const tief = player.pos.y < s.anchor.y - s.zielLen * 0.72;   // nahe dem Tiefpunkt?
    if (keys['KeyW'] || keys['ArrowUp']) {
      // Pumpen: unten einholen, oben nachgeben – so schaukelt man sich hoch
      s.zielLen += (tief ? -6 : 4) * dt;
    } else {
      s.zielLen -= 0.8 * dt;
    }
    s.zielLen = clamp(s.zielLen, CFG.ropeMin, 46);
    s.len = lerp(s.len, s.zielLen, Math.min(1, dt * 3.5));

    const schritte = 4;
    const hdt = dt / schritte;
    for (let i = 0; i < schritte; i++) {
      const d = _v1.copy(player.pos).sub(s.anchor);
      const dist = d.length() || 0.001;
      if (dist > s.len) {
        const n = d.multiplyScalar(1 / dist);
        player.pos.copy(s.anchor).addScaledVector(n, s.len);
        const vn = player.vel.dot(n);
        if (vn > 0) player.vel.addScaledVector(n, -vn * 0.98);   // weich abfangen
        /* Tangentialer Antrieb in Blickrichtung: fühlt sich an wie Schwung
           holen, ohne das Pendel zu verzerren. */
        if (keys['KeyW'] || keys['ArrowUp']) {
          const f = camForward();
          _v2.copy(f).addScaledVector(n, -f.dot(n)).normalize();
          player.vel.addScaledVector(_v2, 16 * hdt);
        }
      }
    }
    player.vel.multiplyScalar(1 - 0.02 * dt);
    const maxV = 40;
    if (player.vel.length() > maxV) player.vel.setLength(maxV);
    if (player.vel.length() > 2) {
      player.facing = dampAngle(player.facing, Math.atan2(player.vel.x, player.vel.z), dt * 8);
    }
    player.fadenZiel = s.anchor; player.fadenHand = s.hand;
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
  if (player.attackBuffer) {
    player.attackBuffer.t -= dt;
    if (player.attackCd <= 0) { const b = player.attackBuffer; player.attackBuffer = null; tryAttack(b.type); }
    else if (player.attackBuffer.t <= 0) player.attackBuffer = null;
  }
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
    a.t += dt / (a.finisher ? 0.46 : (a.type === 'kick' ? 0.4 : 0.3));
    if (!a.hitDone && a.t > 0.33) { a.hitDone = true; resolveAttackHit(); }
    if (a.t >= 1) player.attack = null;
  }

  /* ---- Animation wählen ---- */
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.state === 'swing') player.anim = 'swing';
  else if (player.state === 'zip') player.anim = 'air';
  else if (!player.onGround) player.anim = 'air';
  else if (dir && hSpeed > 0.4) {
    /* Nur laufen, wenn auch wirklich eine Richtungstaste gedrückt ist –
       sonst „läuft" die Figur beim Ausrollen weiter, obwohl man steht. */
    player.anim = 'run';
    player.phase += dt * (5 + hSpeed * 1.15);
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

  /* Beim Klettern lehnt der Körper leicht zur Wand – das liest sich sofort
     als Kleben statt als Hochlaufen. */
  if (player.state === 'climb') {
    r.rotation.x = lerp(r.rotation.x, 0.28, Math.min(1, dt * 10));
  } else
  /* Ausweichen: schneller Satz mit Vorlage – bewusst OHNE Überschlag.
     Die frühere Rolle drehte den Körper um die Füße, dadurch verschwand die
     Figur im Boden und tauchte anschließend von oben wieder auf. */
  if (player.rollT > 0) {
    player.rollT -= dt;
    const fortschritt = 1 - clamp(player.rollT / CFG.rollDauer, 0, 1);
    const bogen = Math.sin(fortschritt * Math.PI);
    r.rotation.x = lerp(r.rotation.x, 0.55 * bogen, Math.min(1, dt * 18));
  } else {
    // Körperneigung beim Schwingen/Fallen
    let tilt = 0;
    if (player.state === 'swing') tilt = clamp(player.vel.y * 0.02, -0.45, 0.35) - 0.35;
    else if (player.state === 'air') tilt = clamp(-player.vel.y * 0.015, -0.25, 0.3);
    r.rotation.x = lerp(r.rotation.x, tilt, Math.min(1, dt * 8));
  }

  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  heroVisual.play(player.anim, {
    phase: player.phase,
    speed01: clamp(hSpeed / CFG.sprintSpeed, 0, 1),
    t: elapsed,
    hand: player.swing ? player.swing.hand : netzHand,
  }, dt);

  if (heroVisual.procedural) {
    overlayAttack(heroVisual.human, player.attack, dt);
  } else {
    /* Pose-Korrekturen für das Menschmodell (nach der Animation) */
    if (player.attack && player.attack.type !== 'web') {
      /* Die geladene Schlag-Animation führt allein – eigene Knochenposen
         haben hier wiederholt für schiefe Haltungen gesorgt. */
      heroVisual.bodenAusgleich(1);
    } else if (player.state === 'swing' && player.swing) {
      heroVisual.poseSchwung(player.swing.anchor, player.swing.hand, elapsed);
    } else if (player.state === 'climb') {
      heroVisual.poseKlettern(player.phase);
    } else if (player.state === 'zip' && player.zip) {
      heroVisual.poseSchuss(player.zip.target, player.zip.hand, 1);
    } else if (player.schussT > 0) {
      player.schussT -= dt;
      heroVisual.poseSchuss(player.schussZiel, netzHand, 1);
    } else if (player.onGround) {
      heroVisual.bodenAusgleich(Math.min(1, dt * 12));   // Füße bleiben oben
    }
  }

  /* Netzfaden ganz zum Schluss setzen – erst jetzt steht die Hand wirklich
     dort, wo sie im Bild zu sehen ist. Vorher hing der Faden ein Bild
     hinterher und schnitt durch den Körper. */
  if (player.fadenZiel) {
    heroVisual.root.updateMatrixWorld(true);
    placeStrand(swingStrand, heroHandPos(_v3, player.fadenHand), player.fadenZiel);
    player.fadenZiel = null;
  }
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
    c.pos.y = lerp(c.pos.y, groundY(c.pos.x, c.pos.z), Math.min(1, dt * 12));
    c.pos.y = Math.max(c.pos.y, groundY(c.pos.x, c.pos.z) - 0.02);
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
    if (c.visual.bodenAusgleich) c.visual.bodenAusgleich(Math.min(1, dt * 12));
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

/* ---- Netzkokon ----
   Statt einer glatten Kugel ein unregelmäßig umwickeltes Bündel: leicht
   verbeulter Körper plus quer laufende Netzbänder und ein paar Fäden. */
const cocoonMat = new THREE.MeshLambertMaterial({
  color: 0xeef1f4, transparent: true, opacity: 0.93, flatShading: true,
});
const bandMat = new THREE.MeshLambertMaterial({ color: 0xfbfdff });

const cocoonKoerperGeo = (() => {
  const g = new THREE.SphereGeometry(0.46, 14, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // in die Länge ziehen und unregelmäßig eindellen
    const beule = 1 + Math.sin(y * 22) * 0.05 + Math.sin(x * 17 + z * 13) * 0.04;
    pos.setXYZ(i, x * beule, y * 1.95, z * beule);
  }
  g.computeVertexNormals();
  return g;
})();
const bandGeo = new THREE.TorusGeometry(0.47, 0.045, 5, 14);

/* Der Kokon wächst mit der Anzahl der Treffer:
   Stufe 1 = ein paar Fäden quer über den Körper,
   Stufe 2 = deutlich mehr Wicklungen,
   Stufe 3 = komplett eingesponnen. Ein einzelner Schuss wickelt also
   niemanden mehr vollständig ein. */
function makeCocoon() {
  const g = new THREE.Group();
  const koerper = new THREE.Mesh(cocoonKoerperGeo, cocoonMat);
  koerper.castShadow = true;
  koerper.visible = false;                // erst ab Stufe 3
  g.add(koerper);
  const baender = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(bandGeo, bandMat);
    const t = -0.78 + i * 0.26;
    b.position.y = t;
    b.rotation.x = Math.PI / 2 + rand(-0.3, 0.3);
    b.rotation.z = rand(-0.25, 0.25);
    const w = (1 - Math.abs(t) * 0.4) * 0.92;
    b.scale.set(w, w, 1);
    b.visible = false;
    g.add(b); baender.push(b);
  }
  const faeden = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, rand(0.6, 1.2), 4), bandMat);
    f.position.set(rand(-0.3, 0.3), rand(-0.6, 0.6), rand(-0.3, 0.3));
    f.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    f.visible = false;
    g.add(f); faeden.push(f);
  }
  g.userData.setzeStufe = (stufe) => {
    // Stufe 1: 2 Bänder + 2 Fäden · Stufe 2: 4 Bänder + alle Fäden · Stufe 3: alles
    const bAnzahl = stufe >= 3 ? baender.length : (stufe === 2 ? 4 : 2);
    baender.forEach((b, i) => { b.visible = i < bAnzahl; });
    faeden.forEach((f, i) => { f.visible = stufe >= 2 || i < 2; });
    koerper.visible = stufe >= 3;
  };
  return g;
}

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
    const cocoon = makeCocoon();
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
      staggerT: 0, webT: 0, webStufe: 0,
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
  /* Jeder weitere Treffer wickelt fester ein. Erst ab Stufe 3 ist der
     Gegner vollständig bewegungsunfähig. */
  e.webStufe = Math.min(3, (e.webStufe || 0) + 1);
  e.webT = Math.max(e.webT, 1.6 + e.webStufe * 1.6);
  if (e.cocoon && e.cocoon.userData.setzeStufe) e.cocoon.userData.setzeStufe(e.webStufe);
  if (e.webStufe >= 3) { e.vel.set(0, 0, 0); e.attack = null; }
  else { e.vel.multiplyScalar(0.3); e.staggerT = Math.max(e.staggerT, 0.35); }
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
      if (e.webT <= 0) { e.cocoon.visible = false; e.webStufe = 0; }
      /* Nur voll eingesponnene Gegner stehen still – teilweise eingewickelte
         zappeln weiter und können sich langsam bewegen. */
      if (e.webStufe >= 3) {
        e.visual.root.position.copy(e.pos);
        e.visual.play('webbed', { t: elapsed }, dt);
        continue;
      }
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
      // Pose erst nach der Animation setzen, sonst überschreibt der Mixer sie
      if (e.visual.poseTreffer) e.visual.poseTreffer(1 - e.staggerT / 0.9);
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

    if (e.webT > 0) speed *= 0.35;      // im Netz zappelnd, kaum vorwärts
    e.vel.x = moveX * speed; e.vel.z = moveZ * speed;
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    collideBody(e);
    /* Höhe weich nachführen: bei Bordsteinkanten sonst sichtbares Springen,
       und niemals unter den Boden. */
    e.pos.y = lerp(e.pos.y, groundY(e.pos.x, e.pos.z), Math.min(1, dt * 12));
    e.pos.y = Math.max(e.pos.y, groundY(e.pos.x, e.pos.z) - 0.02);
    if (speed > 0.1) e.phase += dt * (4 + speed * 1.7);

    e.visual.root.position.copy(e.pos);
    e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, 0, dt * 8);
    e.visual.root.rotation.y = e.facing;
    e.visual.play(anim === 'run' ? 'run' : 'idle',
      { phase: e.phase, speed01: clamp(speed / 5, 0, 1), t: elapsed + e.phase }, dt);
    if (e.visual.procedural) overlayAttack(e.visual.human, e.attack, dt);
    else if (e.visual.bodenAusgleich) e.visual.bodenAusgleich(Math.min(1, dt * 12));
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
  updateEffekte(dt);

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
    get heroVisual() { return heroVisual; },
    colliders,
    // Kamera auf einen Punkt ausrichten (nur für automatisierte Aufnahmen)
    lookAt(x, z) { camYaw = Math.atan2(-(x - player.pos.x), -(z - player.pos.z)); },
  };
}

})();
