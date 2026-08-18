#!/usr/bin/env node
/* =========================================================================
   Wandelt Mixamo-FBX-Dateien in spielfertige GLB-Dateien um.

   Erwartete Eingabedateien (Ordner: tools/input/):
     <slot>-model.fbx   – Charakter in T-Pose, "With Skin"
     <slot>-idle.fbx    – Animation "Without Skin"
     <slot>-walk.fbx, <slot>-run.fbx, <slot>-punch.fbx, ...
   <slot> = hero | civilian | civilian2 | civilian3 | thug

   Ausgabe (Ordner: assets/):
     <slot>.glb            – Modell (Texturen auf max. 1024px verkleinert)
     <slot>@<anim>.glb     – je eine Animations-Datei (winzig, nur Skelett)

   Aufruf:  node tools/convert-mixamo.mjs [eingabeordner] [ausgabeordner]
   ========================================================================= */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { prune, dedup, textureCompress } = require('@gltf-transform/functions');

const inputDir = process.argv[2] || 'tools/input';
const outputDir = process.argv[3] || 'assets';
const SLOTS = ['hero', 'civilian', 'civilian2', 'civilian3', 'thug'];

const fbxBin = path.join(
  path.dirname(require.resolve('fbx2gltf/package.json')),
  'bin',
  os.platform() === 'darwin' ? 'Darwin' : os.platform() === 'win32' ? 'Windows_NT' : 'Linux',
  os.platform() === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF'
);

function fbxToGlb(src, dst) {
  execFileSync(fbxBin, ['--binary', '--anim-framerate', 'bake30', '--input', src, '--output', dst], {
    stdio: 'inherit',
  });
}

async function optimizeModel(file) {
  const io = new NodeIO();
  const doc = await io.read(file);
  let sharp = null;
  try { sharp = require('sharp'); } catch (e) {
    console.warn('  (sharp nicht verfügbar – Texturen bleiben unverändert)');
  }
  if (sharp) {
    await doc.transform(textureCompress({
      encoder: sharp,
      targetFormat: 'jpeg',
      quality: 82,
      resize: [1024, 1024],
    }));
  }
  await doc.transform(dedup(), prune());
  await io.write(file, doc);
}

/* Aus einer Animationsdatei alles entfernen, was nicht die Bewegung ist.
   So bleibt die Datei winzig, selbst wenn sie versehentlich „With Skin“
   heruntergeladen wurde – das Skelett und die Animation bleiben erhalten. */
async function stripToAnimation(file) {
  const io = new NodeIO();
  const doc = await io.read(file);
  const root = doc.getRoot();
  if (!root.listAnimations().length) return false; // keine Animation – unverändert lassen
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();
  await doc.transform(prune({ keepAttributes: false }));
  await io.write(file, doc);
  return true;
}

if (!fs.existsSync(inputDir)) {
  console.error(`Eingabeordner ${inputDir} fehlt.`);
  process.exit(1);
}
fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir).filter((f) => f.toLowerCase().endsWith('.fbx'));
if (!files.length) {
  console.error(`Keine FBX-Dateien in ${inputDir} gefunden.`);
  process.exit(1);
}
console.log('Gefundene FBX-Dateien:', files.join(', '));

let converted = 0;
for (const file of files) {
  // Dateiname zerlegen: "<slot>-<teil>.fbx" (Groß/Kleinschreibung egal)
  const base = file.replace(/\.fbx$/i, '').toLowerCase().replace(/[\s_]+/g, '-');
  const m = base.match(/^([a-z0-9]+)-(.+)$/);
  if (!m || !SLOTS.includes(m[1])) {
    console.warn(`Überspringe ${file} – Name muss "<slot>-<teil>.fbx" sein (Slots: ${SLOTS.join(', ')})`);
    continue;
  }
  const [, slot, part] = m;
  const src = path.join(inputDir, file);
  const isModel = part === 'model' || part === 'tpose' || part === 't-pose';
  const dst = path.join(outputDir, isModel ? `${slot}.glb` : `${slot}@${part}.glb`);
  console.log(`\n→ ${file}  =>  ${dst}`);
  fbxToGlb(src, dst);
  if (isModel) {
    const before = fs.statSync(dst).size;
    await optimizeModel(dst);
    const after = fs.statSync(dst).size;
    console.log(`  Modell optimiert: ${(before / 1e6).toFixed(1)} MB → ${(after / 1e6).toFixed(1)} MB`);
  } else {
    const before = fs.statSync(dst).size;
    const stripped = await stripToAnimation(dst);
    const after = fs.statSync(dst).size;
    if (!stripped) {
      console.warn(`  ACHTUNG: keine Animation gefunden in ${file}`);
    }
    console.log(`  Animationsdatei: ${(before / 1e3).toFixed(0)} KB → ${(after / 1e3).toFixed(0)} KB`);
  }
  converted++;
}

if (!converted) {
  console.error('Keine Datei entsprach dem Namensschema – nichts umgewandelt.');
  process.exit(1);
}
console.log(`\nFertig: ${converted} Datei(en) umgewandelt nach ${outputDir}/`);
