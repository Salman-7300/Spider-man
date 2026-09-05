'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, model, loadClip, THREE } = require('./animation-test-runtime.cjs');
const { cityRuntime } = require('./city-test-runtime.cjs');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pos = (v, n) => v.knochen[n].getWorldPosition(V());
function section(r, a, b) {
  const start = r.source.indexOf(a), end = r.source.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start, a); return r.source.slice(start, end);
}
function box(env, c) {
  for (let x = Math.floor((c.x0 - env.ORIGIN) / env.PITCH); x <= Math.floor((c.x1 - env.ORIGIN) / env.PITCH); x++)
    for (let z = Math.floor((c.z0 - env.ORIGIN) / env.PITCH); z <= Math.floor((c.z1 - env.ORIGIN) / env.PITCH); z++) {
      const key = x + ',' + z; env.colliderGrid.set(key, [...env.colliderGrid.get(key) || [], c]);
    }
}

for (const slot of ['civilian', 'civilian2', 'civilian3', 'civilian4', 'civilian5']) {
  test('Driver reaches forward with bent elbows on real rig: ' + slot, () => {
    const r = runtime(), v = r.env.makeGlbVisual(model([loadClip('idle', 'civilian')], slot));
    v.root.rotation.y = 0.71; v.root.position.set(8, 1, -12);
    v.laborClip('idle', 0.3); v.poseSitzen(1, undefined, true);
    const hip = pos(v, 'hips'), forward = V(Math.sin(0.71), 0, Math.cos(0.71));
    const right = V(Math.cos(0.71), 0, -Math.sin(0.71));
    for (const side of ['left', 'right']) {
      const hand = pos(v, side + 'hand').sub(hip), foot = pos(v, side + 'foot').sub(hip);
      assert.ok(hand.dot(forward) > 0.40 && Math.abs(hand.dot(right)) < 0.28, 'hands at wheel, not T-pose');
      assert.ok(hand.y > 0.19 && hand.y < 0.34);
      assert.ok(foot.dot(forward) > 0.4 && foot.y < -0.4);
      const a = pos(v, side + 'arm'), b = pos(v, side + 'forearm'), c = pos(v, side + 'hand');
      assert.ok(a.distanceTo(c) < (a.distanceTo(b) + b.distanceTo(c)) * 0.94, 'elbow stays bent');
    }
  });
}

test('Perch has grounded feet, a low support hand and an asymmetric raised knee', () => {
  const v = runtime().makeVisual(['idle']);
  for (let i = 0; i < 60; i++) { v.laborClip('idle', 0.2); v.poseKauern(1, 0); v.hockeAusgleich(0.35); }
  const hip = pos(v, 'hips'), head = pos(v, 'head');
  assert.ok(hip.y > 0.2 && hip.y < 0.55); assert.ok(head.y > 0.55 && head.y < 1.05);
  for (const side of ['left', 'right']) {
    assert.ok(pos(v, side + 'foot').y >= 0.06 && pos(v, side + 'foot').y < 0.12);
    assert.ok(pos(v, side + 'leg').y > 0.2, 'knees do not go through roof');
    assert.ok(pos(v, side + 'leg').z > hip.z + 0.2, 'knees fold forward');
  }
  assert.ok(Math.min(pos(v, 'lefthand').y, pos(v, 'righthand').y) < 0.1);
  assert.ok(Math.abs(pos(v, 'lefthand').y - pos(v, 'righthand').y) > 0.3);
});

test('Walking resumes without a crouch one-shot and restores ground contact quickly', () => {
  const v = runtime().makeVisual(['idle', 'run', 'walk', 'ducken']);
  for (let i = 0; i < 60; i++) { v.play('idle', { speed: 0 }, 1 / 60); v.poseKauern(1, 0); v.hockeAusgleich(0.35); }
  for (let i = 0; i < 24; i++) {
    v.play('run', { speed: 7 }, 1 / 60);
    const weight = Math.exp(-(i + 1) * 22 / 60);
    if (weight > 0.015) { v.poseKauern(weight, 0); v.hockeAusgleich(14 / 60); }
    else v.bodenAusgleich(18 / 60);
  }
  assert.ok(['run', 'sprint'].includes(v.aktuellerClip));
  assert.ok(Math.min(pos(v, 'leftfoot').y, pos(v, 'rightfoot').y) < 0.25, 'grounded within 0.4 seconds');
});

