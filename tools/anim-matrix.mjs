#!/usr/bin/env node
/* =========================================================================
   Phase 13, Teil 2: Qualitaetsmatrix der Heldenbewegungen.

   Misst JEDE Datei assets/hero@*.glb aus der Datei selbst - ohne Browser,
   ohne Three.js, in wenigen Sekunden wiederholbar. Gemessen wird:

     Dauer          Laenge des Clips in Sekunden
     Keys           Stuetzstellen der laengsten Spur
     Knochen        wieviele Knochen sich ueberhaupt bewegen (ueber 2 Grad)
     Umfang         mittlerer groesster Ausschlag dieser Knochen, in Grad
     Naht           Winkelunterschied zwischen letztem und erstem Bild.
                    Fast alles im Spiel laeuft als Schleife (nur downed,
                    sit und taunt nicht) - eine grosse Naht ist der Ruck,
                    den man bei jedem Durchlauf sieht.
     Huefte         wie weit die Huefte waagerecht wandert. Die Bewegungen
                    sollen "in place" sein; wandert die Huefte, schiebt
                    sich die Figur im Spiel von selbst zur Seite.

   Aufruf:  node tools/anim-matrix.mjs [--csv] [--alle]
   ========================================================================= */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const fs = require('node:fs');
const path = require('node:path');

const WURZEL = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const csv = process.argv.includes('--csv');
const alle = process.argv.includes('--alle');

/* Winkel zwischen zwei Quaternionen, in Grad. */
function winkel(a, b) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  d = Math.min(1, Math.abs(d));
  return 2 * Math.acos(d) * 180 / Math.PI;
}

async function miss(datei) {
  const doc = await new NodeIO().read(datei);
  const anim = doc.getRoot().listAnimations()[0];
  if (!anim) return null;
  let dauer = 0, keys = 0;
  const drehungen = [];
  let huefte = null;
  for (const ch of anim.listChannels()) {
    const s = ch.getSampler();
    const ein = s.getInput(), aus = s.getOutput();
    dauer = Math.max(dauer, ein.getMax([])[0]);
    keys = Math.max(keys, ein.getCount());
    const name = ch.getTargetNode().getName();
    if (ch.getTargetPath() === 'rotation') {
      const n = ein.getCount();
      const q0 = aus.getElement(0, []);
      let maxAb = 0;
      for (let i = 1; i < n; i++) maxAb = Math.max(maxAb, winkel(q0, aus.getElement(i, [])));
      drehungen.push({ name, maxAb, naht: winkel(q0, aus.getElement(n - 1, [])) });
    } else if (ch.getTargetPath() === 'translation' && /Hips$/.test(name)) {
      const n = ein.getCount();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = aus.getElement(i, []);
        x0 = Math.min(x0, v[0]); x1 = Math.max(x1, v[0]);
        y0 = Math.min(y0, v[1]); y1 = Math.max(y1, v[1]);
        z0 = Math.min(z0, v[2]); z1 = Math.max(z1, v[2]);
      }
      const a = aus.getElement(0, []), b = aus.getElement(n - 1, []);
      huefte = { waagerecht: Math.hypot(x1 - x0, z1 - z0), hoch: y1 - y0,
                 naht: Math.hypot(b[0] - a[0], b[2] - a[2]) };
    }
  }
  const bewegt = drehungen.filter((d) => d.maxAb > 2);
  const mittel = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
  return {
    dauer: +dauer.toFixed(2), keys,
    knochen: bewegt.length, spuren: drehungen.length,
    umfang: +mittel(bewegt.map((d) => d.maxAb)).toFixed(1),
    nahtMittel: +mittel(bewegt.map((d) => d.naht)).toFixed(1),
    nahtMax: +Math.max(0, ...bewegt.map((d) => d.naht)).toFixed(1),
    nahtWo: bewegt.length ? bewegt.slice().sort((a, b) => b.naht - a.naht)[0].name
                              .replace('mixamorig:', '') : '-',
    hueftWeg: huefte ? +huefte.waagerecht.toFixed(3) : null,
    hueftNaht: huefte ? +huefte.naht.toFixed(3) : null,
  };
}

const dateien = fs.readdirSync(path.join(WURZEL, 'assets'))
  .filter((f) => /^hero@.*\.glb$/.test(f)).sort();

const zeilen = [];
for (const f of dateien) {
  const m = await miss(path.join(WURZEL, 'assets', f));
  if (!m) { console.error('keine Animation:', f); continue; }
  m.name = f.replace(/^hero@|\.glb$/g, '');
  zeilen.push(m);
}

if (csv) {
  console.log('name;dauer;keys;knochen;spuren;umfang;nahtMittel;nahtMax;nahtWo;hueftWeg;hueftNaht');
  for (const z of zeilen)
    console.log([z.name, z.dauer, z.keys, z.knochen, z.spuren, z.umfang,
                 z.nahtMittel, z.nahtMax, z.nahtWo, z.hueftWeg, z.hueftNaht].join(';'));
} else {
  /* Nur die auffaelligen, sortiert nach Naht - das ist der Ruck, den man
     im Spiel sieht. Mit --alle kommen alle 94. */
  const kopf = 'Bewegung'.padEnd(16) + 's'.padStart(6) + 'Keys'.padStart(6) +
    'Knoch'.padStart(6) + 'Umfang'.padStart(8) + 'NahtM'.padStart(7) +
    'NahtMax'.padStart(9) + '  schlimmster Knochen'.padEnd(22) + 'Huefte'.padStart(8);
  console.log(kopf);
  console.log('-'.repeat(kopf.length));
  const liste = zeilen.slice().sort((a, b) => b.nahtMittel - a.nahtMittel);
  for (const z of (alle ? liste : liste.slice(0, 30))) {
    console.log(z.name.padEnd(16) + String(z.dauer).padStart(6) +
      String(z.keys).padStart(6) + String(z.knochen).padStart(6) +
      String(z.umfang).padStart(8) + String(z.nahtMittel).padStart(7) +
      String(z.nahtMax).padStart(9) + '  ' + z.nahtWo.padEnd(20) +
      String(z.hueftWeg === null ? '-' : z.hueftWeg).padStart(8));
  }
  console.log('\n' + zeilen.length + ' Bewegungen gemessen.');
}
