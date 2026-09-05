'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cityRuntime, THREE } = require('./city-test-runtime.cjs');
const { runtime } = require('./animation-test-runtime.cjs');
const createLook = require('../city-visuals.js');
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const near = (a, b, tolerance = 0.001) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const count = root => { let n = 0; root.traverse(() => n++); return n; };

test('Four high-rise styles retain footprint and exact roof height at different sizes', () => {
  const look = createLook(THREE);
  for (let variant = 0; variant < 4; variant++) for (const [w, h, d] of [[9, 38, 11], [18, 90, 22], [24, 132, 20]]) {
    const tower = look.createTower(w, h, d, variant), box = new THREE.Box3().setFromObject(tower);
    near(box.min.x, -w / 2); near(box.max.x, w / 2); near(box.min.z, -d / 2); near(box.max.z, d / 2);
    near(box.min.y, 0); near(box.max.y, h); assert.equal(tower.children.length, 2);
    let triangles = 0;
    tower.traverse(o => { if (o.isMesh) { triangles += o.geometry.attributes.position.count / 3;
      for (const value of o.geometry.attributes.position.array) assert.ok(Number.isFinite(value)); } });
    assert.ok(triangles < 6500);
  }
});

test('Modern cars preserve the real driver seat and cabin clearance; geometry differs by variant', () => {
  const r = cityRuntime(), classic = cityRuntime(false), hashes = new Set();
  const old = classic.makeCarMesh(0x3d7583), oldBox = new THREE.Box3().setFromObject(old);
  for (let i = 0; i < 3; i++) {
    const car = r.makeCarMesh(0x3d7583), box = new THREE.Box3().setFromObject(car);
    assert.equal(JSON.stringify(car.userData.fahrerSitz), JSON.stringify(old.userData.fahrerSitz));
    assert.ok(car.userData.insassen && car.children.includes(car.userData.insassen));
    near(box.max.y, oldBox.max.y, 0.01); near(box.max.x, oldBox.max.x, 0.02);
    near(box.max.z, oldBox.max.z, 0.03); near(box.min.y, 0, 0.001);
    hashes.add(Array.from(car.getObjectByName('Body').geometry.attributes.position.array).join(','));
    // Above the dashboard: the center of the cabin must be open, not a solid box.
    const ray = new THREE.Raycaster(V(0, 1.45, 0), V(0, -1, 0)); car.updateMatrixWorld(true);
    const bodyHit = ray.intersectObject(car.getObjectByName('Body'))[0];
    assert.ok(bodyHit && bodyHit.point.y < 0.79);
  }
  assert.equal(hashes.size, 3);
});

test('Wheel travel matches distance, front wheels steer, braking lights and stopped wheels work', () => {
  const look = createLook(THREE), car = look.createCar(0x467c88, 0), m = car.userData.cityMotion;
  look.updateCar(car, 7, 0.05);
  for (const w of m.wheels) near(w.roll.rotation.x, 1);
  car.rotation.y = 0.06; look.updateCar(car, 7, 0.05);
  for (const w of m.wheels) assert.ok(w.front ? w.steer.rotation.y > 0 : w.steer.rotation.y === 0);
  const angles = m.wheels.map(w => w.roll.rotation.x);
  look.updateCar(car, 0, 0.05);
  assert.deepEqual(m.wheels.map(w => w.roll.rotation.x), angles);
  assert.equal(m.brake.color.getHex(), 0xff4038);
});

test('Taxi, police, truck and bus retain expected metadata and four animated wheels', () => {
  const r = cityRuntime();
  for (const type of [{ art: 'taxi', laenge: 4.5, breite: 1.9 }, { art: 'polizei', laenge: 4.6, breite: 2 },
    { art: 'lkw', laenge: 8, breite: 2.3 }, { art: 'bus', laenge: 9.5, breite: 2.4 }]) {
    const car = r.makeFahrzeugMesh(type, 0x436f8e), m = car.userData.cityMotion;
    assert.equal(m.wheels.length, 4); r.look.updateCar(car, 10, 1 / 60);
    assert.ok(m.wheels.every(w => Number.isFinite(w.roll.rotation.x) && w.roll.rotation.x > 0));
    if (type.art === 'polizei') assert.equal(car.userData.blaulicht.children.length, 2);
    if (type.art === 'bus') assert.equal(car.userData.sitzplaetze.length, 9);
  }
});

