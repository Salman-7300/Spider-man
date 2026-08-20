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
  runSpeed: 7,
  sprintSpeed: 11,
  airAccel: 10,
  jumpVel: 11.5,
  climbSpeed: 4.5,
  /* Abstand der Körpermitte zur Wand beim Klettern. Vorher wurde der volle
     Kollisionsradius (0,45 m) benutzt – dadurch schwebte die Figur sichtbar
     vor dem Haus, statt daran zu kleben. */
  climbGap: 0.15,
  ropeMin: 7,
  playerHP: 100,
  enemyHP: 34,
  civCount: 22,
  carCount: 26,
  heliCount: 2,
  maxEnemies: 14,
  rollDauer: 0.45,
};
/* Abstand, auf den der Held im Nahkampf herangeht: halber Körper (0,45) +
   halber Gegner (0,4) + ein Stück Arm. So berühren sich die Figuren beim
   Schlag wirklich. */
const NAHKAMPF = 1.05;

const BLOCKS = 7;           // 7x7 Häuserblöcke
const PITCH = 50;           // Rasterabstand (Block + Straße)
const ORIGIN = -175;        // Rasterursprung (Straßenlinien bei -175..175)
const ROAD_HALF = 6;        // halbe Asphaltbreite
const SLAB_H = 0.25;        // Gehweg-/Blocksockelhöhe
const RIVER_X0 = 186, RIVER_X1 = 330;   // Fluss
const SHORE_X0 = 330, SHORE_X1 = 400;   // gegenüberliegendes Ufer
const BRIDGE_Z = -25, BRIDGE_HW = 7.5;  // Brücke entlang der Straße z=-25
/* Eigenes, etwas engeres Raster für den Stadtteil am anderen Ufer.
   Vorher standen dort nur 16 nackte Quader auf einer leeren Platte –
   deshalb wirkte die andere Seite leer und unfertig. */
const SHORE_PITCH = 32, SHORE_ROAD = 5;
const SHORE_OX = 336, SHORE_OZ = -192;
const SHORE_NX = 2, SHORE_NZ = 12;
/* Die Brücke mündet bei z = BRIDGE_Z – dieser Streifen bleibt Straße. */
function uferBlockFrei(cx, cz) {
  return !(Math.abs(cz - BRIDGE_Z) < SHORE_PITCH * 0.7 && cx < SHORE_OX + SHORE_PITCH);
}
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
    hupe() { tone(430, 0.28, 'square', 0.07); setTimeout(() => tone(360, 0.22, 'square', 0.06), 60); },
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

const sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10; sun.shadow.camera.far = 400;
sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
sun.shadow.bias = -0.0004;
scene.add(sun); scene.add(sun.target);
const himmel = new THREE.HemisphereLight(0xcfe4ff, 0x51452e, 0.85);

/* ======================= Tag und Nacht =======================
   Ein voller Umlauf dauert acht Minuten: Morgen, Mittag, Abend, Nacht.
   Sonnenstand, Farben, Nebel und Himmel wandern mit. Nachts leuchten die
   Fenster, Ampeln und der Suchscheinwerfer erst richtig. */
scene.add(himmel);
const TAG = { dauer: 900, zeit: 0.42 };   // 0 = Mitternacht, 0.5 = Mittag
/* Ein voller Tag dauert jetzt 15 statt 8 Minuten – vorher stand man
   gefühlt ständig im Dunkeln. */
const SONNE_RICHTUNG = new THREE.Vector3(0.5, 0.8, 0.3);
const _mischFarbe = new THREE.Color();
const _tagA = new THREE.Color(), _tagB = new THREE.Color();

function mischen(ziel, farbeA, farbeB, t) {
  _tagA.setHex(farbeA); _tagB.setHex(farbeB);
  ziel.copy(_tagA).lerp(_tagB, t);
  return ziel;
}

if (typeof window !== "undefined") window.__setzeZeit = (t) => { TAG.zeit = t; };
/* ======================= Wetter =======================
   Regen zieht ab und zu über die Stadt. Die Tropfen sind ein einziges
   Punktobjekt, das um die Kamera herum mitwandert – dadurch kostet der
   ganze Regen nur einen Zeichenaufruf. */
const REGEN = { an: false, staerke: 0, naechsterWechsel: 70 };
let regenPunkte = null, regenGeschw = null;
const REGEN_ANZAHL = 3200, REGEN_BOX = 55;

function baueRegen() {
  /* Jeder Tropfen ist ein kurzer Strich statt eines Punktes – erst dadurch
     sieht es nach Regen aus und nicht nach Schneeflocken. */
  const pos = new Float32Array(REGEN_ANZAHL * 6);
  regenGeschw = new Float32Array(REGEN_ANZAHL);
  for (let i = 0; i < REGEN_ANZAHL; i++) {
    const x = rand(-REGEN_BOX, REGEN_BOX), y = rand(0, 48), z = rand(-REGEN_BOX, REGEN_BOX);
    pos[i * 6] = x;     pos[i * 6 + 1] = y;        pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - 0.7;  pos[i * 6 + 5] = z;
    regenGeschw[i] = rand(30, 48);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  regenPunkte = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color: 0xc6d8ea, transparent: true, opacity: 0, depthWrite: false }));
  regenPunkte.frustumCulled = false;
  scene.add(regenPunkte);
}

function updateWetter(dt) {
  if (!regenPunkte) baueRegen();
  REGEN.naechsterWechsel -= dt;
  if (REGEN.naechsterWechsel <= 0) {
    REGEN.an = !REGEN.an;
    REGEN.naechsterWechsel = REGEN.an ? rand(50, 110) : rand(120, 240);
  }
  const ziel = REGEN.an ? 1 : 0;
  REGEN.staerke += clamp(ziel - REGEN.staerke, -dt * 0.25, dt * 0.25);
  regenPunkte.material.opacity = REGEN.staerke * 0.42;
  regenPunkte.visible = REGEN.staerke > 0.02;
  if (!regenPunkte.visible) return;

  /* Tropfen fallen; wer unten ankommt, wird oben neu eingesetzt.
     Das ganze Feld folgt der Kamera, damit es nie ausgeht. */
  const pos = regenPunkte.geometry.attributes.position;
  const a = pos.array;
  const cx = camera.position.x, cz = camera.position.z, cy = camera.position.y;
  for (let i = 0; i < REGEN_ANZAHL; i++) {
    const o = i * 6;
    let x = a[o] + 5 * dt;
    let y = a[o + 1] - regenGeschw[i] * dt;
    let z = a[o + 2];
    if (y < cy - 28) { y = cy + 28; x = cx + rand(-REGEN_BOX, REGEN_BOX); z = cz + rand(-REGEN_BOX, REGEN_BOX); }
    if (Math.abs(x - cx) > REGEN_BOX) x = cx - Math.sign(x - cx) * REGEN_BOX;
    if (Math.abs(z - cz) > REGEN_BOX) z = cz - Math.sign(z - cz) * REGEN_BOX;
    a[o] = x;     a[o + 1] = y;        a[o + 2] = z;
    a[o + 3] = x - 0.09; a[o + 4] = y - 0.8; a[o + 5] = z;
  }
  pos.needsUpdate = true;
}

if (typeof window !== "undefined") {
  window.__regenAn = () => { REGEN.an = true; REGEN.staerke = 1; REGEN.naechsterWechsel = 999; };
  window.__regenInfo = () => ({ an: REGEN.an, staerke: +REGEN.staerke.toFixed(2), sichtbar: regenPunkte ? regenPunkte.visible : null });
}
function updateTagNacht(dt) {
  TAG.zeit = (TAG.zeit + dt / TAG.dauer) % 1;
  const w = TAG.zeit * Math.PI * 2;
  /* Sonnenhöhe: -1 (tiefe Nacht) bis +1 (Mittag) */
  const hoch = -Math.cos(w);
  const tagAnteil = clamp((hoch + 0.25) / 1.1, 0, 1);
  /* Dämmerung: kurz vor Sonnenauf- und -untergang am stärksten */
  const daemmer = clamp(1 - Math.abs(hoch) * 3.2, 0, 1);

  /* Nur die RICHTUNG merken – die Position setzt die Kamera, damit der
     Schattenausschnitt dem Spieler folgt. */
  SONNE_RICHTUNG.set(Math.sin(w) * 0.8, Math.max(0.12, hoch), Math.cos(w * 0.6) * 0.6 + 0.35).normalize();
  sun.intensity = 0.4 + tagAnteil * 0.85;
  mischen(sun.color, 0xff9a55, 0xfff2dd, 1 - daemmer);
  /* Nachts deutlich heller als vorher: bei Nacht UND Regen war das Bild
     fast schwarz, man konnte weder Gegner noch die eigene Figur erkennen.
     Eine Großstadt bei Nacht ist durch Straßen- und Fensterlicht ohnehin
     nie wirklich dunkel. */
  himmel.intensity = 0.72 + tagAnteil * 0.36;

  const himmelFarbe = daemmer > 0.35
    ? mischen(_mischFarbe, 0x121a2e, 0xe0794a, daemmer)
    : mischen(_mischFarbe, 0x1b2740, 0x9fc4e8, tagAnteil);
  scene.background.copy(himmelFarbe);
  scene.fog.color.copy(himmelFarbe).lerp(_tagB.setHex(0xffffff), 0.12 * tagAnteil);

  /* Nachts wird die Sicht kürzer – das gibt Tiefe und spart Rechenzeit. */
  scene.fog.near = 110 + tagAnteil * 60;
  scene.fog.far = 300 + tagAnteil * 240;
  if (REGEN.staerke > 0.02) {
    /* Bei Regen wird alles grauer und die Sicht kürzer. */
    scene.background.lerp(_tagB.setHex(0x5a6472), REGEN.staerke * 0.55);
    scene.fog.color.lerp(_tagB.setHex(0x5a6472), REGEN.staerke * 0.55);
    scene.fog.far *= 1 - REGEN.staerke * 0.3;
    /* Regen dämpft nur noch leicht – zusammen mit der Nacht war es sonst
       zappenduster. */
    sun.intensity *= 1 - REGEN.staerke * 0.25;
  }
  window.__nacht = tagAnteil < 0.35;
}

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
  return Math.abs(z - BRIDGE_Z) < BRIDGE_HW && x > 178 && x < RIVER_X1 + 4;
}
function inWater(x, z) {
  return x > RIVER_X0 && x < RIVER_X1 && !onBridge(x, z);
}
function groundY(x, z) {
  if (x >= SHORE_X1 || x <= -195 || Math.abs(z) >= 195) return 0;
  if (onBridge(x, z)) return 0.3;
  if (x > RIVER_X0) {
    if (x < SHORE_X0) return WATER_Y;
    /* Auch drüben gibt es Gehwege – sonst steckten die Füße im Sockel. */
    const bi = Math.floor((x - SHORE_OX) / SHORE_PITCH);
    const bj = Math.floor((z - SHORE_OZ) / SHORE_PITCH);
    if (bi < 0 || bi >= SHORE_NX || bj < 0 || bj >= SHORE_NZ) return 0;
    const cx = SHORE_OX + bi * SHORE_PITCH + SHORE_PITCH / 2;
    const cz = SHORE_OZ + bj * SHORE_PITCH + SHORE_PITCH / 2;
    if (!uferBlockFrei(cx, cz)) return 0;
    const u = x - (cx - SHORE_PITCH / 2), v = z - (cz - SHORE_PITCH / 2);
    if (u > SHORE_ROAD && u < SHORE_PITCH - SHORE_ROAD &&
        v > SHORE_ROAD && v < SHORE_PITCH - SHORE_ROAD) return SLAB_H;
    return 0;
  }
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

/* ---------- Stadt-Details ----------
   Gesimse, Ladenzeilen, Feuerleitern, Dachaufbauten: Das sind pro Haus
   schnell zwanzig Kisten – bei über hundert Häusern wären das tausende
   einzelne Objekte und damit tausende Zeichenaufrufe pro Bild.
   Deshalb werden alle Details gesammelt und am Ende zu EINER Geometrie
   verschmolzen. Die Farbe steckt dann in den Eckpunkten. */
const dekoTeile = [];
function deko(w, h, d, x, y, z, farbe, ry) {
  dekoTeile.push({ w, h, d, x, y, z, farbe, ry: ry || 0 });
}

function baueDekoMesh() {
  if (!dekoTeile.length) return;
  const basis = new THREE.BoxGeometry(1, 1, 1);
  const bp = basis.attributes.position, bn = basis.attributes.normal, bi = basis.index;
  const anzahl = dekoTeile.length;
  const positionen = new Float32Array(anzahl * bp.count * 3);
  const normalen = new Float32Array(anzahl * bp.count * 3);
  const farben = new Float32Array(anzahl * bp.count * 3);
  const indizes = new Uint32Array(anzahl * bi.count);
  const m = new THREE.Matrix4(), nm = new THREE.Matrix3();
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion();
  const skal = new THREE.Vector3(), eul = new THREE.Euler();
  const v = new THREE.Vector3(), farbe = new THREE.Color();
  let vo = 0, io = 0;
  for (const t of dekoTeile) {
    eul.set(0, t.ry, 0);
    m.compose(pos.set(t.x, t.y, t.z), quat.setFromEuler(eul), skal.set(t.w, t.h, t.d));
    nm.getNormalMatrix(m);
    farbe.set(t.farbe);
    for (let i = 0; i < bp.count; i++) {
      v.fromBufferAttribute(bp, i).applyMatrix4(m);
      positionen[(vo + i) * 3] = v.x; positionen[(vo + i) * 3 + 1] = v.y; positionen[(vo + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(bn, i).applyMatrix3(nm).normalize();
      normalen[(vo + i) * 3] = v.x; normalen[(vo + i) * 3 + 1] = v.y; normalen[(vo + i) * 3 + 2] = v.z;
      farben[(vo + i) * 3] = farbe.r; farben[(vo + i) * 3 + 1] = farbe.g; farben[(vo + i) * 3 + 2] = farbe.b;
    }
    for (let i = 0; i < bi.count; i++) indizes[io + i] = bi.getX(i) + vo;
    vo += bp.count; io += bi.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positionen, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(normalen, 3));
  g.setAttribute('color', new THREE.BufferAttribute(farben, 3));
  g.setIndex(new THREE.BufferAttribute(indizes, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  cityGroup.add(mesh);
  dekoTeile.length = 0;
}

/* Ladenzeile, Gesims, Feuerleiter und Dachaufbauten für ein Haus. */
const MARKISEN = [0x7d3029, 0x2e4f3c, 0x2b3f5e, 0x6b5730, 0x4f3350];
function schmueckeHaus(w, h, d, x, z) {
  const unten = SLAB_H, oben = SLAB_H + h;

  /* Erdgeschoss: dunkler Sockel mit Schaufensterband und Vordach.
     Auf Straßenhöhe spielt der Kampf – dort fällt Detail am meisten auf. */
  deko(w + 0.5, 3.0, d + 0.5, x, unten + 1.5, z, 0x23272f);
  deko(w + 0.62, 0.9, d + 0.62, x, unten + 2.1, z, 0xffe9a8);   // Schaufensterband
  const markise = pick(MARKISEN);
  deko(w + 1.05, 0.15, d + 1.05, x, unten + 3.2, z, markise);    // Vordach
  addCollider({ x0: x - (w + 1.05) / 2, x1: x + (w + 1.05) / 2,
                z0: z - (d + 1.05) / 2, z1: z + (d + 1.05) / 2,
                h: unten + 3.28, y0: unten + 2.9, klein: true });

  /* Gesims am Dachrand – gibt dem Haus oben einen Abschluss. Es steht
     45 cm über die Wand hinaus; ohne Kollision stand man mit den Beinen
     mitten darin. */
  deko(w + 0.9, 0.55, d + 0.9, x, oben - 0.28, z, 0x8b9099);
  addCollider({ x0: x - (w + 0.9) / 2, x1: x + (w + 0.9) / 2,
                z0: z - (d + 0.9) / 2, z1: z + (d + 0.9) / 2,
                h: oben, y0: oben - 0.9, klein: true });
  deko(w + 0.5, 0.7, d + 0.5, x, oben - 1.1, z, 0x6f757e);

  /* Feuerleiter an einer Seitenwand – beim Klettern und Schwingen
     ständig im Blick. */
  if (h > 22 && Math.random() < 0.55) {
    const anX = Math.random() < 0.5;
    const seite = Math.random() < 0.5 ? 1 : -1;
    const ebenen = Math.min(7, Math.floor((h - 6) / 4.5));
    for (let e = 0; e < ebenen; e++) {
      const y = unten + 4.5 + e * 4.5;
      if (y > oben - 2) break;
      const px = anX ? x + seite * (w / 2 + 0.5) : x + rand(-w / 4, w / 4);
      const pz = anX ? z + rand(-d / 4, d / 4) : z + seite * (d / 2 + 0.5);
      const bw = anX ? 1.4 : 3.0, bd = anX ? 3.0 : 1.4;
      deko(bw, 0.16, bd, px, y, pz, 0x30343a);                    // Podest
      deko(bw, 0.75, 0.07, px, y + 0.45, pz + (anX ? 0 : seite * 0.45), 0x4a5058);
      if (anX) deko(0.07, 0.75, bd, px + seite * 0.45, y + 0.45, pz, 0x4a5058);
      /* Das Podest ist begehbar. Ohne Kollision ist man bisher glatt
         hindurchgefallen bzw. mitten im Balkon gestanden.
         "klein" heißt: kein Ziel für den Netzanker. */
      addCollider({ x0: px - bw / 2, x1: px + bw / 2, z0: pz - bd / 2, z1: pz + bd / 2,
                    h: y + 0.08, y0: y - 0.3, klein: true });
      // Leiter zur nächsten Ebene
      if (e < ebenen - 1) deko(0.5, 4.5, 0.09, px, y + 2.25, pz, 0x3d4249);
    }
  }

  /* Dachaufbauten: Lüftungskästen, Rohre, Antenne, manchmal Reklame. */
  const anzahl = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < anzahl; i++) {
    const kw = rand(1.2, 2.6), kh = rand(0.7, 1.8), kd = rand(1.2, 2.6);
    deko(kw, kh, kd, x + rand(-w / 2 + 1.5, w / 2 - 1.5), oben + kh / 2,
         z + rand(-d / 2 + 1.5, d / 2 - 1.5), pick([0x767c85, 0x646a72, 0x878d96]));
  }
  for (let i = 0; i < 2; i++) {
    deko(0.35, rand(1.2, 2.4), 0.35, x + rand(-w / 3, w / 3), oben + 1.0,
         z + rand(-d / 3, d / 3), 0x555b63);
  }
  if (Math.random() < 0.45) {                       // Antennenmast
    const ah = rand(4, 9);
    deko(0.22, ah, 0.22, x + rand(-w / 4, w / 4), oben + ah / 2, z + rand(-d / 4, d / 4), 0x484d55);
  }
  if (h > 30 && Math.random() < 0.3) {              // Reklametafel
    const bw = Math.min(w * 0.9, 10), bh = rand(3, 5);
    const quer = Math.random() < 0.5;
    deko(quer ? bw : 0.3, bh, quer ? 0.3 : bw, x, oben + bh / 2 + 0.6, z,
         pick([0xc8402f, 0x2f6fc8, 0xe0b23a, 0x35a06a]));
    deko(quer ? bw : 0.5, 0.5, quer ? 0.5 : bw, x, oben + 0.3, z, 0x3a3f47);
  }
}

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

  /* Fahrbahnmarkierungen. Sie gehen ins gemeinsame Sammel-Mesh: einzeln
     gezeichnet waren das über 500 Zeichenaufrufe allein für die Striche –
     der mit Abstand größte Posten der ganzen Stadt. */
  const nearCrossing = (s) => {
    const u = ((s - ORIGIN) % PITCH + PITCH) % PITCH;
    return u < ROAD_HALF + 3 || u > PITCH - ROAD_HALF - 3;
  };
  for (let i = 0; i <= BLOCKS; i++) {
    const L = ORIGIN + i * PITCH;
    for (let s = -186; s < 186; s += 10) {
      if (nearCrossing(s)) continue;
      deko(0.35, 0.04, 4, L, 0.02, s, 0xd9c979);
      deko(4, 0.04, 0.35, s, 0.02, L, 0xd9c979);
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
  baueAmpeln();
  baueDekoMesh();
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
  schmueckeHaus(w, h, d, x, z);
  /* Hohe Häuser bekommen Staffelgeschosse: Der Turm wird nach oben
     schmaler, statt als glatter Quader zu enden. Jede Stufe ist ein
     eigenes Hindernis, an dem man auch klettern kann. */
  if (h > 45) {
    let sw = w, sd = d, sy = SLAB_H + h;
    const stufen = h > 75 ? 2 : 1;
    for (let i = 0; i < stufen; i++) {
      sw *= rand(0.62, 0.78); sd *= rand(0.62, 0.78);
      const sh = rand(6, 14);
      const st = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), mats);
      st.position.set(x, sy + sh / 2, z);
      st.castShadow = true; st.receiveShadow = true;
      cityGroup.add(st);
      addCollider({ x0: x - sw / 2, x1: x + sw / 2, z0: z - sd / 2, z1: z + sd / 2, h: sy + sh });
      deko(sw + 0.7, 0.45, sd + 0.7, x, sy + sh - 0.22, z, 0x8b9099);
      sy += sh;
    }
  }
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
  for (let z = -190; z < 190; z += 8) {
    if (Math.abs(z - BRIDGE_Z) < BRIDGE_HW + 3) continue;
    deko(0.2, 1, 7, RIVER_X0 - 0.3, 0.5, z + 3.5, 0x22343f);
  }

  /* Brücke. Fahrbahn und Geländer beginnen erst dort, wo die Brücke
     wirklich anfängt (x = BR_X0). Vorher ragten die knallroten Geländer
     bis weit in die Stadtstraße hinein und standen als große rote Keile
     mitten auf der Fahrbahn – genau das war der Fehler vor der Brücke. */
  const BR_X0 = 178, BR_X1 = RIVER_X1 + 4;
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BR_X1 - BR_X0, 0.6, BRIDGE_HW * 2),
    new THREE.MeshLambertMaterial({ map: asphaltTex }));
  deck.position.set((BR_X0 + BR_X1) / 2, 0, BRIDGE_Z);
  deck.receiveShadow = true; deck.castShadow = true;
  cityGroup.add(deck);
  // Mittelstreifen, damit die Brücke als Straße lesbar bleibt
  for (let x = BR_X0 + 5; x < BR_X1 - 5; x += 9) {
    deko(3.6, 0.04, 0.35, x, 0.32, BRIDGE_Z, 0xd9c979);
  }
  /* Sanfte Auffahrt an beiden Enden: die Fahrbahn liegt 30 cm höher als
     die Straße, ohne Rampe war dort eine harte Kante. */
  for (const [rx, dir] of [[BR_X0, -1], [BR_X1, 1]]) {
    const rampe = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, BRIDGE_HW * 2),
      new THREE.MeshLambertMaterial({ map: asphaltTex }));
    rampe.position.set(rx + dir * 3, -0.16, BRIDGE_Z);
    rampe.rotation.z = dir * 0.05;
    cityGroup.add(rampe);
  }
  for (const s of [-1, 1]) {
    const zr = BRIDGE_Z + s * (BRIDGE_HW - 0.25);
    // schlanker Handlauf statt massiver Wand
    for (const hy of [1.05, 0.62]) {
      deko(BR_X1 - BR_X0, 0.14, 0.16, (BR_X0 + BR_X1) / 2, hy, zr, 0x9a3a3a);
    }
    for (let x = BR_X0 + 2; x < BR_X1; x += 4.5) {
      deko(0.16, 1.15, 0.16, x, 0.85, zr, 0x6f2b2b);
    }
    /* Unsichtbare Brüstung: man fällt nicht mehr einfach seitlich von der
       Brücke ins Wasser, sondern stößt am Geländer an. */
    addCollider({ x0: BR_X0, x1: BR_X1, z0: zr - 0.25, z1: zr + 0.25, h: 1.4 });
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
  /* Asphalt statt einer nackten grauen Platte – das andere Ufer ist jetzt
     ein eigener Stadtteil mit Straßenraster, Gehwegen, Häusern, Laternen
     und einer Uferpromenade. */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SHORE_X1 - SHORE_X0 + 60, 420),
    new THREE.MeshLambertMaterial({ map: asphaltTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((SHORE_X0 + SHORE_X1) / 2 + 14, 0, 0);
  ground.receiveShadow = true;
  cityGroup.add(ground);

  /* Fahrbahnmarkierungen auf den Uferstraßen. Sie wandern ins gemeinsame
     Sammel-Mesh, sonst kämen allein hier über 150 einzelne Zeichenaufrufe
     zusammen und die Bildrate würde spürbar einbrechen. */
  for (let bi = 0; bi <= SHORE_NX; bi++) {
    const L = SHORE_OX + bi * SHORE_PITCH;
    for (let z = SHORE_OZ + 6; z < SHORE_OZ + SHORE_NZ * SHORE_PITCH - 6; z += 9) {
      if (Math.abs(z - BRIDGE_Z) < 10) continue;
      deko(0.35, 0.04, 3.6, L, 0.02, z, 0xd9c979);
    }
  }
  for (let bj = 0; bj <= SHORE_NZ; bj++) {
    const L = SHORE_OZ + bj * SHORE_PITCH;
    for (let x = SHORE_OX + 6; x < SHORE_OX + SHORE_NX * SHORE_PITCH - 6; x += 9) {
      deko(3.6, 0.04, 0.35, x, 0.02, L, 0xd9c979);
    }
  }

  // Blöcke: Gehwegsockel + Häuser (dieselben Bausteine wie in der Stadt)
  const slabGeo = new THREE.BoxGeometry(1, SLAB_H * 2, 1);
  const slabMat = new THREE.MeshLambertMaterial({ map: sidewalkTex });
  const innen = SHORE_PITCH - SHORE_ROAD * 2;          // bebaubare Fläche (22)
  for (let bi = 0; bi < SHORE_NX; bi++) {
    for (let bj = 0; bj < SHORE_NZ; bj++) {
      const cx = SHORE_OX + bi * SHORE_PITCH + SHORE_PITCH / 2;
      const cz = SHORE_OZ + bj * SHORE_PITCH + SHORE_PITCH / 2;
      if (!uferBlockFrei(cx, cz)) continue;
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.scale.set(innen, 1, innen);
      slab.position.set(cx, 0, cz);
      slab.receiveShadow = true;
      cityGroup.add(slab);

      /* Am Wasser stehen niedrigere Häuser, dahinter wächst die Skyline –
         so bekommt die andere Seite Tiefe statt einer flachen Reihe. */
      const hoch = bi === 0 ? rand(0.55, 0.85) : rand(0.9, 1.35);
      const stil = Math.random();
      if (stil < 0.18) {
        // Kleiner Park mit Bäumen statt eines Hauses
        for (let i = 0; i < 5; i++) {
          const bx = cx + rand(-innen / 2 + 2, innen / 2 - 2);
          const bz = cz + rand(-innen / 2 + 2, innen / 2 - 2);
          const stamm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6),
            new THREE.MeshLambertMaterial({ color: 0x5a4530 }));
          stamm.position.set(bx, SLAB_H + 1.3, bz);
          cityGroup.add(stamm);
          const krone = new THREE.Mesh(new THREE.SphereGeometry(rand(1.5, 2.3), 7, 6),
            new THREE.MeshLambertMaterial({ color: 0x2f6b38 }));
          krone.position.set(bx, SLAB_H + rand(3.4, 4.2), bz);
          krone.castShadow = true;
          cityGroup.add(krone);
        }
      } else if (stil < 0.55) {
        // Ein Turm auf dem ganzen Block
        const w = rand(innen * 0.55, innen * 0.85), d = rand(innen * 0.55, innen * 0.85);
        const h = rand(26, 52) * hoch;
        makeBuildingMesh(w, h, d, cx + rand(-1.5, 1.5), cz + rand(-1.5, 1.5));
      } else {
        const off = innen / 4 + 1;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          if (Math.random() < 0.2) continue;
          makeBuildingMesh(rand(7, 10), rand(14, 34) * hoch, rand(7, 10),
            cx + sx * off + rand(-0.8, 0.8), cz + sz * off + rand(-0.8, 0.8));
        }
      }
      if ((bi + bj) % 2 === 0) addLamp(cx - innen / 2 + 1, cz - innen / 2 + 1);
    }
  }

  /* Uferpromenade: Geländer entlang der Kaimauer, damit die Kante nicht
     einfach im Nichts endet. */
  for (let z = -190; z < 190; z += 8) {
    if (Math.abs(z - BRIDGE_Z) < BRIDGE_HW + 3) continue;
    deko(0.2, 1, 7, SHORE_X0 + 0.3, 0.5, z + 3.5, 0x22343f);
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
  'attack', 'kick', 'hit', 'roll', 'sit', 'swing', 'climb',
  /* mixamo-5: freies Klettern, seitliches Hangeln, Ausweichschritt
     nach links und rechts. */
  'klettern_frei', 'klettern_seit', 'ausweichenL', 'ausweichenR',
  /* mixamo-6: über eine Kante ziehen, am Sims hängen. */
  'kante', 'haengen',
  'hook', 'punch3', 'luftangriff', 'knie', 'block', 'taunt', 'jubel'];

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
          ruhe: ruheKarte(gltf.scene),
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
    if (!jobs.length) { teileBewegungen(); ergaenzeSpiegelungen(); done(); return; }
    let pending2 = jobs.length;
    const finish2 = () => { if (--pending2 === 0) { teileBewegungen(); ergaenzeSpiegelungen(); done(); } };
    for (const [slot, part] of jobs) {
      loader.load(`assets/${slot}@${part}.glb`, (gltf) => {
        try {
          const clip = (gltf.animations || [])[0];
          if (clip) {
            clip.name = part; // Clip nach dem Dateinamens-Teil benennen
            glbModels[slot].clips.push(entferneFinger(entferneVersatz(clip)));
          }
        } catch (e) { /* ignorieren */ }
        finish2();
      }, undefined, finish2);
    }
  }
}

