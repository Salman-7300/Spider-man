#!/usr/bin/env node
/* =========================================================================
   Holt einzelne Bewegungen aus einer fertigen GLB-Datei heraus.

   Der Mixamo-Weg (convert-mixamo.mjs) geht von FBX-Dateien aus, die je eine
   Bewegung enthalten. Fertige Modelle aus Sketchfab und aehnlichen Quellen
   bringen dagegen oft ein Dutzend Bewegungen in EINER Datei mit - und ihre
   Knochen heissen leicht anders: "mixamorig:Hips_01" statt "mixamorig:Hips".
   Auf dem Skelett des Spiels laeuft so eine Spur ins Leere, weil der Name
   nicht gefunden wird.

   Dieses Werkzeug schneidet je eine Bewegung heraus, benennt die Knochen um
   und schreibt sie als <slot>@<name>.glb - genau im Format, das das Spiel
   schon laedt.

   Aufruf:
     node tools/extract-anims.mjs <datei.glb> --liste
     node tools/extract-anims.mjs <datei.glb> <ausgabe> --nimm="swingStart:schwungstart,hanging:haengen_frei" [--slots=hero,thug]
   ========================================================================= */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { prune } = require('@gltf-transform/functions');

const args = process.argv.slice(2);
const quelle = args.find((a) => !a.startsWith('--'));
const rest = args.filter((a) => !a.startsWith('--') && a !== quelle);
const ausgabe = rest[0];
const nurListe = args.includes('--liste');
const nimmArg = (args.find((a) => a.startsWith('--nimm=')) || '').slice(7);
const slotArg = (args.find((a) => a.startsWith('--slots=')) || '').slice(8);
const SLOTS = slotArg ? slotArg.split(',').map((s) => s.trim()) : ['hero'];

if (!quelle || !fs.existsSync(quelle)) {
  console.error('Quelldatei fehlt. Aufruf siehe Kopf der Datei.');
  process.exit(1);
}

/* Laenge einer Bewegung: der spaeteste Zeitpunkt aller Spuren. */
function dauerVon(anim) {
  let d = 0;
  for (const s of anim.listSamplers()) {
    const inp = s.getInput();
    if (!inp || !inp.getCount()) continue;
    d = Math.max(d, inp.getElement(inp.getCount() - 1, [])[0]);
  }
  return d;
}

const io = new NodeIO();

if (nurListe) {
  const doc = await io.read(quelle);
  for (const a of doc.getRoot().listAnimations()) {
    console.log(`${(a.getName() || '(ohne Namen)').padEnd(16)} ${dauerVon(a).toFixed(2)}s  ` +
                `${a.listChannels().length} Spuren`);
  }
  process.exit(0);
}

if (!ausgabe || !nimmArg) {
  console.error('Es fehlt der Ausgabeordner oder --nimm=quelle:ziel,...');
  process.exit(1);
}

const paare = nimmArg.split(',').map((p) => {
  const [von, nach] = p.split(':');
  return { von: von.trim(), nach: (nach || von).trim() };
});

fs.mkdirSync(ausgabe, { recursive: true });

for (const { von, nach } of paare) {
  /* Fuer jede Bewegung frisch einlesen: das Wegwerfen der anderen
     Bewegungen veraendert das Dokument. */
  const doc = await io.read(quelle);
  const root = doc.getRoot();
  const treffer = root.listAnimations().find((a) => a.getName() === von);
  if (!treffer) {
    console.warn(`⚠ "${von}" ist in ${path.basename(quelle)} nicht enthalten – übersprungen.`);
    continue;
  }
  const dauer = dauerVon(treffer);
  if (dauer < 0.05) {
    console.warn(`⚠ "${von}" ist nur ${dauer.toFixed(2)}s lang (eine einzelne Haltung) – übersprungen.`);
    continue;
  }
  treffer.setName('mixamo.com');
  for (const a of root.listAnimations()) {
    if (a === treffer) continue;
    /* Erst die Verweise loesen, dann wegwerfen. Nur a.dispose() reicht
       nicht: die Zahlenreihen der Spuren behalten sonst einen Verweis und
       landen alle in der Ausgabedatei - gemessen 1,7 MB statt 60 kB, weil
       alle vierzehn Bewegungen mitgeschleppt wurden. */
    for (const s of a.listSamplers()) { s.setInput(null); s.setOutput(null); s.dispose(); }
    for (const ch of a.listChannels()) ch.dispose();
    a.dispose();
  }
  /* Zahlenreihen ohne Verwendung entfernen. prune() laesst sie stehen. */
  for (const acc of root.listAccessors()) {
    if (!acc.listParents().some((el) => el.propertyType !== 'Root')) acc.dispose();
  }

  /* Knochennamen angleichen: die Endung "_12" faellt weg, damit die Spur
     auf dem Skelett des Spiels ihr Ziel findet. */
  let umbenannt = 0;
  for (const node of root.listNodes()) {
    const alt = node.getName();
    const neu = alt.replace(/_\d+$/, '');
    if (neu !== alt) { node.setName(neu); umbenannt++; }
  }

  /* Alles ausser der Bewegung entfernen – die Datei soll winzig sein. */
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();
  await doc.transform(prune({ keepAttributes: false }));

  for (const slot of SLOTS) {
    const ziel = path.join(ausgabe, `${slot}@${nach}.glb`);
    await io.write(ziel, doc);
    console.log(`✓ ${von} → ${path.basename(ziel)}  ${dauer.toFixed(2)}s  ` +
                `${(fs.statSync(ziel).size / 1024).toFixed(0)} kB  ` +
                `(${umbenannt} Knochen umbenannt)`);
  }
}
