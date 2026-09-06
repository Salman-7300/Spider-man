#!/usr/bin/env node
/* =========================================================================
   Aus einzelnen HALTUNGEN eine Bewegung bauen.

   Wozu: das Unreal-Projekt liefert fuer den Flug und den Netzschwung
   keine Schleifen, sondern EINZELBILDER - "Apex", "AirPose_Low",
   "SkyDivePose" und so weiter sind je 0,033 s lang. Im Spiel ist der
   Netzschwung aber ohnehin keine ablaufende Bewegung: der Clip steht
   still, und seine Stelle folgt der Lage im Bogen (siehe game.js,
   "current.time = lerp(...)"). Gebraucht wird also genau eine Datei, die
   von der einen Haltung zur anderen fuehrt - dieses Werkzeug baut sie.

   Die Haltungen muessen schon auf unserem Skelett liegen (also durch
   tools/retarget-ue4.mjs gelaufen sein). Verglichen und zugeordnet wird
   ueber die KNOCHENNAMEN, nicht ueber die Nummern.

   Aufruf:
     node tools/posen-zu-bogen.mjs <ziel.glb> <name> <pose0.glb> <pose1.glb> [...]

   Die Stellen liegen gleichmaessig zwischen 0 und 1 Sekunde; das Spiel
   spricht sie ueber den Bogen an, die Laufzeit selbst spielt keine Rolle.
   ========================================================================= */
import fs from 'node:fs';

function liesGlb(pfad) {
  const b = fs.readFileSync(pfad);
  if (b.toString('ascii', 0, 4) !== 'glTF' || b.readUInt32LE(4) !== 2) {
    throw new Error('GLB 2.0 erwartet: ' + pfad);
  }
  let json = null, bin = null;
  for (let s = 12; s + 8 <= b.length;) {
    const laenge = b.readUInt32LE(s), typ = b.readUInt32LE(s + 4);
    const stueck = b.subarray(s + 8, s + 8 + laenge);
    if (typ === 0x4e4f534a) json = JSON.parse(stueck.toString());
    if (typ === 0x004e4942) bin = stueck;
    s += 8 + laenge;
  }
  return { json, bin };
}

/* Erster Wert eines Zugriffs - die Haltungen sind Einzelbilder. */
function ersterWert(g, nummer) {
  const a = g.json.accessors[nummer], v = g.json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.sparse) throw new Error('Float-Spur erwartet');
  const breite = { VEC3: 3, VEC4: 4 }[a.type];
  const start = (v.byteOffset || 0) + (a.byteOffset || 0);
  return Array.from({ length: breite }, (_, i) => g.bin.readFloatLE(start + i * 4));
}

/* Alle Drehungen einer Haltung, nach Knochennamen. */
function drehungen(g) {
  const raus = new Map();
  const anim = (g.json.animations || [])[0];
  if (!anim) throw new Error('Datei ohne Bewegung');
  for (const kanal of anim.channels) {
    if (kanal.target.path !== 'rotation') continue;
    const name = (g.json.nodes[kanal.target.node] || {}).name;
    raus.set(name, ersterWert(g, anim.samplers[kanal.sampler].output));
  }
  return raus;
}

/* ---- Warum das BECKEN weggelassen werden kann ----
   Die Flughaltungen des UE4-Projekts bringen ihre eigene Koerperlage mit:
   in "AirPose_Low" liegt die Figur schon schraeg im Raum. Das Spiel dreht
   den Koerper beim Netzschwung aber selbst - nach der Lage im Bogen. Beide
   Drehungen zusammen ergaben eine Figur, die kopfueber am Faden hing.
   Mit --ohne-becken liefert die Datei nur die GLIEDER, und die Koerperlage
   bleibt beim Spiel. */
const ohneBecken = process.argv.includes('--ohne-becken');
const [ziel, name, ...quellen] = process.argv.slice(2).filter((a) => a !== '--ohne-becken');
if (!ziel || !name || quellen.length < 2) {
  console.error('Aufruf: node tools/posen-zu-bogen.mjs <ziel.glb> <name> <pose0.glb> <pose1.glb> [...]');
  process.exit(1);
}