/* Name eines Knotens so schreiben, wie ihn die Animationsspuren ansprechen. */
function spurName(name) {
  return THREE.PropertyBinding && THREE.PropertyBinding.sanitizeNodeName
    ? THREE.PropertyBinding.sanitizeNodeName(name) : name;
}

/* Ruhehaltung (Rest-Pose) eines Modells oder einer Bewegungsdatei einsammeln:
   die Grunddrehung jedes Knochens, bevor irgendeine Bewegung läuft. */
function ruheKarte(scene) {
  const karte = new Map();
  scene.traverse((o) => {
    const n = spurName(o.name || '');
    if (n && !karte.has(n)) karte.set(n, o.quaternion.clone());
  });
  return karte;
}


/* Mixamo-Bewegungen stammen oft von einem anderen Charakter als das Modell.
   Ihre Hüft-Positionsspur ist dann in fremden Maßen und würde die Figur in
   den Boden ziehen oder schweben lassen. Deshalb bleiben nur die Drehungen
   erhalten – die passen bei jedem Mixamo-Skelett. */
function entferneVersatz(clip) {
  clip.tracks = clip.tracks.filter((t) => !/\.position$/.test(t.name));
  return clip;
}

/* Eine Bewegung spiegeln: aus einem rechten Schlag wird ein linker.
   Dazu werden die Links/Rechts-Knochen getauscht und jede Drehung an der
   Körpermittelebene gespiegelt (y und z umkehren). Mixamo-Skelette sind
   symmetrisch aufgebaut, deshalb passt das exakt.
   So wechselt die Schlagkombo sichtbar den Arm, ohne zweite Datei. */
function spiegeleClip(clip, name) {
  const spuren = [];
  for (const t of clip.tracks) {
    const neu = t.clone();
    neu.name = t.name.replace(/Left/g, '\u0000').replace(/Right/g, 'Left').replace(/\u0000/g, 'Right');
    if (/\.quaternion$/.test(neu.name)) {
      const v = neu.values;
      for (let i = 0; i + 3 < v.length; i += 4) { v[i + 1] = -v[i + 1]; v[i + 2] = -v[i + 2]; }
    }
    spuren.push(neu);
  }
  return new THREE.AnimationClip(name, clip.duration, spuren);
}

/* Für jede Figur eine gespiegelte Schlagfassung ergänzen. */
function ergaenzeSpiegelungen() {
  /* Aus jedem Schlag entsteht zusätzlich die seitenverkehrte Fassung.
     Damit ergeben zwei Dateien vier sichtbar verschiedene Schläge. */
  const paare = [['punch', 'punch2'], ['hook', 'hook2']];
  for (const slot of Object.keys(glbModels)) {
    const m = glbModels[slot];
    if (!m) continue;
    for (const [quelle, ziel] of paare) {
      if (m.clips.some((c) => c.name === ziel)) continue;
      const c = m.clips.find((x) => x.name === quelle);
      if (c) m.clips.push(spiegeleClip(c, ziel));
    }
  }
}

/* Fingerknochen aus einer Bewegung entfernen.
   Die Fingerhaltung der Bewegungsdateien passt bis zu 26° nicht zur
   Ruhehaltung unseres Modells – die Hände sahen dadurch verkrampft und
   klauenartig aus. Ohne diese Spuren behalten die Hände die schön
   modellierte Grundhaltung des Anzugs. */
