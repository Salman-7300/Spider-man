#!/usr/bin/env node
/* =========================================================================
   Qualitaets-Pass, Paket 2: Fassadenbilder der Haeusermodelle in der
   GEMESSENEN Aufloesung aus den Originalen neu rechnen.

   convert-haeuser.mjs hat jede Grundfarbe pauschal auf 256 x 256 JPEG
   (Qualitaet 74) verkleinert. Die Originale (Release build-1,
   brownstone-building-set-low-poly-model.zip und
   downtown-buildings-set-low-poly-model.zip, Ordner textures/) haben
   2048 x 2048, einige 1024. Im Spiel ergab das, gemessen mit der
   Texeldichte je Dreieck (Bildpunkte je Meter, flaechengewichtet ueber
   alle Haeuser, Keim 4711): waagrecht 10 bis 58, senkrecht nur 3,5 bis
   21 px/m - die prozeduralen Fassaden liegen bei 213. Die Spielkamera
   (72 Grad, 720 Zeilen) zeigt auf 10 m Abstand 2 cm je Bildpunkt, also
   braucht eine Fassade dort rund 50 px/m, um scharf zu sein.

   Deshalb NICHT alles auf 2048, sondern je Bild und je ACHSE die kleinste
   Zweierpotenz, mit der die gemessene Dichte 41 px/m (85 % von 48)
   erreicht - waagrecht hoechstens 1024, senkrecht 2048 nur dort, wo 1024
   unter 24 px/m bliebe (Downtown_Facade_FLR_8 auf ModernOffice_2: die
   Modelle sind senkrecht gestreckt). Bilder ohne Eintrag (Modelle, die
   in keiner Stadt stehen: ClassicOffice, ArtDeco, ModernOffice_4/5)
   bleiben, wie sie sind.

   Die Geometrie bleibt Byte fuer Byte gleich - davon haengen die
   Tiefenkarten der Kletterhaut und alle Kollider ab. Das Werkzeug prueft
   das selbst und bricht sonst ab. Ebenso prueft es, dass jedes Original
   wirklich das Bild ist, das heute verkleinert im Modell steckt
   (mittlere Abweichung nach dem Verkleinern).

   Aufruf (aus tools/):
     node haeuser-texturen.mjs <quellordner> [ein.glb] [aus.glb]
   ========================================================================= */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const sharp = require('sharp');

/* Name, Breite, Hoehe - dahinter die gemessene Dichte vorher -> nachher
   (px/m waagrecht/senkrecht). */
const ZIEL = [
  ['Downtown_Facade_FLR_8', 1024, 2048],           // 10.5/3.5  -> 42/28
  ['Downtown_Facade_FLR_6', 1024, 1024],           // 11.2/11.8 -> 45/47
  ['Downtown_Facade_FLR_2', 512, 1024],            // 26.9/12.9 -> 54/52
  ['Downtown_Facade_FLR_7', 512, 1024],            // 28.3/13.0 -> 57/52
  ['Downtown_Firstfloor_FLR_2', 512, 1024],        // 22.3/13.4 -> 45/54
  ['Downtown_Firstfloortrim_FLR_1', 512, 1024],    // 14.8/13.9 -> 59/56
  ['Downtown_Concrete_FLR_1', 256, 1024],          // 51.4/19.0 -> 51/76
  ['Downtown_Modern_Firstfloor_FLR_1', 256, 1024], // 58.5/13.7 -> 59/55
  ['Brownstone_Facade_Flr_1', 512, 1024],          // 24.4/15.6 -> 49/62
  ['Brownstone_Facade_Flr_2', 512, 1024],          // 27.8/16.4 -> 56/66
  ['Brownstone_Facade_Flr_3', 512, 1024],          // 22.0/14.1 -> 44/56
  ['Brownstone_Facade_Flr_5', 1024, 1024],         // 19.8/13.1 -> 79/52
  ['Brownstone_Facade_Flr_6', 512, 1024],          // 34.4/18.3 -> 69/73
  ['Brownstone_Facade_FLR_7', 512, 512],           // 31.9/23.8 -> 64/48
  ['Brownstone_Firstfloor_1', 512, 512],           // 36.1/21.4 -> 72/43
  ['Brownstone_Wall_1', 128, 512],                 // 52.4/26.9 -> 52/54
];
const QUALITAET = 84;
const HOECHSTE_ABWEICHUNG = 10;      // mittlere Abweichung je Kanal, 0..255

