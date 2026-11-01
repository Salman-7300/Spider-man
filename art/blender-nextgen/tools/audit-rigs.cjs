'use strict';
// Rig-/Clip-Audit: liest die echten GLB-Dateien, keine Annahmen.
// node art/blender-nextgen/tools/audit-rigs.cjs > art/blender-nextgen/reports/rig-audit.json
const fs = require('node:fs');
const path = require('node:path');
const { readGLB } = require('../../../tools/create-glide-animation.cjs');
const root = path.resolve(__dirname, '../../..');
const norm = n => (n || '').replace(/^mixamorig\d*:?/i, 'mixamorig').replace(/_\d+(?=\.|$)/, '');
const finger = /hand(thumb|index|middle|ring|pinky)\d/i;

function rig(file) {
  const { json } = readGLB(file);
  // Alle Skins vereinigen (civilian hat mehrere); ohne Skin (reine Clip-Datei) zaehlen alle benannten Knoten.
  const joints = json.skins && json.skins.length ? [...new Set(json.skins.flatMap(s => s.joints))]
    : json.nodes.map((n, i) => i).filter(i => /mixamorig/i.test(json.nodes[i].name || ''));
  const skins = (json.skins || []).length;
  const rest = {};
  for (const j of joints) {
    const n = json.nodes[j];
    rest[norm(n.name)] = { r: n.rotation || [0, 0, 0, 1], t: n.translation || [0, 0, 0], s: n.scale || [1, 1, 1] };
  }
  const parent = {};
  json.nodes.forEach((n, i) => (n.children || []).forEach(c => { parent[c] = i; }));
  const hierarchy = joints.map(j => [norm(json.nodes[j].name), parent[j] !== undefined ? norm(json.nodes[parent[j]].name) : null]);
  return { skins, joints: joints.length, names: Object.keys(rest), rest, hierarchy,
    meshes: (json.meshes || []).length, materials: (json.materials || []).length,
    textures: (json.textures || []).length, images: (json.images || []).length };
}
function clip(file) {
  const { json } = readGLB(file);
  const a = (json.animations || [])[0];
  if (!a) return null;
  let dur = 0;
  const targets = new Map();
  for (const ch of a.channels) {
    const n = norm(json.nodes[ch.target.node].name);
    if (!targets.has(n)) targets.set(n, new Set());
    targets.get(n).add(ch.target.path);
    const inp = json.accessors[a.samplers[ch.sampler].input];
    dur = Math.max(dur, (inp.max || [0])[0]);
  }
  const restOfClipRig = rig(file).rest;
  return { name: a.name, clips: json.animations.length, duration: +dur.toFixed(3),
    channels: a.channels.length, bones: [...targets.keys()], restOfClipRig,
    translationBones: [...targets].filter(([, p]) => p.has('translation')).map(([n]) => n) };
}
const qdot = (a, b) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
const out = { models: {}, clips: {} };
for (const m of ['hero', 'thug', 'civilian', 'civilian2']) {
  const f = path.join(root, 'assets', m + '.glb');
  const r = rig(f);
  out.models[m] = { skins: r.skins, file: 'assets/' + m + '.glb', bytes: fs.statSync(f).size, joints: r.joints,
    meshes: r.meshes, materials: r.materials, textures: r.textures, images: r.images,
    hierarchy: r.hierarchy };
  out.models[m]._rest = r.rest;
}
const wanted = { hero: ['idle', 'walk', 'run', 'sprint', 'jump', 'land', 'swing', 'klettern', 'klettern_seit', 'gleiten',
  'punch', 'kick', 'roll', 'fall', 'schwungpose', 'zip_zug', 'wandlauf', 'kante', 'uppercut', 'hit', 'luftangriff',
  'sturzflug', 'sturzland', 'schwungland'],
  thug: ['idle', 'walk', 'run', 'punch', 'kick', 'block', 'hit', 'fall', 'ausweichenL', 'ausweichenR', 'taunt', 'uppercut'] };
for (const [slot, list] of Object.entries(wanted)) {
  const model = out.models[slot];
  for (const c of list) {
    const f = path.join(root, 'assets', `${slot}@${c}.glb`);
    if (!fs.existsSync(f)) { out.clips[`${slot}@${c}`] = { missing: true }; continue; }
    const k = clip(f);
    if (!k) { out.clips[`${slot}@${c}`] = { noAnimation: true }; continue; }
    const used = k.bones.filter(b => !finger.test(b));
    const missingOnModel = used.filter(b => !model._rest[b]);
    // Rest-Abweichung: Spur setzt lokale Rotation absolut -> Rest des Clip-Rigs muss zum Modell passen.
    let worst = 0, worstBone = null;
    for (const b of used) {
      if (!model._rest[b] || !k.restOfClipRig[b]) continue;
      const ang = 2 * Math.acos(Math.min(1, qdot(model._rest[b].r, k.restOfClipRig[b].r))) * 180 / Math.PI;
      if (ang > worst) { worst = ang; worstBone = b; }
    }
    out.clips[`${slot}@${c}`] = { bytes: fs.statSync(f).size, glbClipName: k.name, duration: k.duration,
      channels: k.channels, bonesAnimated: used.length, fingerBonesAnimated: k.bones.length - used.length,
      bonesMissingOnModel: missingOnModel, translationBones: k.translationBones,
      restDeltaMaxDeg: +worst.toFixed(2), restDeltaBone: worstBone };
  }
}
for (const m of Object.values(out.models)) delete m._rest;
// Namensvergleich hero vs thug
out.nameDiff = {};
for (const [a, b] of [['hero', 'thug'], ['thug', 'civilian'], ['hero', 'civilian2']]) {
  const A = new Set(out.models[a].hierarchy.map(h => h[0])), B = new Set(out.models[b].hierarchy.map(h => h[0]));
  out.nameDiff[a + '-' + b] = { onlyA: [...A].filter(x => !B.has(x)), onlyB: [...B].filter(x => !A.has(x)) };
}
process.stdout.write(JSON.stringify(out, null, 1));
