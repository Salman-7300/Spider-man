#!/usr/bin/env node
/* =========================================================================
   Einzelne Knochenspuren aus einer Bewegungsdatei entfernen.

   Wozu: eine umgerechnete Bewegung kann in EINEM Knochen falsch sein,
   waehrend der Rest stimmt. Beim Gehschritt aus animation-2 ist es der
   Kopf - er haengt nach vorn, waehrend alle anderen Bewegungen des
   Modells (idle, walk, run) den Blick 26 Grad anders halten. Ohne Spur
   bleibt der Knochen in der RUHEHALTUNG des Modells und passt damit
   wieder zu allem anderen. Dasselbe macht tools/retarget-ue4.mjs mit
   seiner Liste NUR_ACHSE.

   Aufruf:
     node tools/spur-entfernen.mjs <datei.glb> <knochen,knochen,...>
   ========================================================================= */
import fs from 'node:fs';

const [pfad, liste] = process.argv.slice(2);
if (!pfad || !liste) {
  console.error('Aufruf: node tools/spur-entfernen.mjs <datei.glb> <knochen,...>');
  process.exit(1);
}
const raus = liste.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean);
const schlicht = (n) => (n || '').replace(/^mixamorig:?/i, '').toLowerCase();

const b = fs.readFileSync(pfad);
if (b.toString('ascii', 0, 4) !== 'glTF' || b.readUInt32LE(4) !== 2) {
  throw new Error('GLB 2.0 erwartet: ' + pfad);
}
const jsonLaenge = b.readUInt32LE(12);
const json = JSON.parse(b.slice(20, 20 + jsonLaenge).toString('utf8'));
const rest = b.slice(20 + jsonLaenge);

let weg = 0;
const namen = [];
for (const anim of json.animations || []) {
  anim.channels = anim.channels.filter((kanal) => {
    const name = (json.nodes[kanal.target.node] || {}).name;
    if (!raus.includes(schlicht(name))) return true;
    weg++; if (!namen.includes(name)) namen.push(name);
    return false;
  });
}
if (!weg) { console.log('nichts entfernt - kein Knochen der Liste kommt vor'); process.exit(0); }

/* Die Sampler bleiben stehen; sie werden nur nicht mehr benutzt. Das ist
   erlaubt und spart es, alle Zugriffsnummern neu zu vergeben. */
let neuJson = Buffer.from(JSON.stringify(json));
neuJson = Buffer.concat([neuJson, Buffer.alloc((4 - neuJson.length % 4) % 4, 0x20)]);
const out = Buffer.alloc(12 + 8 + neuJson.length + rest.length);
out.write('glTF'); out.writeUInt32LE(2, 4);
out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(neuJson.length, 12); out.writeUInt32LE(0x4e4f534a, 16);
neuJson.copy(out, 20); rest.copy(out, 20 + neuJson.length);
if (out.length < 1024) throw new Error('Datei verdaechtig klein: ' + out.length);
fs.writeFileSync(pfad, out);
console.log('✓', pfad, '-', weg, 'Spur(en) entfernt:', namen.join(', '), '|', out.length, 'Bytes');