function entferneFinger(clip) {
  clip.tracks = clip.tracks.filter(
    (t) => !/hand(thumb|index|middle|ring|pinky)\d/i.test(t.name));
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
  climb: [/^climb$/i, /climb/i, /crawl/i, /ladder/i],
  kante: [/kante/i],
  haengen: [/haengen/i],
  klettern_frei: [/klettern_frei/i],
  klettern_seit: [/klettern_seit/i],
  ausweichenL: [/ausweichenL/],
  ausweichenR: [/ausweichenR/],
  roll: [/roll/i, /dodge/i, /dive/i, /evade/i],
  hit: [/hit/i, /impact/i, /react/i, /stagger/i],
  punch: [/punch/i, /jab/i, /hook/i, /elbow/i, /boxing/i],
  punch2: [/punch2/i],
  punch3: [/punch3/i],
  hook: [/^hook$/i],
  hook2: [/hook2/i],
  luftangriff: [/luftangriff/i],
  knie: [/knie/i],
  block: [/block/i],
  taunt: [/taunt/i],
  jubel: [/jubel/i],
  kick: [/kick/i],
  sit: [/sit/i, /hurt/i, /crouch/i, /dying/i, /death/i],
  webbed: [/idle/i],
  downed: [/dying/i, /death/i, /sit/i, /idle/i],
  attack: [/punch/i, /attack/i, /kick/i, /melee/i, /combat/i],
};
const GLB_FALLBACK = {
  walk: ['run', 'idle'], run: ['walk', 'idle'],
  jump: ['air', 'run', 'idle'], air: ['jump', 'run', 'idle'],
  land: ['idle'], roll: ['run', 'idle'], hit: ['idle'],
  punch: ['attack'], punch2: ['punch', 'attack'], punch3: ['punch', 'attack'],
  hook: ['punch', 'attack'], hook2: ['hook', 'punch', 'attack'],
  luftangriff: ['kick', 'attack'], knie: ['kick', 'attack'],
  block: ['idle'], taunt: ['idle'], jubel: ['idle'],
  kick: ['attack'],
  swing: ['air', 'run', 'idle'], climb: ['walk', 'idle'],
  klettern_frei: ['climb'], klettern_seit: ['climb'],
  kante: ['climb', 'jump'], haengen: ['climb', 'idle'],
  ausweichenL: ['roll'], ausweichenR: ['roll'],
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
  /* Drehreihenfolge Y-X-Z: Erst die Blickrichtung, dann die Vorlage um die
     KÖRPEREIGENE Querachse, dann die Kurvenlage um die Flugachse. In der
     Standardreihenfolge X-Y-Z kippt rotation.x um die WELT-X-Achse – beim
     Schwingen nach Osten legte sich die Figur dadurch seitlich, statt sich
     nach vorn zu neigen. */
  root.rotation.order = 'YXZ';
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
  /* Alle Knochen merken – beim Umfallen wird daran der tiefste Punkt
     gesucht, denn die Füße sind dann nicht mehr das Unterste. */
  const alleKnochen = [];
  inner.traverse((o) => { if (o.isBone) alleKnochen.push(o); });
  const basisY = inner.position.y;
  let fussRuhe = null, bodenKorrektur = 0;
  /* Ruhehöhe der Füße JETZT aus der Bindehaltung messen – noch bevor
     irgendeine Bewegung läuft. Früher wurde sie beim ersten Bildaufbau
     genommen; fiel die Figur da gerade (angezogene Beine), merkte sich der
     Ausgleich eine viel zu hohe Ruhelage und hob die Figur dauerhaft
     mehrere Handbreit über den Boden. */
  if (fuesse.length) {
    inner.updateMatrixWorld(true);
    let tiefster = Infinity;
    const _mess = new THREE.Vector3();
    for (const f of fuesse) { f.getWorldPosition(_mess); tiefster = Math.min(tiefster, _mess.y); }
    if (isFinite(tiefster)) fussRuhe = tiefster - root.position.y;
  }

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
  /* Ruhelage jedes Knochens JETZT sichern – vor der ersten Bewegung.
     Beim Mixamo-Skelett liegt die Ruhedrehung der Oberschenkel bei rund
     ±π um Z. Wer diese Winkel als Eulerwerte gegen 0 zieht, dreht das Bein
     um 180° – und die Figur steht im Spagat. Genau das war der Grund für
     die gespreizten Beine am Netz. Mit der gesicherten Ruhelage lässt sich
     stattdessen sauber dorthin zurückblenden. */
  const ruheDrehung = new Map();
  inner.traverse((o) => { if (o.isBone) ruheDrehung.set(o, o.quaternion.clone()); });
  const _qd = new THREE.Quaternion(), _ed = new THREE.Euler();
  const _vw1 = new THREE.Vector3(), _vw2 = new THREE.Vector3();
  const _vw3 = new THREE.Vector3(), _vw4 = new THREE.Vector3();
  const _hf = new THREE.Vector3(), _hs = new THREE.Vector3(), _hp = new THREE.Vector3();
  const _fh = new THREE.Vector3();
  const _mA = new THREE.Matrix4(), _mB = new THREE.Matrix4();

  /* Eigenachsen der Hände aus der Bindehaltung ablesen: wohin zeigen die
     Finger, wohin die Handfläche? Ohne das lässt sich die Hand nicht
     gezielt auf eine Wand legen – die Ziel-Kinematik dreht den Unterarm
     zwar zur Wand, die Drehung UM den Arm bleibt dabei aber frei. Genau
     deshalb zeigten beim Klettern beide Handflächen nach außen. */
  const handBasis = {};
  (() => {
    inner.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    for (const seite of ['left', 'right']) {
      const hand = knochen[seite + 'hand'];
      const mitte = knochen[seite + 'handmiddle1'];
      const zeige = knochen[seite + 'handindex1'];
      const klein = knochen[seite + 'handpinky1'];
      if (!hand || !mitte || !zeige || !klein) continue;
      const finger = mitte.position.clone().normalize();
      const spreiz = klein.position.clone().sub(zeige.position).normalize();
      const flaeche = new THREE.Vector3().crossVectors(finger, spreiz).normalize();
      /* In der Bindehaltung zeigen die Handflächen nach unten – daran
         lässt sich das Vorzeichen festmachen. */
      hand.getWorldQuaternion(q);
      if (flaeche.clone().applyQuaternion(q).y > 0) flaeche.negate();
      const quer = new THREE.Vector3().crossVectors(flaeche, finger).normalize();
      handBasis[seite] = { finger, quer, flaeche };
    }
  })();

  /* Hand so drehen, dass die Finger in fingerWelt zeigen und die
     Handfläche in flaecheWelt (also flach auf der Wand liegt). */
  function setzeHand(seite, fingerWelt, flaecheWelt, k) {
    const hb = handBasis[seite];
    const hand = knochen[seite + 'hand'];
    if (!hb || !hand) return;
    hand.updateMatrixWorld(true);
    _hp.copy(flaecheWelt).normalize();
    _hf.copy(fingerWelt).addScaledVector(_hp, -_hf.dot(_hp));
    if (_hf.lengthSq() < 1e-6) return;
    _hf.normalize();
    _hs.crossVectors(_hp, _hf).normalize();
    _mA.makeBasis(hb.finger, hb.quer, hb.flaeche).transpose();
    _mB.makeBasis(_hf, _hs, _hp).multiply(_mA);
    _q.setFromRotationMatrix(_mB);
    hand.parent.getWorldQuaternion(_q2);
    _q2.invert().multiply(_q);
    hand.quaternion.slerp(_q2, clamp(k, 0, 1));
  }
  /* Knochen zur Ruhelage ziehen und von dort um kleine Winkel auslenken. */
  function drehZuRuhe(bone, ax, ay, az, k) {
    if (!bone) return;
    const ruhe = ruheDrehung.get(bone);
    if (!ruhe) return;
    bone.quaternion.slerp(ruhe, clamp(k, 0, 1));
    _ed.set(ax || 0, ay || 0, az || 0);
    bone.quaternion.multiply(_qd.setFromEuler(_ed));
  }

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
    poseSchwung(zielWelt, seite, t, bogen, neigung) {
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
      /* Die geladene Hänge-Bewegung steht fast still – am Netz sah das aus
         wie eine eingefrorene Puppe. Ein ruhiger Beintakt im Rhythmus des
         Pendels bringt Leben hinein, ohne der Bewegung ins Handwerk zu
         pfuschen (halbes Gewicht, kleine Ausschläge). */
      const takt = Math.sin((t || 0) * 2.3);
      const k = 0.9;
      /* lage: -1 = es geht abwärts in den Bogen hinein, +1 = es geht wieder
         hinauf. Am tiefsten Punkt zieht man die Beine an, oben streckt man
         sie nach vorn – erst dadurch wirkt der Schwung gelöst statt wie
         eine an einem Faden hängende Puppe. */
      const lage = clamp(bogen === undefined ? 0 : bogen, -1, 1);
      const anziehen = 1 - Math.abs(lage);          // 1 am Tiefpunkt
      const strecken = Math.max(0, lage);           // 1 im Aufstieg
      /* Am Netz hing die Figur bisher kerzengerade – das wirkte steif wie
         eine Puppe. Jetzt sind die Beine deutlich angewinkelt und laufen
         nach hinten aus, die Knie schwingen gegenläufig mit dem Pendel und
         der Rumpf legt sich nach vorn in den Bogen. */
      /* Der Körper liegt jetzt flach in Flugrichtung. Die Beine sollen
         dabei hinterherziehen, nicht nach vorn geklappt werden – also
         kaum Hüftbeugung, dafür angewinkelte Knie. Am Tiefpunkt zieht er
         sie an, im Aufstieg streckt er sie aus. */
      const hueft = 0.04 + anziehen * 0.18 - strecken * 0.16;
      const knie = 0.45 + anziehen * 0.75 - strecken * 0.32;
      drehZuRuhe(knochen.leftupleg, hueft + takt * 0.34, 0, 0, k);
      drehZuRuhe(knochen.rightupleg, hueft + 0.06 - takt * 0.34, 0, 0, k);
      drehZuRuhe(knochen.leftleg, knie - takt * 0.30, 0, 0, k);
      drehZuRuhe(knochen.rightleg, knie - 0.14 + takt * 0.30, 0, 0, k);
      /* Rumpf: am Tiefpunkt eingerollt, im Aufstieg aufgerichtet, dazu
         eine leichte Drehung zum Netzarm hin. */
      drehe(knochen.spine1, -0.06 + anziehen * 0.16 - strecken * 0.12,
            (seite === 'L' ? 0.12 : -0.12) + takt * 0.05, 0, 0.5);
      drehe(knochen.spine, -0.04 + anziehen * 0.08, seite === 'L' ? 0.08 : -0.08, 0, 0.4);
      /* Der freie Arm schwingt weit aus – nicht angelegt wie im Stillstand. */
      drehe(knochen[andere], -0.55 + wiegen * 2.2 - strecken * 0.5, 0,
            seite === 'L' ? -0.95 : 0.95, 0.7);
      drehe(knochen[andereK], -0.35 - anziehen * 0.5, 0, 0, 0.7);
      /* Der Kopf hält gegen die Vorlage, damit der Blick nach vorn geht
         und nicht auf den Asphalt. */
      /* Bei 66° Vorlage muss der Blick um denselben Betrag zurückgenommen
         werden, sonst schaut die Figur senkrecht auf die Straße. Die
         Gegendrehung verteilt sich auf Kopf, Hals und obere Wirbelsäule –
         auf einen Knochen allein sähe sie verrenkt aus. */
      const gegen = -(neigung || 0);
      drehZuRuhe(knochen.head, gegen * 0.55, 0, 0, 0.85);
      drehZuRuhe(knochen.neck, gegen * 0.3, 0, 0, 0.8);
      drehe(knochen.spine2, gegen * 0.22, 0, 0, 0.55);
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
    /* Wandkriechen: Die geladene Kletter-Bewegung stammt von einer Leiter –
       die Figur greift dort vor der Brust und steht aufrecht. An einer
       Hauswand sieht das falsch aus. Hier werden Hände und Füße deshalb
       auf echte Punkte AN DER WAND gezielt: Arme weit oben und außen,
       Knie seitlich abgespreizt. Das ergibt die typische Spinnenhaltung,
       ohne dass eine neue Bewegungsdatei nötig wäre. */
    poseWandkriechen(nx, nz, phase, k) {
      root.updateMatrixWorld(true);
      const rechts = _vw1.set(nz, 0, -nx);        // seitlich an der Wand
      const rein = _vw2.set(-nx, 0, -nz);         // Richtung Wand
      /* Die Leiter-Bewegung schiebt das Becken fast einen Meter nach
         hinten – deshalb schwebte die Figur sichtbar VOR dem Haus, statt
         daran zu kleben. Dieser Versatz wird hier weggerechnet: das Becken
         steht wieder senkrecht über dem Anfasspunkt an der Wand.
         Achsen von root: lokal +Z zeigt zur Wand, lokal +X nach links. */
      if (knochen.hips) {
        knochen.hips.getWorldPosition(_vw3);
        const dx = _vw3.x - root.position.x, dz = _vw3.z - root.position.z;
        const tiefe = dx * rein.x + dz * rein.z;
        const quer = dx * rechts.x + dz * rechts.z;
        /* Der Fehler wird auf den bestehenden Versatz AUFADDIERT. Vorher
           wurde er als absoluter Zielwert gesetzt – dadurch pendelte die
           Korrektur zwischen zwei Werten hin und her und das Becken blieb
           einen halben Meter von der Wand entfernt. */
        /* Zielabstand so gewählt, dass Brust und Bauch die Wand streifen
           und Hände und Füße genau auf der Fassade liegen – nicht darin. */
        inner.position.z = clamp(inner.position.z + (-0.15 - tiefe) * 0.35, -1.2, 1.2);
        /* Achtung beim Vorzeichen: die lokale X-Achse der Wurzel zeigt nach
           LINKS, also entgegen "rechts". Mit dem falschen Vorzeichen war es
           eine Mitkopplung – der Körper wanderte bis an den Anschlag von
           0,8 m zur Seite und stand deshalb schief an der Wand. */
        inner.position.x = clamp(inner.position.x + quer * 0.35, -0.5, 0.5);
        root.updateMatrixWorld(true);
      }
      const m = root.position;
      const g = Math.sin(phase);
      const punkt = (out, seite, hoehe, tiefe) => out
        .copy(m).addScaledVector(rechts, seite).addScaledVector(rein, tiefe)
        .setY(m.y + hoehe);

      /* Nur das OBERE Glied zielt auf einen Punkt an der Wand; Ellbogen
         und Knie werden anschließend schlicht gebeugt. Wurden beide
         Glieder gezielt, verdrehte die kürzeste Drehung die Unterarme und
         Unterschenkel – das waren die schief stehenden Arme und Beine. */
      /* Oberarm zielt auf den Ellbogen, Unterarm auf die Hand. Beide Ziele
         liegen auf der Fassade, dadurch stehen die Ellbogen nach außen wie
         bei einer Spinne und die Hände liegen wirklich an der Wand. */
      punkt(_vw3, -0.66, 1.48 + g * 0.10, 0.06);          // linker Ellbogen
      zieleKnochen(knochen.leftarm, knochen.leftforearm, _vw3, k);
      punkt(_vw3, -0.34, 2.15 + g * 0.22, 0.13);          // linke Hand
      zieleKnochen(knochen.leftforearm, knochen.lefthand, _vw3, k);
      punkt(_vw4, 0.66, 1.48 - g * 0.10, 0.06);
      zieleKnochen(knochen.rightarm, knochen.rightforearm, _vw4, k);
      punkt(_vw4, 0.34, 2.15 - g * 0.22, 0.13);
      zieleKnochen(knochen.rightforearm, knochen.righthand, _vw4, k);

      // Knie seitlich nach außen, Füße darunter an der Wand
      punkt(_vw3, -0.68, 0.78 - g * 0.10, -0.02);
      zieleKnochen(knochen.leftupleg, knochen.leftleg, _vw3, k);
      punkt(_vw3, -0.44, 0.22 - g * 0.16, 0.13);
      zieleKnochen(knochen.leftleg, knochen.leftfoot, _vw3, k);
      punkt(_vw4, 0.68, 0.78 + g * 0.10, -0.02);
      zieleKnochen(knochen.rightupleg, knochen.rightleg, _vw4, k);
      punkt(_vw4, 0.44, 0.22 + g * 0.16, 0.13);
      zieleKnochen(knochen.rightleg, knochen.rightfoot, _vw4, k);
      /* Handflächen flach auf die Fassade, Finger nach oben-außen. */
      _vw3.copy(rein);
      setzeHand('left', _fh.set(0, 1, 0).addScaledVector(rechts, -0.3), _vw3, 0.9);
      setzeHand('right', _fh.set(0, 1, 0).addScaledVector(rechts, 0.3), _vw3, 0.9);
      // Kopf hebt sich, der Blick geht nach oben
      drehZuRuhe(knochen.head, -0.35, 0, 0, k * 0.8);
    },
    /* Nach dem Klettern den Wandversatz wieder abbauen. */
    versatzAus(k) {
      if (Math.abs(inner.position.x) < 0.001 && Math.abs(inner.position.z) < 0.001) return;
      inner.position.x = lerp(inner.position.x, 0, k);
      inner.position.z = lerp(inner.position.z, 0, k);
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
      /* Zielhöhe der Füße = Bindehaltung. Der frühere Abzug von 7 cm war
         wirkungslos, solange nur gehoben werden konnte – jetzt würde er
         die Figur dauerhaft in den Asphalt drücken. */
      const fehler = (fussRuhe - 0.015) - relativ;
      /* Der Ausgleich darf die Figur auch ABSENKEN. Vorher konnte er nur
         heben; in der Landebewegung stehen die Füße rund 25 cm über der
         Ruhelage, und die Figur schwebte für einen Moment sichtbar über
         der Straße. */
      const ziel = clamp(bodenKorrektur + fehler, -0.3, 0.35);
      /* Der Ausgleich wird in BEIDE Richtungen gleich weich nachgeführt.
         Früher sprang er nach oben sofort – beim Laufen wandert der tiefste
         Fuß aber in jedem Schritt auf und ab, dadurch hüpfte der ganze
         Körper im Schritttakt. Genau das hat das Laufen unruhig gemacht. */
      bodenKorrektur = lerp(bodenKorrektur, ziel, clamp(k === undefined ? 0.12 : k, 0, 0.35));
      inner.position.y = basisY + bodenKorrektur;
    },
    /* Hinlegen: Die Umfall-Bewegung dreht den Körper zwar waagerecht, lässt
       die Hüfte dabei aber auf Stehhöhe – die Figur lag deshalb rund einen
       Meter über dem Boden in der Luft. Hier wird der ganze Körper so weit
       abgesenkt, dass der tiefste Knochen wirklich aufliegt. */
    legeHin(k) {
      root.updateMatrixWorld(true);
      let tiefster = Infinity;
      for (const bn of alleKnochen) { bn.getWorldPosition(_vb); tiefster = Math.min(tiefster, _vb.y); }
      if (!isFinite(tiefster)) return;
      const ueber = tiefster - root.position.y - 0.11;      // so hoch schwebt er noch
      const ziel = clamp(bodenKorrektur - ueber, -1.6, 0.35);
      bodenKorrektur = lerp(bodenKorrektur, ziel, clamp(k === undefined ? 0.25 : k, 0, 1));
      inner.position.y = basisY + bodenKorrektur;
    },
    /* Gibt es für diesen Zustand eine echte geladene Bewegung?
       Wenn ja, hat sie Vorrang vor allen selbstgebauten Posen. */
    hatClip(key) { return !!findClip(m.clips, key); },
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
      /* Solange es für Schwingen und Klettern keine eigene Bewegungsdatei
         gab, diente die ruhige Steh-Animation als Grundlage für die
         selbstgebauten Posen. Liegt eine echte Bewegung vor, führt die –
         sonst sah Klettern aus wie Die-Wand-hoch-Laufen. */
      let want = key;
      if ((key === 'swing' || key === 'climb' || key === 'klettern_frei' ||
           key === 'klettern_seit') && !findClip(m.clips, key)) {
        want = findClip(m.clips, 'climb') ? 'climb' : 'idle';
        if (key === 'swing') want = 'idle';
      }
      /* Umschalten nach echtem Tempo, nicht nach einem Anteil der
         Höchstgeschwindigkeit: sonst wurde beim Anlaufen ein stark
         beschleunigter Gehschritt gezeigt. */
      const vBoden = p.speed === undefined ? (p.speed01 || 0) * CFG.sprintSpeed : p.speed;
      if (key === 'run' && vBoden < 2.9 && findClip(m.clips, 'walk')) want = 'walk';
      const a = actionFor(want) || actionFor('idle');
      if (a && a !== current) {
        if (current) current.fadeOut(0.22);
        /* Umfallen und Liegenbleiben laufen genau einmal und bleiben im
           letzten Bild stehen – sonst fällt die Figur endlos immer wieder. */
        const einmal = want === 'downed' || want === 'sit' || want === 'taunt';
        a.setLoop(einmal ? THREE.LoopOnce : THREE.LoopRepeat, einmal ? 1 : Infinity);
        a.clampWhenFinished = einmal;
        a.reset().fadeIn(0.22).play();
        current = a;
      }
      /* Schrittlänge an das echte Tempo koppeln: die Mixamo-Läufe legen bei
         Geschwindigkeit 1 rund 1,45 m/s (Gehen) bzw. 4,2 m/s (Rennen)
         zurück. Wird die Abspielgeschwindigkeit daraus berechnet, bleiben
         die Füße am Boden stehen, statt zu rutschen – genau das hat das
         Laufen bisher unruhig wirken lassen. */
      if (current && (want === 'run' || want === 'walk')) {
        const v = p.speed === undefined ? (p.speed01 || 0) * CFG.sprintSpeed : p.speed;
        const ref = want === 'walk' ? 1.45 : 4.2;
        current.timeScale = clamp(v / ref, 0.7, 2.6);
      } else if (current && (want === 'climb' || want === 'klettern_frei' || want === 'klettern_seit')) {
        /* An der Wand nur klettern, wenn auch gedrückt wird – sonst
           kraxelte die Figur auf der Stelle weiter. */
        current.timeScale = p.tempo === undefined ? 1 : p.tempo;
      } else if (current) {
        current.timeScale = 1;
      }
      mixer.update(dt);
    },
    /* art: 'punch' oder 'kick' – damit ein Tritt auch wie ein Tritt
       aussieht und nicht wie derselbe Schlag. Fehlt die passende Datei,
       greift automatisch die allgemeine Angriffsbewegung. */
    /* zielDauer: wie lange der Schlag im Spiel dauern SOLL. Die Mixamo-
       Dateien sind zwischen 1,7 s und 3,8 s lang – ungekürzt abgespielt
       hing die Figur nach jedem Schlag sekundenlang im Nachschwingen und
       eine Kombo war nicht mehr möglich. Die Bewegung wird deshalb
       beschleunigt und der ausklingende Rest weggeblendet. */
    attackOneShot(tempo, art, zielDauer) {
      const a = actionFor(art || 'attack') || actionFor('attack');
      if (!a) return 0;
      const d = a.getClip().duration;
      const v = zielDauer ? clamp(d / zielDauer, 1.3, 3.4) : (tempo || 1.7);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      /* Beim Verketten weich überblenden. Nur wenn dieselbe Bewegung
         direkt noch einmal kommt, muss sie zurückgesetzt werden – sonst
         sprang die Figur bei jedem Klick zurück auf das erste Bild und der
         Schlag sah abgehackt aus. */
      const gleiche = angriff === a;
      if (angriff && !gleiche) angriff.fadeOut(0.09);
      else if (current && !angriff) current.fadeOut(0.09);
      if (gleiche) a.reset();
      else { a.reset(); a.fadeIn(0.09); }
      a.timeScale = v; a.play();
      angriff = a;
      angriffT = zielDauer ? Math.min(zielDauer, d / v) : d / v;
      return angriffT;
    },
    /* Ausweichrolle: die Datei ist 2,4 s lang, im Spiel darf das Ausweichen
       aber nur einen knappen Satz dauern. Sie wird deshalb beschleunigt
       abgespielt, damit die Rolle wirklich zu Ende geht, statt mittendrin
       in den Stand zu springen. */
    /* Kantenzug: einmalige Bewegung mit fester Spieldauer. */
    kanteOneShot(zielDauer) {
      const a = actionFor('kante');
      if (!a) return 0;
      const d = a.getClip().duration;
      const v = clamp(d / zielDauer, 1, 4.5);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      if (current) current.fadeOut(0.1);
      a.reset(); a.fadeIn(0.1); a.timeScale = v; a.play();
      angriff = a;
      angriffT = Math.min(zielDauer, d / v);
      return angriffT;
    },
    rolleOneShot(zielDauer, welche) {
      const a = actionFor(welche || 'roll') || actionFor('roll');
      if (!a) return 0;
      const d = a.getClip().duration;
      const v = clamp(d / zielDauer, 1, 3.2);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      if (current) current.fadeOut(0.08);
      a.reset(); a.fadeIn(0.08); a.timeScale = v; a.play();
      angriff = a;
      angriffT = Math.min(zielDauer, d / v);
      return angriffT;
    },
    /* Wie lange dauert eine geladene Bewegung? Damit lässt sich die
       Spielmechanik auf die Bewegungsdatei abstimmen, statt umgekehrt. */
    clipDauer(key) {
      const c = findClip(m.clips, key);
      return c ? c.duration : 0;
    },
  };
}

function makeProceduralVisual(cfg) {
  const human = makeHuman(cfg);
  return {
    root: human.root, procedural: true, human,
    play(key, p, dt) { poseHuman(human, key, p, dt); },
    attackOneShot() {},
    rolleOneShot() { return 0; },
    clipDauer() { return 0; },
    legeHin() {},
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
  root.rotation.order = 'YXZ';
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
/* ======================= Netzfaden =======================
   Ein Netzfaden ist kein glattes weißes Rohr, sondern ein Bündel feiner
   Fäden, das an der Hand dicker ist als am Anker und unter dem eigenen
   Gewicht leicht durchhängt. Genau das hat vorher gefehlt. */
const fadenTex = canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  /* Mehrere feine Stränge längs, dazu ein paar Querverbindungen –
     um den Zylinder gewickelt ergibt das ein gedrehtes Seil. */
  g.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const x = 5 + i * 13 + rand(-2, 2);
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,0.95)' : 'rgba(226,234,242,0.8)';
    g.lineWidth = i % 2 ? 2.4 : 1.5;
    g.beginPath();
    for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y * 0.09 + i) * 2.2, y);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = rand(0, h);
    g.beginPath(); g.moveTo(rand(0, w * 0.6), y); g.lineTo(rand(w * 0.4, w), y + rand(-6, 6)); g.stroke();
  }
});
fadenTex.wrapS = fadenTex.wrapT = THREE.RepeatWrapping;