test('Subway doors actually reveal an opening; passengers and wheel direction remain valid', () => {
  const r = cityRuntime(), train = r.baueZug(0x376f95);
  assert.equal(train.userData.freieSitze.length, 30);
  const ray = new THREE.Raycaster(V(4.25, 1.7, 4), V(0, 0, -1));
  const opaque = () => { train.updateMatrixWorld(true); return ray.intersectObject(train, true)
    .filter(hit => hit.point.z > 1.14 && !hit.object.material.transparent); };
  assert.ok(opaque().length > 0, 'closed door has a lower panel');
  train.userData.tuerL.position.x = -(1.35 - 0.16); train.userData.tuerR.position.x = 1.35 - 0.16;
  assert.equal(opaque().length, 0, 'open doorway has no fixed wall or bench behind it');
  assert.ok(train.userData.tuerL.children.some(m => m.material.transparent));
  r.look.updateTrain(train, 12, 1 / 60); const phase = train.userData.trainMotion.phase;
  r.look.updateTrain(train, 0, 1 / 60); assert.equal(train.userData.trainMotion.phase, phase);
  r.look.updateTrain(train, -12, 1 / 60); near(train.userData.trainMotion.phase, 0);
});

test('Helicopter retains flight/light references and tail rotor stays in its rotation plane', () => {
  const h = cityRuntime().makeHeliMesh();
  for (const name of ['mesh', 'rotor', 'heckRotor', 'lampe', 'strahl', 'fleck']) assert.ok(h[name]);
  assert.ok(h.mesh.getObjectByName('StreamlinedFuselage'));
  const box = new THREE.Box3().setFromObject(h.heckRotor);
  assert.ok(box.max.x - box.min.x < 0.13);
});

test('Civilian shared atlases keep skin colors; role changes do not accumulate nodes', () => {
  const look = createLook(THREE), v = runtime().makeVisual(['idle']);
  const shared = new THREE.MeshPhongMaterial({ color: 0xffffff }); shared.name = 'Ch02_body';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), shared); body.name = 'Ch02_Body';
  const shirt = new THREE.Mesh(body.geometry, shared); shirt.name = 'Ch02_Cloth'; v.root.add(body, shirt);
  look.dressCivilian(v, 0);
  assert.equal(body.material, shared); assert.equal(shared.color.getHex(), 0xffffff);
  assert.notEqual(shirt.material, shared); assert.notEqual(shirt.material.color.getHex(), 0xffffff);
  look.dressEnemy(v, 'schlaeger'); const nodes = count(v.root);
  for (let i = 0; i < 100; i++) look.dressEnemy(v, look.enemyStyles[i % look.enemyStyles.length]);
  assert.equal(count(v.root), nodes);
  look.dressEnemy(v, 'waechter'); assert.equal(v.root.userData.cityRole, 'waechter');
  assert.ok(v.cityGear.parent.isBone);
});

test('Swing selects its own clip without generic fallbacks and cannot run off its safe range', () => {
  const v = runtime().makeVisual(['schwung2', 'idle']);
  for (let i = 0; i < 600; i++) v.play('swing', { speed: 20, bogen: Math.sin(i / 60) }, 1 / 60);
  const state = v.laufStand(); assert.equal(state.clip, 'schwung2'); assert.equal(state.ts, 0);
  assert.ok(state.t >= 3.517 * 0.014 && state.t <= 3.518 * 0.121);
});

for (const fps of [30, 60, 120]) test(`Thirty seconds of swing and hand swaps remain bounded at ${fps} fps`, context => {
  const v = runtime().makeVisual(['schwung2', 'schwung', 'schwungpose', 'schwunghang', 'idle']);
  const names = ['hips', 'spine', 'spine1', 'spine2', 'head', 'neck', ...['left', 'right'].flatMap(side =>
    ['shoulder', 'arm', 'forearm', 'hand', 'upleg', 'leg', 'foot', 'toebase'].map(b => side + b))];
  const previous = {}; let peak = 0; v.root.rotation.x = 1.1;
  for (let i = 0; i < 30 * fps; i++) {
    const t = i / fps, b = Math.sin(t * 1.2);
    v.play('swing', { speed: 20, bogen: b, t }, 1 / fps);
    v.poseSchwung(V(8, 20, 6), Math.floor(t / 3) % 2 ? 'L' : 'R', t, b, 1.1,
      Math.floor(t / 2) % 2 === 1, Math.min(1, (i + 1) / fps / 0.16));
    for (const n of names) {
      const q = v.knochen[n].quaternion; near(q.length(), 1, 1e-5);
      if (previous[n]) peak = Math.max(peak, previous[n].angleTo(q) * 180 / Math.PI);
      previous[n] = q.clone();
    }
  }
  assert.ok(peak < 720 / fps, 'largest per-frame local joint change: ' + peak);
  context.diagnostic(`Peak local joint change: ${peak.toFixed(3)} degrees per simulated frame`);
});

test('A swing overlay with zero weight changes no bone', () => {
  const v = runtime().makeVisual(['schwung2']); v.laborClip('schwung2', 0.08);
  const before = Object.fromEntries(Object.entries(v.knochen).map(([n, b]) => [n, b.quaternion.toArray()]));
  v.poseSchwung(V(-8, 20, -4), 'L', 0.5, 1, 1.1, true, 0);
  for (const [n, q] of Object.entries(before)) assert.deepEqual(v.knochen[n].quaternion.toArray(), q);
});
