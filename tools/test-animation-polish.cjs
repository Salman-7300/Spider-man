'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runtime, loadClip, THREE, root } = require('./animation-test-runtime.cjs');
const { buildGlide } = require('./create-glide-animation.cjs');
const V = (x, y, z) => new THREE.Vector3(x, y, z);

for (const mode of ['laufend', 'zeitNull', 'pausiert', 'endpose', 'teilweise']) {
  test('Sichtbare Pose blendet stetig aus: ' + mode, () => {
    const { env } = runtime();
    const object = new THREE.Object3D(), mixer = new THREE.AnimationMixer(object);
    const clip = new THREE.AnimationClip('pose', 1, [new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [10, 10])]);
    const action = mixer.clipAction(clip).play(); mixer.update(0.1);
    if (mode === 'zeitNull') action.timeScale = 0;
    if (mode === 'pausiert') action.paused = true;
    if (mode === 'endpose') { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; mixer.update(2); }
    if (mode === 'teilweise') { action.fadeIn(0.4); mixer.update(0.1); }
    const before = object.position.x;
    env.blendeAus(action, 0.22); mixer.update(1 / 60);
    assert.ok(object.position.x > before * 0.8 && object.position.x < before);
    mixer.update(0.25); assert.ok(Math.abs(object.position.x) < 1e-6);
  });
}

test('Inaktive und zukuenftige Posen tragen kein Gewicht bei', () => {
  const { env } = runtime();
  const mixer = new THREE.AnimationMixer(new THREE.Object3D());
  const action = mixer.clipAction(new THREE.AnimationClip('pose', 1, []));
  assert.equal(env.gewichtVon(action), 0);
  action.startAt(2).play(); assert.equal(env.gewichtVon(action), 0);
  action.stop(); assert.equal(env.gewichtVon(action), 0);
  action.play(); action.enabled = false; assert.equal(env.gewichtVon(action), 0);
});

test('Bremsen behaelt Schritte bis zum Stillstand und flattert nicht', () => {
  const { env } = runtime();
  let anim = 'run';
  for (const speed of [7, 3, 0.5, 0.39, 0.18]) {
    assert.ok(env.hatBodenbewegung(speed, anim));
    anim = 'run';
  }
  assert.equal(env.hatBodenbewegung(0.1, anim), false);
  assert.equal(env.hatBodenbewegung(0.2, 'idle'), false);
  assert.ok(env.hatBodenbewegung(0.5, 'idle'));
});

test('Duckstand haelt den echten Clip an, Weiterlaufen setzt ihn fort', () => {
  const r = runtime(), visual = r.makeVisual(['ducken', 'idle', 'walk', 'run']);
  for (let i = 0; i < 90; i++) visual.play('duckstand', { speed: 0 }, 1 / 60);
  const a = visual.laufStand();
  assert.equal(a.clip, 'ducken'); assert.equal(a.ts, 0); assert.equal(a.t, 0.42);
  visual.play('run', { speed: 1.5, ducken: true, gang: 'ducken' }, 1 / 60);
  assert.ok(visual.laufStand().ts > 0);
});

