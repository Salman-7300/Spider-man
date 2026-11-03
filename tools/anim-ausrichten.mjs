#!/usr/bin/env node
/* =========================================================================
   Eine Bewegungsdatei im Raum ausrichten.

   Warum ueberhaupt: Die Wandbewegungen aus dem Unreal-Projekt sind NICHT
   alle gleich ausgerichtet. Gemessen an Huefte, Kopf und Schultern zeigt

     LowCrawl_F   Kopf nach +X, Bauch nach +Y   (liegt auf dem Ruecken)
     LowCrawl_L   Kopf nach +Z, Bauch nach +X
     LowCrawl_R   Kopf nach -Z, Bauch nach -X

   In Unreal macht das nichts: dort wird die ganze Figur an die Wand
   gedreht, und jede dieser Dateien bringt ihre Drehung selbst mit. Bei uns
   kippt die Figur immer gleich (siehe wandKriechen in game.js), und dann
   klebt sie mal mit dem Ruecken an der Fassade, mal quer.

   Hier wird jede Datei auf DIESELBE Ausgangslage gedreht:
     Kopf nach vorn (+Z), Bauch nach unten (-Y)
   also flach auf dem Bauch liegend, Kopf in Bewegungsrichtung - genauso
   wie die Kriechbewegung, mit der die Wandkippung im Spiel gebaut wurde.

   Gedreht wird die WURZELSPUR (Hips): eine Drehung davor dreht die ganze
   Figur, weil alle anderen Knochen an ihr haengen. Die Verschiebungsspur
   wird mitgedreht, sonst laeuft die Figur in die alte Richtung davon.

   Aufruf:
     node tools/anim-ausrichten.mjs <ein.glb> <aus.glb> <qx> <qy> <qz> <qw>
   Das Quaternion liefert die Messung im Browser (scratchpad: ausricht.js).
   ========================================================================= */
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
/* Punkt mit einem Quaternion drehen. */
function drehePunkt(q, p) {
  const [x, y, z, w] = q;
  const ix = w * p[0] + y * p[2] - z * p[1];
  const iy = w * p[1] + z * p[0] - x * p[2];
  const iz = w * p[2] + x * p[1] - y * p[0];
  const iw = -x * p[0] - y * p[1] - z * p[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

const [ein, aus, ...zahlen] = process.argv.slice(2);
if (!ein || !aus || zahlen.length < 4) {
  console.error('Aufruf: anim-ausrichten.mjs <ein.glb> <aus.glb> <qx> <qy> <qz> <qw>');
  process.exit(1);
}
const Q = zahlen.slice(0, 4).map(Number);

const io = new NodeIO();
const doc = await io.read(ein);
const anims = doc.getRoot().listAnimations();
if (!anims.length) throw new Error('keine Bewegung in ' + ein);

/* Die Wurzel der Bewegung ist der Knoten, dessen Vorfahren keine eigene
   Drehspur haben - bei unseren Dateien immer die Huefte. */
const gedreht = new Set();
for (const anim of anims) {
  for (const ch of anim.listChannels()) {
    const knoten = ch.getTargetNode();
    /* Nur die Huefte wird gedreht. Alle anderen Knochen haengen an ihr,
       ihre Drehungen sind relativ und bleiben unveraendert. (Ueber die
       Elternkette zu gehen ist hier nicht verlaesslich - je nach Version
       kennt der Knoten seinen Elternknoten nicht.) */
    if (!/hips$/i.test(knoten.getName())) continue;
    const pfad = ch.getTargetPath();
    const abtaster = ch.getSampler();
    const werte = abtaster.getOutput();
    const feld = Array.from(werte.getArray());
    if (pfad === 'rotation') {
      for (let i = 0; i < feld.length; i += 4) {
        const r = qMul(Q, [feld[i], feld[i + 1], feld[i + 2], feld[i + 3]]);
        feld[i] = r[0]; feld[i + 1] = r[1]; feld[i + 2] = r[2]; feld[i + 3] = r[3];
      }
      gedreht.add(knoten.getName() + '.rotation');
    } else if (pfad === 'translation') {
      for (let i = 0; i < feld.length; i += 3) {
        const r = drehePunkt(Q, [feld[i], feld[i + 1], feld[i + 2]]);
        feld[i] = r[0]; feld[i + 1] = r[1]; feld[i + 2] = r[2];
      }
      gedreht.add(knoten.getName() + '.translation');
    } else continue;
    werte.setArray(new Float32Array(feld));
  }
}
await io.write(aus, doc);
console.log(`${ein} -> ${aus}: ${[...gedreht].join(', ')}`);