/* Grundgitter: offener Zylinder, dessen Punkte jedes Bild neu gesetzt
   werden. Ein starrer Zylinder kann sich nicht durchbiegen. */
const FADEN_RING = 6, FADEN_LANG = 14;
const fadenBasis = (() => {
  const g = new THREE.CylinderGeometry(1, 1, 1, FADEN_RING, FADEN_LANG, true);
  const p = g.attributes.position;
  const roh = new Float32Array(p.count * 3);
  roh.set(p.array);
  return { geo: g, roh };
})();

function makeWebStrand() {
  const geo = fadenBasis.geo.clone();
  const mat = new THREE.MeshBasicMaterial({
    map: fadenTex.clone(), transparent: true, alphaTest: 0.12,
    depthWrite: false, side: THREE.DoubleSide, color: 0xffffff,
  });
  mat.map.needsUpdate = true;
  mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.visible = false;
  m.renderOrder = 3;
  scene.add(m);
  return m;
}
const swingStrand = makeWebStrand();
const shotStrands = [makeWebStrand(), makeWebStrand(), makeWebStrand()];
let shotIdx = 0;
const activeShots = []; // {mesh, life, from, to}

const _fa = new THREE.Vector3(), _fb = new THREE.Vector3(), _fc = new THREE.Vector3();
const _fd = new THREE.Vector3(), _fe = new THREE.Vector3();

/* from = Hand, to = Anker. durchhang: 0 = straff gespannt. */
function placeStrand(mesh, from, to, durchhang) {
  _fa.subVectors(to, from);
  const len = _fa.length();
  if (len < 0.05) { mesh.visible = false; return; }
  mesh.visible = true;
  _fa.multiplyScalar(1 / len);                       // Richtung
  /* Zwei Querachsen zur Fadenrichtung aufspannen. */
  _fb.set(0, 1, 0);
  if (Math.abs(_fa.y) > 0.94) _fb.set(1, 0, 0);
  _fc.crossVectors(_fa, _fb).normalize();            // quer
  _fd.crossVectors(_fc, _fa).normalize();            // hoch
  const sag = durchhang === undefined ? 0.012 : durchhang;
  const tiefe = Math.min(1.1, len * sag);

  const p = mesh.geometry.attributes.position;
  const roh = fadenBasis.roh;
  for (let i = 0; i < p.count; i++) {
    const bx = roh[i * 3], by = roh[i * 3 + 1], bz = roh[i * 3 + 2];
    const t = by + 0.5;                              // 0 an der Hand, 1 am Anker
    // Radius: an der Hand kräftig, zum Anker hin dünner
    const r = 0.036 - 0.021 * t;
    const durch = tiefe * 4 * t * (1 - t);           // Parabel-Durchhang
    _fe.copy(from)
       .addScaledVector(_fa, len * t)
       .addScaledVector(_fd, -durch)
       .addScaledVector(_fc, bx * r)
       .addScaledVector(_fd, bz * r);
    p.setXYZ(i, _fe.x, _fe.y, _fe.z);
  }
  p.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
  // Muster mit der Länge mitwachsen lassen, sonst wird es lang gezogen
  mesh.material.map.repeat.set(1, Math.max(1, Math.round(len * 0.6)));
}

/* Kurzer Netzklatscher: ein aufblitzendes Netzmuster am Einschlagpunkt. */
const klatscherPool = [];
const klatscherAktiv = [];
function netzKlatscher(pos) {
  let m = klatscherPool.pop();
  if (!m) {
    m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fleckMat.clone());
    m.material.depthTest = false;
    m.renderOrder = 4;
    scene.add(m);
  }
  m.position.copy(pos);
  m.visible = true;
  m.material.opacity = 0.95;
  m.scale.setScalar(0.2);
  klatscherAktiv.push({ m, t: 0 });
}
function updateKlatscher(dt) {
  for (let i = klatscherAktiv.length - 1; i >= 0; i--) {
    const k = klatscherAktiv[i];
    k.t += dt;
    k.m.quaternion.copy(camera.quaternion);
    k.m.scale.setScalar(0.2 + Math.min(1, k.t / 0.16) * 0.75);
    k.m.material.opacity = clamp(1 - k.t / 0.42, 0, 1) * 0.95;
    if (k.t > 0.42) { k.m.visible = false; klatscherPool.push(k.m); klatscherAktiv.splice(i, 1); }
  }
}

function flashWebShot(from, to) {
  const mesh = shotStrands[shotIdx = (shotIdx + 1) % shotStrands.length];
  /* Der Faden schießt sichtbar heraus, statt sofort in voller Länge da
     zu sein – das gibt dem Schuss Richtung und Tempo. */
  activeShots.push({ mesh, life: 0.24, t: 0, from: from.clone(), to: to.clone() });
  placeStrand(mesh, from, from, 0);
  mesh.material.opacity = 1;
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
  state: 'ground',        // ground | air | swing | climb | zip | kante
  kante: null,
  onGround: true,
  jumps: 0,
  phase: 0,
  wall: null,             // {col, nx, nz}
  swing: null,            // {anchor, len}
  zip: null,              // {target, t, enemy}
  attack: null,           // {type, t, arm, hitDone}
  attackBuffer: null,     // gepufferte Eingabe für flüssige Ketten
  fadenZiel: null, fadenHand: 'R',   // wohin der Netzfaden zeigt
  combo: 0, comboTimer: 0, stufe: 0, klettertempo: 0, ziel: null, keinHaltCd: 0,
  attackCd: 0,
  dodgeT: 0, iFrames: 0, rollT: 0, landT: 0, hitT: 0,
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
/* Verlässt das Fenster den Fokus oder springt die Mauszeigersperre auf,
   kommt kein mouseup mehr an – die rechte Taste bliebe sonst "gedrückt"
   und der Netzschwung ließe sich nicht mehr beenden. */
window.addEventListener('blur', () => { swingHeld = false; });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) swingHeld = false; });
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
  sun.position.copy(player.pos).addScaledVector(SONNE_RICHTUNG, 150);
  sun.target.position.copy(player.pos);
}

/* ======================= Kollision Figur <-> Welt ======================= */
function collideBody(body, prevY) {
  // body: {pos, vel, radius, onGround, wall, platform}
  const p = body.pos, r = body.radius;
  body.wall = null;
  const cols = collidersNear(p.x, p.z);
  for (const c of cols) {
    /* Vorsprünge wie Feuerleiter-Podeste haben eine Unterkante (y0). Sie
       sind nur in ihrer eigenen Höhe im Weg – sonst würde man schon unten
       auf der Straße gegen eine unsichtbare Wand laufen. */
    if (c.y0 !== undefined && p.y + 1.75 < c.y0) continue;
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
/* Läuft der Faden frei zum Anker, oder steckt ein Haus dazwischen?
   Ohne diese Prüfung schoss das Netz gern durch die Nachbarfassade. */
function freieSicht(ax, ay, az, bx, by, bz, ziel) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  const schritte = Math.min(26, Math.max(4, Math.round(len / 2.5)));
  for (let i = 1; i < schritte; i++) {
    const t = i / schritte;
    const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
    for (const c of collidersNear(x, z)) {
      if (c === ziel || c.klein) continue;
      if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y < c.h) return false;
    }
  }
  return true;
}

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
  const boden = groundY(px, pz);

  /* Ein Netz muss an einem echten Bauwerk hängen. Früher gab es als
     Rückfall einen "Himmelsanker" – dann hing der Faden sichtbar im
     Nichts, und genau das sah unecht aus. Stattdessen wird jetzt in zwei
     Durchgängen gesucht: erst mit strengen Ansprüchen an den Bogen, dann
     mit lockeren. Findet sich gar nichts, wird kein Netz geschossen. */
  function suche(minDot, minHoehe, maxDist, hoheKante, pendelPruefen) {
    let best = null, bestScore = -1e9;
    for (const c of colliders) {
      if (c.klein) continue;                      // Feuerleitern taugen nicht
      if (c.h < py + hoheKante) continue;
      let cx = px + rx * wunschWeite, cz = pz + rz * wunschWeite;
      if (cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1) {
        /* Der Wunschpunkt liegt MITTEN im Haus. Dann wird bis zur dem
           Spieler zugewandten Dachkante zurückgegangen – sonst hing der
           Anker im Inneren und das Netz verlief durch die Fassade. */
        const sx = rx > 1e-6 ? (cx - c.x0) / rx : (rx < -1e-6 ? (cx - c.x1) / rx : Infinity);
        const sz = rz > 1e-6 ? (cz - c.z0) / rz : (rz < -1e-6 ? (cz - c.z1) / rz : Infinity);
        const sm = Math.min(sx, sz);
        if (isFinite(sm)) { cx -= rx * sm; cz -= rz * sm; }
      } else {
        cx = clamp(cx, c.x0, c.x1);
        cz = clamp(cz, c.z0, c.z1);
      }
      const dx = cx - px, dz = cz - pz;
      const dist = Math.hypot(dx, dz);
      if (dist > maxDist || dist < 3) continue;
      const dot = (dx * rx + dz * rz) / (dist || 1);
      if (dot < minDot) continue;
      /* Nur noch DACHKANTEN. Vorher durfte der Anker mitten auf einer
         Fassade liegen – dann verlief das Netz sichtbar durch die Wand
         und das Seil zog die Figur in das Haus hinein. */
      const anchorY = c.h - 0.35;
      if (anchorY < py + minHoehe) continue;
      /* Der tiefste Punkt des Pendels muss über der Straße bleiben. Sonst
         hängt man am Seil und schleift sofort über den Boden. */
      if (pendelPruefen) {
        const seil = Math.max(CFG.ropeMin, Math.hypot(dist, anchorY - py));
        if (anchorY - seil < boden + 2.5) continue;
      }
      const hoehe = anchorY - py;
      /* Nicht mehr "je höher desto besser": ein Anker 60 m über einem
         ergibt ein schlaffes, langes Seil und der erste Bogen passiert
         fast nichts – das ist das Unflüssige beim Anschwingen vom Boden.
         Bevorzugt wird eine Kante rund 20 m über dem Spieler. */
      const score = dot * 3
                  - Math.abs(dist - wunschWeite) / 18   // Wunschweite bevorzugen
                  - Math.abs(hoehe - 20) / 26;
      if (score > bestScore && freieSicht(px, py + 1.3, pz, cx, anchorY, cz, c)) {
        bestScore = score; best = V3(cx, anchorY, cz);
      }
    }
    return best;
  }
  return suche(0.3, 6, 60, 7, true)     // schöner Bogen nach vorn
      || suche(-0.15, 3, 95, 3, false)   // notfalls auch schräg und weiter weg
      || null;
}

function startSwing() {
  const anchor = findAnchor();
  if (!anchor) return false;                  // nichts zum Festmachen in Reichweite
  const abstand = anchor.distanceTo(player.pos);
  /* Das Netz wird beim Festmachen so weit eingeholt, dass der tiefste
     Punkt des Bogens über der Straße bleibt. Vorher wurden solche Anker
     einfach verworfen – tief über der Stadt fand man dann gar keinen mehr
     und der Schwung ging nicht los. Jetzt zieht das Netz stattdessen an,
     genau wie im Vorbild. */
  const boden = groundY(player.pos.x, player.pos.z);
  const maxLen = Math.max(CFG.ropeMin, anchor.y - boden - 2.2);
  /* Zusätzliche Obergrenze: ein 40-m-Seil schwingt kaum, es fällt nur.
     Mit höchstens 32 m bleiben die Bögen zügig und man merkt den Zug. */
  const grenze = Math.min(Math.max(maxLen, abstand * 0.55), 32);
  const zielLen = clamp(abstand, CFG.ropeMin, grenze);
  const hand = wechsleNetzHand();             // Hände wechseln sich ab
  /* Das Seil beginnt genau so lang, wie die Figur gerade entfernt ist, und
     wird dann eingeholt. Wurde es sofort auf die Wunschlänge gesetzt, hat
     die harte Seilbedingung die Figur im selben Bild an den Anker
     herangerissen – das war der Sprung nach oben beim Anschwingen. */
  player.swing = { anchor, hand, len: Math.max(abstand, zielLen), zielLen, t: 0 };
  player.state = 'swing';
  SFX.thwip();
  return true;
}

function stopSwing(boost) {
  if (player.state !== 'swing') return;
  player.swing = null;
  player.state = 'air';
  if (boost) {
    /* Am tiefsten Punkt loslassen gibt den größten Schub – wie beim
       echten Pendel wird die Drehbewegung in Weite umgesetzt. */
    const vh = Math.hypot(player.vel.x, player.vel.z);
    if (player.vel.y > -2) player.vel.y += 1.7;
    else player.vel.y += 0.8;
    if (vh > 6) { player.vel.x *= 1.03; player.vel.z *= 1.03; }
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
    treffEffekt(ziel, 0.6, 0xdff0ff);
    /* Zusätzlich ein kurzer Netzklatscher am Einschlag – ein paar Fäden,
       die sternförmig auseinanderspritzen. */
    netzKlatscher(ziel);
    popupWorld('Eingewickelt!', target.pos, '#bfe8ff');
  }
}

/* Sucht entlang der Blickrichtung die erste Hauskante, an der das Netz
   wirklich Halt findet. Ohne diese Prüfung endete der Netz-Zip an einem
   Punkt im leeren Himmel – der Faden hing sichtbar im Nichts. */
function zipHaltepunkt() {
  const f = camForward();
  const rx = -f.z, rz = f.x;                       // seitlich zur Blickrichtung
  const steig = Math.tan(clamp(camPitch, -0.2, 1.1));
  /* Kein reiner Strahl, sondern ein schmaler Kegel: mitten auf der Straße
     liegt genau geradeaus oft gar kein Haus, die Fassaden links und rechts
     aber schon. Ohne die Seitenproben ließ sich der Netz-Zip auf der
     Straße praktisch nie auslösen. */
  for (let s = 4; s <= 60; s += 1.5) {
    const y = player.pos.y + 1.4 + s * steig;
    for (const seit of [0, s * 0.14, -s * 0.14, s * 0.27, -s * 0.27, s * 0.38, -s * 0.38]) {
      const x = player.pos.x + f.x * s + rx * seit;
      const z = player.pos.z + f.z * s + rz * seit;
      for (const c of collidersNear(x, z)) {
        if (c.klein) continue;
        if (x > c.x0 - 0.4 && x < c.x1 + 0.4 && z > c.z0 - 0.4 && z < c.z1 + 0.4) {
          // Dachkante, wenn der Strahl oben ankommt – sonst die Wand selbst
          return V3(x, Math.min(c.h - 0.3, Math.max(y, player.pos.y + 2)), z);
        }
      }
    }
  }
  return null;
}

function webZip() {
  if (player.dead) return;
  const enemy = coneTargetEnemy(30, 0.5);
  const target = enemy
    ? V3(enemy.pos.x, enemy.pos.y + 1.2, enemy.pos.z)
    : zipHaltepunkt();
  if (!target) {
    if (player.keinHaltCd <= 0) { popupScreen('Kein Halt in Reichweite'); player.keinHaltCd = 1.4; }
    return;
  }
  stopSwing(false);
  const hand = wechsleNetzHand();
  player.state = 'zip';
  player.zip = { target, enemy: enemy || null, t: 0.6, hand };
  const dir = _v1.copy(target).sub(player.pos).sub(_v2.set(0, 1.2, 0)).normalize();
  player.vel.copy(dir).multiplyScalar(27);
  /* Kein zusätzlicher Blitz-Faden: der Zip zieht den Faden ohnehin die
     ganze Zeit mit. Beide zusammen sahen aus wie zwei Netze. */
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
  if (!heroVisual || player.dead || player.dodgeT > 0 || player.state === 'climb') return;
  const dir = inputDir() || { x: -Math.sin(player.facing), z: -Math.cos(player.facing) };
  /* Die Dauer kommt aus der Rollen-Bewegung selbst. Vorher war sie mit
     0,45 s fest verdrahtet, die Bewegungsdatei ist aber gut doppelt so
     lang – die Rolle wurde deshalb mitten im Abrollen abgeschnitten und
     ging in den Stand über. Genau das sah kaputt aus. */
  /* Vorwärts/rückwärts wird gerollt, zur Seite gibt es seit mixamo-5 einen
     echten Ausweichschritt. Beim Schritt zur Seite bleibt die Blickrichtung
     erhalten – man weicht aus, ohne den Gegner aus den Augen zu verlieren. */
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  const vor = dir.x * fx + dir.z * fz;
  const seit = dir.x * -fz + dir.z * fx;
  const zurSeite = Math.abs(seit) > Math.abs(vor)
    && heroVisual.hatClip && heroVisual.hatClip(seit > 0 ? 'ausweichenR' : 'ausweichenL');
  const welche = zurSeite ? (seit > 0 ? 'ausweichenR' : 'ausweichenL') : 'roll';
  /* In der Luft wird NICHT gerollt. Die Rollbewegung gehört auf den Boden –
     in der Luft sah es aus, als würde man frei schwebend einen Purzelbaum
     schlagen. Dort gibt es nur einen kurzen Ausweichsatz, die Figur behält
     ihre Flughaltung. */
  const dauer = player.onGround
    ? ((heroVisual.rolleOneShot ? heroVisual.rolleOneShot(zurSeite ? 0.5 : 0.72, welche) : 0)
       || CFG.rollDauer)
    : 0.34;
  /* Tempo so wählen, dass die Strecke zur Bewegung passt: rund vier Meter
     in einem Satz. 19 m/s haben die Figur früher neun Meter weit aus dem
     Bild geschossen, die Kamera kam nicht hinterher. */
  const tempo = zurSeite ? 8.5 : (player.onGround ? 10.5 : 9);
  player.vel.x = dir.x * tempo;
  player.vel.z = dir.z * tempo;
  if (!zurSeite) player.facing = Math.atan2(dir.x, dir.z);
  player.dodgeT = dauer;
  player.rollT = player.onGround ? dauer : 0;
  player.rollGesamt = dauer;
  player.iFrames = dauer * 0.9;
  player.attack = null;                          // Angriff sauber abbrechen
  player.attackCd = Math.min(player.attackCd, 0.12);
  camShake = Math.max(camShake, 0.03);
  SFX.swoosh();
}

/* Schlagkombo: jede Stufe sieht anders aus. Der gespiegelte Schlag
   ("punch2") kommt aus derselben Datei, nur seitenverkehrt – dadurch
   wechselt die Figur sichtbar den Arm. Die letzte Stufe ist der Abschluss. */
const KOMBO = [
  { art: 'punch',  ziel: 0.42, arm: 'R' },   // gerader Stoß
  { art: 'hook',   ziel: 0.46, arm: 'L' },   // Haken
  { art: 'punch2', ziel: 0.44, arm: 'L' },   // gespiegelter Stoß
  { art: 'punch3', ziel: 0.52, arm: 'R' },   // Kombischlag
  { art: 'hook2',  ziel: 0.48, arm: 'R' },   // gespiegelter Haken
  { art: 'kick',   ziel: 0.62, arm: 'R', finisher: true },
];

