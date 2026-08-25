#!/usr/bin/env node
/* =========================================================================
   Bewegungen vom UE4-Mannequin auf das Mixamo-Skelett umrechnen.

   Warum ueberhaupt: Unreal-Projekte bringen ihre Bewegungen auf dem
   UE4-Mannequin mit ("pelvis", "spine_01", "thigh_l", ...). Unsere Figuren
   haben ein Mixamo-Skelett ("mixamorig:Hips", "mixamorig:Spine", ...). Eine
   Bewegungsspur findet ihren Knochen nur bei gleichem Namen - einfach
   umbenennen reicht aber NICHT: die beiden Skelette stehen in
   verschiedenen Ruhehaltungen (Mannequin A-Pose, Mixamo T-Pose) und ihre
   Knochenachsen zeigen in andere Richtungen. Wer nur die Drehungen
   kopiert, bekommt verdrehte Arme und Beine.

   Gerechnet wird ueber die KNOCHENACHSEN. Der erste Versuch ging ueber
   die Ruhehaltung (R_quelle_global · R_quelle_ruhe⁻¹ · R_ziel_ruhe). Das
   ist die uebliche Formel, sie uebertraegt aber nur die BEWEGUNG relativ
   zur jeweiligen Ruhehaltung - und die beiden Ruhehaltungen sind
   verschieden (Mannequin A-Pose, Mixamo T-Pose). Gemessen blieb dadurch
   ein gleichbleibender Fehler von 67 Grad am Oberarm und 88 Grad am
   Unterarm stehen: die Arme standen dauerhaft zu weit aussen.
   Jetzt wird je Knochen eine feste Korrektur A bestimmt, die die
   ZIEL-Knochenachse auf die QUELL-Knochenachse dreht (beide als
   Ruheversatz zum Kindknochen im eigenen System):
     A            = kuerzeste Drehung von u_ziel nach u_quelle
     R_ziel_global(t) = R_quelle_global(t) · A
     R_ziel_lokal(t)  = R_ziel_elternGlobal(t)⁻¹ · R_ziel_global(t)
   Damit zeigt jedes Glied im Ziel in dieselbe Richtung wie in der Quelle,
   unabhaengig davon, wie die beiden Skelette in Ruhe stehen. Die Drehung
   um die Knochenachse (Verwindung) kommt dabei unveraendert mit.

   Aufruf:
     node tools/retarget-ue4.mjs <ue4.fbx|.glb> <ziel.glb> <mixamo-vorlage.glb>
     node tools/retarget-ue4.mjs <ordner> <ausgabeordner> <vorlage.glb>
   ========================================================================= */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { NodeIO, Document } = require('@gltf-transform/core');

const fbxBin = path.join(
  path.dirname(require.resolve('fbx2gltf/package.json')), 'bin',
  os.platform() === 'darwin' ? 'Darwin' : os.platform() === 'win32' ? 'Windows_NT' : 'Linux',
  os.platform() === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF');

/* UE4-Mannequin -> Mixamo. Die Zwilling-Knochen (twist) und die
   IK-Hilfsknochen bleiben weg: sie haben in Mixamo kein Gegenstueck. */
const KARTE = {
  pelvis: 'Hips',
  spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2',
  neck_01: 'Neck', head: 'Head',
  clavicle_l: 'LeftShoulder', upperarm_l: 'LeftArm',
  lowerarm_l: 'LeftForeArm', hand_l: 'LeftHand',
  clavicle_r: 'RightShoulder', upperarm_r: 'RightArm',
  lowerarm_r: 'RightForeArm', hand_r: 'RightHand',
  thigh_l: 'LeftUpLeg', calf_l: 'LeftLeg', foot_l: 'LeftFoot', ball_l: 'LeftToeBase',
  thigh_r: 'RightUpLeg', calf_r: 'RightLeg', foot_r: 'RightFoot', ball_r: 'RightToeBase',
};

/* ---------- kleine Quaternionen-Werkzeuge ---------- */
const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];
/* Kuerzeste Drehung, die a auf b legt (beide normiert). */
const qVon = (a, b) => {
  const d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) {
    /* Gegenrichtung: irgendeine Achse senkrecht zu a. */
    let ax = [1, 0, 0];
    if (Math.abs(a[0]) > 0.9) ax = [0, 1, 0];
    const c = [a[1]*ax[2]-a[2]*ax[1], a[2]*ax[0]-a[0]*ax[2], a[0]*ax[1]-a[1]*ax[0]];
    const l = Math.hypot(...c) || 1;
    return [c[0]/l, c[1]/l, c[2]/l, 0];
  }
  const c = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const q = [c[0], c[1], c[2], 1 + d];
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0]/l, q[1]/l, q[2]/l, q[3]/l];
};
const einheit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0]/l, v[1]/l, v[2]/l]; };
const qRot = (q, v) => {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y,
          iy * w + iw * -y + iz * -x - ix * -z,
          iz * w + iw * -z + ix * -y - iy * -x];
};