test('Glide keeps both legs behind the pelvis and both hands out of the torso', () => {
  const v = runtime().makeVisual(['gleiten']); v.root.rotation.x = 0.3;
  for (const bank of [-0.7, 0, 0.7]) {
    v.laborClip('gleiten', 0.3); v.poseGleiten(0, bank, 1, 1, 20);
    const hip = pos(v, 'hips'), head = pos(v, 'head');
    const left = pos(v, 'leftfoot'), right = pos(v, 'rightfoot');
    assert.ok(head.z > hip.z + 0.35 && Math.abs(head.y - hip.y) < 0.4);
    assert.ok(left.z < hip.z - 0.55 && right.z < hip.z - 0.55);
    assert.ok(Math.abs(left.y - right.y) < 0.15, 'legs lie in one flight plane');
    assert.ok(Math.abs(pos(v, 'lefthand').x - hip.x) > 0.4);
    assert.ok(Math.abs(pos(v, 'righthand').x - hip.x) > 0.4);
  }
});

for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  test(`Wall hold reaches the same facade with all four extremities (${nx},${nz})`, () => {
    const v = runtime().makeVisual(['kriechen']);
    v.root.rotation.y = Math.atan2(-nx, -nz); v.root.position.set(nx * 0.18, 20, nz * 0.18);
    for (let i = 0; i < 60; i++) { v.laborClip('kriechen', 0.2); v.wandKriechen(1, 0.3, 0); }
    const normal = V(nx, 0, nz), hip = pos(v, 'hips');
    v.root.position.addScaledVector(normal, 0.18 - hip.dot(normal));
    v.poseWandhalt(nx, nz, 1, 0);
    for (const bone of ['lefthand', 'righthand', 'leftfoot', 'rightfoot']) {
      const distance = pos(v, bone).dot(normal);
      assert.ok(distance > 0.025 && distance < 0.13, bone + ': ' + distance);
    }
  });
}

for (const roll of [0, -Math.PI / 2, Math.PI / 2]) {
  test('Wall run keeps the head in the direction of travel and a sole on the wall: ' + roll, () => {
    const v = runtime().makeVisual(['run']); v.root.rotation.y = Math.PI; v.root.position.set(0, 20, 0.18);
    for (let i = 0; i < 80; i++) { v.laborClip('run', 0.15); v.wandKriechen(1, 0.3, roll, true); }
    v.root.position.z += 0.52 - pos(v, 'hips').z;
    v.poseWandSprint(0, 1, 0, 1, roll, 1);
    const direction = V(Math.sin(roll), Math.cos(roll), 0), spine = pos(v, 'head').sub(pos(v, 'hips'));
    assert.ok(spine.dot(direction) > 0.4, 'run must not use the prone crawl transform');
    assert.ok(Math.min(pos(v, 'leftfoot').z, pos(v, 'rightfoot').z) < 0.12);
    assert.ok(pos(v, 'lefthand').z > 0.05 && pos(v, 'righthand').z > 0.05);
  });
}

test('Seat identities survive distance reordering, return visits and occupied seats', () => {
  const r = runtime(); r.run(section(r, 'function festeSitzZuordnung(', 'function updateZugGaeste('));
  const pool = [{}, {}, {}];
  const seats = [{ key: 'a', rolle: 0 }, { key: 'b', rolle: 1 }, { key: 'c', rolle: 2 }, { key: 'd', rolle: 0 }];
  const keys = value => Array.from(value, s => s && s.key);
  assert.deepEqual(keys(r.env.festeSitzZuordnung(pool, seats)), ['a', 'b', 'c']);
  assert.deepEqual(keys(r.env.festeSitzZuordnung(pool, seats.slice().reverse())), ['a', 'b', 'c']);
  assert.deepEqual(keys(r.env.festeSitzZuordnung(pool, seats.filter(s => s.key !== 'a'))), ['d', 'b', 'c']);
  r.env.festeSitzZuordnung(pool, []);
  assert.deepEqual(keys(r.env.festeSitzZuordnung(pool, seats)), ['a', 'b', 'c']);
});

