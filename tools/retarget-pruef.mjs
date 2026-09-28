#!/usr/bin/env node
/* Prueft eine Umrechnung: zeigen dieselben Gliedmassen in beiden Skeletten
   in dieselbe Richtung? Verglichen werden Richtungen, nicht Drehungen -
   nur die sieht man am Ende auch. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);

const qMul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
const qRot = (q, v) => {
  const [x,y,z,w] = q, [vx,vy,vz] = v;
  const ix = w*vx + y*vz - z*vy, iy = w*vy + z*vx - x*vz;
  const iz = w*vz + x*vy - y*vx, iw = -x*vx - y*vy - z*vz;
  return [ix*w + iw*-x + iy*-z - iz*-y, iy*w + iw*-y + iz*-x - ix*-z, iz*w + iw*-z + ix*-y - iy*-x];
};
function glb(datei) {
  const b = fs.readFileSync(datei);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jl).toString());
  let bin = null, off = 20 + jl;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), typ = b.readUInt32LE(off + 4);
    if (typ === 0x004e4942) { bin = b.slice(off + 8, off + 8 + len); break; }
    off += 8 + len;
  }
  const kn = json.nodes.map((n, i) => ({ i, name: n.name || ('n'+i), kinder: n.children || [],
    t: n.translation || [0,0,0], r: n.rotation || [0,0,0,1], eltern: -1 }));
  for (const k of kn) for (const c of k.kinder) kn[c].eltern = k.i;
  return { json, bin, kn, nach: new Map(kn.map(k => [k.name, k])) };
}
function lies(json, bin, idx) {
  const acc = json.accessors[idx], bv = json.bufferViews[acc.bufferView];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const anz = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4 }[acc.type];
  const out = new Float32Array(acc.count * anz);
  for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE(start + i*4);
  return { werte: out, anz, count: acc.count };
}
function spurenVon(d) {
  const anim = (d.json.animations || [])[0];
  const m = new Map();
  if (!anim) return m;
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler], aus = lies(d.json, d.bin, s.output);
    if (!m.has(ch.target.node)) m.set(ch.target.node, {});
    const e = m.get(ch.target.node);
    if (ch.target.path === 'rotation') { e.r = []; for (let i=0;i<aus.count;i++) e.r.push(Array.from(aus.werte.slice(i*4,i*4+4))); }
    if (ch.target.path === 'translation') { e.t = []; for (let i=0;i<aus.count;i++) e.t.push(Array.from(aus.werte.slice(i*3,i*3+3))); }
  }
  return m;
}
/* Globale Position und Drehung aller Knoten in Bild f */
function fk(d, spuren, f) {
  const pos = new Map(), rot = new Map();
  const rechne = (k) => {
    if (pos.has(k.i)) return;
    let pp = [0,0,0], pr = [0,0,0,1];
    if (k.eltern >= 0) { rechne(d.kn[k.eltern]); pp = pos.get(k.eltern); pr = rot.get(k.eltern); }
    const sp = spuren.get(k.i);
    const lr = sp && sp.r ? sp.r[Math.min(f, sp.r.length-1)] : k.r;
    const lt = sp && sp.t ? sp.t[Math.min(f, sp.t.length-1)] : k.t;
    const v = qRot(pr, lt);
    pos.set(k.i, [pp[0]+v[0], pp[1]+v[1], pp[2]+v[2]]);
    rot.set(k.i, qMul(pr, lr));
  };
  for (const k of d.kn) rechne(k);
  return { pos, rot };
}
const norm = (v) => { const l = Math.hypot(...v) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const winkel = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0]*b[0]+a[1]*b[1]+a[2]*b[2]))) * 180 / Math.PI;

const [quellDatei, zielDatei, vorlageDatei] = process.argv.slice(2);
const q = glb(quellDatei), zA = glb(zielDatei), v = glb(vorlageDatei);
/* Zielskelett = Vorlage (Ruhehaltung) + Bewegung aus zielDatei, nach NAMEN
   verbunden. */
const kurz = (n) => (/^mixamorig\d*:?(.+)$/i.exec(n) || [0, n])[1];
const vNach = new Map(v.kn.map(k => [kurz(k.name), k]));
const zSpuren = new Map();
{
  const roh = spurenVon(zA);
  for (const [idx, e] of roh) {
    const name = kurz(zA.kn[idx].name);
    const zielK = vNach.get(name);
    if (zielK) zSpuren.set(zielK.i, e);
  }
}
const qSpuren = spurenVon(q);
/* Paare: Knochen -> Kind, in beiden Skeletten */
const PAARE = [
  ['upperarm_l', 'lowerarm_l', 'LeftArm', 'LeftForeArm'],
  ['lowerarm_l', 'hand_l', 'LeftForeArm', 'LeftHand'],
  ['upperarm_r', 'lowerarm_r', 'RightArm', 'RightForeArm'],
  ['thigh_l', 'calf_l', 'LeftUpLeg', 'LeftLeg'],
  ['calf_l', 'foot_l', 'LeftLeg', 'LeftFoot'],
  ['thigh_r', 'calf_r', 'RightUpLeg', 'RightLeg'],
  ['spine_01', 'spine_03', 'Spine', 'Spine2'],
  ['neck_01', 'head', 'Neck', 'Head'],
];
const anim = (q.json.animations || [])[0];
const N = lies(q.json, q.bin, anim.samplers[0].input).count;
const je = new Map(PAARE.map(p => [p[2], []]));
for (let f = 0; f < N; f++) {
  const A = fk(q, qSpuren, f), B = fk(v, zSpuren, f);
  for (const [qa, qb, za, zb] of PAARE) {
    const ka = q.nach.get(qa), kb = q.nach.get(qb);
    const la = vNach.get(za), lb = vNach.get(zb);
    if (!ka || !kb || !la || !lb) continue;
    const dq = norm([A.pos.get(kb.i)[0]-A.pos.get(ka.i)[0], A.pos.get(kb.i)[1]-A.pos.get(ka.i)[1], A.pos.get(kb.i)[2]-A.pos.get(ka.i)[2]]);
    const dz = norm([B.pos.get(lb.i)[0]-B.pos.get(la.i)[0], B.pos.get(lb.i)[1]-B.pos.get(la.i)[1], B.pos.get(lb.i)[2]-B.pos.get(la.i)[2]]);
    je.get(za).push(winkel(dq, dz));
  }
}
let gesamt = [];
for (const [name, liste] of je) {
  if (!liste.length) { console.log(name.padEnd(14), '-'); continue; }
  const mittel = liste.reduce((a,b)=>a+b,0)/liste.length;
  const max = Math.max(...liste);
  gesamt = gesamt.concat(liste);
  console.log(name.padEnd(14), 'Mittel', mittel.toFixed(1) + '°', ' Max', max.toFixed(1) + '°');
}
console.log('---- gesamt Mittel', (gesamt.reduce((a,b)=>a+b,0)/gesamt.length).toFixed(1) + '°',
            ' Max', Math.max(...gesamt).toFixed(1) + '°');