/* ---------- glTF einlesen: Hierarchie, Ruhehaltung, Bewegung ---------- */
function leseSkelett(datei) {
  const b = fs.readFileSync(datei);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString());
  let bin = null;
  let off = 20 + jsonLen;
  while (off + 8 <= b.length) {
    const len = b.readUInt32LE(off), typ = b.readUInt32LE(off + 4);
    if (typ === 0x004e4942) { bin = b.slice(off + 8, off + 8 + len); break; }
    off += 8 + len;
  }
  const knoten = json.nodes.map((n, i) => ({
    i, name: n.name || ('n' + i), kinder: n.children || [],
    t: n.translation || [0, 0, 0],
    r: n.rotation || [0, 0, 0, 1],
    s: n.scale || [1, 1, 1],
    matrix: n.matrix || null,
    eltern: -1,
  }));
  for (const k of knoten) for (const c of k.kinder) knoten[c].eltern = k.i;
  const nachName = new Map();
  for (const k of knoten) if (!nachName.has(k.name)) nachName.set(k.name, k);
  return { json, bin, knoten, nachName };
}

/* Werte eines Accessors als Float32Array */
function lies(json, bin, idx) {
  const acc = json.accessors[idx];
  const bv = json.bufferViews[acc.bufferView];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const anz = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
  const out = new Float32Array(acc.count * anz);
  for (let i = 0; i < out.length; i++) out[i] = bin.readFloatLE(start + i * 4);
  return { werte: out, anz, count: acc.count };
}

/* Globale Ruhedrehung eines Knotens */
function ruheGlobal(sk, k) {
  let q = [0, 0, 0, 1];
  const kette = [];
  for (let n = k; n; n = n.eltern >= 0 ? sk.knoten[n.eltern] : null) kette.unshift(n);
  for (const n of kette) q = qMul(q, n.r);
  return q;
}
function ruhePos(sk, k) {
  let p = [0, 0, 0], q = [0, 0, 0, 1];
  const kette = [];
  for (let n = k; n; n = n.eltern >= 0 ? sk.knoten[n.eltern] : null) kette.unshift(n);
  for (const n of kette) {
    const v = qRot(q, n.t);
    p = [p[0] + v[0], p[1] + v[1], p[2] + v[2]];
    q = qMul(q, n.r);
  }
  return p;
}