function tryAttack(type) {
  if (!heroVisual || player.dead || player.state === 'climb') return;
  if (player.rollT > 0) return;
  /* Zu früh gedrückt? Eingabe kurz merken und automatisch nachziehen –
     dadurch fühlt sich die Schlagfolge zusammenhängend an. */
  if (player.attackCd > 0) {
    /* JEDER Klick während der laufenden Bewegung wird gemerkt und direkt
       danach ausgeführt. Vorher zählte er nur in den letzten 0,4 s – bei
       einer 0,9-s-Bewegung lag die Sperre aber bei ~0,5 s, also verfiel
       schnelles Klicken komplett. Deshalb war von der Kombo nichts zu
       sehen: Stufe 2 wurde nie erreicht. */
    player.attackBuffer = { type, t: Math.max(0.5, player.attackCd + 0.25) };
    return;
  }
  player.attackBuffer = null;
  if (player.comboTimer <= 0) { player.combo = 0; player.stufe = 0; }
  /* Die Schlagfolge richtet sich nach der Zahl der AUSGEFÜHRTEN Schläge,
     nicht nach den Treffern. Vorher zählte nur ein Treffer weiter – wer
     ins Leere schlug oder danebenstand, sah immer wieder denselben
     ersten Schlag. Genau deshalb war die Kombo nicht zu erkennen. */
  const stufe = player.stufe || 0;
  /* In der Luft gibt es einen eigenen Sprungangriff – am Boden die Kombo. */
  const k = !player.onGround
    ? { art: 'luftangriff', ziel: 0.5, arm: 'R' }
    : type === 'kick'
      ? { art: 'kick', ziel: 0.55, arm: 'R' }
      : KOMBO[stufe % KOMBO.length];
  const finisher = !!k.finisher;
  const arm = k.arm;
  /* Die Dauer kommt aus der Bewegungsdatei selbst. Vorher war sie fest
     verdrahtet und viel kürzer als der Clip – deshalb startete die
     Animation bei schnellem Klicken immer wieder von vorn. */
  const dauer = heroVisual.attackOneShot(0, k.art, k.ziel) || k.ziel || 0.42;
  const wieTritt = k.art === 'kick' || k.art === 'luftangriff' || k.art === 'knie';
  player.attack = { type: wieTritt ? 'kick' : 'punch', t: 0, arm, art: k.art,
                    hitDone: false, finisher, stufe, dauer };
  if (player.onGround && type !== 'kick') {
    player.stufe = (stufe + 1) % KOMBO.length;
    player.comboTimer = Math.max(player.comboTimer, 1.6);
  }
  /* Der nächste Schlag darf schon starten, während der aktuelle noch
     ausklingt – so entsteht überhaupt erst eine flüssige Kette. */
  player.attackCd = dauer * 0.72;

  /* Zielbindung: Solange die Kombo läuft, bleibt derselbe Gegner das Ziel.
     Vorher wurde bei JEDEM Schlag neu der nächstgelegene gesucht – mitten
     in der Kombo sprang die Figur deshalb zu einem anderen Gegner, drehte
     sich weg und rutschte quer durch die Gruppe. */
  if (player.ziel && (player.ziel.dead ||
      Math.hypot(player.ziel.pos.x - player.pos.x, player.ziel.pos.z - player.pos.z) > 5.5 ||
      Math.abs(player.ziel.pos.y - player.pos.y) > 2.5)) {
    player.ziel = null;
  }
  if (!player.ziel || player.comboTimer <= 0) {
    const neu = nearestEnemy(4.2, 0.2);
    if (neu) player.ziel = neu;
  }
  const target = player.ziel;
  if (target) {
    const dx = target.pos.x - player.pos.x, dz = target.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    /* Genau so weit heranziehen, dass der Schlag sitzt – nicht weiter.
       Der frühere Stoß mit bis zu 9 m/s hat die Figur am Gegner
       vorbeigeschoben, das war das Rutschen. */
    /* Schlagabstand: Arm plus zwei halbe Körper sind rund 1,1 m. Vorher
       wurde nur bis 1,7 m herangezogen – auf die Entfernung berührt man
       sich beim Schlagen überhaupt nicht, der Treffer war reine Zahlen-
       sache. Jetzt geht die Figur so weit ran, dass die Faust ankommt. */
    if (d > NAHKAMPF) {
      const noetig = Math.min(14, (d - NAHKAMPF * 0.9) / Math.max(0.12, dauer * 0.28));
      player.vel.x = (dx / d) * noetig;
      player.vel.z = (dz / d) * noetig;
    } else {
      player.vel.x *= 0.2; player.vel.z *= 0.2;
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
  /* Reichweite passend zum neuen, engen Schlagabstand. */
  const range = a.type === 'kick' ? 2.7 : 2.4;
  /* Zuerst das gebundene Ziel prüfen – sonst zählt mitten in der Kombo
     plötzlich ein anderer Gegner als Treffer. */
  let e = null;
  if (player.ziel && !player.ziel.dead) {
    const zd = Math.hypot(player.ziel.pos.x - player.pos.x, player.ziel.pos.z - player.pos.z);
    if (zd <= range + 0.4 && Math.abs(player.ziel.pos.y - player.pos.y) <= 2.5) e = player.ziel;
  }
  if (!e) e = nearestEnemy(range, 0.05);
  if (!e) {
    /* Ein Schlag ins Leere setzt die Kette nicht mehr auf null zurück –
       sonst kam man ohne Gegner nie über Stufe 1 hinaus und die Kombo
       war praktisch unsichtbar. Sie läuft jetzt nur schneller ab. */
    player.combo = Math.max(0, player.combo - 1);
    player.comboTimer = Math.min(player.comboTimer, 1.2);
    updateHUD();
    return;
  }
  /* Zum Treffer wird der Rest der Lücke geschlossen. Der Heranzug über die
     Geschwindigkeit allein war zu langsam: gemessen standen die Figuren im
     Moment des Treffers noch 1,70 m auseinander, da berührt sich nichts.
     Der Nachzug ist auf 0,8 m begrenzt und sieht wie ein Ausfallschritt aus. */
  {
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > NAHKAMPF + 0.12) {
      const zieh = Math.min(0.8, d - NAHKAMPF);
      player.pos.x += (dx / d) * zieh;
      player.pos.z += (dz / d) * zieh;
      player.facing = Math.atan2(dx, dz);
    }
  }
  const wucht = a.finisher ? 1.9 : (a.type === 'kick' ? 1.5 : 1);
  let dmg = (a.type === 'kick' ? 16 : 11) * (a.finisher ? 1.5 : 1);
  if (e.webT > 0) dmg *= 2;           // eingewickelte Gegner sind wehrlos
  dmg *= 1 + Math.min(player.combo, 6) * 0.06;   // Kombo steigert den Schaden

  /* Deckung: Schläge prallen weitgehend ab, ein Tritt bricht sie auf.
     Dadurch lohnt es sich, zwischen Schlag und Tritt zu wechseln. */
  let geblockt = false;
  if (e.blockT > 0) {
    if (a.type === 'kick' || a.finisher) {
      e.blockT = 0; e.blockCd = rand(2.5, 5); e.staggerT = Math.max(e.staggerT, 0.5);
      popupWorld('Deckung gebrochen!', e.pos, '#8fd4ff');
    } else {
      dmg *= 0.2; geblockt = true;
      player.combo = Math.max(0, player.combo - 1);
    }
  }

  const treffer = _v1.set(
    (player.pos.x + e.pos.x) / 2,
    Math.max(player.pos.y, e.pos.y) + 1.15,
    (player.pos.z + e.pos.z) / 2
  );
  treffEffekt(treffer, geblockt ? wucht * 0.5 : wucht, geblockt ? 0x4da3ff : (a.finisher ? 0xffd23c : 0xffffff));

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
  /* Treffer sichtbar machen – vorher steckte die Figur alles regungslos ein. */
  if (player.onGround) player.hitT = 0.32;
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
  if (player.dead) {
    /* Auch im K.o. wirkt Schwerkraft – vorher blieb die Figur dort in der
       Luft stehen, wo sie getroffen wurde. */
    const boden = groundY(player.pos.x, player.pos.z);
    if (player.pos.y > boden) {
      player.vel.y -= CFG.gravity * dt;
      player.pos.y += player.vel.y * dt;
      if (player.pos.y <= boden) { player.pos.y = boden; player.vel.y = 0; }
    }
    player.vel.x *= Math.max(0, 1 - dt * 3);
    player.vel.z *= Math.max(0, 1 - dt * 3);
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.z * dt;
    /* Nur EIN Aufruf pro Bild – vorher schaltete der zweite Aufruf sofort
       wieder auf Stehen zurück, dadurch fing das Umfallen endlos neu an. */
    player.anim = 'downed';
    updateHeroVisual(dt);
    return;
  }

  const dir = inputDir();
  const wantSwing = (keys['Space'] || swingHeld);

  /* ---- Über die Kante ziehen ---- */
  if (player.state === 'kante' && player.kante) {
    const k = player.kante;
    k.t += dt / k.dauer;
    const f = clamp(k.t, 0, 1);
    /* Erst hochziehen, dann nach vorn aufs Dach – das entspricht dem
       Ablauf der Bewegung. */
    const hoch = clamp(f / 0.62, 0, 1);
    const vor = clamp((f - 0.45) / 0.55, 0, 1);
    player.pos.y = lerp(k.von.y, k.nach.y, hoch * hoch * (3 - 2 * hoch));
    player.pos.x = lerp(k.von.x, k.nach.x, vor * vor * (3 - 2 * vor));
    player.pos.z = lerp(k.von.z, k.nach.z, vor * vor * (3 - 2 * vor));
    player.anim = 'kante';
    if (f >= 1) {
      player.kante = null;
      player.state = 'ground';
      player.onGround = true;
      player.jumps = 0;
      player.vel.set(0, 0, 0);
    }
    updateHeroVisual(dt);
    return;
  }

  /* ---- Klettern ---- */
  if (player.state === 'climb') {
    const w = player.wallInfo;
    const c = w.col;
    // an der Wand halten
    if (w.nx !== 0) player.pos.x = (w.nx > 0 ? c.x1 : c.x0) + w.nx * CFG.climbGap;
    else player.pos.z = (w.nz > 0 ? c.z1 : c.z0) + w.nz * CFG.climbGap;
    // Bewegung an der Wand: W=hoch, S=runter, A/D=seitlich
    let up = 0, side = 0;
    if (keys['KeyW'] || keys['ArrowUp']) up += 1;
    if (keys['KeyS'] || keys['ArrowDown']) up -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) side += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) side -= 1;
    /* Tangente „nach rechts" aus Sicht der Figur. Die Figur schaut in
       Richtung (-nx, -nz); rechts davon liegt (-f.z, f.x) = (nz, -nx).
       Vorher stand hier genau das Gegenteil – deshalb liefen A und D
       an der Wand verkehrt herum. */
    const tx = w.nz, tz = -w.nx;
    player.vel.set(tx * side * CFG.climbSpeed, up * CFG.climbSpeed, tz * side * CFG.climbSpeed);
    player.pos.addScaledVector(player.vel, dt);
    /* Am Rand der Wand um die Ecke wechseln. Vorher wurde die Figur dort
       einfach festgehalten – an jeder Hauskante war Schluss. */
    if (side !== 0) {
      const rand = 0.25;
      let neuNx = 0, neuNz = 0;
      if (w.nx !== 0) {
        if (player.pos.z < c.z0 + rand) neuNz = -1;
        else if (player.pos.z > c.z1 - rand) neuNz = 1;
      } else {
        if (player.pos.x < c.x0 + rand) neuNx = -1;
        else if (player.pos.x > c.x1 - rand) neuNx = 1;
      }
      if (neuNx !== 0 || neuNz !== 0) {
        player.wallInfo = player.wall = { nx: neuNx, nz: neuNz, col: c };
        if (neuNx !== 0) player.pos.x = (neuNx > 0 ? c.x1 : c.x0) + neuNx * CFG.climbGap;
        else player.pos.z = (neuNz > 0 ? c.z1 : c.z0) + neuNz * CFG.climbGap;
        // knapp hinter die Kante setzen, damit man nicht sofort zurückspringt
        if (neuNx !== 0) player.pos.z = clamp(player.pos.z, c.z0 + 0.35, c.z1 - 0.35);
        else player.pos.x = clamp(player.pos.x, c.x0 + 0.35, c.x1 - 0.35);
        SFX.swoosh();
      }
    }
    // seitlich begrenzen
    if (w.nx !== 0) player.pos.z = clamp(player.pos.z, c.z0 + 0.2, c.z1 - 0.2);
    else player.pos.x = clamp(player.pos.x, c.x0 + 0.2, c.x1 - 0.2);
    player.phase += dt * (1 + (Math.abs(up) + Math.abs(side)) * 6);
    /* Klettertempo für die Animation: hoch = vorwärts, runter = rückwärts,
       ohne Eingabe hängt die Figur still an der Wand. */
    const bewegt = Math.abs(up) + Math.abs(side);
    player.klettertempo = bewegt === 0 ? 0 : (up < 0 ? -0.9 : 1);
    /* Oben angekommen → über die Kante ziehen. Vorher wurde die Figur
       einfach aufs Dach versetzt und nach oben geschleudert; jetzt läuft
       dafür eine eigene Bewegung ab und der Körper wandert währenddessen
       auf die Dachfläche. */
    if (player.pos.y + 1.75 > c.h && up > 0) {
      const dauer = heroVisual.kanteOneShot ? heroVisual.kanteOneShot(0.95) : 0;
      const ziel = V3(
        player.pos.x - w.nx * (player.radius + 0.75),
        c.h,
        player.pos.z - w.nz * (player.radius + 0.75),
      );
      if (dauer > 0.2) {
        player.state = 'kante';
        player.kante = { t: 0, dauer, von: player.pos.clone(), nach: ziel, hoch: c.h };
        player.vel.set(0, 0, 0);
      } else {
        player.pos.copy(ziel);
        player.vel.set(-w.nx * 3, 5, -w.nz * 3);
        player.state = 'air';
      }
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
    /* Seitliches Hangeln hat seit mixamo-5 eine eigene Bewegung; senkrecht
       geht es mit dem freien Klettern nach oben. Die Wandpose legt sich in
       beiden Fällen darüber. */
    const seitlich = Math.abs(side) > Math.abs(up);
    player.anim = bewegt === 0 ? 'haengen'            // ruhig an der Wand hängen
                : seitlich ? 'klettern_seit'          // seitlich hangeln
                : 'climb';                            // senkrecht hoch/runter
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
    /* Kein künstlicher Satz nach oben mehr. Vorher wurde die Figur beim
       Anschwingen dicht über dem Boden schlagartig auf 5,5 m/s nach oben
       geschossen – das sah aus, als würde sie aus dem Nichts fünf Meter
       hochspringen. Stattdessen holt das Netz selbst ein, bis der Bogen
       über der Straße bleibt (siehe startSwing). Dadurch fängt der Schwung
       tief an und steigt mit jedem Bogen weiter. */
    if (hoehe > 0.8 || player.vel.y < 0) {
      const vy = player.vel.y;
      if (!startSwing()) {
        /* Kein Haus in Reichweite (z. B. über dem Fluss oder hoch über
           allen Dächern): kein Netz ins Leere schießen. Die Taste bleibt
           aber scharf – sobald ein Haus in Reichweite kommt, greift das
           Netz von selbst, ohne dass man neu drücken muss. */
        player.vel.y = vy;
        if (player.keinHaltCd <= 0) {
          popupScreen('Kein Halt in Reichweite');
          player.keinHaltCd = 1.6;
        }
      }
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
      /* Die Rolle läuft aus, statt mit vollem Tempo abzubrechen. */
      const b = Math.max(0, 1 - dt * 2.6);
      player.vel.x *= b; player.vel.z *= b;
    } else if (player.attack && player.attack.type !== 'web') {
      /* Gebremst wird erst NACH dem Treffer. Vorher hat die Bremse schon
         den Ausfallschritt zum Gegner abgewürgt – die Figur kam gar nicht
         in Reichweite und schlug ins Leere. */
      const b = Math.max(0, 1 - dt * (player.attack.hitDone ? 9 : 1.2));
      player.vel.x *= b; player.vel.z *= b;
      if (dir) player.facing = dampAngle(player.facing, Math.atan2(dir.x, dir.z), Math.min(1, dt * 3));
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
    /* Das Seil wird mit begrenztem Tempo eingeholt. Ein Anteilsschritt hat
       bei großem Unterschied über 30 m/s Zugkraft ergeben – die Figur
       schoss dabei nach oben. Acht Meter je Sekunde fühlt sich nach Zug an,
       ohne zu katapultieren. */
    const spann = 8 * dt;
    s.len = s.len > s.zielLen ? Math.max(s.zielLen, s.len - spann)
                              : Math.min(s.zielLen, s.len + spann);

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
  const fallTempo = -player.vel.y;          // für die Landeanimation
  player.onGround = false;
  player.platform = null;
  collideBody(player, prevY);
  collidePlayerCars(prevY);
  collidePlayerHelis(prevY);

  if (player.onGround) {
    if (player.state === 'swing') stopSwing(false);
    if (!wasOnGround && player.vel.length() < 4) SFX.swoosh();
    /* Aus größerer Höhe aufkommen: kurz die Landeanimation zeigen. */
    if (!wasOnGround && fallTempo > 6) player.landT = clamp(fallTempo / 26, 0.18, 0.42);
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
  if (player.keinHaltCd > 0) player.keinHaltCd -= dt;
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
    if (player.comboTimer <= 0) { player.combo = 0; player.stufe = 0; player.ziel = null; updateHUD(); }
  }
  if (player.regenCd > 0) player.regenCd -= dt;
  else if (player.hp < CFG.playerHP) { player.hp = Math.min(CFG.playerHP, player.hp + dt * 4); updateHUD(); }

  /* ---- Angriff auswerten ---- */
  if (player.attack) {
    const a = player.attack;
    a.t += dt / (a.dauer || 0.34);
    /* Der Sprungangriff traf erst nach einem Drittel des langen Clips –
       da stand die Figur längst wieder am Boden. Er trifft jetzt sehr
       früh, die übrigen Schläge wie gehabt in der Mitte der Ausholphase. */
    const treffPunkt = a.art === 'luftangriff' ? 0.3 : (a.type === 'kick' ? 0.3 : 0.33);
    if (!a.hitDone && a.t > treffPunkt) { a.hitDone = true; resolveAttackHit(); }
    if (a.t >= 1) player.attack = null;
  }

  /* ---- Animation wählen ---- */
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.landT > 0) player.landT -= dt;
  if (player.hitT > 0) player.hitT -= dt;
  /* Verliert man mitten in der Rolle den Boden (Bordstein, Kante), wird
     sie abgebrochen – sonst rollt die Figur im Fallen weiter. */
  if (player.rollT > 0 && !player.onGround && player.vel.y < -1) player.rollT = 0;
  if (player.rollT > 0) player.anim = 'roll';
  else if (player.hitT > 0 && player.onGround && !player.attack) player.anim = 'hit';
  else if (player.state === 'swing') player.anim = 'swing';
  /* Beim Netz-Zip auf einen Gegner fliegt der Held mit dem Knie voran. */
  else if (player.state === 'zip') player.anim = (player.zip && player.zip.enemy) ? 'knie' : 'air';
  /* Steigen und Fallen sind zwei verschiedene Bewegungen – solange es nach
     oben geht, läuft der Absprung, danach erst der freie Fall. */
  else if (!player.onGround) player.anim = player.vel.y > 1.5 ? 'jump' : 'air';
  else if (player.landT > 0) player.anim = 'land';
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
    r.rotation.x = lerp(r.rotation.x, 0.13, Math.min(1, dt * 10));
  } else
  /* Ausweichen: schneller Satz mit Vorlage – bewusst OHNE Überschlag.
     Die frühere Rolle drehte den Körper um die Füße, dadurch verschwand die
     Figur im Boden und tauchte anschließend von oben wieder auf. */
  if (player.rollT > 0) {
    player.rollT -= dt;
    /* Die Ausweichrolle kommt jetzt aus der Animation. Eine zusätzliche
       Drehung der ganzen Figur hat sie früher unter den Boden gezogen. */
    r.rotation.x = lerp(r.rotation.x, 0, Math.min(1, dt * 18));
  } else {
    // Körperneigung beim Schwingen/Fallen
    let tilt = 0;
    if (player.state === 'swing' && player.swing) {
      /* Beim Schwingen hing die Figur senkrecht unter dem Netz und lehnte
         sich sogar leicht nach HINTEN – die Beine liefen also voraus. Im
         Vorbild fliegt der Kopf voran und die Beine hängen hinterher, je
         schneller desto flacher. Genau das ist der Unterschied zwischen
         "hängt an einem Faden" und "schwingt". */
      const hs = Math.hypot(player.vel.x, player.vel.z);
      tilt = clamp(0.3 + hs * 0.05, 0.3, 1.15);
      // Kurvenlage: seitlich in den Bogen legen
      const a = player.swing.anchor;
      const rx = Math.cos(player.facing), rz = -Math.sin(player.facing);
      const seit = (a.x - player.pos.x) * rx + (a.z - player.pos.z) * rz;
      r.rotation.z = lerp(r.rotation.z, clamp(-seit * 0.07, -0.5, 0.5), Math.min(1, dt * 5));
    } else {
      if (player.state === 'air') tilt = clamp(-player.vel.y * 0.015, -0.25, 0.3);
      if (r.rotation.z !== 0) r.rotation.z = lerp(r.rotation.z, 0, Math.min(1, dt * 8));
    }
    r.rotation.x = lerp(r.rotation.x, tilt, Math.min(1, dt * 8));
  }

  if (player.state !== 'climb' && heroVisual.versatzAus) {
    heroVisual.versatzAus(Math.min(1, dt * 8));
  }
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  heroVisual.play(player.anim, {
    phase: player.phase,
    speed01: clamp(hSpeed / CFG.sprintSpeed, 0, 1),
    speed: hSpeed,
    tempo: player.klettertempo,
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
      heroVisual.poseSchwung(player.swing.anchor, player.swing.hand, elapsed,
                             clamp(player.vel.y * 0.09, -1, 1), r.rotation.x);
    } else if (player.state === 'kante') {
      /* Der Kantenzug führt allein – hier keine eigene Pose dazwischen. */
    } else if (player.state === 'climb') {
      /* Die geladene Bewegung liefert den Rhythmus, die Wandpose setzt
         Hände und Füße wirklich an die Wand. */
      const w = player.wallInfo;
      if (w && heroVisual.poseWandkriechen) heroVisual.poseWandkriechen(w.nx, w.nz, player.phase, 0.85);
      else if (!heroVisual.hatClip('climb')) heroVisual.poseKlettern(player.phase);
    } else if (player.state === 'zip' && player.zip) {
      heroVisual.poseSchuss(player.zip.target, player.zip.hand, 1);
    } else if (player.schussT > 0) {
      player.schussT -= dt;
      heroVisual.poseSchuss(player.schussZiel, netzHand, 1);
    } else if (player.dead) {
      heroVisual.legeHin(Math.min(1, dt * 6));
    } else if (player.onGround) {
      /* Beim Laufen darf der Ausgleich nur ganz sacht nachziehen, sonst
         hüpft der Körper im Schritttakt mit. Im Stand darf er zügiger sein. */
      /* Beim Laufen ganz sacht (sonst hüpft der Körper im Schritttakt),
         beim Landen zügig, damit die Füße sofort aufsetzen. */
      const zaeh = (player.anim === 'run' || player.anim === 'walk') ? 0.6
                 : (player.anim === 'land' || player.anim === 'roll') ? 12 : 5;
      heroVisual.bodenAusgleich(Math.min(0.35, dt * zaeh));
    }
  }

  /* Netzfaden ganz zum Schluss setzen – erst jetzt steht die Hand wirklich
     dort, wo sie im Bild zu sehen ist. Vorher hing der Faden ein Bild
     hinterher und schnitt durch den Körper. */
  if (player.fadenZiel) {
    heroVisual.root.updateMatrixWorld(true);
    /* Beim Schwingen hängt das Seil unter Last leicht durch, beim Netz-Zip
       ist es straff gespannt. */
    placeStrand(swingStrand, heroHandPos(_v3, player.fadenHand), player.fadenZiel,
                player.state === 'swing' ? 0.014 : 0.004);
    player.fadenZiel = null;
  }
}

