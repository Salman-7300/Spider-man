/* Stadtmoebel vereinfachen.
   ANLASS, gemessen an der gebauten Stadt: ein einziges Instanzfeld trug
   766 976 Dreiecke - die Ampel, 3424 Dreiecke je Stueck bei 224
   Instanzen. Der Muelleimer hat 3480, mehr als die Ampel. Zusammen
   tragen die Stadtmoebel rund 1,13 Mio. Dreiecke, und weil die
   Instanzfelder ueber die ganze Stadt reichen, werden sie nie
   weggeschnitten: sie stecken in JEDEM Bild drin.
   Dieses Werkzeug laeuft EINMAL und schreibt die verkleinerten Dateien.
   Das Spiel braucht meshoptimizer nicht - nur dieses Skript:
     cd tools && npm install --no-save meshoptimizer
     node moebel-vereinfachen.mjs [--schreiben]
   Ohne --schreiben wird nur gerechnet und nichts angefasst. */
import { NodeIO } from '@gltf-transform/core';
import { simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.resolve(hier, '..');
const schreiben = process.argv.includes('--schreiben');

/* Je Modell ein Ziel. Gewaehlt nach Nutzen, nicht pauschal: die Ampel
   steht 224 mal in der Stadt, der Kiosk 20 mal. Und nach Form: ein
   Mast ist ein Zylinder und vertraegt wenig Kanten, eine Bank hat
   Latten, die man nicht wegkuerzen darf. */
const ZIEL = {
  traffic_light_01: 0.22,
  trash_bin_01: 0.16,
  street_lamp_01: 0.24,
  station_clock: 0.35,
  plaza_planter_01: 0.55,
  plaza_bench_01: 0.70,
  info_kiosk_01: 1.00,      // schon klein, bleibt
};

function dreiecke(mesh) {
  let t = 0;
  for (const pr of mesh.listPrimitives()) {
    const idx = pr.getIndices();
    t += idx ? idx.getCount() / 3 : pr.getAttribute('POSITION').getCount() / 3;
  }
  return Math.round(t);
}

await MeshoptSimplifier.ready;
const io = new NodeIO();
let vorher = 0, nachher = 0;

for (const datei of ['assets/stadtmoebel.glb', 'assets/bahnhofmoebel.glb']) {
  const p = path.join(wurzel, datei);
  const doc = await io.read(p);
  const vor = {};
  for (const m of doc.getRoot().listMeshes()) vor[m.getName()] = dreiecke(m);

  /* Zuerst verschweissen - doppelte Punkte an derselben Stelle kosten
     Speicher und hindern den Vereinfacher daran, ueber Kanten hinweg zu
     arbeiten. */
  await doc.transform(weld());

  /* Dann je Modell mit seinem eigenen Ziel. simplify() arbeitet auf dem
     ganzen Dokument, deshalb je Modell ein eigener Durchlauf ueber eine
     Kopie der Primitive-Liste. */
  for (const m of doc.getRoot().listMeshes()) {
    const ziel = ZIEL[m.getName()];
    if (!ziel || ziel >= 1) continue;
    for (const pr of m.listPrimitives()) {
      /* error: wie weit die Oberflaeche wandern darf, als Anteil der
         Modellgroesse. 0,3 Prozent ist bei einem 4 m hohen Mast gut
         ein Zentimeter - das sieht man aus zwei Metern nicht. */
      MeshoptSimplifier.useExperimentalFeatures = true;
      const { simplifyPrimitive } = await import('@gltf-transform/functions');
      simplifyPrimitive(pr, { simplifier: MeshoptSimplifier, ratio: ziel, error: 0.003 });
    }
  }

  const nach = {};
  for (const m of doc.getRoot().listMeshes()) nach[m.getName()] = dreiecke(m);
  console.log('==', datei);
  for (const name of Object.keys(vor)) {
    vorher += vor[name]; nachher += nach[name];
    const p2 = vor[name] ? Math.round(100 * (1 - nach[name] / vor[name])) : 0;
    console.log('  ', String(vor[name]).padStart(6), '->', String(nach[name]).padStart(6),
                '(' + String(p2).padStart(3) + ' % weniger)  ' + name);
  }
  if (schreiben) { await io.write(p, doc); console.log('   geschrieben'); }
}
console.log('Summe je Modell:', vorher, '->', nachher,
            '(' + Math.round(100 * (1 - nachher / vorher)) + ' % weniger)');
