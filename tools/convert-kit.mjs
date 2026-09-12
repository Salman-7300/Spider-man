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

const args = process.argv.slice(2);
const [kitDir, ziel, ...teile] = args.filter((a) => !a.startsWith('--'));
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

/* Ein fertiges Haus aus dem Baukasten besteht aus rund einem Dutzend
   Teilmeshes, weil es ein Dutzend Materialien benutzt - und jedes
   Teilmesh ist ein eigener Zeichenaufruf. Ueber eine ganze Gegend sind das
   schnell ein paar hundert.
   Mit --sparsam werden deshalb die Materialien zusammengelegt, die man im
   Spiel ohnehin kaum auseinanderhaelt: die vier "FakeInterior" hinter den
   Fenstern werden zu einem, und InteriorFloor, InteriorWall und Glass
   werden zu EINEM dunklen Innenmaterial.
   Zusammenlegen ja - wegwerfen NICHT. Beim ersten Versuch flogen die drei
   heraus, und damit war das Haus eine blosse Huelle: durch die Tuer und
   die Schaufenster sah man quer hindurch auf die Strasse dahinter. Genau
   das war "man kann durch die Haeuser sehen". MI_InteriorWall ist die
   Innenschale ueber die volle Hoehe (1950 Dreiecke bei Building_Large_2) -
   sie ist es, die das Haus schliesst. */
const sparsam = args.includes('--sparsam');
const INNEN = 'MI_Innenraum';
function sparName(name) {
  if (!sparsam) return name;
  if (/FakeInterior/i.test(name)) return 'MI_FakeInterior';
  if (/Interior(Floor|Wall)|^MI_Glass$/i.test(name)) return INNEN;
  return name;
}
function wegwerfen() { return false; }

function holeMaterial(quellMat) {
  const name = sparName(quellMat.getName() || 'material');
  if (matCache.has(name)) return matCache.get(name);
  const m = aus.createMaterial(name);
  m.setRoughnessFactor(1).setMetallicFactor(0);
  /* Der zusammengelegte Innenraum bekommt eine eigene, dunkle Farbe und
     gar keine Textur: er ist nur dazu da, das Haus dicht zu machen, und
     durch Tuer und Scheibe soll man einen dunklen Raum sehen, nicht die
     Backsteintextur der Aussenwand. */
  if (name === INNEN) {
    m.setBaseColorFactor([0.10, 0.10, 0.115, 1]);
    matCache.set(name, m);
    return m;
  }
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
      /* Die Wiederholung MUSS mitkommen. Der Baukasten kachelt seine
         Texturen (UV bis 1,5 und darueber); ohne das gesetzte
         Wiederholen klemmt die Kachelung am Rand fest und aus einer
         Backsteinwand wird eine einfarbig braune Flaeche. Genau so sahen
         die ersten eingebauten Haeuser aus. */
      ni.setWrapS(info.getWrapS());
      ni.setWrapT(info.getWrapT());
      ni.setMagFilter(info.getMagFilter());
      ni.setMinFilter(info.getMinFilter());
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
  /* Alle Primitive eines Teils kommen in EIN Mesh - egal aus wie vielen
     Quellmeshes sie stammen. Vorher ueberschrieb jedes Quellmesh das
     vorige, und bei mehreren blieb nur das letzte uebrig. */
  const neu = aus.createMesh(name);
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const qm0 = prim.getMaterial();
      if (qm0 && wegwerfen(qm0.getName() || '')) continue;   // derzeit nichts
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
      if (qm0) p.setMaterial(holeMaterial(qm0));
      neu.addPrimitive(p);
    }
  }
  knoten.setMesh(neu);
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