export function retarget(quellGlb, vorlageGlb) {
  const q = leseSkelett(quellGlb);
  const z = leseSkelett(vorlageGlb);

  /* Zielknochen finden - die Namen koennen "mixamorig:Hips",
     "mixamorigHips" oder "mixamorig1Hips" lauten. */
  const zielKnochen = new Map();   // Mixamo-Kurzname -> Knoten
  for (const k of z.knoten) {
    const m = /^mixamorig\d*:?(.+)$/i.exec(k.name);
    if (m && !zielKnochen.has(m[1])) zielKnochen.set(m[1], k);
  }
  if (!zielKnochen.size) throw new Error('Vorlage hat kein Mixamo-Skelett');

  /* Zeitachse und Drehungen der Quelle je Knoten einsammeln. */
  const anim = (q.json.animations || [])[0];
  if (!anim) throw new Error('keine Bewegung in der Quelle');
  let zeiten = null;
  const spuren = new Map();        // knotenIndex -> {r: [[x,y,z,w],...], t: [...]}
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    const ein = lies(q.json, q.bin, s.input);
    const aus = lies(q.json, q.bin, s.output);
    if (!zeiten || ein.count > zeiten.length) zeiten = Array.from(ein.werte);
    const ziel = ch.target.node;
    if (!spuren.has(ziel)) spuren.set(ziel, {});
    const e = spuren.get(ziel);
    if (ch.target.path === 'rotation') {
      e.r = []; for (let i = 0; i < aus.count; i++) e.r.push(Array.from(aus.werte.slice(i * 4, i * 4 + 4)));
    } else if (ch.target.path === 'translation') {
      e.t = []; for (let i = 0; i < aus.count; i++) e.t.push(Array.from(aus.werte.slice(i * 3, i * 3 + 3)));
    }
  }
  const N = zeiten.length;

  /* Hueftenhoehe beider Skelette - fuer den Massstab der Wurzelbewegung. */
  const qHip = q.nachName.get('pelvis'), zHip = zielKnochen.get('Hips');
  if (!qHip || !zHip) throw new Error('Huefte nicht gefunden');
  const massstab = Math.abs(ruhePos(z, zHip)[1]) / Math.max(1e-6, Math.abs(ruhePos(q, qHip)[1]));

  /* ---- Korrektur je Knochen ----
     u = Richtung zum Kindknochen im eigenen Ruhesystem. Die nehmen wir
     aus dem Ruheversatz des Kindes; Knochen ohne abgebildetes Kind
     (Hand, Fuss, Kopf, Zehe) uebernehmen die Korrektur ihres Elters. */
  const KIND = {};
  for (const [ue] of Object.entries(KARTE)) {
    const kq = q.nachName.get(ue);
    if (!kq) continue;
    for (const ci of kq.kinder) {
      const nm = q.knoten[ci].name;
      if (KARTE[nm]) { KIND[ue] = nm; break; }
    }
  }
  const ruheQ = new Map(), ruheZ = new Map(), korr = new Map();
  for (const [ueName, mxName] of Object.entries(KARTE)) {
    const kq = q.nachName.get(ueName), kz = zielKnochen.get(mxName);
    if (!kq || !kz) continue;
    ruheQ.set(ueName, ruheGlobal(q, kq));
    ruheZ.set(ueName, ruheGlobal(z, kz));
    const kindUe = KIND[ueName];
    if (!kindUe) continue;
    const kqK = q.nachName.get(kindUe), kzK = zielKnochen.get(KARTE[kindUe]);
    if (!kqK || !kzK) continue;
    korr.set(ueName, qVon(einheit(kzK.t), einheit(kqK.t)));
  }
  /* Knochen ohne Kind: Korrektur vom Elter erben. */
  for (const [ueName] of Object.entries(KARTE)) {
    if (korr.has(ueName) || !q.nachName.get(ueName)) continue;
    for (let p = q.nachName.get(ueName).eltern; p >= 0; p = q.knoten[p].eltern) {
      const nm = q.knoten[p].name;
      if (korr.has(nm)) { korr.set(ueName, korr.get(nm)); break; }
    }
    if (!korr.has(ueName)) korr.set(ueName, [0, 0, 0, 1]);
  }

  /* Reihenfolge: Eltern vor Kindern (die Karte ist schon so sortiert,
     zur Sicherheit nach Tiefe im QUELLskelett sortieren). */
  const tiefe = (sk, k) => { let d = 0; for (let n = k; n.eltern >= 0; n = sk.knoten[n.eltern]) d++; return d; };
  const reihe = Object.keys(KARTE)
    .filter((n) => ruheQ.has(n))
    .sort((a, b) => tiefe(q, q.nachName.get(a)) - tiefe(q, q.nachName.get(b)));

  /* Je Bild rechnen. */
  const ausgabe = new Map();       // mixamoName -> {r: [...], t?: [...]}
  for (const n of reihe) ausgabe.set(KARTE[n], { r: [] });
  ausgabe.get('Hips').t = [];

  const globalQ = new Map(), globalZ = new Map();
  for (let f = 0; f < N; f++) {
    globalQ.clear(); globalZ.clear();
    /* Quelle: globale Drehung jedes Knotens (ganze Kette, auch nicht
       abgebildete Knoten wie die Twists - sonst stimmt die Kette nicht). */
    const globalVon = (k) => {
      if (globalQ.has(k.i)) return globalQ.get(k.i);
      const sp = spuren.get(k.i);
      const lokal = sp && sp.r ? sp.r[Math.min(f, sp.r.length - 1)] : k.r;
      const eltern = k.eltern >= 0 ? globalVon(q.knoten[k.eltern]) : [0, 0, 0, 1];
      const g = qMul(eltern, lokal);
      globalQ.set(k.i, g);
      return g;
    };
    for (const n of reihe) {
      const kq = q.nachName.get(n);
      const gQ = globalVon(kq);
      const gZ = qMul(gQ, korr.get(n));
      globalZ.set(KARTE[n], gZ);
      /* Elterndrehung im ZIEL: der naechste abgebildete Vorfahr. */
      let elternG = [0, 0, 0, 1];
      for (let p = kq.eltern; p >= 0; p = q.knoten[p].eltern) {
        const nm = KARTE[q.knoten[p].name];
        if (nm && globalZ.has(nm)) { elternG = globalZ.get(nm); break; }
      }
      ausgabe.get(KARTE[n]).r.push(qMul(qInv(elternG), gZ));
    }
    /* Wurzelbewegung: Verschiebung der Huefte, auf Zielgroesse skaliert. */
    const spH = spuren.get(qHip.i);
    const tH = spH && spH.t ? spH.t[Math.min(f, spH.t.length - 1)] : qHip.t;
    ausgabe.get('Hips').t.push([tH[0] * massstab, tH[1] * massstab, tH[2] * massstab]);
  }

  return { zeiten, ausgabe, praefix: 'mixamorig:' };
}

