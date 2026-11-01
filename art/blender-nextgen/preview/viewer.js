/* Next-Gen Modellvergleich - isolierter Three.js-r128-Viewer.
   Gehoert NICHT zum Spielcode. Laedt die exportierten GLB-Prototypen und die
   bisherigen Produktionsmodelle und behandelt Figuren wie game.js:
   - Knochennamen vereinheitlichen (knochenName)
   - Positionsspuren und Fingerspuren entfernen (entferneVersatz, entferneFinger)
   - Groesse 1,76 m aus der Bounding Box (messeModell), Mitte auf den Ursprung
   - Metallanteil <= 0,08, Rauheit 0,35..0,9, Eigenleuchten 0x14141a, Schattenkurve
   - lineare Ausgabe ohne Tonemapping, Sonne 0xfff2dd 1,15 + Himmel 0,85 (Spiel-Licht)
   Test-Schnittstelle: window.T (fuer die CDP-Aufnahmen in tools/cdp-capture.cjs). */
'use strict';
(function () {
const ROOT = '../../../';
const NG = '../';
const $ = (id) => document.getElementById(id);

const ASSETS = {
  sedan: {
    label: 'Urban Premium Sedan', kind: 'car',
    newUrl: NG + 'exports/vehicle-urban-sedan-v1.glb',
    clips: ['stand', 'vorwaerts', 'rueckwaerts', 'links', 'rechts', 'fahrer'],
  },
  enemy: {
    label: 'Armored Street Enforcer', kind: 'char', slot: 'thug',
    oldUrl: ROOT + 'assets/thug.glb', newUrl: NG + 'exports/enemy-armored-enforcer-v1.glb',
    clips: ['bind', 'idle', 'walk', 'run', 'punch', 'kick', 'block', 'hit', 'fall', 'ausweichenL', 'ausweichenR', 'uppercut', 'taunt',
      'proto:threat_taunt'],
    protos: { threat_taunt: NG + 'animations/enemy-threat-taunt-v1.glb' },
  },
  hero: {
    label: 'Web Hero Next-Gen', kind: 'char', slot: 'hero',
    oldUrl: ROOT + 'assets/hero.glb', newUrl: NG + 'exports/webhero-nextgen-v1.glb',
    clips: ['bind', 'idle', 'walk', 'run', 'sprint', 'jump', 'land', 'roll', 'fall', 'swing', 'schwungpose', 'zip_zug',
      'gleiten', 'sturzflug', 'sturzflug2', 'klettern', 'klettern_seit', 'wandlauf', 'kante', 'punch', 'kick', 'uppercut',
      'hit', 'luftangriff', 'proto:landing_pose'],
    protos: { landing_pose: NG + 'animations/webhero-landing-pose-v1.glb' },
  },
};
const PAINT = {
  neutral_graphite: 0x373b40, white: 0xe7e7e3, black: 0x16171a, silver: 0xa9afb4,
  dark_blue: 0x1b2a4a, muted_red: 0x7a2a26,
};

// ---------------------------------------------------------------- Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.autoClear = false;
$('view').appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 400);
const loader = new THREE.GLTFLoader();

// Zwei Szenen fuer den Vergleich; gemeinsame Kamera, Licht-Aufbau identisch.
function makeStage() {
  const scene = new THREE.Scene();
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.15);
  sun.position.set(6, 10, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { near: 1, far: 40, left: -8, right: 8, top: 8, bottom: -8 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const sky = new THREE.HemisphereLight(0xcfe4ff, 0x51452e, 0.85);
  scene.add(sky);
  const lamp = new THREE.SpotLight(0xffd9a8, 0, 30, 0.7, 0.5, 1.4);
  lamp.position.set(3, 7, 2); lamp.castShadow = true; scene.add(lamp, lamp.target);
  const env = new THREE.Group(); scene.add(env);
  const holder = new THREE.Group(); scene.add(holder);
  return { scene, sun, sky, lamp, env, holder, item: null };
}
const stages = [makeStage(), makeStage()];

let studioEnv = null;
function studioEnvironment() {
  // Equirect-Verlauf (Himmel hell, Boden dunkel, eine weiche Sonne) -> PMREM
  if (studioEnv) return studioEnv;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#c9d3e0'); grd.addColorStop(0.48, '#8d949c'); grd.addColorStop(0.52, '#4a4642'); grd.addColorStop(1, '#2a2826');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  const sun = g.createRadialGradient(70, 30, 0, 70, 30, 26);
  sun.addColorStop(0, 'rgba(255,255,250,1)'); sun.addColorStop(1, 'rgba(255,255,250,0)');
  g.fillStyle = sun; g.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.encoding = THREE.sRGBEncoding;
  const pm = new THREE.PMREMGenerator(renderer);
  const ac = renderer.autoClear; renderer.autoClear = true; renderer.setScissorTest(false);
  studioEnv = pm.fromEquirectangular(tex).texture;
  renderer.autoClear = ac; pm.dispose();
  return studioEnv;
}

// ---------------------------------------------------------------- Umgebung
function buildEnv(st, kind, night) {
  st.env.clear();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120),
    new THREE.MeshLambertMaterial({ color: kind === 'city' ? 0x2b2d30 : (night ? 0x1a1b1d : 0x6d6f72) }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; st.env.add(ground);
  if (kind !== 'city') return;
  const walk = new THREE.MeshLambertMaterial({ color: 0x77736b });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 120), walk);
    w.position.set(sx * 7.5, 0.075, 0); w.receiveShadow = true; st.env.add(w);
  }
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c0 });
  for (let z = -50; z < 50; z += 6) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 2.6), lineMat);
    l.rotation.x = -Math.PI / 2; l.position.set(0, 0.005, z); st.env.add(l);
  }
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3f46'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 16) for (let x = 5; x < 64; x += 15) {
    const lit = night && ((x * 7 + y * 13) % 5 < 2);
    g.fillStyle = lit ? '#f2c77a' : '#1c232b'; g.fillRect(x, y, 9, 10);
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  for (let i = 0; i < 10; i++) {
    const h = 14 + (i * 37 % 19), w = 9 + (i % 3) * 3;
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / 6, h / 8);
    const m = new THREE.MeshLambertMaterial({ map: t, emissive: night ? 0x332a1a : 0x000000, emissiveMap: night ? t : null });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m);
    const side = i % 2 ? 1 : -1;
    b.position.set(side * (9.5 + w / 2), h / 2, -40 + Math.floor(i / 2) * 18);
    st.env.add(b);
  }
}

