#!/usr/bin/env node
/* =========================================================================
   Macht Teile aus einem Modellbaukasten (Quaternius "Downtown City
   MegaKit", CC0) spielfertig.

   Der Baukasten kommt als 336 einzelne glTF-Dateien mit PBR-Texturen:
   Grundfarbe, Normalen und ORM, je 1 bis 9 MB gross. Das Spiel zeichnet
   mit MeshLambert - Normalen- und ORM-Karten kann es gar nicht benutzen,
   und einzelne Dateien waeren einzelne Ladevorgaenge.

   Dieses Werkzeug sammelt deshalb die gewuenschten Teile in EINE GLB-Datei,
   jedes Teil als eigener benannter Knoten. Normalen- und ORM-Karten fliegen
   raus, die Grundfarbe wird auf 512 px als JPEG gerechnet. Aus rund 90 MB
   werden so ein paar hundert Kilobyte.

   Aufruf:
     node tools/convert-kit.mjs <kit-ordner> <ausgabe.glb> Teil1 Teil2 ...
   ========================================================================= */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { NodeIO, Document } = require('@gltf-transform/core');
const { prune, dedup, textureCompress, weld } = require('@gltf-transform/functions');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* dann ohne Verkleinern */ }

const [kitDir, ziel, ...teile] = process.argv.slice(2);
if (!kitDir || !ziel || !teile.length) {
  console.error('Aufruf: node tools/convert-kit.mjs <kit-ordner> <ausgabe.glb> Teil1 Teil2 ...');
  process.exit(1);
}

const io = new NodeIO();
const aus = new Document();
const szene = aus.createScene('kit');
/* glTF verlangt einen Puffer, in dem alle Zahlenreihen liegen. Ohne ihn
   bricht das Schreiben ab, sobald die erste Zahlenreihe entsteht. */
const puffer = aus.createBuffer();
/* Materialien werden ueber ihren Namen geteilt: die meisten Teile des
   Baukastens benutzen dieselben paar Materialien. */
const matCache = new Map();
const texCache = new Map();

function holeMaterial(quellMat) {
  const name = quellMat.getName() || 'material';
  if (matCache.has(name)) return matCache.get(name);
  const m = aus.createMaterial(name);
  m.setRoughnessFactor(1).setMetallicFactor(0);
  m.setBaseColorFactor(quellMat.getBaseColorFactor());
  const t = quellMat.getBaseColorTexture();
  if (t) {
    const tn = t.getName() || t.getURI() || name;
    let neu = texCache.get(tn);
    if (!neu) {
      neu = aus.createTexture(tn)
        .setImage(t.getImage())
        .setMimeType(t.getMimeType());
      texCache.set(tn, neu);
    }
    m.setBaseColorTexture(neu);
    const info = quellMat.getBaseColorTextureInfo();
    if (info) {
      const ni = m.getBaseColorTextureInfo();
      ni.setTexCoord(info.getTexCoord());
    }
  }
  matCache.set(name, m);
  return m;
}

let gefunden = 0;
for (const name of teile) {
  const datei = path.join(kitDir, `${name}.gltf`);
  if (!fs.existsSync(datei)) {
    console.warn(`⚠ ${name}: nicht im Baukasten gefunden – übersprungen.`);
    continue;
  }
  const doc = await io.read(datei);
  const knoten = aus.createNode(name);
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    const neu = aus.createMesh(name);
    for (const prim of mesh.listPrimitives()) {
      const p = aus.createPrimitive();
      /* Nur die Attribute uebernehmen, die das Spiel zeichnet: Lage,
         Normale und die erste UV. TANGENT und die zweiten UV braucht
         MeshLambert nicht und sie kosten nur Platz. */
      for (const attr of ['POSITION', 'NORMAL', 'TEXCOORD_0']) {
        const a = prim.getAttribute(attr);
        if (!a) continue;
        p.setAttribute(attr, aus.createAccessor(attr).setBuffer(puffer)
          .setType(a.getType()).setArray(a.getArray()));
      }
      const idx = prim.getIndices();
      if (idx) {
        p.setIndices(aus.createAccessor('idx').setBuffer(puffer).setType('SCALAR').setArray(idx.getArray()));
        tris += idx.getCount() / 3;
      } else {
        tris += prim.getAttribute('POSITION').getCount() / 3;
      }
      const qm = prim.getMaterial();
      if (qm) p.setMaterial(holeMaterial(qm));
      neu.addPrimitive(p);
    }
    knoten.setMesh(neu);
  }
  szene.addChild(knoten);
  gefunden++;
  console.log(`  + ${name}  ${Math.round(tris)} Dreiecke`);
}

if (!gefunden) { console.error('Kein einziges Teil gefunden.'); process.exit(1); }

if (sharp) {
  await aus.transform(textureCompress({
    encoder: sharp, targetFormat: 'jpeg', quality: 80, resize: [512, 512],
  }));
}
await aus.transform(weld(), dedup(), prune());
await io.write(ziel, aus);
console.log(`\n✓ ${gefunden} Teile → ${ziel}  ` +
            `${(fs.statSync(ziel).size / 1024).toFixed(0)} kB  ` +
            `${texCache.size} Textur(en), ${matCache.size} Material(ien)`);
