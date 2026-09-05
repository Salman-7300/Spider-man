'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, THREE } = require('./animation-test-runtime.cjs');
const { cityRuntime } = require('./city-test-runtime.cjs');
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function worldBox(env, c) {
  for (let i = Math.floor((c.x0 - env.ORIGIN) / env.PITCH); i <= Math.floor((c.x1 - env.ORIGIN) / env.PITCH); i++)
    for (let j = Math.floor((c.z0 - env.ORIGIN) / env.PITCH); j <= Math.floor((c.z1 - env.ORIGIN) / env.PITCH); j++) {
      const key = i + ',' + j; env.colliderGrid.set(key, [...(env.colliderGrid.get(key) || []), c]);
    }
}

for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  test(`Climbing keeps the camera outside the facade with room to see the hero (${nx},${nz})`, () => {
    const r = runtime(), e = r.env;
    const c = { x0: -10, x1: 10, z0: -10, z1: 10, h: 70 };
    worldBox(e, c);
    e.player.pos.set(nx * 10.18, 30, nz * 10.18);
    e.player.state = 'climb'; e.player.wallInfo = { col: c, nx, nz };
    const inwardYaw = Math.atan2(-nx, -nz);
    r.run(`camYaw = ${inwardYaw}; camPitch = 0.22; camPos.copy(player.pos); camPos.y += 1.7;`);
    for (let i = 0; i < 120; i++) e.updateCamera(1 / 60);
    const p = e.camera.position;
    assert.ok((nx ? p.x * nx : p.z * nz) > 10.3, 'camera remains outside wall');
    assert.ok(p.distanceTo(e.player.pos) > 4.5, 'view recovers instead of staying against the head');
  });
}

test('Climbing camera also respects a neighboring building and a thin overhang', () => {
  const r = runtime(), e = r.env;
  const c = { x0: -12, x1: 0, z0: -15, z1: 15, h: 60 };
  const neighbor = { x0: 3.2, x1: 12, z0: -15, z1: 15, h: 60 };
  const overhang = { x0: 0, x1: 3.2, z0: -15, z1: 15, y0: 33, h: 33.12 };
  for (const box of [c, neighbor, overhang]) worldBox(e, box);
  e.player.pos.set(0.18, 30, 0); e.player.state = 'climb'; e.player.wallInfo = { col: c, nx: 1, nz: 0 };
  r.run('camYaw = -Math.PI / 2; camPos.set(0.18, 31.7, 0); camShake = 0.3;');
  for (let i = 0; i < 120; i++) e.updateCamera(1 / 60);
  const p = e.camera.position;
  assert.ok(p.x > 0.3 && p.x < 2.9); assert.ok(p.y < 32.7);
  assert.ok(Number.isFinite(p.length()));
});

test('Windows reveal a recessed room; roof, footprint and closed world collision remain intact', () => {
  const r = cityRuntime();
  for (let kind = 0; kind < 4; kind++) {
    const tower = r.look.createTower(18, 90, 22, kind); tower.updateMatrixWorld(true);
    const glass = tower.getObjectByName('Glazing');
    assert.ok(glass.material.transparent && glass.material.opacity < 0.3 && !glass.material.depthWrite);
    const cols = Math.floor(17.5 / (kind === 1 ? 2.9 : 2.5)), step = 17.5 / cols;
    const x = -8.75 + (Math.floor(cols / 2) + 0.5) * step;
    const ray = new THREE.Raycaster(V(x, 5.65, 12), V(0, 0, -1));
    const hits = ray.intersectObject(tower, true);
    const pane = hits.find(h => h.object === glass), opaque = hits.find(h => !h.object.material.transparent);
    assert.ok(pane && opaque); assert.ok(opaque.distance - pane.distance > 1.5, 'real depth behind pane');
    const roof = new THREE.Raycaster(V(0, 91, 0), V(0, -1, 0)).intersectObject(tower, true)[0];
    assert.ok(Math.abs(roof.point.y - 90) < 1e-5);
    const e = runtime().env;
    assert.ok(e.kameraKastenTreffer(V(x, 5.65, 12), V(x, 5.65, 8),
      { x0: -9, x1: 9, z0: -11, z1: 11, h: 90 }, 0.3) < 1, 'glass remains a solid world surface');
    const lod = tower.getObjectByName('OfficeDetails'), camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 200); camera.updateMatrixWorld(); lod.update(camera);
    assert.equal(tower.getObjectByName('OfficeFurniture').visible, false);
    camera.position.set(0, 0, 15); camera.updateMatrixWorld(); lod.update(camera);
    assert.equal(tower.getObjectByName('OfficeFurniture').visible, true);
  }
});

test('Vehicle collision follows the visible roof and bounds at arbitrary yaw', () => {
  const r = cityRuntime();
  for (const typ of [{ art: 'pkw', laenge: 4.4, breite: 1.9 }, { art: 'lkw', laenge: 8, breite: 2.3 },
    { art: 'bus', laenge: 9.5, breite: 2.4 }]) {
    const mesh = r.makeFahrzeugMesh(typ, 0x5b7985), car = { mesh, typ, axis: 'x' };
    mesh.position.set(15, 2, -8);
    for (const yaw of [0, 0.37, Math.PI / 2, 2.8]) {
      mesh.rotation.y = yaw; mesh.updateMatrixWorld(true);
      const visual = new THREE.Box3().setFromObject(mesh), collision = r.carAABB(car);
      assert.ok(collision.x0 <= visual.min.x + 0.001 && collision.x1 >= visual.max.x - 0.001);
      assert.ok(collision.z0 <= visual.min.z + 0.001 && collision.z1 >= visual.max.z - 0.001);
      assert.ok(Math.abs(collision.top - visual.max.y) < 0.01, 'roof is not inside vehicle');
    }
  }
});