// ---------------------------------------------------------------- Figuren wie im Spiel
const knochenName = (n) => n.replace(/^mixamorig\d*:?/i, 'mixamorig').replace(/_\d+(?=\.|$)/, '');
function prepClip(clip, name) {
  clip = clip.clone(); clip.name = name;
  for (const t of clip.tracks) t.name = knochenName(t.name);
  clip.tracks = clip.tracks.filter((t) => !/\.position$/.test(t.name));
  clip.tracks = clip.tracks.filter((t) => !/hand(thumb|index|middle|ring|pinky)\d/i.test(t.name));
  clip.resetDuration();
  return clip;
}
const hellCache = new Map();
function hebeSchatten(tex) {           // wie game.js: dunkle Stellen deutlich anheben, helle kaum
  if (!tex || !tex.image) return tex;
  if (hellCache.has(tex)) return hellCache.get(tex);
  try {
    const img = tex.image, bw = img.width, bh = img.height;
    const f = Math.min(1, 2048 / Math.max(bw, bh)), w = Math.round(bw * f), h = Math.round(bh * f);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, bw, bh, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), a = d.data, tab = new Uint8Array(256);
    for (let i = 0; i < 256; i++) tab[i] = Math.round(255 * Math.pow(i / 255, 0.62));
    for (let i = 0; i < a.length; i += 4) { a[i] = tab[a[i]]; a[i + 1] = tab[a[i + 1]]; a[i + 2] = tab[a[i + 2]]; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.flipY = tex.flipY; t.encoding = tex.encoding; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
    hellCache.set(tex, t); return t;
  } catch (e) { return tex; }
}
function gameCharacter(gltf) {
  const scene = gltf.scene;
  scene.traverse((o) => { if (o.isBone) o.name = knochenName(o.name); });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const h = box.max.y - box.min.y;
  const s = h > 0.01 ? 1.76 / h : 1;
  const inner = new THREE.Group();
  inner.add(scene);
  inner.scale.setScalar(s);
  inner.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  const mats = new Set();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.frustumCulled = false;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
  });
  for (const m of mats) {
    m.userData.orig = { metalness: m.metalness, roughness: m.roughness, map: m.map, emissive: m.emissive && m.emissive.getHex() };
  }
  const root = new THREE.Group(); root.add(inner);
  return { root, scene, mats: [...mats], scale: s, rawHeight: h };
}
function applyLook(item, mode) {
  if (!item || !item.mats) return;
  for (const m of item.mats) {
    const o = m.userData.orig;
    if (item.kind === 'char') {
      if (mode === 'studio') {
        m.metalness = o.metalness; m.roughness = o.roughness; m.map = o.map;
        if (m.emissive) m.emissive.setHex(o.emissive || 0);
      } else {
        m.metalness = Math.min(o.metalness, 0.08);
        m.roughness = Math.min(0.9, Math.max(0.35, o.roughness));
        if (m.emissive) m.emissive.setHex(0x14141a);
        if (o.map) m.map = hebeSchatten(o.map);
      }
    }
    m.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Laden
const cache = new Map();
function loadGLB(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((res, rej) => {
      const t0 = performance.now();
      loader.load(url, (g) => { g.loadMs = performance.now() - t0; res(g); }, undefined, rej);
    }));
  }
  return cache.get(url);
}
const clipCache = new Map();
async function loadClip(asset, name) {
  const key = asset.slot + ':' + name;
  if (clipCache.has(key)) return clipCache.get(key);
  let url;
  if (name.startsWith('proto:')) url = asset.protos[name.slice(6)];
  else url = ROOT + 'assets/' + asset.slot + '@' + name + '.glb';
  const p = new Promise((res) => loader.load(url, (g) => res(g.animations[0] ? prepClip(g.animations[0], name) : null), undefined, () => res(null)));
  clipCache.set(key, p);
  return p;
}

