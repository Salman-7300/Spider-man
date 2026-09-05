'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, model, loadClip, THREE } = require('./animation-test-runtime.cjs');
const { cityRuntime } = require('./city-test-runtime.cjs');
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const pos = (v, n) => v.knochen[n].getWorldPosition(V());

for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  test(`Wall running contacts translated facades, not just the origin (${nx},${nz})`, () => {
    for (const plane of [-125, -42, 37, 148]) {
      const r = runtime(), v = r.makeVisual(['idle', 'run', 'kriechen']);
      v.root.rotation.y = Math.atan2(-nx, -nz);
      v.root.position.set(nx ? plane + nx * 0.52 : 19, 20, nz ? plane + nz * 0.52 : -17);
      const normal = V(nx, 0, nz);
      for (let i = 0; i < 90; i++) {
        r.env.player.pos.copy(v.root.position);
        v.play('climb', { wandModus: 'lauf', wandKriechen: true, wandKontakt: true, tempo: 1.4, speed: 0 }, 1 / 60);
        v.wandKriechen(1, 0.3, 0, true, true, 1 / 60);
        v.root.position.addScaledVector(normal, plane * (nx || nz) + 0.52 - pos(v, 'hips').dot(normal));
        v.poseWandSprint(nx, nz, plane, i * 0.10, 0, 1);
        if (i < 25) continue;
        for (const side of ['left', 'right']) {
          const distance = pos(v, side + 'foot').dot(normal) - plane * (nx || nz);
          assert.ok(distance > 0.03 && distance < 0.27, 'foot contact distance ' + distance);
          assert.ok(pos(v, side + 'foot').y < pos(v, 'hips').y - 0.10, 'legs do not extend sideways at hip height');
        }
      }
    }
  });
  test(`Climb cycles, stop and reverse keep limbs outside a translated facade (${nx},${nz})`, () => {
    const r = runtime(), v = r.makeVisual(['idle', 'kriechen', 'run']), plane = -63;
    const normal = V(nx, 0, nz), right = V(-nz, 0, nx);
    v.root.rotation.y = Math.atan2(-nx, -nz);
    v.root.position.set(nx ? plane + nx * 0.26 : 0, 20, nz ? plane + nz * 0.26 : 0);
    let previous = null, maxStep = 0;
    for (let i = 0; i < 480; i++) {
      const velocity = i < 120 ? V(0, 2.6, 0) : i < 180 ? V() : i < 300 ? right.clone().multiplyScalar(4.4) : V(0, -2.6, 0);
      v.root.position.addScaledVector(velocity, 1 / 60);
      r.env.player.pos.copy(v.root.position);
      v.play('climb', { wandModus: 'kriechen', wandKriechen: true, wandKontakt: true, tempo: velocity.length(), speed: 0 }, 1 / 60);
      assert.equal(v.aktuellerClip, 'idle', 'prone clip must not fight the contact pose');
      v.wandKriechen(1, 0.3, 0, false, true, 1 / 60);
      v.root.position.addScaledVector(normal, plane * (nx || nz) + 0.26 - pos(v, 'hips').dot(normal));
      v.poseWandKontakt(nx, nz, plane, velocity, 1 / 60, 1);
      const now = {};
      for (const name of ['lefthand', 'righthand', 'leftfoot', 'rightfoot', 'leftleg', 'rightleg']) {
        const p = pos(v, name), depth = p.dot(normal) - plane * (nx || nz);
        assert.ok(Number.isFinite(p.length()) && depth >= 0.015 && depth < 0.8, name + ' at ' + depth);
        now[name] = p.clone().sub(v.root.position);
        if (previous && i > 30) maxStep = Math.max(maxStep, now[name].distanceTo(previous[name]));
      }
      assert.ok(pos(v, 'head').y > pos(v, 'hips').y + 0.4);
      previous = now;
    }
    assert.ok(maxStep < 0.19, 'contact reset produces a large step: ' + maxStep);
  });
}

test('Perch is wider, supports the roof and retains a stable narrow variant', () => {
  for (const narrow of [0, 1]) {
    const v = runtime().makeVisual(['idle']);
    for (let i = 0; i < 90; i++) { v.play('idle', { speed: 0 }, 1 / 60); v.poseKauern(1, narrow); v.hockeAusgleich(0.35); }
    const span = pos(v, 'leftfoot').distanceTo(pos(v, 'rightfoot'));
    assert.ok(narrow ? span < 0.30 : span > 0.55);
    assert.ok(Math.min(pos(v, 'lefthand').y, pos(v, 'righthand').y) < 0.10, 'support hand reaches the roof');
    for (const n of ['leftfoot', 'rightfoot', 'leftleg', 'rightleg']) assert.ok(pos(v, n).y > 0.035);
  }
});