function webRuntime() {
  const r = runtime(); Object.assign(r.env, { helis: [], SLAB_H: 0 });
  r.run(section(r, 'function netzWegFrei(', 'function findAnchor(')); return r;
}
function helicopter(e) {
  const h = { mesh: new THREE.Group() }; h.mesh.position.set(0, 60, -20); h.mesh.scale.setScalar(1.9);
  e.helis.push(h); e.player.pos.set(0, 40, 0);
  e.camera.position.copy(e.player.pos).add(V(0, 1.25, 0)); e.camera.lookAt(h.mesh.position); e.camera.updateMatrixWorld(true);
  return h;
}
test('Heli can be aimed at above the city; nearby roof/wall/occlusion and range still matter', () => {
  const { env: e } = webRuntime(), h = helicopter(e);
  let a = e.findHeliAnchor(); assert.equal(a.heli, h); assert.ok(a.y < h.mesh.position.y - 1.5);
  e.player.pos.y = 20; assert.equal(e.findHeliAnchor(), null);
  e.player.pos.y = 40;
  box(e, { x0: -10, x1: 10, z0: -10.01, z1: -10, h: 100 });
  assert.equal(e.findHeliAnchor(), null, 'thin wall blocks anchor');
  e.colliderGrid.clear(); h.mesh.position.z = -120; assert.equal(e.findHeliAnchor(), null);
});
test('Anchor follows translation/rotation and releases on disappearance, teleport or obstruction', () => {
  const { env: e } = webRuntime(), h = helicopter(e), a = e.findHeliAnchor();
  const s = { heli: h, heliLocal: a.heliLocal, anchor: a.clone(), anchorVelocity: V() };
  h.mesh.position.x += 0.2; h.mesh.rotation.z = 0.02;
  assert.ok(e.bewegeNetzAnker(s, 1 / 60));
  assert.ok(s.anchor.distanceTo(h.mesh.localToWorld(s.heliLocal.clone())) < 1e-8);
  assert.ok(s.anchorVelocity.x > 5 && s.anchorVelocity.x < 20);
  h.mesh.position.x += 20; assert.equal(e.bewegeNetzAnker(s, 1 / 60), false);
  h.mesh.position.x -= 20; e.helis.length = 0; assert.equal(e.bewegeNetzAnker(s, 1 / 60), false);
  e.helis.push(h); box(e, { x0: -10, x1: 10, z0: -10.01, z1: -10, h: 100 });
  assert.equal(e.bewegeNetzAnker(s, 1 / 60), false);
});
test('Moving rope constraint preserves shared world velocity and cannot pull through a thin wall', () => {
  const { env: e } = webRuntime();
  const s = { heli: {}, anchor: V(2, 40, 0), len: 1, anchorVelocity: V(8, 0, 0) };
  const p = V(0, 40, 0), velocity = V(8, 0, 0);
  assert.ok(e.spannNetz(s, p, velocity, 0.4)); assert.equal(velocity.x, 8); assert.equal(p.x, 1);
  p.x = 0; box(e, { x0: 0.6, x1: 0.61, z0: -2, z1: 2, y0: 39, h: 45 });
  assert.equal(e.spannNetz(s, p, velocity, 0.4), false); assert.equal(p.x, 0);
});
test('Twenty seconds of a moving pendulum carries the player with the helicopter', () => {
  const { env: e } = webRuntime();
  const s = { heli: {}, anchor: V(0, 80, 0), len: 25, anchorVelocity: V(8, 0, 0) };
  const p = V(0, 55, 0), velocity = V(); let maxDistance = 0;
  for (let i = 0; i < 1200; i++) {
    s.anchor.x += 8 / 60; velocity.y -= 20 / 60; p.addScaledVector(velocity, 1 / 60);
    assert.ok(e.spannNetz(s, p, velocity, 0.4));
    maxDistance = Math.max(maxDistance, p.distanceTo(s.anchor));
  }
  assert.ok(p.x > 135 && maxDistance <= 25.000001); assert.ok(Number.isFinite(velocity.length()));
});