async function buildItem(assetKey, which) {
  const a = ASSETS[assetKey];
  if (a.kind === 'car') {
    if (which === 'old') {
      const V = window.WEB_HERO_VISUALS;
      const car = V.createCar(PAINT.neutral_graphite, 0);
      const it = { kind: 'car', root: car, old: true, loadMs: 0, bytes: 0, mats: [] };
      car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      it.wheels = car.userData.cityMotion.wheels.map((w) => ({ roll: w.roll, steer: w.steer, front: w.front }));
      it.seat = { x: -0.44, y: 0.96, z: 0.12 };
      return it;
    }
    const g = await loadGLB(a.newUrl);
    const root = g.scene.clone(true);
    const it = { kind: 'car', root, old: false, loadMs: g.loadMs, mats: [] };
    const mats = new Set();
    root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
      }
    });
    it.mats = [...mats];
    for (const m of it.mats) m.userData.orig = { metalness: m.metalness, roughness: m.roughness };
    it.paint = it.mats.find((m) => m.name === 'Sedan_Paint');
    it.wheels = ['FL', 'FR', 'RL', 'RR'].map((t) => ({ roll: root.getObjectByName('Wheel_' + t),
      steer: root.getObjectByName('Steer_' + t), front: t[0] === 'F' }));
    const seat = root.getObjectByName('DriverSeat');
    it.seat = seat ? { x: seat.position.x, y: seat.position.y, z: seat.position.z } : null;
    it.extras = (g.scene.userData && g.scene.userData.citySwing) ||
      (root.getObjectByName('UrbanSedan_v1') || {}).userData;
    return it;
  }
  const g = await loadGLB(which === 'old' ? a.oldUrl : a.newUrl);
  const clone = THREE.SkeletonUtils.clone(g.scene);
  const it = gameCharacter({ scene: clone });
  it.kind = 'char'; it.loadMs = g.loadMs; it.old = which === 'old';
  it.mixer = new THREE.AnimationMixer(it.scene);
  return it;
}

// ---------------------------------------------------------------- Zustand
const state = { asset: 'sedan', which: 'new', clip: 'stand', play: true, t: 0, mode: 'gameDay', env: 'neutral',
  yaw: 35, pitch: 12, dist: 60, paint: 'neutral_graphite', speed: 0, steer: 0, driver: null, frozen: false };

