'use strict';
// Harte Kompatibilitaetspruefung der Prototypen gegen die Produktionsdateien (nur lesend).
// node art/blender-nextgen/tools/compat-test.cjs  -> reports/compat-test.json, Exit-Code 1 bei Fehler
const fs = require('node:fs');
const path = require('node:path');
const { readGLB } = require('../../../tools/create-glide-animation.cjs');
const root = path.resolve(__dirname, '../../..');
const ng = (p) => path.join(root, 'art/blender-nextgen', p);
const as = (p) => path.join(root, 'assets', p);
const norm = (n) => (n || '').replace(/^mixamorig\d*:?/i, 'mixamorig').replace(/_\d+(?=\.|$)/, '');
const finger = /hand(thumb|index|middle|ring|pinky)\d/i;
const res = { checks: [], ok: true };
const check = (name, pass, detail) => { res.checks.push({ name, pass, detail }); if (!pass) res.ok = false; };

function accData(g, i) {
  const a = g.json.accessors[i], v = g.json.bufferViews[a.bufferView];
  const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const size = { 5126: 4, 5123: 2, 5125: 4, 5121: 1 }[a.componentType];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || n * size;
  const out = Buffer.alloc(a.count * n * size);
  for (let k = 0; k < a.count; k++) g.bin.copy(out, k * n * size, start + k * stride, start + k * stride + n * size);
  return out;
}
function floats(g, i) { const b = accData(g, i); return Array.from({ length: b.length / 4 }, (_, k) => b.readFloatLE(k * 4)); }
function clipLocals(file, which) {
  const g = readGLB(file), a = g.json.animations[0], out = {};
  for (const ch of a.channels) {
    if (ch.target.path !== 'rotation') continue;
    const n = norm(g.json.nodes[ch.target.node].name);
    if (finger.test(n)) continue;
    const s = a.samplers[ch.sampler], v = floats(g, s.output);
    const k = which === 'last' ? v.length / 4 - 1 : 0;
    out[n] = v.slice(k * 4, k * 4 + 4);
  }
  return out;
}
const ang = (p, q) => 2 * Math.acos(Math.min(1, Math.abs(p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3]))) * 180 / Math.PI;
function maxAng(A, B) { let m = 0, worst = null; for (const k in A) if (B[k]) { const d = ang(A[k], B[k]); if (d > m) { m = d; worst = k; } } return { deg: +m.toFixed(4), worst }; }

// ---- Held: alles ausser Linsenpositionen identisch
{
  const o = readGLB(as('hero.glb')), n = readGLB(ng('exports/webhero-nextgen-v1.glb'));
  check('hero: gleiche Knotenanzahl und -namen', JSON.stringify(o.json.nodes.map((x) => x.name)) === JSON.stringify(n.json.nodes.map((x) => x.name)));
  check('hero: Knoten-Transformationen identisch', JSON.stringify(o.json.nodes.map((x) => [x.rotation, x.translation, x.scale, x.matrix, x.children]))
    === JSON.stringify(n.json.nodes.map((x) => [x.rotation, x.translation, x.scale, x.matrix, x.children])));
  check('hero: Skin (Gelenke, Skelettwurzel) identisch', JSON.stringify(o.json.skins.map((s) => [s.joints, s.skeleton])) === JSON.stringify(n.json.skins.map((s) => [s.joints, s.skeleton])));
  const ibmSame = accData(o, o.json.skins[0].inverseBindMatrices).equals(accData(n, n.json.skins[0].inverseBindMatrices));
  check('hero: inverse Bind-Matrizen bytegleich', ibmSame);
  const lens = new Set([3, 4].map((m) => n.json.meshes[m].primitives[0].attributes.POSITION));
  const diff = [];
  n.json.meshes.forEach((m, mi) => m.primitives.forEach((p, pi) => {
    const op = o.json.meshes[mi].primitives[pi];
    for (const [k, ai] of Object.entries(p.attributes)) {
      if (lens.has(ai)) continue;
      if (!accData(o, op.attributes[k]).equals(accData(n, ai))) diff.push(mi + ':' + k);
    }
    if (!accData(o, op.indices).equals(accData(n, p.indices))) diff.push(mi + ':indices');
  }));
  check('hero: Geometrie, UV, Gewichte, Gelenkindizes bytegleich (ausser Linsenform)', diff.length === 0, diff);
  res.hero = { trisOld: o.json.meshes.reduce((s, m) => s + o.json.accessors[m.primitives[0].indices].count / 3, 0),
    images: n.json.images.map((i) => i.mimeType), bytesOld: fs.statSync(as('hero.glb')).size, bytesNew: fs.statSync(ng('exports/webhero-nextgen-v1.glb')).size };
}
// ---- Enforcer gegen thug
{
  const o = readGLB(as('thug.glb')), n = readGLB(ng('exports/enemy-armored-enforcer-v1.glb'));
  const on = o.json.skins[0].joints.map((j) => norm(o.json.nodes[j].name)), nn = n.json.skins[0].joints.map((j) => norm(n.json.nodes[j].name));
  check('enforcer: gleiche Gelenkmenge wie thug', JSON.stringify([...on].sort()) === JSON.stringify([...nn].sort()), { old: on.length, new: nn.length });
  const R = (g) => Object.fromEntries(g.json.skins[0].joints.map((j) => [norm(g.json.nodes[j].name), g.json.nodes[j].rotation || [0, 0, 0, 1]]));
  const d = maxAng(R(o), R(n));
  check('enforcer: Ruhe-Rotationen wie thug (< 0,1 Grad)', d.deg < 0.1, d);
}
// ---- Animationsprototypen: Spiel-Werte exakt getroffen
{
  const t0 = clipLocals(ng('animations/enemy-threat-taunt-v1.glb'), 'first'), tl = clipLocals(ng('animations/enemy-threat-taunt-v1.glb'), 'last');
  const idle = clipLocals(as('thug@idle.glb'), 'first');
  const a = maxAng(idle, t0), b = maxAng(idle, tl);
  check('taunt: erstes Bild = thug@idle Bild 0 (< 0,5 Grad)', a.deg < 0.5, a);
  check('taunt: letztes Bild = thug@idle Bild 0 (< 0,5 Grad)', b.deg < 0.5, b);
  const thug = readGLB(as('thug.glb')); const rigNames = new Set(thug.json.skins[0].joints.map((j) => norm(thug.json.nodes[j].name)));
  const missing = Object.keys(t0).filter((k) => !rigNames.has(k));
  check('taunt: nur Knochen, die das Rig kennt', missing.length === 0, missing);
  const l0 = clipLocals(ng('animations/webhero-landing-pose-v1.glb'), 'first'), ll = clipLocals(ng('animations/webhero-landing-pose-v1.glb'), 'last');
  const hidle = clipLocals(as('hero@idle.glb'), 'first'), hfall = clipLocals(as('hero@fall.glb'), 'first');
  const c = maxAng(hidle, ll);
  check('landing: letztes Bild = hero@idle Bild 0 (< 0,5 Grad)', c.deg < 0.5, c);
  const body = Object.keys(hidle);
  check('landing: steuert alle 22 Koerperknochen', body.every((k) => k in l0), body.filter((k) => !(k in l0)));
}
fs.writeFileSync(ng('reports/compat-test.json'), JSON.stringify(res, null, 1));
for (const c of res.checks) console.log((c.pass ? 'OK   ' : 'FAIL ') + c.name + (c.pass ? '' : '  ' + JSON.stringify(c.detail)));
process.exit(res.ok ? 0 : 1);