test('Web geometry has thin fixed ends and smooth world-down sag at every orientation', () => {
  const r = runtime(); Object.assign(r.env, { scene: new THREE.Scene(), fadenTex: new THREE.Texture() });
  r.run(section(r, 'const FADEN_RING =', '/* Kurzer Netzklatscher:'));
  for (const to of [V(0, 30, 0), V(10, 25, 5), V(20, 0, 0)]) {
    const mesh = r.env.makeWebStrand(), from = V(0, 0, 0);
    r.env.placeStrand(mesh, from, to, 0.014, 1);
    const points = mesh.geometry.attributes.position;
    for (let i = 0; i < points.count; i++) assert.ok(Number.isFinite(points.getX(i) + points.getY(i) + points.getZ(i)));
    const first = V().fromBufferAttribute(points, 0);
    assert.ok(first.distanceTo(to) < 0.025, 'anchor ring stays attached');
    const last = V().fromBufferAttribute(points, points.count - 1);
    assert.ok(last.distanceTo(from) < 0.025, 'wrist ring stays attached');
    const oldRepeat = mesh.material.map.repeat.y;
    r.env.placeStrand(mesh, from, to.clone().multiplyScalar(1.0001), 0.014, 1);
    assert.ok(Math.abs(mesh.material.map.repeat.y - oldRepeat) < 0.01);
  }
});

test('Station floor details stay within the original walking surface and signs respect line offset', () => {
  const r = runtime(), boxes = [];
  Object.assign(r.env, { UB_DZ: 100, UB_LINIEN: [{ dz: 0 }, { dz: 100 }], SLAB_H: 4,
    cityGroup: new THREE.Group(), ubDeko: (...args) => boxes.push(args),
    canvasTex: () => new THREE.Texture() });
  r.run(section(r, 'const ubSchilder =', 'function ubCollider('));
  r.env.ubBodenMuster(-15, 15, 0.65, 6, -9);
  assert.ok(boxes.length > 50);
  for (const [w, h, d, x, y, z] of boxes) {
    assert.ok(x - w / 2 >= -15 && x + w / 2 <= 15);
    assert.ok(z - d / 2 >= 0.65 && z + d / 2 <= 6);
    assert.ok(y - h / 2 >= -9 && y + h / 2 <= -8.98);
  }
  r.env.ubSchild('U2 · Central', 'Gleis 1', 0, -6, 30, Math.PI, 3, 0.6);
  const group = r.run('ubSchilder'); assert.equal(group.children[0].position.z, 130);
  assert.equal(group.children[0].children[0].rotation.y, Math.PI);
});

test('New enemy bodies accept all core combat clips without missing or invalid bone transforms', () => {
  for (const slot of ['civilian4', 'civilian5']) {
    const r = runtime(), clips = ['idle', 'run', 'punch', 'kick', 'block'].map(n => loadClip(n, 'thug'));
    const v = r.env.makeGlbVisual(model(clips, slot));
    for (const name of ['idle', 'run', 'punch', 'kick', 'block']) {
      assert.ok(v.laborClip(name, 0.45));
      for (const bone of Object.values(v.knochen)) assert.ok(Number.isFinite(bone.getWorldPosition(V()).length()));
    }
    const look = cityRuntime().look;
    for (let i = 0; i < 100; i++) look.dressEnemy(v, i % 2 ? 'duellant' : 'stuermer');
    let count = 0; v.root.traverse(o => { if (o.name === 'EnemyRoleGear') count++; }); assert.equal(count, 1);
  }
});