/* ======================= Autos / Verkehr ======================= */
const cars = [];
const CAR_COLORS = [0xc23b30, 0x3059b5, 0xd8d8d8, 0x2c2c30, 0xd5a021, 0x3b7a3f, 0x8446a8, 0x9fa8b5];

/* Fahrzeugtypen. Vorher gab es nur acht Farben derselben Karosserie –
   eine Straße wirkt erst lebendig, wenn Größe und Form sich unterscheiden. */
const FAHRZEUGE = [
  { art: 'pkw',    laenge: 4.4, breite: 1.9, hoehe: 0.6, gewicht: 46 },
  { art: 'taxi',   laenge: 4.5, breite: 1.9, hoehe: 0.6, gewicht: 16 },
  { art: 'bus',    laenge: 9.5, breite: 2.4, hoehe: 2.4, gewicht: 10 },
  { art: 'lkw',    laenge: 8.0, breite: 2.3, hoehe: 2.0, gewicht: 14 },
  { art: 'polizei',laenge: 4.6, breite: 2.0, hoehe: 0.65, gewicht: 6 },
];
function waehleFahrzeug() {
  const summe = FAHRZEUGE.reduce((a, f) => a + f.gewicht, 0);
  let r = Math.random() * summe;
  for (const f of FAHRZEUGE) { r -= f.gewicht; if (r <= 0) return f; }
  return FAHRZEUGE[0];
}

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

/* ======================= Helikopter ======================= */
const helis = [];
const _hOben = new THREE.Vector3(0, 1, 0);
const _hAchse = new THREE.Vector3();

function makeHeliMesh() {
  const g = new THREE.Group();
  const lack = new THREE.MeshLambertMaterial({ color: 0x2b3550 });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x14161c });
  const glas = new THREE.MeshLambertMaterial({ color: 0x9fd2e8 });

  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 4.2), lack);
  rumpf.position.y = 0.2; rumpf.castShadow = true;
  g.add(rumpf);
  const kanzel = new THREE.Mesh(new THREE.SphereGeometry(1.0, 12, 10), glas);
  kanzel.scale.set(0.95, 0.8, 1.1);
  kanzel.position.set(0, 0.25, 2.1);
  g.add(kanzel);
  const heck = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 3.6), lack);
  heck.position.set(0, 0.55, -3.4); heck.castShadow = true;
  g.add(heck);
  const finne = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.8), lack);
  finne.position.set(0, 1.1, -4.9);
  g.add(finne);

  // Kufen
  for (const sx of [-1, 1]) {
    const kufe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3.4), dunkel);
    kufe.position.set(sx * 0.85, -0.85, 0.2);
    g.add(kufe);
    for (const sz of [1.1, -1.1]) {
      const strebe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), dunkel);
      strebe.position.set(sx * 0.85, -0.45, sz);
      g.add(strebe);
    }
  }

  /* Rotor: vier Blätter plus eine fast durchsichtige Scheibe – im Flug
     verschmilzt beides zum typischen Rotorkreis. */
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), dunkel);
  mast.position.y = 1.35;
  g.add(mast);
  const rotor = new THREE.Group();
  /* Rotor deutlich über dem Rumpf – sonst steht man beim Landen mitten
     zwischen den Blättern. */
  rotor.position.y = 1.95;
  const blattGeo = new THREE.BoxGeometry(0.26, 0.06, 7.2);
  /* Zwei Balken ergeben vier Blätter (jeder Balken reicht nach beiden Seiten). */
  for (let i = 0; i < 2; i++) {
    const blatt = new THREE.Mesh(blattGeo, dunkel);
    blatt.rotation.y = i * Math.PI / 2;
    rotor.add(blatt);
  }
  const scheibe = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24),
    new THREE.MeshBasicMaterial({ color: 0x9aa3b5, transparent: true, opacity: 0.16,
                                 side: THREE.DoubleSide, depthWrite: false }));
  scheibe.rotation.x = -Math.PI / 2;
  rotor.add(scheibe);
  g.add(rotor);

  const heckRotor = new THREE.Group();
  heckRotor.position.set(0.28, 1.1, -4.9);
  for (let i = 0; i < 3; i++) {
    const blatt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.06), dunkel);
    blatt.rotation.z = i * Math.PI / 3;
    heckRotor.add(blatt);
  }
  g.add(heckRotor);

  const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }));
  lampe.position.set(0, -0.7, -1.6);
  g.add(lampe);

  /* Suchscheinwerfer: ein offener Kegel als Lichtstrahl. Er hängt nicht am
     Rumpf, sondern in der Szene – so kann er unabhängig von der Kurvenlage
     senkrecht nach unten auf die Straße zeigen. */
  /* Breites Ende oben in der Geometrie – nach dem Ausrichten zeigt es
     zum Boden, das schmale zum Hubschrauber. */
  const strahlGeo = new THREE.CylinderGeometry(6.5, 0.5, 1, 14, 1, true);
  const strahl = new THREE.Mesh(strahlGeo, new THREE.MeshBasicMaterial({
    color: 0xfff0c0, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, depthWrite: false }));
  scene.add(strahl);
  const fleck = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true,
                                  opacity: 0.16, depthWrite: false }));
  fleck.rotation.x = -Math.PI / 2;
  scene.add(fleck);

  /* Ein echter Polizeihubschrauber ist rund 15 m lang. In dieser Größe
     passt der Held aufrecht zwischen Dach und Rotor. */
  g.scale.setScalar(1.9);
  g.userData.heli = true;
  scene.add(g);
  return { mesh: g, rotor, heckRotor, lampe, strahl, fleck };
}

/* Höchstes Haus entlang einer Flugrunde suchen.
   Der Hubschrauber muss darüber bleiben, sonst fliegt er durch die Häuser. */
function hoechstesHausAufRunde(mx, mz, radius) {
  let hoch = 0;
  for (let i = 0; i < 72; i++) {
    const w = (i / 72) * Math.PI * 2;
    const x = mx + Math.cos(w) * radius;
    const z = mz + Math.sin(w) * radius;
    for (const c of colliders) {
      /* Etwas Puffer um das Haus herum – der Rotor ist breiter als der Rumpf. */
      if (x > c.x0 - 9 && x < c.x1 + 9 && z > c.z0 - 9 && z < c.z1 + 9) {
        if (c.h > hoch) hoch = c.h;
      }
    }
  }
  return hoch;
}

function spawnHelis() {
  for (let i = 0; i < CFG.heliCount; i++) {
    const teile = makeHeliMesh();
    helis.push({
      ...teile,
      /* Jeder Hubschrauber zieht seine eigene weite Runde über der Stadt. */
      mx: rand(-70, 70), mz: rand(-70, 70),
      radius: rand(60, 130),
      winkel: rand(0, Math.PI * 2),
      tempo: rand(0.045, 0.085) * (Math.random() < 0.5 ? 1 : -1),
      hoehe: 0,      // wird gleich aus den Hausdächern bestimmt
      wanken: rand(0, Math.PI * 2),
    });
    const h = helis[helis.length - 1];
    /* Reiseflughöhe: sicher über dem höchsten Dach der eigenen Runde. */
    h.hoehe = hoechstesHausAufRunde(h.mx, h.mz, h.radius) + rand(16, 26);
  }
}

/* Deckfläche eines Hubschraubers – darauf kann man landen und mitfliegen. */
function heliAABB(h) {
  const p = h.mesh.position;
  return { x0: p.x - 2.9, x1: p.x + 2.9, z0: p.z - 4.2, z1: p.z + 4.2, top: p.y + 1.9 };
}

function updateHelis(dt) {
  for (const h of helis) {
    const vorherX = h.mesh.position.x, vorherZ = h.mesh.position.z;
    h.winkel += h.tempo * dt;
    h.wanken += dt * 0.7;
    const x = h.mx + Math.cos(h.winkel) * h.radius;
    const z = h.mz + Math.sin(h.winkel) * h.radius;
    const y = h.hoehe + Math.sin(h.wanken) * 1.4;
    h.mesh.position.set(x, y, z);
    /* Nase in Flugrichtung, dazu leichte Kurvenlage – ohne das wirkt der
       Flug wie ein Modell an der Schnur. */
    const dx = x - vorherX, dz = z - vorherZ;
    if (dx * dx + dz * dz > 1e-6) h.mesh.rotation.y = Math.atan2(dx, dz);
    h.mesh.rotation.z = lerp(h.mesh.rotation.z, h.tempo > 0 ? -0.18 : 0.18, Math.min(1, dt * 2));
    h.mesh.rotation.x = -0.06;
    h.rotor.rotation.y += dt * 26;
    h.heckRotor.rotation.x += dt * 34;
    h.lampe.visible = (elapsed % 1.1) < 0.55;

    /* Bei einem Überfall zieht ein Hubschrauber über den Tatort und kreist
       enger – wie eine echte Polizeistaffel. */
    if (h.zielMitte) {
      h.mx = lerp(h.mx, h.zielMitte.x, Math.min(1, dt * 0.25));
      h.mz = lerp(h.mz, h.zielMitte.z, Math.min(1, dt * 0.25));
      h.radius = lerp(h.radius, 34, Math.min(1, dt * 0.25));
    }

    /* Suchscheinwerfer: wandert langsam über den Boden. */
    const zx = h.sucheX !== undefined ? h.sucheX : x;
    const zz = h.sucheZ !== undefined ? h.sucheZ : z;
    h.sucheWinkel = (h.sucheWinkel || 0) + dt * 0.5;
    const zielX = (h.zielMitte ? h.zielMitte.x : x) + Math.cos(h.sucheWinkel) * 14;
    const zielZ = (h.zielMitte ? h.zielMitte.z : z) + Math.sin(h.sucheWinkel * 0.7) * 14;
    h.sucheX = lerp(zx, zielX, Math.min(1, dt * 1.2));
    h.sucheZ = lerp(zz, zielZ, Math.min(1, dt * 1.2));
    const boden = groundY(h.sucheX, h.sucheZ);
    const laenge = Math.max(4, y - boden);
    h.strahl.position.set((x + h.sucheX) / 2, boden + laenge / 2, (z + h.sucheZ) / 2);
    h.strahl.scale.set(1, laenge, 1);
    /* Kegel entlang der Verbindung Hubschrauber -> Bodenpunkt drehen. */
    const rx = h.sucheX - x, ry = boden - y, rz = h.sucheZ - z;
    const len = Math.hypot(rx, ry, rz) || 1;
    _hAchse.set(rx / len, ry / len, rz / len);
    h.strahl.quaternion.setFromUnitVectors(_hOben, _hAchse);
    h.fleck.position.set(h.sucheX, boden + 0.06, h.sucheZ);
    h.vx = dt > 0 ? dx / dt : 0;
    h.vz = dt > 0 ? dz / dt : 0;
  }
}

function collidePlayerHelis(prevY) {
  const p = player.pos, r = player.radius;
  for (const h of helis) {
    const b = heliAABB(h);
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r &&
        p.y < b.top && prevY >= b.top - 0.4 && player.vel.y <= 0.01) {
      p.y = b.top;
      player.vel.y = 0;
      player.onGround = true;
      player.platform = h;
      // mit dem Hubschrauber mitfliegen
      p.x += (h.vx || 0) * 0.016;
      p.z += (h.vz || 0) * 0.016;
    }
  }
}

/* Baut ein Fahrzeug nach Typ. Alles aus Kisten, damit es zum Stil passt. */
function makeFahrzeugMesh(typ, farbe) {
  if (typ.art === 'pkw') return makeCarMesh(farbe);
  const g = new THREE.Group();
  const L = typ.laenge, B = typ.breite;
  const lack = new THREE.MeshLambertMaterial({ color: farbe });
  const dunkel = new THREE.MeshLambertMaterial({ color: 0x17181c });
  const glas = new THREE.MeshLambertMaterial({ color: 0x9fd2e8 });

  if (typ.art === 'taxi') {
    const auto = makeCarMesh(0xf2c12e);
    const schild = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfff3c0 }));
    schild.position.set(0, 1.56, -0.2);
    auto.add(schild);
    for (const sz of [1, -1]) {                       // Schachbrettstreifen
      const streifen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 2.6),
        new THREE.MeshLambertMaterial({ color: 0x1b1b1f }));
      streifen.position.set(sz * 0.97, 0.75, 0);
      auto.add(streifen);
    }
    return auto;
  }
  if (typ.art === 'polizei') {
    const auto = makeCarMesh(0xf0f0f2);
    for (const sz of [1, -1]) {
      const tuer = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x1c3f8c }));
      tuer.position.set(sz * 0.97, 0.62, 0);
      auto.add(tuer);
    }
    const balken = new THREE.Group();
    for (const [sx, col] of [[-0.28, 0x2f6fff], [0.28, 0xff3020]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: col }));
      l.position.set(sx, 0, 0);
      balken.add(l);
    }
    balken.position.set(0, 1.5, -0.2);
    auto.add(balken);
    auto.userData.blaulicht = balken;
    return auto;
  }
  // Bus und LKW
  const raeder = (positionen) => {
    const geo = new THREE.CylinderGeometry(0.46, 0.46, 0.3, 10);
    for (const [sx, sz] of positionen) {
      const w = new THREE.Mesh(geo, dunkel);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * (B / 2 - 0.1), 0.46, sz);
      g.add(w);
    }
  };
  if (typ.art === 'bus') {
    const k = new THREE.Mesh(new THREE.BoxGeometry(B, typ.hoehe, L), lack);
    k.position.y = 1.35; k.castShadow = true; g.add(k);
    for (let i = -1; i <= 1; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(B + 0.04, 0.8, 2.4), glas);
      f.position.set(0, 1.85, i * 2.9); g.add(f);
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(B - 0.15, 1.0, 0.08), glas);
    front.position.set(0, 1.9, L / 2 - 0.02); g.add(front);
    raeder([[-1, L / 2 - 1.3], [1, L / 2 - 1.3], [-1, -L / 2 + 1.6], [1, -L / 2 + 1.6]]);
  } else {                                            // LKW
    const kabine = new THREE.Mesh(new THREE.BoxGeometry(B, 1.9, 2.3), lack);
    kabine.position.set(0, 1.35, L / 2 - 1.15); kabine.castShadow = true; g.add(kabine);
    const scheibe = new THREE.Mesh(new THREE.BoxGeometry(B - 0.2, 0.75, 0.08), glas);
    scheibe.position.set(0, 1.75, L / 2 - 0.02); g.add(scheibe);
    const kasten = new THREE.Mesh(new THREE.BoxGeometry(B + 0.1, 2.3, L - 2.6),
      new THREE.MeshLambertMaterial({ color: 0xd9dbe0 }));
    kasten.position.set(0, 1.6, -1.3); kasten.castShadow = true; g.add(kasten);
    raeder([[-1, L / 2 - 1.2], [1, L / 2 - 1.2], [-1, -L / 2 + 1.4], [1, -L / 2 + 1.4]]);
  }
  const licht = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
  for (const sx of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.08), licht);
    l.position.set(sx * (B / 2 - 0.4), 0.75, L / 2 + 0.02);
    g.add(l);
  }
  scene.add(g);
  return g;
}

/* ======================= Ampeln =======================
   Eine gemeinsame Schaltung für die ganze Stadt: erst haben die
   Ost-West-Straßen Grün, dann die Nord-Süd-Straßen. Dazwischen Gelb.
   Die Lampenköpfe liegen in zwei InstancedMesh – dadurch kosten alle
   Ampeln zusammen nur zwei Zeichenaufrufe statt hunderte. */
/* var, weil die Stadt weiter oben gebaut wird als diese Zeile steht. */
var AMPEL = { phase: 0, t: 0, gruenDauer: 9, gelbDauer: 2 };
var ampelX = null, ampelZ = null;

