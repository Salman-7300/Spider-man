#!/usr/bin/env node
/* =========================================================================
   Eine Bewegung aus einem Unreal-Projekt (.uasset) in eine GLB-Datei mit
   dem UE4-Skelett schreiben. Das Ergebnis sieht aus wie ein FBX-Export und
   geht anschliessend durch tools/retarget-ue4.mjs auf das Mixamo-Skelett.

   Warum ueberhaupt: Unreal legt Bewegungen nur als .uasset ab, und die
   oeffnet sonst nur Unreal selbst. Die Rohdaten stehen darin aber
   UNKOMPRIMIERT (RawAnimationData) - die lassen sich lesen.

   Achsen: gemessen, nicht geraten. Die Ruhehaltung des Skeletts wurde mit
   der eines FBX-Exports desselben Skeletts verglichen; von allen 48
   Vorzeichen-Vertauschungen passt (x, z, -y) mit Zentimeter->Meter. Das
   ist eine Drehung um -90 Grad um die X-Achse, also eine echte Drehung -
   Drehungen lassen sich damit einfach umkonjugieren.

   Aufruf:
     node tools/uasset-zu-glb.mjs <skelett.uasset> <anim.uasset|ordner> <ziel>
   ========================================================================= */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { leseSkelett, leseBewegung } from './uasset-lesen.mjs';

const require = createRequire(import.meta.url);
const { NodeIO, Document } = require('@gltf-transform/core');

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qInv = (q) => [-q[0], -q[1], -q[2], q[3]];

/* Drehung um -90 Grad um X. */
const H = Math.SQRT1_2;
const M = [-H, 0, 0, H];
const Mi = qInv(M);
/* Ein Punkt: (x, y, z) -> (x, z, -y), dazu Zentimeter in Meter. */
const punkt = (t) => [t[0] * 0.01, t[2] * 0.01, -t[1] * 0.01];
/* Eine Drehung im selben Basiswechsel. */
const dreh = (q) => qMul(qMul(M, q), Mi);

export function baueQuelle(skelettDatei, animDatei) {
  const sk = leseSkelett(skelettDatei);
  const an = leseBewegung(animDatei);
  const nachName = new Map(sk.map((k, i) => [k.name, i]));

  /* Bilder: gleichmaessig ueber die Laufzeit, auf 30 Bilder je Sekunde. */
  const dauer = Math.max(1 / 30, an.dauer || 1);
  const bilder = Math.max(2, Math.round(dauer * 30));
  const zeiten = [];
  for (let f = 0; f < bilder; f++) zeiten.push((f / (bilder - 1)) * dauer);

  /* Je Knochen die Bilder aus der passenden Spur holen. */
  const spurFuer = new Map();
  an.knochen.forEach((nm, i) => spurFuer.set(nm, an.spuren[i]));

  const knochen = sk.map((k) => {
    const sp = spurFuer.get(k.name);
    const rot = [], pos = [];
    for (let f = 0; f < bilder; f++) {
      if (!sp) { rot.push(dreh(k.r)); pos.push(punkt(k.t)); continue; }
      /* Der Rohdatensatz kann viel feiner sein als 30 Bilder je Sekunde
         (gemessen bis 799 Schluessel auf 0,63 s). Abgetastet wird nach
         Anteil, nicht nach Bildnummer. */
      const anteil = bilder > 1 ? f / (bilder - 1) : 0;
      const ri = sp.rot.length ? Math.min(sp.rot.length - 1, Math.round(anteil * (sp.rot.length - 1))) : -1;
      const pi = sp.pos.length ? Math.min(sp.pos.length - 1, Math.round(anteil * (sp.pos.length - 1))) : -1;
      rot.push(ri >= 0 ? dreh(sp.rot[ri]) : dreh(k.r));
      pos.push(pi >= 0 ? punkt(sp.pos[pi]) : punkt(k.t));
    }
    return { name: k.name, eltern: k.eltern, ruheR: dreh(k.r), ruheT: punkt(k.t), rot, pos };
  });
  return { knochen, zeiten, name: an.name, nachName };
}

async function schreibe(q, datei) {
  const doc = new Document();
  const puffer = doc.createBuffer();
  const szene = doc.createScene();
  const anim = doc.createAnimation(q.name);
  const zeit = doc.createAccessor().setType('SCALAR')
    .setArray(new Float32Array(q.zeiten)).setBuffer(puffer);
  const knoten = q.knochen.map((k) => doc.createNode(k.name)
    .setTranslation(k.ruheT).setRotation(k.ruheR));
  q.knochen.forEach((k, i) => {
    if (k.eltern >= 0) knoten[k.eltern].addChild(knoten[i]); else szene.addChild(knoten[i]);
  });
  q.knochen.forEach((k, i) => {
    const rot = doc.createAccessor().setType('VEC4')
      .setArray(new Float32Array(k.rot.flat())).setBuffer(puffer);
    anim.addChannel(doc.createAnimationChannel().setTargetNode(knoten[i]).setTargetPath('rotation')
      .setSampler(anim.addSampler(doc.createAnimationSampler()
        .setInterpolation('LINEAR').setInput(zeit).setOutput(rot)).listSamplers().at(-1)));
    /* Verschiebung nur an der Wurzel und der Huefte - sonst zerrt es das
       Skelett auseinander, wenn eine Spur nur einen Schluessel hat. */
    if (k.eltern < 0 || q.knochen[k.eltern].eltern < 0) {
      const tr = doc.createAccessor().setType('VEC3')
        .setArray(new Float32Array(k.pos.flat())).setBuffer(puffer);
      anim.addChannel(doc.createAnimationChannel().setTargetNode(knoten[i]).setTargetPath('translation')
        .setSampler(anim.addSampler(doc.createAnimationSampler()
          .setInterpolation('LINEAR').setInput(zeit).setOutput(tr)).listSamplers().at(-1)));
    }
  });
  await new NodeIO().write(datei, doc);
}

const [skDatei, ein, aus] = process.argv.slice(2);
if (!skDatei || !ein || !aus) {
  console.error('Aufruf: node tools/uasset-zu-glb.mjs <skelett.uasset> <anim.uasset|ordner> <ziel>');
  process.exit(1);
}
const dateien = fs.statSync(ein).isDirectory()
  ? fs.readdirSync(ein).filter((f) => f.endsWith('.uasset')).map((f) => path.join(ein, f))
  : [ein];
if (dateien.length > 1) fs.mkdirSync(aus, { recursive: true });
let gut = 0, schlecht = 0;
for (const f of dateien) {
  const basis = path.basename(f, '.uasset');
  try {
    const q = baueQuelle(skDatei, f);
    const ziel = dateien.length > 1 ? path.join(aus, basis + '.glb') : aus;
    await schreibe(q, ziel);
    console.log(`✓ ${basis}: ${q.knochen.length} Knochen, ${q.zeiten.length} Bilder`);
    gut++;
  } catch (e) {
    console.warn(`⚠ ${basis}: ${e.message}`);
    schlecht++;
  }
}
console.log(`\n${gut} umgewandelt, ${schlecht} uebersprungen.`);