test('Gleitclip ist reproduzierbar, bewegt und schliesst ohne Sprung', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'webhero-glide-'));
  try {
    const data = buildGlide(path.join(root, 'assets/hero@sturzflug.glb'), path.join(temp, 'glide.glb'));
    assert.ok(data.equals(fs.readFileSync(path.join(root, 'assets/hero@gleiten.glb'))));
    const clip = loadClip('gleiten'); assert.equal(clip.duration, 3);
    let moving = 0;
    for (const track of clip.tracks) {
      const first = new THREE.Quaternion().fromArray(track.values, 0);
      const last = new THREE.Quaternion().fromArray(track.values, track.values.length - 4);
      assert.deepEqual(first.toArray(), last.toArray());
      let changed = false;
      for (let i = 0; i < track.values.length; i += 4) {
        const q = new THREE.Quaternion().fromArray(track.values, i);
        assert.ok(Math.abs(q.length() - 1) < 0.000001);
        if (first.angleTo(q) > 0.005) changed = true;
      }
      if (changed) moving++;
    }
    assert.ok(moving >= 14);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('Gleitpose bei Gewicht null aendert keinen Knochen', () => {
  const r = runtime(), visual = r.makeVisual(['gleiten', 'idle']);
  visual.laborClip('gleiten', 0.3);
  const before = Object.fromEntries(Object.entries(visual.knochen).map(([k, b]) => [k, b.quaternion.clone()]));
  visual.poseGleiten(0.4, 0.7, 1, 0, 18);
  for (const [k, q] of Object.entries(before)) assert.deepEqual(visual.knochen[k].quaternion.toArray(), q.toArray());
});

test('Gleiten reagiert auf Kurven und laesst den Kopf weich los', () => {
  const r = runtime(), visual = r.makeVisual(['gleiten', 'idle']);
  visual.laborClip('gleiten', 0.3);
  const head = visual.knochen.head.quaternion.clone();
  visual.poseGleiten(0.2, 0.8, 1, 0.001, 18);
  assert.ok(head.angleTo(visual.knochen.head.quaternion) < 0.01);
  visual.laborClip('gleiten', 0.3); visual.poseGleiten(0.2, -0.8, 1, 0.9, 18);
  const left = visual.knochen.leftleg.quaternion.clone();
  visual.laborClip('gleiten', 0.3); visual.poseGleiten(0.2, 0.8, 1, 0.9, 18);
  assert.ok(left.angleTo(visual.knochen.leftleg.quaternion) > 0.01);
});

test('Exakte Kamerastrecke trifft duennes Hindernis zwischen alten Stichproben', () => {
  const { env } = runtime();
  const c = { x0: 1.12, x1: 1.14, z0: -1, z1: 1, h: 5 };
  const t = env.kameraKastenTreffer(V(0, 2, 0), V(12, 2, 0), c, 0.3);
  assert.ok(Math.abs(t * 12 - 0.82) < 1e-8);
  assert.equal(env.kameraKastenTreffer(V(0, 7, 0), V(12, 7, 0), c, 0.3), 1);
  assert.equal(env.kameraKastenTreffer(V(0, 2, 0), V(12, 2, 0), { ...c, y0: 3 }, 0.3), 1);
});

test('Kamera erfasst Rastergrenzen und bleibt vor der Fassade', () => {
  const { env } = runtime();
  env.colliderGrid.set('4,3', [{ x0: 25.2, x1: 25.22, z0: -2, z1: 2, h: 8 }]);
  const from = V(24, 2, 0), to = V(29, 2, 0);
  env.begrenzeKamera(from, to);
  assert.ok(to.x < 24.9 && to.x > 24);
});

test('Endgueltige Kamera ist auch nach Glaettung und Shake frei', () => {
  const r = runtime(), { env } = r;
  env.player.pos.set(0, 0, 0);
  env.colliderGrid.set('3,3', [{ x0: -1, x1: 1, z0: 2, z1: 2.05, h: 6 }]);
  env.rand = () => 1;
  r.run('camYaw = 0; camPitch = 0; camPos.set(0, 2, 8); camShake = 0.5;');
  env.updateCamera(1 / 60);
  assert.ok(env.camera.position.z < 1.7);
  assert.ok(Number.isFinite(env.camera.position.length()));
});

test('Kamera respektiert Boden und Dach-Untergrenze', () => {
  const { env } = runtime();
  const p = V(0, -4, 4); env.begrenzeKamera(V(0, 2, 0), p); assert.ok(p.y >= 0.3);
  env.player.onGround = true; env.player.pos.y = 20;
  const roof = V(0, 18, 4); env.begrenzeKamera(V(0, 21.7, 0), roof); assert.ok(roof.y >= 20.35);
});
