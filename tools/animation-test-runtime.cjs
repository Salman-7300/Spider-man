'use strict';
// Rendererlose Pruefung der ECHTEN game.js-Funktionen mit dem Heldenrig.
// Kein Ersatz fuer Sichtpruefung, Eingabetest oder Kampagnenregression.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');
const { readGLB } = require('./create-glide-animation.cjs');
const root = path.resolve(__dirname, '..');
vm.runInNewContext(fs.readFileSync(path.join(root, 'lib/SkeletonUtils.js'), 'utf8'), { THREE, console });
const normalize = n => n.replace(/^mixamorig\d*:?/i, 'mixamorig').replace(/_\d+(?=\.|$)/, '');

function array(source, index) {
  const a = source.json.accessors[index], v = source.json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.sparse) throw new Error('Float-Spur erwartet');
  const size = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const offset = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || size * 4;
  const out = [];
  for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out.push(source.bin.readFloatLE(offset + i * stride + k * 4));
  return out;
}

function loadClip(name, slot = 'hero') {
  const source = readGLB(path.join(root, 'assets/' + slot + '@' + name + '.glb'));
  const animation = source.json.animations[0], tracks = [];
  for (const channel of animation.channels) {
    const target = channel.target;
    const n = normalize(source.json.nodes[target.node].name);
    // Dieselben Filter wie loadCompanionClips im Spiel.
    if (target.path === 'translation' || /hand(thumb|index|middle|ring|pinky)\d/i.test(n)) continue;
    const s = animation.samplers[channel.sampler];
    const suffix = { rotation: 'quaternion', scale: 'scale' }[target.path];
    const Track = target.path === 'rotation' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    tracks.push(new Track(n + '.' + suffix, array(source, s.input), array(source, s.output)));
  }
  return new THREE.AnimationClip(name, -1, tracks);
}

function model(clips, slot = 'hero') {
  const { json } = readGLB(path.join(root, 'assets/' + slot + '.glb'));
  const joints = new Set(json.skins.flatMap(s => s.joints));
  const nodes = json.nodes.map((n, i) => {
    const o = joints.has(i) ? new THREE.Bone() : new THREE.Group();
    o.name = joints.has(i) ? normalize(n.name || '') : (n.name || '');
    if (n.matrix) new THREE.Matrix4().fromArray(n.matrix).decompose(o.position, o.quaternion, o.scale);
    else {
      if (n.translation) o.position.fromArray(n.translation);
      if (n.rotation) o.quaternion.fromArray(n.rotation);
      if (n.scale) o.scale.fromArray(n.scale);
    }
    return o;
  });
  json.nodes.forEach((n, i) => (n.children || []).forEach(k => nodes[i].add(nodes[k])));
  const scene = new THREE.Group();
  json.scenes[json.scene || 0].nodes.forEach(i => scene.add(nodes[i]));
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  scene.traverse(o => { if (o.isBone) { o.getWorldPosition(p); box.expandByPoint(p); } });
  const scale = 1.76 / (box.max.y - box.min.y), center = box.getCenter(new THREE.Vector3());
  return { scene, clips, scale, yOffset: -box.min.y, xOffset: -center.x, zOffset: -center.z, yaw: 0 };
}

function runtime(source = fs.readFileSync(path.join(root, 'game.js'), 'utf8')) {
  function between(start, end) {
    const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error('Testausschnitt fehlt: ' + start);
    return source.slice(a, b);
  }
  const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), onGround: false, state: 'air' };
  const env = {
    THREE, console, Math, Set, Map, player,
    clamp: (v, a, b) => Math.min(b, Math.max(a, v)), lerp: (a, b, t) => a + (b - a) * t,
    V3: (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z),
    CFG: { sprintSpeed: 11 }, dist2: 0, WAND_RUHE_T: 0, LOD_WEITE: 130, ZIELE_ALT: false,
    WANDLAUF_CLIP: 'run', KLETTER_CLIP: 'kriechen',
    EINST: { maus: 100, autokam: 'aus' }, mouseDX: 0, mouseDY: 0, touchAktiv: false,
    KAT: { aktiv: false }, groundY: () => 0, ORIGIN: -175, PITCH: 50, colliderGrid: new Map(),
    camera: new THREE.PerspectiveCamera(70, 16 / 9, 0.1, 1000),
    sun: { position: new THREE.Vector3(), target: new THREE.Object3D() },
    SONNE_RICHTUNG: new THREE.Vector3(1, 1, 0).normalize(), kamTelemetrie: () => {},
    rand: () => 0, dampAngle: (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t,
    _v1: new THREE.Vector3(), _v2: new THREE.Vector3(), _v3: new THREE.Vector3(),
  };
  const context = vm.createContext(env);
  vm.runInContext([
    between('const GANG_REF =', 'const GLB_ANIM_PARTS ='),
    between('const ANGRIFF_FENSTER =', 'const GLB_CLIP_PATTERNS ='),
    between('const GLB_CLIP_PATTERNS =', '/* ---- Netz-Kostüm:'),
    between('function makeGlbVisual(', 'function makeProceduralVisual('),
    between('let camYaw =', '/* Bodenhöhe unter einem einzelnen Fuß'),
  ].join('\n'), context);
  return { env, context, makeVisual: (names) => env.makeGlbVisual(model(names.map(name => loadClip(name)))),
           run: code => vm.runInContext(code, context), source };
}
module.exports = { runtime, model, loadClip, array, THREE, root };