/* ---------- Ergebnis als GLB schreiben ---------- */
async function schreibe(erg, datei, name) {
  const doc = new Document();
  const puffer = doc.createBuffer();
  const szene = doc.createScene();
  const anim = doc.createAnimation(name);
  const zeit = doc.createAccessor().setType('SCALAR')
    .setArray(new Float32Array(erg.zeiten)).setBuffer(puffer);
  for (const [knochen, spur] of erg.ausgabe) {
    const node = doc.createNode(erg.praefix + knochen);
    szene.addChild(node);
    const rot = doc.createAccessor().setType('VEC4')
      .setArray(new Float32Array(spur.r.flat())).setBuffer(puffer);
    anim.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation')
      .setSampler(anim.addSampler(doc.createAnimationSampler()
        .setInterpolation('LINEAR').setInput(zeit).setOutput(rot)).listSamplers().at(-1)));
    if (spur.t) {
      const tr = doc.createAccessor().setType('VEC3')
        .setArray(new Float32Array(spur.t.flat())).setBuffer(puffer);
      anim.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation')
        .setSampler(anim.addSampler(doc.createAnimationSampler()
          .setInterpolation('LINEAR').setInput(zeit).setOutput(tr)).listSamplers().at(-1)));
    }
  }
  await new NodeIO().write(datei, doc);
}

/* ---------- Aufruf ---------- */
const [ein, aus, vorlage] = process.argv.slice(2);
if (!ein || !aus || !vorlage) {
  console.error('Aufruf: node tools/retarget-ue4.mjs <ein.fbx|ordner> <aus.glb|ordner> <vorlage.glb>');
  process.exit(1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rt-'));
const dateien = fs.statSync(ein).isDirectory()
  ? fs.readdirSync(ein).filter((f) => /\.(fbx|glb)$/i.test(f)).map((f) => path.join(ein, f))
  : [ein];
if (dateien.length > 1) fs.mkdirSync(aus, { recursive: true });
for (const f of dateien) {
  const basis = path.basename(f).replace(/\.(fbx|glb)$/i, '');
  let glb = f;
  if (/\.fbx$/i.test(f)) {
    glb = path.join(tmp, basis + '.glb');
    execFileSync(fbxBin, ['--binary', '--anim-framerate', 'bake30', '--input', f, '--output', glb],
      { stdio: ['ignore', 'ignore', 'ignore'] });
  }
  try {
    const erg = retarget(glb, vorlage);
    const ziel = dateien.length > 1 ? path.join(aus, basis + '.glb') : aus;
    await schreibe(erg, ziel, basis);
    console.log(`✓ ${basis}: ${erg.ausgabe.size} Knochen, ${erg.zeiten.length} Bilder -> ${path.basename(ziel)}`);
  } catch (e) {
    console.warn(`⚠ ${basis}: ${e.message}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