function baueAmpeln() {
  const stellen = [];
  for (let i = 0; i <= BLOCKS; i++) {
    for (let j = 0; j <= BLOCKS; j++) {
      const x = ORIGIN + i * PITCH, z = ORIGIN + j * PITCH;
      if (x > RIVER_X0 - 20) continue;                 // nicht im Fluss
      for (const [sx, sz] of [[1, 1], [-1, -1]]) {
        const px = x + sx * (ROAD_HALF + 1.2), pz = z + sz * (ROAD_HALF + 1.2);
        stellen.push([px, pz]);
        deko(0.22, 5.2, 0.22, px, SLAB_H + 2.6, pz, 0x2c3037);          // Mast
        /* Zwei getrennte Signalköpfe: einer für die Ost-West-Richtung,
           einer für Nord-Süd. Vorher saßen beide an derselben Stelle und
           es sah aus, als leuchte eine Ampel gleichzeitig rot und grün. */
        deko(0.46, 1.2, 0.46, px + 0.45, SLAB_H + 5.6, pz, 0x23262b);
        deko(0.46, 1.2, 0.46, px, SLAB_H + 4.2, pz + 0.45, 0x23262b);
      }
    }
  }
  const geo = new THREE.SphereGeometry(0.17, 8, 6);
  ampelX = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x22c55e }), stellen.length);
  ampelZ = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xef4444 }), stellen.length);
  const m = new THREE.Matrix4();
  stellen.forEach(([px, pz], i) => {
    m.makeTranslation(px + 0.45, SLAB_H + 5.6, pz + 0.26);
    ampelX.setMatrixAt(i, m);
    m.makeTranslation(px + 0.26, SLAB_H + 4.2, pz + 0.45);
    ampelZ.setMatrixAt(i, m);
  });
  ampelX.instanceMatrix.needsUpdate = true;
  ampelZ.instanceMatrix.needsUpdate = true;
  cityGroup.add(ampelX); cityGroup.add(ampelZ);
}

/* Farbe der Ampel für eine Fahrtrichtung: 'gruen' | 'gelb' | 'rot' */
function ampelFuer(axis) {
  const meins = (axis === 'x') === (AMPEL.phase === 0);
  if (!meins) return 'rot';
  return AMPEL.t > AMPEL.gruenDauer ? 'gelb' : 'gruen';
}

function updateAmpeln(dt) {
  AMPEL.t += dt;
  if (window.__WEBHERO_TEST__ !== undefined) { window.__ampelPhase = AMPEL.phase; window.__ampelX = ampelFuer('x'); window.__ampelZ = ampelFuer('z'); }
  if (AMPEL.t > AMPEL.gruenDauer + AMPEL.gelbDauer) { AMPEL.t = 0; AMPEL.phase = 1 - AMPEL.phase; }
  if (!ampelX) return;
  const farbe = (axis) => {
    const z = ampelFuer(axis);
    return z === 'gruen' ? 0x22c55e : z === 'gelb' ? 0xeab308 : 0xef4444;
  };
  ampelX.material.color.setHex(farbe('x'));
  ampelZ.material.color.setHex(farbe('z'));
}

/* Nächste Kreuzung vor dem Fahrzeug (Abstand entlang der Fahrtrichtung). */
function abstandZurKreuzung(car) {
  let best = Infinity;
  for (let i = 0; i <= BLOCKS; i++) {
    const linie = ORIGIN + i * PITCH;
    const d = (linie - car.s) * car.dir;
    if (d > 0 && d < best) best = d;
  }
  return best;
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
    const typ = waehleFahrzeug();
    const sMin = -186, sMax = isBridgeRoad ? SHORE_X1 - 10 : 186;
    cars.push({
      axis, lane, dir: laneSign, // Rechtsverkehr angenähert
      s: rand(sMin, sMax), sMin, sMax,
      speed: rand(8, 13) * (typ.art === 'bus' || typ.art === 'lkw' ? 0.72 : 1),
      tempoJetzt: 0, hupCd: 0,
      typ,
      mesh: makeFahrzeugMesh(typ, typ.art === 'bus' ? pick([0x2f6fc8, 0x3b7a3f, 0xc23b30])
                                 : typ.art === 'lkw' ? pick([0x4a5058, 0x2f4f7a]) : pick(CAR_COLORS)),
      vx: 0, vz: 0,
      hitCd: 0,
    });
  }
}
spawnCars();
spawnHelis();

function updateCars(dt) {
  updateAmpeln(dt);
  for (const car of cars) {
    let ziel = car.speed;
    const eigenLaenge = (car.typ ? car.typ.laenge : 4.4);

    /* Vordermann: Abstand hängt jetzt von der Fahrzeuglänge ab. */
    for (const o of cars) {
      if (o === car || o.axis !== car.axis || Math.abs(o.lane - car.lane) > 0.5) continue;
      const gap = (o.s - car.s) * car.dir - (eigenLaenge + (o.typ ? o.typ.laenge : 4.4)) / 2;
      if (gap > 0 && gap < 9) ziel = Math.min(ziel, (o.tempoJetzt || 0) * 0.85);
      if (gap <= 0 && gap > -3) ziel = 0;
    }

    /* Ampel: vor der Haltelinie stehenbleiben, wenn nicht Grün. */
    const zustand = ampelFuer(car.axis);
    if (zustand !== 'gruen') {
      const d = abstandZurKreuzung(car) - (ROAD_HALF + eigenLaenge / 2 + 0.6);
      const bremsweg = (car.tempoJetzt * car.tempoJetzt) / 16 + 2;
      if (d > -1.5 && d < bremsweg) ziel = Math.min(ziel, Math.max(0, d * 1.6));
    }

    /* Hält jemand auf der Fahrbahn? Bremsen und hupen. */
    const px = car.axis === 'x' ? car.s : car.lane;
    const pz = car.axis === 'x' ? car.lane : car.s;
    const dx = player.pos.x - px, dz = player.pos.z - pz;
    const vorne = car.axis === 'x' ? dx * car.dir : dz * car.dir;
    const seitlich = Math.abs(car.axis === 'x' ? dz : dx);
    if (player.pos.y < 2.2 && vorne > 0 && vorne < 14 && seitlich < 2.4) {
      ziel = Math.min(ziel, Math.max(0, (vorne - 4) * 1.2));
      car.hupCd -= dt;
      if (car.hupCd <= 0) { SFX.hupe(); car.hupCd = rand(1.4, 3); }
    } else if (car.hupCd > 0) car.hupCd -= dt;

    /* Weich beschleunigen und bremsen statt sprunghaft. */
    const rampe = ziel < car.tempoJetzt ? 14 : 4.5;
    car.tempoJetzt = car.tempoJetzt + clamp(ziel - car.tempoJetzt, -rampe * dt, rampe * dt);
    const speed = car.tempoJetzt;
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
    const bl = car.mesh.userData && car.mesh.userData.blaulicht;
    if (bl) {
      const an = (elapsed * 6) % 2 < 1;
      bl.children[0].visible = an;
      bl.children[1].visible = !an;
    }
  }
}

function carAABB(car) {
  /* Box passt jetzt zum Fahrzeug – auf einen Bus konnte man vorher nicht
     richtig steigen, weil die Box die eines PKW war. */
  const t = car.typ || { laenge: 4.4, breite: 1.9, art: 'pkw' };
  const halbL = t.laenge / 2 + 0.1, halbB = t.breite / 2 + 0.1;
  const hx = car.axis === 'x' ? halbL : halbB;
  const hz = car.axis === 'x' ? halbB : halbL;
  const cx = car.mesh.position.x, cz = car.mesh.position.z;
  const dach = t.art === 'bus' ? 2.6 : t.art === 'lkw' ? 2.8 : 1.32;
  return { x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, top: dach };
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

/* Kleines Handy in der Hand – wird nur eingeblendet, wenn jemand filmt. */
function makeHandy() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x2a2e36 }));
  const glas = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x9fd2e8 }));
  glas.position.z = 0.015; m.add(glas);
  m.position.set(0.28, 1.35, 0.3);
  m.visible = false;
  return m;
}

const RUFE = ['Spider-Man!', 'Da ist er!', 'Danke!', 'Wahnsinn!', '📸'];

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

    /* Reaktion auf den Helden: stehenbleiben, hinschauen, filmen, rufen.
       Nur wenn gerade keine Gefahr in der Nähe ist. */
    if (!c.handy) { c.handy = makeHandy(); c.visual.root.add(c.handy); }
    const dHeld = Math.hypot(player.pos.x - c.pos.x, player.pos.z - c.pos.z);
    const sichtbar = dHeld < 9 && Math.abs(player.pos.y - c.pos.y) < 6;
    if (!threat && c.state !== 'flee' && c.state !== 'hurt' && sichtbar) {
      if (c.staunT === undefined || c.staunT <= 0) {
        c.staunT = rand(1.6, 3.4);
        c.filmt = Math.random() < 0.45;
        if (Math.random() < 0.25) popupWorld(pick(RUFE), c.pos, '#ffe9a8');
      }
      c.staunT -= dt;
      c.gafft = true;
    } else {
      c.gafft = false; c.filmt = false; c.staunT = 0;
    }
    c.handy.visible = !!(c.gafft && c.filmt);

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
      if (d < 1.2) { c.wp = (c.wp + 1) % 4; c.festT = 0; c.letzteDist = null; }
      else { dirX = dx / d; dirZ = dz / d; }
      /* Steckt jemand an einer Hauskante fest, kommt er dem Ziel nicht mehr
         näher und läuft auf der Stelle. Dann einfach das nächste Ziel
         ansteuern statt ewig gegen die Wand zu rennen. */
      if (c.letzteDist !== null && c.letzteDist !== undefined && d > c.letzteDist - 0.25 * dt * 10) {
        c.festT = (c.festT || 0) + dt;
        if (c.festT > 1.5) { c.wp = (c.wp + 1) % 4; c.festT = 0; }
      } else c.festT = 0;
      c.letzteDist = d;
      if (Math.random() < dt * 0.02) speed = 0; // kurz stehenbleiben
    }

    if (c.gafft) {
      speed = 0; dirX = 0; dirZ = 0;
      c.facing = dampAngle(c.facing, Math.atan2(player.pos.x - c.pos.x, player.pos.z - c.pos.z), dt * 6);
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
    c.visual.play(c.gafft && !c.filmt && c.visual.hatClip && c.visual.hatClip('jubel')
                    ? 'jubel' : (speed > 0.1 ? 'run' : 'idle'),
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
/* Zwei Netz-Muster: eines deckend für den fertigen Kokon (man sieht die
   Wicklungen), eines mit durchsichtigem Hintergrund für Fäden und
   Netzflecken auf dem Körper. Die früheren glatten weißen Ringe sahen aus
   wie Plastikreifen, nicht wie Netz. */
const wickelTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f2f5f8'; g.fillRect(0, 0, w, h);
  g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = i % 3 ? 'rgba(203,213,225,0.85)' : 'rgba(255,255,255,0.9)';
    g.lineWidth = i % 3 ? 1.4 : 2.6;
    const y = rand(0, h);
    g.beginPath(); g.moveTo(-4, y); 
    for (let x = 0; x <= w + 4; x += 16) g.lineTo(x, y + Math.sin(x * 0.08 + i) * 3.5);
    g.stroke();
  }
  g.strokeStyle = 'rgba(176,190,208,0.8)'; g.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    g.beginPath(); g.moveTo(rand(0, w), 0); g.lineTo(rand(0, w), h); g.stroke();
  }
});
/* Muster mehrfach über den Kokon legen – sonst sieht man die Wicklungen
   auf der kleinen Fläche kaum. */
wickelTex.wrapS = wickelTex.wrapT = THREE.RepeatWrapping;
wickelTex.repeat.set(2, 3);
const fleckTex = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineCap = 'round';
  const cx = w / 2, cy = h / 2;
  // Speichen
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand(-0.15, 0.15);
    g.lineWidth = rand(1.6, 3);
    g.beginPath(); g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * cy * rand(0.75, 1.05), cy + Math.sin(a) * cy * rand(0.75, 1.05));
    g.stroke();
  }
  // Spiralringe
  for (let r = 10; r < cy; r += rand(8, 14)) {
    g.lineWidth = rand(1, 2);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rr = r * (1 + Math.sin(a * 3 + r) * 0.09);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
});
/* Äußere Fadenlage: durchsichtiger Überzug mit kreuz und quer laufenden
   Strängen. Erst dadurch liest sich der Kokon als GEWICKELT – eine glatte
   weiße Hülle allein sieht aus wie Kunststoff. */
const huelleTex = canvasTex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.lineCap = 'round';
  for (let i = 0; i < 34; i++) {
    const schraeg = i % 2 ? 1 : -1;
    g.strokeStyle = i % 4 === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(236,243,250,0.7)';
    g.lineWidth = i % 4 === 0 ? 2.2 : 1.2;
    const y0 = rand(-20, h + 20);
    g.beginPath();
    for (let x = -6; x <= w + 6; x += 12) {
      g.lineTo(x, y0 + x * 0.42 * schraeg + Math.sin(x * 0.11 + i) * 3);
    }
    g.stroke();
  }
});
huelleTex.wrapS = huelleTex.wrapT = THREE.RepeatWrapping;
huelleTex.repeat.set(2, 3);
const huelleMat = new THREE.MeshBasicMaterial({
  map: huelleTex, transparent: true, alphaTest: 0.06, depthWrite: false,
  side: THREE.DoubleSide, opacity: 0.85,
});
const cocoonMat = new THREE.MeshLambertMaterial({
  map: wickelTex, transparent: true, opacity: 0.88, flatShading: true,
  color: 0xdfe6ee,
});
const bandMat = new THREE.MeshLambertMaterial({ color: 0xf4f8fc });
const fleckMat = new THREE.MeshBasicMaterial({
  map: fleckTex, transparent: true, alphaTest: 0.08, depthWrite: false,
  side: THREE.DoubleSide, opacity: 0.92,
});

const cocoonKoerperGeo = (() => {
  const g = new THREE.SphereGeometry(0.42, 16, 14);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y / 0.42;                       // -1 (unten) .. +1 (oben)
    /* Menschliche Silhouette statt Vase: breite Schultern, schmalere
       Hüfte, oben der eingewickelte Kopf, unten die Füße. */
    let breite = 0.86 + 0.30 * Math.exp(-Math.pow((t - 0.45) / 0.30, 2))  // Schultern
               - 0.22 * Math.exp(-Math.pow((t - 0.95) / 0.16, 2))         // Hals
               - 0.34 * Math.max(0, -t - 0.30);                           // Beine unten
    /* Der Beinterm hat vorher ALLES oberhalb von t = -0,72 verschmälert –
       auch den Kopf. Der Kokon lief deshalb oben spitz zu wie ein Zipfel. */
    /* Deutlichere Beulen: ein von Hand gewickeltes Bündel ist nie glatt. */
    breite *= 1 + Math.sin(y * 26) * 0.075 + Math.sin(x * 19 + z * 15) * 0.06
            + Math.sin(y * 41 + x * 9) * 0.035;
    pos.setXYZ(i, x * breite * 1.02, y * 2.3, z * breite * 0.80);
  }
  g.computeVertexNormals();
  return g;
})();
/* Dünner Ring statt dickem Reifen – gewickelter Faden, kein Schlauch. */
const bandGeo = new THREE.TorusGeometry(0.25, 0.015, 4, 13);
const fadenGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.55, 4);
const fleckGeo = new THREE.PlaneGeometry(0.46, 0.46);

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
  // Zweite, leicht größere Schale mit den sichtbaren Fäden darüber
  const huelle = new THREE.Mesh(cocoonKoerperGeo, huelleMat);
  huelle.scale.set(1.05, 1.02, 1.06);
  huelle.rotation.y = rand(0, Math.PI);
  huelle.visible = false;
  huelle.renderOrder = 2;
  g.add(huelle);

  /* Netzflecken: dort, wo das Netz auftrifft, klebt ein Stück Spinnennetz
     am Körper. Das ist der erste sichtbare Treffer – vorher schwebten
     stattdessen sofort weiße Reifen um die Beine. */
  const flecken = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fleckGeo, fleckMat);
    const a = rand(0, Math.PI * 2);
    const y = rand(-0.30, 0.52);          // Rumpf, nicht der Kopf
    f.position.set(Math.cos(a) * 0.26, y, Math.sin(a) * 0.20);
    f.lookAt(Math.cos(a) * 3, y, Math.sin(a) * 3);
    f.rotation.z = rand(0, Math.PI);
    f.scale.setScalar(rand(0.75, 1.15));
    f.visible = false;
    g.add(f); flecken.push(f);
  }

  /* Wicklungen: viele dünne Fäden, schräg um den Körper gelegt. */
  const baender = [];
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(bandGeo, bandMat);
    const t = -0.82 + i * 0.21;
    b.position.set(rand(-0.03, 0.03), t, rand(-0.03, 0.03));
    b.rotation.x = Math.PI / 2 + rand(-0.34, 0.34);
    b.rotation.z = rand(-0.3, 0.3);
    /* Der Querschnitt eines Menschen ist keine Scheibe: breiter als tief,
       an den Schultern weiter als an Hüfte und Beinen. */
    const schulter = 1 + 0.22 * Math.exp(-Math.pow((t - 0.42) / 0.3, 2));
    const w = (1 - Math.max(0, -t - 0.3) * 0.45) * schulter * rand(0.9, 1.04);
    b.scale.set(w, w * 0.7, rand(0.85, 1.15));
    b.visible = false;
    g.add(b); baender.push(b);
  }

  /* Lose Fäden, die quer über den Körper laufen und abstehen. */
  const faeden = [];
  for (let i = 0; i < 12; i++) {
    const f = new THREE.Mesh(fadenGeo, bandMat);
    f.position.set(rand(-0.26, 0.26), rand(-0.75, 0.85), rand(-0.20, 0.20));
    f.rotation.set(rand(0, 3.2), rand(0, 3.2), rand(0, 3.2));
    f.scale.set(1, rand(0.6, 1.5), 1);
    f.visible = false;
    g.add(f); faeden.push(f);
  }

  /* Wird der Gegner an eine Wand geheftet, spannen ein paar Fäden vom
     Kokon nach hinten zur Fassade. */
  const wandFaeden = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(fadenGeo, bandMat);
    const y = rand(-0.55, 0.7), sx = rand(-0.24, 0.24);
    f.position.set(sx * 0.6, y, -0.32);
    f.rotation.x = Math.PI / 2 + rand(-0.25, 0.25);
    f.rotation.z = rand(-0.4, 0.4);
    f.scale.set(1, rand(0.7, 1.1), 1);
    f.visible = false;
    g.add(f); wandFaeden.push(f);
  }
  g.userData.setzeWand = (an) => { wandFaeden.forEach((f) => { f.visible = an; }); };
  g.userData.setzeStufe = (stufe) => {
    /* Stufe 1: ein Netzfleck und ein paar Fäden – der Gegner kann noch
       laufen. Stufe 2: erste Wicklungen. Stufe 3: komplett eingesponnen. */
    const fl = stufe >= 3 ? 4 : (stufe === 2 ? 3 : 2);
    flecken.forEach((f, i) => { f.visible = i < fl; });
    /* Bei Stufe 3 trägt der Kokon selbst das Wickelmuster. Alle neun Ringe
       zusätzlich anzuzeigen sah aus, als schwebten Reifen um das Bündel –
       es bleiben ein paar wenige, die stramm anliegen. */
    baender.forEach((b, i) => { b.visible = stufe >= 3 || (stufe === 2 && i < 4); });
    const fAnzahl = stufe >= 3 ? 12 : (stufe === 2 ? 8 : 4);
    faeden.forEach((f, i) => { f.visible = i < fAnzahl; });
    /* Der komplette Kokon ist nur noch das Ergebnis, wenn jemand an eine
       Wand geheftet wird. Mitten auf der Straße wird ein Gegner kräftig
       eingewickelt und ist bewegungsunfähig – aber kein Bündel. So kämpft
       das Vorbild auch. */
    koerper.visible = false;
    huelle.visible = false;
  };
  g.userData.setzeKokon = (an) => {
    koerper.visible = an;
    huelle.visible = an;
    if (an) { baender.forEach((b, i) => { b.visible = i % 3 === 1; b.scale.setScalar(0.94); }); }
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

/* Gegnertypen – ohne neue Modelle, allein über Größe, Farbton und Werte.
   Damit fühlt sich nicht mehr jeder Gegner gleich an. */
const GANOVEN = [
  { art: 'schlaeger', groesse: 1.00, hp: 34, schaden: 8,  tempo: 5.0, blockChance: 0.18, farbe: 0x000000, gewicht: 55 },
  { art: 'brecher',   groesse: 1.22, hp: 62, schaden: 14, tempo: 3.9, blockChance: 0.34, farbe: 0x2a1410, gewicht: 22 },
  { art: 'flink',     groesse: 0.88, hp: 22, schaden: 6,  tempo: 6.6, blockChance: 0.08, farbe: 0x101c28, gewicht: 23 },
];
function waehleGanov() {
  const summe = GANOVEN.reduce((a, g) => a + g.gewicht, 0);
  let r = Math.random() * summe;
  for (const g of GANOVEN) { r -= g.gewicht; if (r <= 0) return g; }
  return GANOVEN[0];
}

/* Warnzeichen über dem Kopf: Ausrufezeichen vor einem Schlag,
   Schild beim Blocken. Beides nur zwei kleine Kisten. */
function makeWarnzeichen() {
  const g = new THREE.Group();
  const rot = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  const balken = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), rot);
  balken.position.y = 0.3; g.add(balken);
  const punkt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), rot);
  punkt.position.y = 0.02; g.add(punkt);
  g.position.y = 2.15;
  g.visible = false;
  return g;
}
function makeBlockzeichen() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.75 }));
  m.position.y = 1.25;
  m.visible = false;
  return m;
}