async function setClipOn(it, name) {
  if (!it || it.kind !== 'char') return null;
  it.mixer.stopAllAction();
  it.action = null; it.clip = null;
  if (name === 'bind') return null;
  const clip = await loadClip(ASSETS[state.asset], name);
  if (!clip) return null;
  it.clip = clip;
  it.action = it.mixer.clipAction(clip); it.action.play();
  return clip;
}

let driverTemplate = null;
async function attachDriver(it) {
  if (!it || it.kind !== 'car' || !it.seat) return;
  if (!driverTemplate) {
    const g = await loadGLB(ROOT + 'assets/civilian.glb');
    driverTemplate = g;
  }
  const d = gameCharacter({ scene: THREE.SkeletonUtils.clone(driverTemplate.scene) });
  d.kind = 'char';
  d.mixer = new THREE.AnimationMixer(d.scene);
  const clip = await loadClip({ slot: 'civilian' }, 'sit');
  if (clip) { const ac = d.mixer.clipAction(clip); ac.play(); d.mixer.setTime(clip.duration * 0.5); }
  d.root.updateMatrixWorld(true);
  // Becken auf den Sitzpunkt (wie updateAutoFahrer: Huefte auf seat.y)
  const hips = d.scene.getObjectByName('mixamorigHips');
  const hp = new THREE.Vector3(); hips.getWorldPosition(hp);
  d.root.position.set(it.seat.x - hp.x, it.seat.y - hp.y, it.seat.z - hp.z);
  it.root.add(d.root);
  it.driver = d;
  applyLook(d, state.mode);
}

function driverClearance(it) {
  if (!it || !it.driver) return null;
  it.root.updateMatrixWorld(true);
  const head = it.driver.scene.getObjectByName('mixamorigHeadTop_End') || it.driver.scene.getObjectByName('mixamorigHead');
  const hp = new THREE.Vector3(); head.getWorldPosition(hp);
  // Kopfoberkante: hoechster Punkt der gerenderten Figur (CPU-Skinning)
  let top = -Infinity; const v = new THREE.Vector3();
  it.driver.scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i); o.boneTransform(i, v); v.applyMatrix4(o.matrixWorld);
      if (v.y > top) top = v.y;
    }
  });
  // von oben nach unten: erste Flaeche ueber dem Kopf ist das Dach (Aussenhaut)
  const ray = new THREE.Raycaster(new THREE.Vector3(hp.x, 6, hp.z), new THREE.Vector3(0, -1, 0), 0, 6);
  const targets = [];
  it.root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) targets.push(o); });
  const hit = ray.intersectObjects(targets, false).find((h) => h.point.y > top - 0.3);
  return { headTop: +top.toFixed(3), roofHitAbove: hit ? +hit.point.y.toFixed(3) : null,
    clearance: hit ? +(hit.point.y - top).toFixed(3) : null, hitMesh: hit ? hit.object.name : null,
    hitMaterial: hit ? (Array.isArray(hit.object.material) ? '' : hit.object.material.name) : null };
}

async function rebuild() {
  for (const st of stages) {
    if (st.item) { st.holder.remove(st.item.root); st.item = null; }
  }
  const a = ASSETS[state.asset];
  const plan = state.which === 'compare' ? ['old', 'new'] : [state.which];
  const items = await Promise.all(plan.map((w) => buildItem(state.asset, w)));
  items.forEach((it, i) => { stages[i].item = it; stages[i].holder.add(it.root); });
  for (const st of stages) applyLook(st.item, state.mode);
  setPaint(state.paint);
  await setClip(state.clip);
  $('tagL').textContent = state.which === 'compare' ? 'Bisher' : (state.which === 'old' ? 'Bisher' : 'Neu');
  $('tagR').textContent = state.which === 'compare' ? 'Neu' : '';
  $('tagR').style.display = state.which === 'compare' ? 'block' : 'none';
  $('split').style.display = state.which === 'compare' ? 'block' : 'none';
  if (a.kind === 'char' && state.dist > 90) state.dist = 60;
}

