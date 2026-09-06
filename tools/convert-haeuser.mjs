#!/usr/bin/env node
/* =========================================================================
   Haeusersaetze spielfertig machen.

   Die beiden Saetze ("Brownstone Building Set", "Downtown Buildings Set")
   kommen als FBX mit je rund 40 Texturen: Grundfarbe, Rauheit, Spiegelung
   und Hoehenkarte. Das Spiel zeichnet mit MeshLambert - alles ausser der
   Grundfarbe kann es gar nicht benutzen.

   Dieses Werkzeug
     - sucht die gewuenschten Gebaeude ueber ihren Namen (die Saetze legen
       ein Gebaeude als mehrere Teile ab: "..._1", "..._2", ...),
     - rechnet die Knotenverschiebungen in die Eckpunkte hinein,
     - legt jedes Gebaeude in einen EINHEITSWUERFEL: Grundflaeche
       -0,5..0,5, Hoehe 0..1, Ursprung in der Mitte des Grundrisses.
       Im Spiel genuegt dann scale.set(breite, hoehe, tiefe),
     - wirft alle Karten ausser der Grundfarbe weg und rechnet diese auf
       256 Pixel JPEG.

   Aufruf:
     node tools/convert-haeuser.mjs <ziel.glb> <quelle.glb>:<Name>,<Name>...
   ========================================================================= */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { NodeIO, Document } = require('@gltf-transform/core');
const { prune, dedup, textureCompress } = require('@gltf-transform/functions');
let sharp = null;
try { sharp = require('sharp'); } catch (e) { /* dann ohne Verkleinern */ }

const args = process.argv.slice(2);
const ziel = args[0];
if (!ziel || args.length < 2) {
  console.error('Aufruf: node tools/convert-haeuser.mjs <ziel.glb> <quelle.glb>:Name,Name ...');
  process.exit(1);
}

const io = new NodeIO();
const aus = new Document();
const ausSzene = aus.createScene('haeuser');
const ausBuf = aus.createBuffer();
const matKarte = new Map();          // Quellmaterial -> Zielmaterial

/* Weltmatrix eines Knotens (die Saetze nutzen nur Verschiebung/Skalierung,
   trotzdem wird sauber ueber die volle Matrix gerechnet). */
function weltMatrix(node) {
  const m = node.getWorldMatrix ? node.getWorldMatrix() : null;
  if (m) return m;
  return null;
}

function mulPunkt(m, x, y, z) {
  return [ m[0] * x + m[4] * y + m[8] * z + m[12],
           m[1] * x + m[5] * y + m[9] * z + m[13],
           m[2] * x + m[6] * y + m[10] * z + m[14] ];
}

async function holeMaterial(quelle) {
  if (matKarte.has(quelle)) return matKarte.get(quelle);
  const m = aus.createMaterial(quelle.getName() || 'mat');
  m.setRoughnessFactor(1).setMetallicFactor(0);
  const bc = quelle.getBaseColorTexture();
  if (bc) {
    const t = aus.createTexture(bc.getName() || 'tex')
      .setImage(bc.getImage()).setMimeType(bc.getMimeType());
    m.setBaseColorTexture(t);
    const info = quelle.getBaseColorTextureInfo();
    if (info) m.getBaseColorTextureInfo().setTexCoord(info.getTexCoord());
  }
  const f = quelle.getBaseColorFactor();
  if (f) m.setBaseColorFactor(f);
  matKarte.set(quelle, m);
  return m;
}

for (const eintrag of args.slice(1)) {
  const i = eintrag.lastIndexOf(':');
  const datei = eintrag.slice(0, i);
  const namen = eintrag.slice(i + 1).split(',').filter(Boolean);
  const doc = await io.read(datei);
  const wurzel = doc.getRoot();
  /* Weltmatrizen brauchen eine Szene - die Saetze haengen alles flach
     unter den Wurzelknoten. */
  for (const basis of namen) {
    /* Alle Teile dieses Gebaeudes einsammeln. */
    const teile = [];
    for (const node of wurzel.listNodes()) {
      const n = node.getName() || '';
      if (n !== basis && !new RegExp('^' + basis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '_\\d+$').test(n)) continue;
      const mesh = node.getMesh();
      if (!mesh) continue;
      teile.push({ node, mesh });
    }
    if (!teile.length) { console.error('  ! nicht gefunden:', basis); continue; }
    /* Erster Durchgang: Ausmasse in Weltkoordinaten. */
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const roh = [];
    for (const { node, mesh } of teile) {
      const M = weltMatrix(node);
      for (const prim of mesh.listPrimitives()) {
        const P = prim.getAttribute('POSITION');
        const a = P.getArray();
        const pts = new Float32Array(a.length);
        for (let k = 0; k < a.length; k += 3) {
          const p = M ? mulPunkt(M, a[k], a[k + 1], a[k + 2]) : [a[k], a[k + 1], a[k + 2]];
          pts[k] = p[0]; pts[k + 1] = p[1]; pts[k + 2] = p[2];
          for (let c = 0; c < 3; c++) {
            if (p[c] < min[c]) min[c] = p[c];
            if (p[c] > max[c]) max[c] = p[c];
          }
        }
        roh.push({ prim, pts });
      }
    }
    const groesse = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const mitte = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
    /* Zweiter Durchgang: in den Einheitswuerfel legen und uebernehmen. */
    const zielMesh = aus.createMesh(basis);
    for (const { prim, pts } of roh) {
      for (let k = 0; k < pts.length; k += 3) {
        pts[k] = (pts[k] - mitte[0]) / (groesse[0] || 1);
        pts[k + 1] = (pts[k + 1] - mitte[1]) / (groesse[1] || 1);
        pts[k + 2] = (pts[k + 2] - mitte[2]) / (groesse[2] || 1);
      }
      const neu = aus.createPrimitive();
      neu.setAttribute('POSITION', aus.createAccessor().setType('VEC3').setArray(pts).setBuffer(ausBuf));
      const N = prim.getAttribute('NORMAL');
      if (N) neu.setAttribute('NORMAL', aus.createAccessor().setType('VEC3')
        .setArray(new Float32Array(N.getArray())).setBuffer(ausBuf));
      const T = prim.getAttribute('TEXCOORD_0');
      if (T) neu.setAttribute('TEXCOORD_0', aus.createAccessor().setType('VEC2')
        .setArray(new Float32Array(T.getArray())).setBuffer(ausBuf));
      const I = prim.getIndices();
      if (I) neu.setIndices(aus.createAccessor().setType('SCALAR')
        .setArray(new Uint32Array(I.getArray())).setBuffer(ausBuf));
      const qm = prim.getMaterial();
      if (qm) neu.setMaterial(await holeMaterial(qm));
      zielMesh.addPrimitive(neu);
    }
    const knoten = aus.createNode(basis).setMesh(zielMesh);
    ausSzene.addChild(knoten);
    console.log('  +', basis.padEnd(34),
      groesse.map((v) => v.toFixed(1)).join(' x '), 'm');
  }
}

await aus.transform(dedup(), prune());
if (sharp) {
  await aus.transform(textureCompress({
    encoder: sharp, targetFormat: 'jpeg', resize: [256, 256], quality: 74 }));
}
await io.write(ziel, aus);
console.log('geschrieben:', ziel);