test('Train leading lights swap at a stationary reversal without rotating wheels', () => {
  const r = cityRuntime(), train = r.baueZug(0x466a85), m = train.userData.trainMotion;
  r.look.updateTrain(train, 0, 1 / 60, -1);
  assert.equal(m.phase, 0); assert.equal(m.frontLights.color.getHex(), 0xd24632);
  assert.equal(m.rearLights.color.getHex(), 0xe8f3f7);
  r.look.updateTrain(train, 0, 1 / 60, 1);
  assert.equal(m.frontLights.color.getHex(), 0xe8f3f7); assert.equal(m.phase, 0);
});

test('Hit overlay preserves authored pose at endpoints and respects strength and direction', () => {
  const v = runtime().makeVisual(['idle']);
  for (const [t, weight] of [[0, 1], [1, 1], [0.5, 0]]) {
    v.laborClip('idle', 0.3);
    const before = Object.fromEntries(Object.entries(v.knochen).map(([n, b]) => [n, b.quaternion.toArray()]));
    v.poseTreffer(t, 'links', weight);
    for (const [n, q] of Object.entries(before)) assert.deepEqual(v.knochen[n].quaternion.toArray(), q);
  }
  v.laborClip('idle', 0.3); const original = v.knochen.spine1.quaternion.clone();
  v.poseTreffer(0.5, 'links', 0.1); const weak = original.angleTo(v.knochen.spine1.quaternion);
  v.laborClip('idle', 0.3); v.poseTreffer(0.5, 'links', 1); const left = v.knochen.spine1.quaternion.clone();
  assert.ok(original.angleTo(left) > weak * 5);
  v.laborClip('idle', 0.3); v.poseTreffer(0.5, 'rechts', 1);
  assert.ok(left.angleTo(v.knochen.spine1.quaternion) > 0.1);
});

function combatRuntime() {
  const r = runtime(), e = r.env;
  const between = (a, b) => { const start = r.source.indexOf(a), end = r.source.indexOf(b, start + a.length);
    assert.ok(start >= 0 && end > start); return r.source.slice(start, end); };
  Object.assign(e, { cars: [], enemies: [], NAHKAMPF: 1.05, carAABB: cityRuntime().carAABB,
    updateHUD: () => {}, skillWert: () => 1, STUFEN: [{ wucht: 1 }], stufe: 0,
    treffEffekt: () => {}, hitstop: () => {}, SFX: { punch() {}, kick() {} },
    damageEnemy: (target, damage) => { target.hp -= damage; }, brichAngriffAb: () => {} });
  Object.assign(e.player, { radius: 0.45, height: 1.75, facing: 0, onGround: true,
    combo: 0, comboTimer: 3, attack: { type: 'punch', t: 0.4, finisher: false } });
  r.run(between('function kampfFreierWeg(', 'function tryAttack(')
    + between('function nearestEnemy(', '/* ---- Wurfgeschosse ----')
    + between('function trefferRichtung(', '/* ================= Parade')
    + between('function resolveAttackHit(', 'function damagePlayer('));
  return r;
}
const enemy = (x, z) => ({ pos: V(x, 0, z), vel: V(0, 0, 0), facing: Math.PI, hp: 100,
  typ: { poise: 100 }, staggerT: 0, visual: null });

test('Melee cannot select or damage a locked target through thin closed glass/walls', () => {
  const { env: e } = combatRuntime();
  const target = enemy(0, 2.1); e.enemies.push(target); e.player.ziel = target;
  worldBox(e, { x0: -2, x1: 2, z0: 0.71, z1: 0.73, y0: 0, h: 4 });
  assert.equal(e.nearestEnemy(3, 0.05, true), null); assert.equal(e.nahkampfZielFrei(target), false);
  e.resolveAttackHit(); assert.equal(target.hp, 100); assert.equal(e.player.pos.z, 0);
});

test('Attack follow-through cannot teleport the body through a low obstacle or parked car', () => {
  for (const vehicle of [false, true]) {
    const { env: e } = combatRuntime();
    if (vehicle) {
      const mesh = new THREE.Group(); mesh.position.set(0, 0, 2.9);
      mesh.userData.collisionHull = { halfWidth: 1, halfLength: 2.2, roof: 1.98 };
      e.cars.push({ mesh });
    } else worldBox(e, { x0: -2, x1: 2, z0: 0.7, z1: 0.72, y0: 0, h: 0.8 });
    e.nahkampfNachzug(enemy(0, 2.1));
    assert.ok(e.player.pos.z > 0 && e.player.pos.z < 0.26);
  }
});

test('An unobstructed punch retains damage, combo and maximum follow-through distance', () => {
  const { env: e } = combatRuntime(), target = enemy(0, 2.1);
  e.enemies.push(target); e.player.ziel = target;
  e.resolveAttackHit();
  assert.equal(target.hp, 89); assert.equal(e.player.combo, 1);
  assert.ok(Math.abs(e.player.pos.z - 0.8) < 1e-6);
});