async function setClip(name) {
  state.clip = name; state.t = 0;
  const a = ASSETS[state.asset];
  if (a.kind === 'car') {
    state.speed = { vorwaerts: 8, rueckwaerts: -3, links: 5, rechts: 5 }[name] || 0;
    state.steer = { links: 0.42, rechts: -0.42 }[name] || 0;
    for (const st of stages) {
      const it = st.item; if (!it) continue;
      if (it.driver) { it.root.remove(it.driver.root); it.driver = null; }
      if (name === 'fahrer') await attachDriver(it);
    }
    return;
  }
  await Promise.all(stages.map((st) => setClipOn(st.item, name)));
}

function setPaint(key) {
  state.paint = key;
  for (const st of stages) {
    const it = st.item;
    if (it && it.kind === 'car') {
      if (it.paint) it.paint.color.setHex(PAINT[key]);
      else if (it.old) it.root.traverse((o) => { if (o.isMesh && o.name === 'Body' && o.material.color) { /* Spiel-Karosserie: Lack steckt in Eckfarben */ } });
    }
  }
}

function setMode(mode) {
  state.mode = mode;
  const night = mode === 'gameNight';
  for (const st of stages) {
    const studio = mode === 'studio';
    st.sun.intensity = night ? 0.14 : (studio ? 0.9 : 1.15);
    st.sky.intensity = night ? 0.34 : (studio ? 0.25 : 0.85);
    st.sky.color.setHex(night ? 0x5a6a90 : 0xcfe4ff);
    st.lamp.intensity = night ? 2.4 : 0;
    st.scene.environment = mode === 'studio' ? studioEnvironment() : null;
    st.scene.background = new THREE.Color(night ? 0x07090e : (state.env === 'city' ? 0xa9bfd6 : 0x8a8e93));
    buildEnv(st, state.env, night);
    applyLook(st.item, mode);
    if (st.item && st.item.driver) applyLook(st.item.driver, mode);
    const lampMats = st.item && st.item.mats ? st.item.mats.filter((m) => /Lamp/.test(m.name)) : [];
    for (const m of lampMats) m.emissiveIntensity = night ? 3.0 : 1.0;
  }
  if (mode === 'studio') {
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
  } else {
    renderer.outputEncoding = THREE.LinearEncoding;   // wie das Spiel
    renderer.toneMapping = THREE.NoToneMapping;
  }
  for (const st of stages) st.scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
}

// ---------------------------------------------------------------- Bewegung
const _v = new THREE.Vector3();
function step(dt) {
  if (state.play && !state.frozen) state.t += dt;
  const t = state.t;
  for (const st of stages) {
    const it = st.item; if (!it) continue;
    if (it.kind === 'char') {
      if (it.mixer) it.mixer.setTime(it.clip ? t % Math.max(it.clip.duration, 0.001) : 0);
      it.root.position.set(0, 0, 0);
    } else {
      const R = it.old ? 0.35 : 0.335;
      for (const w of it.wheels) {
        w.roll.rotation.x = (state.speed * t / R) % (Math.PI * 2);
        if (w.front) w.steer.rotation.y = state.steer;
      }
      if (it.driver && it.driver.mixer) { /* Sitzpose bleibt stehen */ }
    }
  }
}

