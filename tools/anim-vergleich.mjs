#!/usr/bin/env node
/* =========================================================================
   Sind zwei Bewegungsdateien dieselbe Bewegung?

   Wozu: Zu einem Release kommen oft Dateien, die schon im Spiel stecken -
   nur aus einer anderen Quelle, mit anderem Dateinamen und einer anderen
   Zahl von Knochen. Von Hand sieht man das nicht; zwei Kriechbewegungen
   sehen im Standbild immer gleich aus. Dieses Werkzeug beantwortet die
   Frage mit einer Zahl.

   Gerechnet wird ueber die DREHKURVEN der gemeinsamen Knochen: beide
   Dateien werden auf 40 Stuetzstellen ueber ihre eigene Laenge abgetastet
   (die Laufzeit darf also verschieden sein), und je Knochen wird der
   groesste Winkelunterschied bestimmt. Knochennamen werden dabei um das
   "mixamorig:"-Praefix bereinigt und kleingeschrieben.

   Faustwerte aus dem echten Vergleich (Release animation-2):
     unter  3 Grad  im Mittel -> dieselbe Bewegung, nichts gewonnen
     rund  14 Grad  im Mittel -> dieselbe Bewegung, andere Fassung
     ueber 30 Grad  im Mittel -> wirklich etwas anderes

   Aufruf:
     node tools/anim-vergleich.mjs <a.glb> <b.glb>
   ========================================================================= */
import fs from 'node:fs';

/* ---- GLB lesen: JSON-Teil und Binaerteil ---- */
function ladeGlb(pfad) {
  const b = fs.readFileSync(pfad);
  if (b.slice(0, 4).toString() !== 'glTF') throw new Error(pfad + ': keine GLB-Datei');
  const jsonLaenge = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLaenge).toString('utf8'));
  let stelle = 20 + jsonLaenge, bin = null;
  while (stelle < b.length) {
    const laenge = b.readUInt32LE(stelle), typ = b.readUInt32LE(stelle + 4);
    if (typ === 0x004E4942) { bin = b.slice(stelle + 8, stelle + 8 + laenge); break; }
    stelle += 8 + laenge;
  }
  return { json, bin };
}

/* ---- Einen Zugriff als Float-Feld auslesen ----
   Zeit- und Drehspuren von Mixamo/FBX2glTF liegen immer als float vor;
   andere Datentypen kommen hier nicht vor und werden abgewiesen. */
function feld(g, nummer) {
  const a = g.json.accessors[nummer];
  if (a.componentType !== 5126) throw new Error('unerwarteter Datentyp ' + a.componentType);
  const bv = g.json.bufferViews[a.bufferView];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const breite = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  const out = new Float32Array(a.count * breite);
  for (let i = 0; i < out.length; i++) out[i] = g.bin.readFloatLE(start + i * 4);
  return { werte: out, breite, anzahl: a.count };
}

const sauber = (n) => (n || '').replace(/mixamorig:?/i, '').replace(/\s+/g, '').toLowerCase();

/* ---- Alle Drehspuren der ersten Bewegung ---- */
function drehspuren(g) {
  const anim = (g.json.animations || [])[0];
  const raus = new Map();
  if (!anim) return raus;
  for (const kanal of anim.channels) {
    if (kanal.target.path !== 'rotation') continue;
    const name = sauber((g.json.nodes[kanal.target.node] || {}).name);
    const s = anim.samplers[kanal.sampler];
    raus.set(name, { zeit: feld(g, s.input), dreh: feld(g, s.output) });
  }
  return raus;
}

/* Drehung an der Stelle u (0..1 der eigenen Laenge). Es wird die naechste
   Stuetzstelle genommen, nicht interpoliert - fuer den Vergleich zweier
   Kurven reicht das, und es kann keine Slerp-Wahl das Ergebnis faerben. */
function drehungBei(spur, u) {
  const t = spur.zeit.werte, q = spur.dreh.werte;
  const ziel = t[t.length - 1] * u;
  let i = 0;
  while (i < t.length - 2 && t[i + 1] < ziel) i++;
  return [q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]];
}

/* Winkel zwischen zwei Drehungen in Grad. Das Vorzeichen einer Drehung ist
   beliebig (q und -q drehen gleich), deshalb der Betrag. */
function winkel(a, b) {
  const p = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, p)) * 180 / Math.PI;
}

const [pfadA, pfadB] = process.argv.slice(2);
if (!pfadA || !pfadB) {
  console.error('Aufruf: node tools/anim-vergleich.mjs <a.glb> <b.glb>');
  process.exit(1);
}
const A = ladeGlb(pfadA), B = ladeGlb(pfadB);
const sa = drehspuren(A), sb = drehspuren(B);
const gemeinsam = [...sa.keys()].filter((k) => sb.has(k)).sort();

console.log(pfadA, '- bewegte Knochen:', sa.size);
console.log(pfadB, '- bewegte Knochen:', sb.size);
console.log('nur in der ersten Datei:', [...sa.keys()].filter((k) => !sb.has(k)).join(', ') || '-');
console.log('nur in der zweiten Datei:', [...sb.keys()].filter((k) => !sa.has(k)).join(', ') || '-');

if (!gemeinsam.length) {
  console.log('\nKeine gemeinsamen Knochen - die Dateien benutzen verschiedene Skelette.');
  console.log('Fuer einen Vergleich muesste erst umgerechnet werden (siehe tools/retarget-ue4.mjs).');
  process.exit(0);
}

const je = [];
for (const k of gemeinsam) {
  let groesster = 0;
  for (let i = 0; i <= 40; i++) {
    groesster = Math.max(groesster, winkel(drehungBei(sa.get(k), i / 40), drehungBei(sb.get(k), i / 40)));
  }
  je.push([k, groesster]);
}
je.sort((x, y) => y[1] - x[1]);
const mittel = je.reduce((s, [, v]) => s + v, 0) / je.length;

console.log('\ngemeinsame Knochen:', gemeinsam.length);
console.log('groesster Winkelunterschied je Knochen:',
            'Mittel', mittel.toFixed(1), 'Grad |',
            'Maximum', je[0][1].toFixed(1), 'Grad');
console.log('die groessten:', je.slice(0, 5).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', '));
console.log('\nEinordnung:', mittel < 3 ? 'dieselbe Bewegung - kein Gewinn'
                          : mittel < 20 ? 'dieselbe Bewegung in einer anderen Fassung'
                          : 'unterschiedliche Bewegungen');