/* Liegt der Punkt in einem Gebäude? Wegpunkte dort drin lassen die
   Ganoven dauerhaft gegen die Fassade laufen. */
function inGebaeude(x, z) {
  for (const c of collidersNear(x, z)) {
    if (c.klein) continue;
    if (x > c.x0 - 0.6 && x < c.x1 + 0.6 && z > c.z0 - 0.6 && z < c.z1 + 0.6) return true;
  }
  return false;
}
function freierPunkt(cx, cz, r) {
  for (let i = 0; i < 12; i++) {
    const x = cx + rand(-r, r), z = cz + rand(-r, r);
    if (!inGebaeude(x, z)) return V3(x, 0, z);
  }
  return null;
}

function spawnGang(cx, cz, n) {
  const gang = { enemies: [], home: V3(cx, 0, cz), cleared: false };
  for (let i = 0; i < n; i++) {
    const visual = makeCharacterVisual('thug', {
      thug: true,
      shirt: pick(['#3a3f4a', '#54303a', '#2e4038', '#463a2e']),
      pants: pick(['#26262e', '#3a3630', '#2e3440']),
    });
    const typ = waehleGanov();
    visual.root.scale.setScalar(typ.groesse);
    const hpBar = makeHPBar();
    visual.root.add(hpBar.g);
    const warn = makeWarnzeichen(); visual.root.add(warn);
    const blockZ = makeBlockzeichen(); visual.root.add(blockZ);
    const cocoon = makeCocoon();
    cocoon.position.y = 0.98;
    cocoon.visible = false;
    visual.root.add(cocoon);
    const e = {
      visual, hpBar, cocoon,
      pos: V3(cx + rand(-4, 4), 0, cz + rand(-4, 4)),
      vel: V3(0, 0, 0),
      radius: 0.4 * typ.groesse,
      facing: rand(0, TAU),
      phase: rand(0, TAU),
      typ, warn, blockZ,
      umwegT: 0, umwegSeite: 1, blockiertT: 0,
      hp: typ.hp, hpMax: typ.hp,
      blockT: 0, blockCd: rand(1, 4), warnT: 0,
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


/* Nächste Hauswand in Reichweite finden: Fläche, Normale und Abstand. */
function naheWand(pos, maxAbstand) {
  let best = null, bestD = maxAbstand;
  for (const c of collidersNear(pos.x, pos.z)) {
    if (c.klein || c.h < pos.y + 1.4) continue;
    // Nur außerhalb stehende Gegner ankleben
    const innen = pos.x > c.x0 && pos.x < c.x1 && pos.z > c.z0 && pos.z < c.z1;
    if (innen) continue;
    const kx = clamp(pos.x, c.x0, c.x1), kz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - kx, dz = pos.z - kz;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.01) continue;
    // Normale = Richtung von der Wand weg
    let nx = 0, nz = 0;
    if (Math.abs(dx) >= Math.abs(dz)) nx = Math.sign(dx); else nz = Math.sign(dz);
    bestD = d;
    best = { x: kx, z: kz, nx, nz, col: c };
  }
  return best;
}

function applyWeb(e) {
  if (e.dead) return;
  /* Jeder weitere Treffer wickelt fester ein. Erst ab Stufe 3 ist der
     Gegner vollständig bewegungsunfähig. */
  e.webStufe = Math.min(3, (e.webStufe || 0) + 1);
  e.webT = Math.max(e.webT, 1.6 + e.webStufe * 1.6);
  if (e.cocoon && e.cocoon.userData.setzeStufe) e.cocoon.userData.setzeStufe(e.webStufe);
  if (e.webStufe >= 3) {
    e.vel.set(0, 0, 0); e.attack = null;
    /* Steht der Gegner dicht an einer Hauswand, klebt das dritte Netz ihn
       dort fest – er hängt anschließend an der Fassade statt auf der
       Straße zu liegen. */
    const w = naheWand(e.pos, 2.6);   // etwas großzügiger: der Gegner bewegt sich ja
    if (e.cocoon && e.cocoon.userData.setzeWand) e.cocoon.userData.setzeWand(!!w);
    if (e.cocoon && e.cocoon.userData.setzeKokon) e.cocoon.userData.setzeKokon(!!w);
    if (w) {
      e.pos.x = w.x + w.nx * 0.42;
      e.pos.z = w.z + w.nz * 0.42;
      e.pos.y = groundY(e.pos.x, e.pos.z) + rand(0.6, 1.1);
      e.facing = Math.atan2(w.nx, w.nz);       // Rücken zur Wand
      e.anWand = true;
      popupWorld('An die Wand geheftet!', e.pos, '#bfe8ff');
    }
  }
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
    e.hpBar.fg.scale.x = 1.1 * clamp(e.hp / (e.hpMax || CFG.enemyHP), 0, 1);
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
      for (const h of helis) h.zielMitte = null;   // Hubschrauber zieht weiter
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
      /* Die Umfall-Bewegung legt die Figur selbst waagerecht hin. Die
         zusätzliche Vierteldrehung der ganzen Figur hat sie zusätzlich
         gekippt – die Füße steckten dadurch bis zu 30 cm im Asphalt.
         Stattdessen wird der Körper wie beim Helden so weit abgesenkt,
         dass der tiefste Knochen wirklich aufliegt. */
      e.visual.root.position.copy(e.pos);
      e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, 0, Math.min(1, dt * 8));
      /* Warn- und Deckungszeichen gehören zu einem Gegner, der noch kämpft. */
      if (e.warn) e.warn.visible = false;
      if (e.blockZ) e.blockZ.visible = false;
      e.visual.play('downed', { t: elapsed }, dt);
      if (e.visual.legeHin) e.visual.legeHin(Math.min(1, dt * 6));
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
        e.visual.root.rotation.y = e.facing;
        e.visual.play('webbed', { t: elapsed }, dt);
        continue;
      }
      /* Löst sich das Netz wieder, fällt ein angeklebter Gegner herunter. */
      if (e.anWand) {
        e.anWand = false;
        e.vel.set(0, 0, 0);
        if (e.cocoon.userData.setzeWand) e.cocoon.userData.setzeWand(false);
        if (e.cocoon.userData.setzeKokon) e.cocoon.userData.setzeKokon(false);
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
        /* Weiter Umkreis: bei 22 Zivilisten auf der ganzen Karte kam sonst
           nie einer nah genug vorbei, und die Gang stand nur herum. */
        let civ = null, civD = 55;
        for (const c of civilians) {
          if (c.state === 'hurt') continue;
          const d = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
          if (d < civD) { civ = c; civD = d; }
        }
        /* Deutlich häufiger auf Zivilisten losgehen – dadurch gibt es
           überhaupt etwas zu retten, statt dass die Gang nur herumsteht
           oder gegen Häuser läuft. */
        if (civ && Math.random() < dt * 3) { e.state = 'chase'; e.target = civ; }
      }
    }
    if (e.target === 'player' && (player.dead || (dp > 40 || dpy > 12))) {
      e.state = 'patrol'; e.target = null;
    }
    /* Ist der Spieler auf einem Dach oder an einer Wand, kommt ein Ganove
       nicht hinterher. Er rannte dann dauerhaft gegen die Hauswand –
       das sah aus, als liefe er ins Haus hinein. Nach ein paar Sekunden
       ohne Fortschritt gibt er auf und patrouilliert weiter. */
    if (e.target === 'player' && dpy > 3.5) {
      e.vergeblichT = (e.vergeblichT || 0) + dt;
      if (e.vergeblichT > 3) {
        e.state = 'patrol'; e.target = null; e.vergeblichT = 0;
        /* Statt weiter gegen das Haus zu laufen: nächsten Zivilisten
           suchen und den angreifen. */
        let civ = null, civD = 26;
        for (const c of civilians) {
          if (c.state === 'hurt') continue;
          const dd = Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z);
          if (dd < civD) { civ = c; civD = dd; }
        }
        if (civ) { e.state = 'chase'; e.target = civ; }
      }
    } else e.vergeblichT = 0;

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
        /* Der Ring, auf dem die Ganoven Aufstellung nehmen, hat 1,9 m
           Radius – die Schlagfreigabe lag aber bei 1,7 m. Dadurch stand
           der Gegner dauerhaft knapp außerhalb seiner eigenen Reichweite
           und rannte nur noch auf der Stelle, ohne je zuzuschlagen.
           Die Freigabe liegt jetzt sicher außerhalb des Rings. */
        if (d > 1.4 || dy > 1.6) {
          /* Nicht alle auf denselben Punkt zulaufen – sonst stapeln sich
             die Ganoven zu einem einzigen Klumpen. Jeder steuert seinen
             eigenen Platz auf einem Ring um das Ziel an. */
          if (e.ringWinkel === undefined) e.ringWinkel = Math.random() * Math.PI * 2;
          const zx = tp.x + Math.sin(e.ringWinkel) * 1.35 - e.pos.x;
          const zz = tp.z + Math.cos(e.ringWinkel) * 1.35 - e.pos.z;
          const zd = Math.hypot(zx, zz) || 1;
          moveX = zx / zd; moveZ = zz / zd;
          speed = (e.target === 'player' ? 1 : 0.85) * (e.typ ? e.typ.tempo : 5);
          anim = 'run';
          if (e.target === 'player' && dy > 3 && d < 4) { anim = 'idle'; speed = 0; } // kommt nicht hoch
        } else if (e.attackCd <= 0 && !e.attack && e.warnT <= 0 && e.blockT <= 0) {
          /* Wer in Deckung steht, holt nicht gleichzeitig aus. */
          /* Erst ausholen und warnen, dann schlagen. Vorher kam der Treffer
             ohne Vorankündigung – ausweichen war reine Glückssache. */
          e.warnT = 0.55;
        }
      }
    } else {
      // Patrouille rund ums Revier
      if (!e.waypoint || Math.hypot(e.waypoint.x - e.pos.x, e.waypoint.z - e.pos.z) < 1) {
        e.waitT -= dt;
        if (e.waitT <= 0) {
          /* Nur Wegpunkte im Freien. Vorher konnte der Punkt mitten in
             einem Haus liegen – der Ganove rannte dann bis zum nächsten
             Wechsel gegen die Wand, und von außen sah es aus, als liefe er
             ins Haus hinein. */
          e.waypoint = freierPunkt(e.gang.home.x, e.gang.home.z, 12)
                    || freierPunkt(e.pos.x, e.pos.z, 8);
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
          /* Trefferreichweite etwas größer als der Abstand, auf dem der
             Gegner stehen bleibt – sonst schlägt er zwar zu, kommt aber
             rechnerisch nie an. */
          if (dp < 2.1 && dpy < 2) damagePlayer(e.typ ? e.typ.schaden : 8, e.pos);
        } else if (e.target && Math.hypot(e.target.pos.x - e.pos.x, e.target.pos.z - e.pos.z) < 2.1) {
          hurtCivilian(e.target, e);
        }
      }
      if (a.t >= 1) e.attack = null;
    }
    if (e.attackCd > 0) e.attackCd -= dt;

    /* Vorwarnung: Ausrufezeichen blinkt, danach folgt der Schlag. */
    if (e.warnT > 0) {
      e.warnT -= dt;
      e.warn.visible = ((elapsed * 9) % 2) < 1;
      if (e.warnT <= 0) {
        e.warn.visible = false;
        e.attack = { type: 'thugSwing', t: 0, hitDone: false };
        /* Enger Abstand heißt auch: es trifft öfter. Die Pause zwischen
           zwei Schlägen wird dafür wieder etwas länger, sonst nimmt ein
           einzelner Ganove in zehn Sekunden fast die ganze Lebensleiste. */
        e.attackCd = rand(1.3, 2.1);
        e.visual.attackOneShot();
      }
    } else if (e.warn) e.warn.visible = false;

    /* Blocken: Gegner geht kurz in Deckung. Treffer richten dann wenig aus –
       ein Tritt bricht die Deckung trotzdem. */
    if (e.blockT > 0) {
      e.blockT -= dt;
      if (e.blockT <= 0) e.blockCd = rand(1.6, 4.5);
    } else {
      e.blockCd -= dt;
      /* Deckung ist eine REAKTION, kein Dauerzustand. Vorher ging der
         Gegner in Deckung, sobald der Nachladebalken leer war – er stand
         damit fast ein Drittel der Zeit blockend herum und kam nie zum
         Schlagen. Jetzt blockt er nur, wenn der Spieler wirklich gerade
         angreift und nah genug ist. */
      const nah = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < 3.2;
      const spielerSchlaegt = !!player.attack && player.attack.type !== 'web';
      if (e.blockCd <= 0 && nah && spielerSchlaegt && !e.attack && e.warnT <= 0 &&
          e.webT <= 0 && Math.random() < e.typ.blockChance) {
        e.blockT = rand(0.5, 0.9);
      }
    }
    if (e.blockZ) e.blockZ.visible = e.blockT > 0 &&
      !(e.visual.hatClip && e.visual.hatClip('block'));

    /* Abstand zu ALLEN Ganoven halten – vorher galt das nur innerhalb
       der eigenen Gang, deshalb liefen zwei Gangs ineinander. */
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.05 && d > 0.01) {
        const schub = (1.05 - d) * 0.5;
        e.pos.x += (dx / d) * schub;
        e.pos.z += (dz / d) * schub;
      }
    }

    /* Auch zum Helden Abstand halten – aber nur so viel, dass man sich
       beim Schlag noch berührt. */
    {
      const dxp = e.pos.x - player.pos.x, dzp = e.pos.z - player.pos.z;
      const dpp = Math.hypot(dxp, dzp);
      if (dpp < 0.78 && dpp > 0.01 && Math.abs(e.pos.y - player.pos.y) < 1.8) {
        const schub = (0.78 - dpp) * 0.55;
        e.pos.x += (dxp / dpp) * schub;
        e.pos.z += (dzp / dpp) * schub;
      }
    }

    if (e.webT > 0) speed *= 0.35;      // im Netz zappelnd, kaum vorwärts
    /* Blockiert eine Hauswand den direkten Weg, wird eine Weile seitlich
       daran entlanggelaufen. Vorher rannten die Ganoven stur gegen die
       Fassade – von außen sah es aus, als liefen sie ins Haus hinein. */
    if (e.umwegT > 0) {
      e.umwegT -= dt;
      const qx = -moveZ * e.umwegSeite, qz = moveX * e.umwegSeite;
      moveX = moveX * 0.35 + qx * 0.95;
      moveZ = moveZ * 0.35 + qz * 0.95;
      const l = Math.hypot(moveX, moveZ) || 1;
      moveX /= l; moveZ /= l;
    }
    e.vel.x = moveX * speed; e.vel.z = moveZ * speed;
    const vorX = e.pos.x, vorZ = e.pos.z;
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
    collideBody(e);
    if (speed > 0.5 && e.umwegT <= 0) {
      const gewollt = speed * dt;
      const echt = Math.hypot(e.pos.x - vorX, e.pos.z - vorZ);
      e.blockiertT = echt < gewollt * 0.45 ? (e.blockiertT || 0) + dt : 0;
      if (e.blockiertT > 0.35) {
        e.umwegT = rand(1.2, 2.2);
        e.umwegSeite = Math.random() < 0.5 ? 1 : -1;
        e.blockiertT = 0;
      }
    }
    /* Höhe weich nachführen: bei Bordsteinkanten sonst sichtbares Springen,
       und niemals unter den Boden. */
    e.pos.y = lerp(e.pos.y, groundY(e.pos.x, e.pos.z), Math.min(1, dt * 12));
    e.pos.y = Math.max(e.pos.y, groundY(e.pos.x, e.pos.z) - 0.02);
    if (speed > 0.1) e.phase += dt * (4 + speed * 1.7);

    e.visual.root.position.copy(e.pos);
    e.visual.root.rotation.x = lerp(e.visual.root.rotation.x, 0, dt * 8);
    e.visual.root.rotation.y = e.facing;
    /* Deckung und Ausholen sind eigene Bewegungen, sobald die Dateien da
       sind – sonst bleibt es bei Stehen plus Symbol über dem Kopf. */
    let ganovAnim = anim === 'run' ? 'run' : 'idle';
    if (e.blockT > 0 && e.visual.hatClip && e.visual.hatClip('block')) ganovAnim = 'block';
    else if (e.warnT > 0 && e.visual.hatClip && e.visual.hatClip('taunt')) ganovAnim = 'taunt';
    e.visual.play(ganovAnim,
      { phase: e.phase, speed01: clamp(speed / 5, 0, 1), t: elapsed + e.phase }, dt);
    if (e.visual.procedural) overlayAttack(e.visual.human, e.attack, dt);
    else if (e.visual.bodenAusgleich) e.visual.bodenAusgleich(Math.min(1, dt * 12));
    // HP-Balken zur Kamera & ausblenden wenn voll
    e.hpBar.g.visible = e.hp < (e.hpMax || CFG.enemyHP);
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
      if (helis.length) helis[0].zielMitte = { x: crimeGang.home.x, z: crimeGang.home.z };
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
  } else if (player.stufe > 0 && player.comboTimer > 0) {
    /* Auch die laufende Schlagfolge anzeigen, wenn noch kein Treffer
       gezählt wurde – sonst merkt man von der Kombo überhaupt nichts. */
    comboEl.style.opacity = 0.75;
    comboNEl.textContent = `${player.stufe}/${KOMBO.length}`;
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
  simuliere(dt);
  renderer.render(scene, camera);
}

/* Ein Simulationsschritt ohne Bild. So lässt sich das Spiel in Tests mit
   festen kleinen Zeitschritten durchrechnen – im Testbrowser läuft die
   Darstellung sonst mit wenigen Bildern pro Sekunde und jede Messung, die
   von der Zeit abhängt, wird unbrauchbar. */
function simuliere(dt) {
  if (hitstopT > 0) { hitstopT -= dt; dt *= 0.12; }
  elapsed += dt;

  updatePlayer(dt);
  updateWetter(dt);
  updateTagNacht(dt);
  updateCars(dt);
  updateHelis(dt);
  updateCivilians(dt);
  updateEnemies(dt);
  updateCamera(dt);
  updateEffekte(dt);
  updateKlatscher(dt);

  // Wasser-Animation
  if (waterMesh) waterTex.offset.x = elapsed * 0.015;

  // Netzschuss-Blitze ausblenden
  for (let i = activeShots.length - 1; i >= 0; i--) {
    const s = activeShots[i];
    s.life -= dt; s.t += dt;
    /* Erst herausschießen (6 Hundertstel), dann verblassen. */
    const auszug = clamp(s.t / 0.06, 0, 1);
    _v1.copy(s.from).lerp(s.to, auszug);
    placeStrand(s.mesh, s.from, _v1, 0.004);
    s.mesh.material.opacity = clamp(s.life / 0.14, 0, 1);
    if (s.life <= 0) { s.mesh.visible = false; activeShots.splice(i, 1); }
  }
  if (player.state !== 'swing' && player.state !== 'zip') swingStrand.visible = false;

  updateHUD();
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
    schritt(dt, n) { for (let i = 0; i < (n || 1); i++) simuliere(dt || 1 / 60); },
    get kamPos() { return camera.position.clone(); },
  };
}

})();