// ---------------------------------------------------------------- Kamera & Zeichnen
function frameCamera() {
  const a = ASSETS[state.asset];
  const target = a.kind === 'car' ? new THREE.Vector3(0, 0.7, 0) : new THREE.Vector3(0, 0.95, 0);
  if (state.target) target.copy(state.target);
  const d = state.dist / 10;
  const yaw = THREE.MathUtils.degToRad(state.yaw), pitch = THREE.MathUtils.degToRad(state.pitch);
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d,
    target.z + Math.cos(yaw) * Math.cos(pitch) * d);
  camera.lookAt(target);
}
function draw() {
  frameCamera();
  const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
  renderer.setScissorTest(true);
  renderer.info.reset();
  renderer.info.autoReset = false;
  const panes = state.which === 'compare' ? 2 : 1;
  for (let i = 0; i < panes; i++) {
    const x = (W / panes) * i;
    renderer.setViewport(x, 0, W / panes, H); renderer.setScissor(x, 0, W / panes, H);
    camera.aspect = (W / panes) / H; camera.updateProjectionMatrix();
    renderer.clear();
    renderer.render(stages[i].scene, camera);
  }
  renderer.setScissorTest(false);
  $('split').style.left = (W / 2) + 'px';
}
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!state.frozen) { step(dt); draw(); updateStats(); }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- Messen
function countItem(it) {
  const out = { meshes: 0, primitives: 0, tris: 0, materials: new Set(), textures: new Set(), bones: 0, texBytes: 0 };
  if (!it) return out;
  it.root.traverse((o) => {
    if (o.isBone) out.bones++;
    if (!o.isMesh || !o.visible) return;
    out.meshes++;
    const g = o.geometry;
    const n = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    out.primitives += Array.isArray(o.material) ? g.groups.length : 1;
    out.tris += n;
    for (const m of mats) {
      out.materials.add(m.name || m.uuid);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        const t = m[k]; if (!t || !t.image || out.textures.has(t.uuid)) continue;
        out.textures.add(t.uuid);
        out.texBytes += (t.image.width || 0) * (t.image.height || 0) * 4 * 1.333;
      }
    }
  });
  return { meshes: out.meshes, drawCalls: out.primitives, tris: Math.round(out.tris), materials: out.materials.size,
    textures: out.textures.size, texMB: +(out.texBytes / 1048576).toFixed(1), bones: out.bones };
}
function updateStats() {
  const lines = [];
  stages.slice(0, state.which === 'compare' ? 2 : 1).forEach((st, i) => {
    const c = countItem(st.item);
    lines.push((state.which === 'compare' ? (i ? 'Neu  ' : 'Alt  ') : (state.which === 'old' ? 'Alt  ' : 'Neu  ')) +
      `${c.tris} Dreiecke · ${c.drawCalls} Aufrufe · ${c.materials} Mat · ${c.textures} Tex (${c.texMB} MB)`);
  });
  lines.push(`Renderer: ${renderer.info.render.calls} Aufrufe, ${renderer.info.render.triangles} Dreiecke`);
  lines.push(`Clip: ${state.clip}  t=${state.t.toFixed(2)} s`);
  $('stats').textContent = lines.join('\n');
}

// ---------------------------------------------------------------- UI
function fillClips() {
  const sel = $('clip'); sel.innerHTML = '';
  for (const c of ASSETS[state.asset].clips) {
    const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
  }
}
for (const k of Object.keys(PAINT)) {
  const o = document.createElement('option'); o.value = k; o.textContent = k; $('paint').appendChild(o);
}
$('asset').onchange = async (e) => { state.asset = e.target.value; fillClips(); state.clip = ASSETS[state.asset].clips[0];
  state.dist = ASSETS[state.asset].kind === 'car' ? 60 : 38; $('dist').value = state.dist; await rebuild(); };
$('which').onchange = async (e) => { state.which = e.target.value; await rebuild(); };
$('clip').onchange = (e) => setClip(e.target.value);
$('play').onchange = (e) => { state.play = e.target.checked; };
$('paint').onchange = (e) => setPaint(e.target.value);
$('mode').onchange = (e) => setMode(e.target.value);
$('env').onchange = (e) => { state.env = e.target.value; setMode(state.mode); };
for (const k of ['yaw', 'dist', 'pitch']) $(k).oninput = (e) => { state[k] = +e.target.value; };
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch }; });
window.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  state.yaw = drag.yaw - (e.clientX - drag.x) * 0.4;
  state.pitch = Math.max(-10, Math.min(70, drag.pitch + (e.clientY - drag.y) * 0.3));
});
renderer.domElement.addEventListener('wheel', (e) => { state.dist = Math.max(15, Math.min(140, state.dist + e.deltaY * 0.03)); });
window.addEventListener('resize', () => renderer.setSize(window.innerWidth, window.innerHeight));