const [quellOrdner, ein = '../assets/haeuser.glb', aus = ein] = process.argv.slice(2);
if (!quellOrdner) {
  console.error('Aufruf: node haeuser-texturen.mjs <quellordner> [ein.glb] [aus.glb]');
  process.exit(1);
}
const quellen = fs.readdirSync(quellOrdner);
const quelleZu = (name) => quellen.find((f) => f.replace(/\.(jpe?g|png)$/i, '').toLowerCase() === (name + '_dif').toLowerCase());

function geometrieHash(doc) {
  const h = createHash('sha256');
  for (const mesh of doc.getRoot().listMeshes()) {
    h.update(mesh.getName());
    for (const p of mesh.listPrimitives()) {
      for (const sem of p.listSemantics()) { h.update(sem); h.update(Buffer.from(p.getAttribute(sem).getArray().buffer)); }
      const i = p.getIndices(); if (i) h.update(Buffer.from(i.getArray().buffer));
      h.update(p.getMaterial() ? p.getMaterial().getName() : '-');
    }
  }
  for (const n of doc.getRoot().listNodes()) { h.update(n.getName()); h.update(JSON.stringify(n.getMatrix())); }
  return h.digest('hex');
}

async function abweichung(a, b, w, h) {
  const [x, y] = await Promise.all([a, b].map((buf) => sharp(buf).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer()));
  let s = 0;
  for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]);
  return s / x.length;
}

const io = new NodeIO();
const doc = await io.read(ein);
const vorher = geometrieHash(doc);
let summeAlt = 0, summeNeu = 0;
for (const tex of doc.getRoot().listTextures()) {
  const name = tex.getName().replace(/_[Dd]if\.(jpe?g|png)$/, '');
  const alt = Buffer.from(tex.getImage());
  const meta = await sharp(alt).metadata();
  summeAlt += alt.length;
  const z = ZIEL.find((e) => e[0] === name);
  if (!z) { summeNeu += alt.length; console.log('  =', name.padEnd(34), meta.width + 'x' + meta.height, 'bleibt'); continue; }
  const datei = quelleZu(name);
  if (!datei) throw new Error('Original fehlt: ' + name);
  const roh = fs.readFileSync(path.join(quellOrdner, datei));
  const q = await sharp(roh).metadata();
  if (z[1] > q.width || z[2] > q.height) throw new Error(name + ': Ziel groesser als das Original');
  const abw = await abweichung(roh, alt, meta.width, meta.height);
  if (abw > HOECHSTE_ABWEICHUNG) throw new Error(name + ': Original passt nicht (Abweichung ' + abw.toFixed(1) + ')');
  const neu = await sharp(roh).resize(z[1], z[2], { fit: 'fill', kernel: 'lanczos3' })
    .jpeg({ quality: QUALITAET, mozjpeg: true }).toBuffer();
  tex.setImage(new Uint8Array(neu)).setMimeType('image/jpeg');
  summeNeu += neu.length;
  console.log('  +', name.padEnd(34), meta.width + 'x' + meta.height, '->', (z[1] + 'x' + z[2]).padEnd(9),
    (neu.length / 1024).toFixed(0).padStart(4) + ' KB', ' Abweichung zum alten Bild', abw.toFixed(1));
}
const nachher = geometrieHash(doc);
if (nachher !== vorher) throw new Error('Geometrie veraendert - nichts geschrieben');
await io.write(aus, doc);
console.log('Geometrie unveraendert (' + vorher.slice(0, 16) + ')');
console.log('Bilder', (summeAlt / 1024).toFixed(0), 'KB ->', (summeNeu / 1024).toFixed(0), 'KB; Datei', (fs.statSync(aus).size / 1048576).toFixed(2), 'MB');