const posen = quellen.map(liesGlb);
const satz = posen.map(drehungen);
const vorlage = posen[0];

/* Nur Knochen nehmen, die in ALLEN Haltungen vorkommen - sonst spraenge
   der fehlende in seine Ruhelage, und zwar mitten in der Bewegung. */
const istBecken = (n) => /(^|:)hips$/i.test(n || '');
const gemeinsam = [...satz[0].keys()]
  .filter((n) => satz.every((s) => s.has(n)))
  .filter((n) => !(ohneBecken && istBecken(n)));
const fehlend = [...satz[0].keys()].filter((n) => !gemeinsam.includes(n));

const doc = {
  asset: { version: '2.0', generator: 'WEB HERO posen-zu-bogen.mjs' },
  scene: vorlage.json.scene || 0, scenes: vorlage.json.scenes, nodes: vorlage.json.nodes,
  animations: [{ name, channels: [], samplers: [] }],
  accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }],
};
const teile = [];
function zugriff(werte, typ, dazu = {}) {
  const daten = Buffer.alloc(werte.length * 4);
  werte.forEach((w, i) => daten.writeFloatLE(w, i * 4));
  doc.bufferViews.push({ buffer: 0, byteOffset: doc.buffers[0].byteLength, byteLength: daten.length });
  doc.buffers[0].byteLength += daten.length;
  teile.push(daten);
  const breite = { SCALAR: 1, VEC3: 3, VEC4: 4 }[typ];
  doc.accessors.push({ bufferView: doc.bufferViews.length - 1, componentType: 5126,
                       type: typ, count: werte.length / breite, ...dazu });
  return doc.accessors.length - 1;
}

const n = posen.length;
const zeiten = Array.from({ length: n }, (_, i) => i / (n - 1));
const zeitZugriff = zugriff(zeiten, 'SCALAR', { min: [0], max: [1] });

/* Knochennummer im Zielskelett - die Vorlage liefert die Nummern. */
const nummerVon = new Map();
vorlage.json.nodes.forEach((k, i) => { if (k.name) nummerVon.set(k.name, i); });

for (const knochen of gemeinsam) {
  const bilder = [];
  let vor = null;
  for (const s of satz) {
    let q = s.get(knochen).slice();
    /* Kuerzester Weg: q und -q drehen gleich, aber LINEAR zwischen ihnen
       laeuft die Drehung einmal aussen herum. Ohne das Umdrehen dreht
       sich der Koerper im Bogen ploetzlich falsch herum. */
    if (vor && (q[0] * vor[0] + q[1] * vor[1] + q[2] * vor[2] + q[3] * vor[3]) < 0) {
      q = q.map((w) => -w);
    }
    vor = q;
    bilder.push(...q);
  }
  const aus = zugriff(bilder, 'VEC4');
  doc.animations[0].channels.push({ sampler: doc.animations[0].samplers.length,
                                    target: { node: nummerVon.get(knochen), path: 'rotation' } });
  doc.animations[0].samplers.push({ input: zeitZugriff, output: aus, interpolation: 'LINEAR' });
}

let json = Buffer.from(JSON.stringify(doc));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const bin = Buffer.concat(teile);
const out = Buffer.alloc(28 + json.length + bin.length);
out.write('glTF'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(json.length, 12); out.writeUInt32LE(0x4e4f534a, 16); json.copy(out, 20);
out.writeUInt32LE(bin.length, 20 + json.length); out.writeUInt32LE(0x004e4942, 24 + json.length);
bin.copy(out, 28 + json.length);
fs.writeFileSync(ziel, out);
if (out.length < 1024) throw new Error('Datei verdaechtig klein: ' + out.length + ' Bytes');
console.log('✓', ziel, '-', gemeinsam.length, 'Knochen,', n, 'Stellen,', out.length, 'Bytes');
if (fehlend.length) console.log('  nicht in allen Haltungen, weggelassen:', fehlend.join(', '));