// ---------------------------------------------------------------- Test-Schnittstelle
window.T = {
  state,
  async setup(o) {
    Object.assign(state, { frozen: true });
    if (o.asset) { state.asset = o.asset; fillClips(); $('asset').value = o.asset; }
    if (o.which) { state.which = o.which; $('which').value = o.which; }
    if (o.env) state.env = o.env;
    if (o.paint) state.paint = o.paint;
    state.clip = o.clip || ASSETS[state.asset].clips[0];
    await rebuild();
    setMode(o.mode || state.mode);
    if (o.paint) setPaint(o.paint);
    return true;
  },
  async clip(name) { await setClip(name); return true; },
  view(o) { Object.assign(state, o); if (o.target) state.target = new THREE.Vector3(...o.target); else if (o.target === null) state.target = null; },
  async renderAt(t) {
    state.t = t; const p = state.play; state.play = false; step(0); state.play = p; draw(); updateStats();
    await new Promise((r) => requestAnimationFrame(r)); return true;
  },
  stats() {
    const per = stages.slice(0, state.which === 'compare' ? 2 : 1).map((st) => ({ old: !!(st.item && st.item.old),
      loadMs: st.item ? Math.round(st.item.loadMs || 0) : 0, clipDuration: st.item && st.item.clip ? st.item.clip.duration : null,
      clipTracks: st.item && st.item.clip ? st.item.clip.tracks.length : null, ...countItem(st.item) }));
    return { per, rendererCalls: renderer.info.render.calls, rendererTris: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      gl: renderer.getContext().getParameter(renderer.getContext().VERSION) };
  },
  driver() { return driverClearance(stages[0].item); },
  boneCheck() {
    // fehlende Knochenzuordnungen: jede Spur muss einen Knochen treffen
    return stages.slice(0, state.which === 'compare' ? 2 : 1).map((st) => {
      const it = st.item; if (!it || !it.clip) return null;
      const missing = it.clip.tracks.map((t) => t.name.split('.')[0]).filter((n) => !it.scene.getObjectByName(n));
      return { tracks: it.clip.tracks.length, missing: [...new Set(missing)] };
    });
  },
  wheelCheck() {
    const it = stages[0].item; if (!it || it.kind !== 'car') return null;
    it.root.updateMatrixWorld(true);
    return it.wheels.map((w) => {
      const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(w.roll.getWorldQuaternion(new THREE.Quaternion()));
      const p = w.roll.getWorldPosition(new THREE.Vector3());
      return { name: w.roll.name, pos: p.toArray().map((v) => +v.toFixed(3)), rollAxis: ax.toArray().map((v) => +v.toFixed(3)),
        steerY: +(w.steer ? w.steer.rotation.y : 0).toFixed(3), rollX: +w.roll.rotation.x.toFixed(3) };
    });
  },
  bounds() {
    const it = stages[0].item; it.root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(it.root);
    return { min: b.min.toArray().map((v) => +v.toFixed(3)), max: b.max.toArray().map((v) => +v.toFixed(3)) };
  },
  async perfCars(n, which, frames) {
    // Mehrere Exemplare in einer isolierten Szene: Zeichenaufrufe und Bildzeit messen
    const st = stages[0];
    st.holder.clear();
    const base = await buildItem('sedan', which);
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const c = which === 'old' ? window.WEB_HERO_VISUALS.createCar(PAINT.silver, i % 3) : base.root.clone(true);
      c.position.set((i % 10) * 5.5 - 25, 0, Math.floor(i / 10) * 7 - 25);
      g.add(c);
    }
    g.position.set(0, 0, -3);
    st.holder.add(g);
    state.which = 'new'; state.dist = 720; state.pitch = 38; state.yaw = 0; state.target = new THREE.Vector3(0, 0, 0);
    const gl = renderer.getContext();
    draw(); gl.finish();
    const times = [];
    for (let f = 0; f < frames; f++) {
      g.children.forEach((c, i) => { c.rotation.y = f * 0.01 + i; });
      const t0 = performance.now(); draw(); gl.finish(); times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const res = { n, which, calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
      medianMs: +times[Math.floor(times.length / 2)].toFixed(2), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(2),
      geometries: renderer.info.memory.geometries };
    st.holder.clear(); st.item = null;
    return res;
  },
};

if (/[?&]capture=1/.test(location.search)) $('panel').style.display = 'none';
fillClips();
setMode('gameDay');
rebuild().then(() => { window.T.ready = true; });
requestAnimationFrame(loop);
})();