for (const speed of [2, 7, 11]) test('Gait uses bounded cadence and continuous foot release at ' + speed + ' m/s', () => {
  const r = runtime(), v = r.makeVisual(['idle', 'walk', 'run', 'sprint', 'sprint_lang']);
  let previous = null, previousClip = null, maxStep = 0, maxClipStep = 0;
  for (let i = 0; i < 420; i++) {
    const speedNow = i < 300 ? speed : speed * Math.max(0, 1 - (i - 300) / 60);
    v.root.position.z += speedNow / 60;
    r.env.player.pos.copy(v.root.position);
    v.play(speedNow > 0.1 ? 'run' : 'idle', { speed: speedNow, gang: speedNow > 8 ? 'sprint' : speedNow > 3 ? 'run' : 'walk' }, 1 / 60);
    v.bodenAusgleich(0.02); v.fussIK(() => 0, 0.85, 0, 1);
    const clipFoot = pos(v, 'leftfoot').sub(v.root.position);
    if (previousClip && i > 30) maxClipStep = Math.max(maxClipStep, clipFoot.distanceTo(previousClip));
    previousClip = clipFoot;
    v.gangKontakt(V(0, 0, speedNow), 1 / 60, () => 0);
    const p = pos(v, 'leftfoot').sub(v.root.position);
    if (previous && i > 30) maxStep = Math.max(maxStep, p.distanceTo(previous)); previous = p;
    assert.ok(pos(v, 'leftfoot').y > -0.025 && pos(v, 'rightfoot').y > -0.025);
    if (i === 180 && speed > 5.8) { assert.equal(v.aktuellerClip, 'sprint_lang'); assert.ok(v.laufInfo().faktor <= 1.65); }
  }
  // A fast sprint's authored swing foot already travels >20 cm/frame.
  // Contact release must not introduce a larger jump than that real clip.
  assert.ok(maxStep <= maxClipStep + 0.015, 'contact adds a snap: ' + maxStep + ' vs clip ' + maxClipStep);
});

test('Ambulance factory retains EMS light, wheel and driver references within its collider', () => {
  const r = cityRuntime(), g = r.look.createAmbulance(), car = { mesh: g, typ: { art: 'rtw', laenge: 5.4, breite: 2.1 } };
  assert.equal(g.userData.blaulicht.children.length, 2); assert.ok(g.userData.fahrerSitz);
  r.look.updateCar(g, 12, 0.05); r.look.updateCar(g, 0, 0.05);
  assert.equal(g.userData.cityMotion.brake.color.getHex(), 0xff4038);
  for (const yaw of [0, 0.37, Math.PI / 2, 2.4]) {
    g.rotation.y = yaw; const box = new THREE.Box3().setFromObject(g), hull = r.carAABB(car);
    assert.ok(hull.x0 <= box.min.x + 0.001 && hull.x1 >= box.max.x - 0.001);
    assert.ok(hull.z0 <= box.min.z + 0.001 && hull.z1 >= box.max.z - 0.001);
    assert.ok(Math.abs(hull.top - box.max.y) < 0.02);
  }
});
test('Bus aisle and all seat leg spaces are hollow; people fit below the ceiling', () => {
  const r = cityRuntime(), bus = r.look.createBus({ art: 'bus', laenge: 9.5, breite: 2.4 }, 0x3b7a3f);
  bus.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(V(0, 1.4, -1), V(0, -1, 0));
  const floor = ray.intersectObject(bus, true)[0]; assert.ok(floor && Math.abs(floor.point.y - 0.578) < 0.03);
  for (const [i, pl] of bus.userData.sitzplaetze.entries()) {
    const slot = ['civilian', 'civilian2', 'civilian3', 'civilian4', 'civilian5'][i % 5];
    const v = runtime().env.makeGlbVisual(model([loadClip('idle', 'civilian')], slot));
    v.root.scale.setScalar(pl.scale); v.root.position.set(pl.x, 0, pl.z);
    v.play('idle', { speed: 0 }, 1 / 60); v.poseSitzen(1, undefined, !!pl.fahrer);
    v.root.position.y += pl.y - v.sitzMasse().huefte;
    assert.ok(pos(v, 'head').y < 2.32 && pos(v, 'head').y > 1.65);
    for (const side of ['left', 'right']) {
      assert.ok(pos(v, side + 'foot').y > pl.floor, 'feet through bus floor');
      const foot = pos(v, side + 'foot');
      const wall = new THREE.Raycaster(foot, V(0, 1, 0)).intersectObject(bus.getObjectByName('BusShell'));
      assert.ok(wall.length && wall[0].point.y > 2.4, 'passenger legs inside body box');
    }
  }
});
test('Tree templates share immutable geometry and park paths stay open around the fountain', () => {
  const look = cityRuntime().look, variants = [];
  for (let i = 0; i < 4; i++) {
    const a = look.createTree(i), b = look.createTree(i); variants.push(a.children[1].geometry);
    assert.equal(a.children[0].geometry, b.children[0].geometry);
    assert.equal(a.children[1].geometry, b.children[1].geometry);
    assert.ok(a.userData.trunk.height > 4);
  }
  assert.equal(new Set(variants).size, 4);
  const park = look.createPark(38), box = new THREE.Box3().setFromObject(park);
  assert.ok(box.min.x >= -19.01 && box.max.x <= 19.01 && box.min.z >= -19.01 && box.max.z <= 19.01);
  for (const c of park.userData.solids.slice(1)) {
    assert.ok(Math.min(Math.abs(c.x0), Math.abs(c.x1)) > 1.8);
    assert.ok(Math.min(Math.abs(c.z0), Math.abs(c.z1)) > 1.8);
  }
});
