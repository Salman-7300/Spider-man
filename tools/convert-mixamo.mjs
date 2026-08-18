#!/usr/bin/env node
/* =========================================================================
   Wandelt Mixamo-FBX-Dateien in spielfertige GLB-Dateien um.

   Die Dateinamen dürfen so bleiben, wie Mixamo sie vergibt
   ("Running (7).fbx", "Idle (5).fbx", "Ch24_nonPBR.fbx", ...).
   Ob eine Datei das Modell oder eine Animation ist, wird am INHALT erkannt.

   Aufruf:
     node tools/convert-mixamo.mjs <eingabeordner> <ausgabeordner> [--slot=thug]

   --slot   Für welche Figur die Dateien sind: hero | civilian | civilian2 |
            civilian3 | thug. Ohne Angabe muss der Dateiname mit dem Slot
            beginnen (z. B. "thug-run.fbx").

   Ausgabe:
     <slot>.glb          – Modell (Texturen auf max. 1024 px)
     <slot>@<anim>.glb   – je eine Animation (winzig, nur Bewegung)
   ========================================================================= */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { prune, dedup, textureCompress } = require('@gltf-transform/functions');

const SLOTS = ['hero', 'civilian', 'civilian2', 'civilian3', 'thug'];

/* Mixamo-Animationsnamen -> Bezeichnung im Spiel */
const ANIM_KEYWORDS = [
  [/idle|breathing|standing/i, 'idle'],
  [/walk/i, 'walk'],
  [/run|jog|sprint/i, 'run'],
  [/jump|fall/i, 'jump'],
  [/punch|jab|hook/i, 'punch'],
  [/kick/i, 'kick'],
  [/hit|impact|react/i, 'hit'],
  [/sit|crouch|dying|death/i, 'sit'],
  [/climb/i, 'climb'],
  [/swing|hang|fly/i, 'swing'],
];

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const slotArg = (args.find((a) => a.startsWith('--slot=')) || '').split('=')[1] || null;
const inputDir = positional[0] || 'tools/input';
const outputDir = positional[1] || 'assets';

if (slotArg && !SLOTS.includes(slotArg)) {
  console.error(`Unbekannter Slot "${slotArg}". Erlaubt: ${SLOTS.join(', ')}`);
  process.exit(1);
}

const fbxBin = path.join(
  path.dirname(require.resolve('fbx2gltf/package.json')),
  'bin',
  os.platform() === 'darwin' ? 'Darwin' : os.platform() === 'win32' ? 'Windows_NT' : 'Linux',
  os.platform() === 'win32' ? 'FBX2glTF.exe' : 'FBX2glTF'
);

function fbxToGlb(src, dst) {
  execFileSync(fbxBin, ['--binary', '--anim-framerate', 'bake30', '--input', src, '--output', dst],
    { stdio: ['ignore', 'ignore', 'inherit'] });
}

/* Verrät, was in einer GLB-Datei steckt: Modell oder Animation? */
function inspectGlb(file) {
  const b = fs.readFileSync(file);
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString());
  const anims = (json.animations || []).filter((a) => (a.channels || []).length > 0);
  return { hatMeshes: (json.meshes || []).length > 0, animationen: anims.length };
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
      encoder: sharp, targetFormat: 'jpeg', quality: 82, resize: [1024, 1024],
    }));
  }
  await doc.transform(dedup(), prune());
  await io.write(file, doc);
}

/* Aus einer Animationsdatei alles entfernen, was nicht die Bewegung ist –
   spart rund 80 % Größe, selbst bei „With Skin“-Downloads. */
async function stripToAnimation(file) {
  const io = new NodeIO();
  const doc = await io.read(file);
  const root = doc.getRoot();
  if (!root.listAnimations().length) return false;
  for (const skin of root.listSkins()) skin.dispose();
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const mat of root.listMaterials()) mat.dispose();
  for (const tex of root.listTextures()) tex.dispose();
  await doc.transform(prune({ keepAttributes: false }));
  await io.write(file, doc);
  return true;
}

/* Slot und Animationsname aus dem Dateinamen ableiten */
function deuteDateiname(file) {
  const base = file.replace(/\.fbx$/i, '');
  const norm = base.toLowerCase().replace(/[\s_]+/g, '-');
  let slot = slotArg;
  let rest = norm;
  const m = norm.match(/^([a-z0-9]+)-(.+)$/);
  if (m && SLOTS.includes(m[1])) { slot = m[1]; rest = m[2]; }
  let anim = null;
  for (const [re, name] of ANIM_KEYWORDS) {
    if (re.test(rest)) { anim = name; break; }
  }
  return { slot, anim, rest };
}

if (!fs.existsSync(inputDir)) {
  console.error(`Eingabeordner ${inputDir} fehlt.`);
  process.exit(1);
}
fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir).filter((f) => /\.fbx$/i.test(f)).sort();
if (!files.length) {
  console.error(`Keine FBX-Dateien in ${inputDir} gefunden.`);
  process.exit(1);
}
console.log(`${files.length} FBX-Datei(en) gefunden${slotArg ? ` (Slot: ${slotArg})` : ''}\n`);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbx-'));
let modelle = 0, animationen = 0, uebersprungen = 0;

for (const file of files) {
  const { slot, anim, rest } = deuteDateiname(file);
  if (!slot) {
    console.warn(`⚠ ${file}: kein Slot erkennbar – bitte --slot=<name> angeben ` +
                 `oder Datei "<slot>-<teil>.fbx" nennen. Übersprungen.`);
    uebersprungen++;
    continue;
  }
  const tmp = path.join(tmpDir, 'out.glb');
  try {
    fbxToGlb(path.join(inputDir, file), tmp);
  } catch (e) {
    console.warn(`⚠ ${file}: konnte nicht umgewandelt werden. Übersprungen.`);
    uebersprungen++;
    continue;
  }
  const info = inspectGlb(tmp);
  // Inhalt entscheidet: Animationen drin -> Animationsdatei, sonst Modell
  const istModell = info.animationen === 0 && info.hatMeshes;
  const zielName = istModell ? `${slot}.glb` : `${slot}@${anim || rest.replace(/[^a-z0-9]/g, '')}.glb`;
  const ziel = path.join(outputDir, zielName);
  fs.copyFileSync(tmp, ziel);

  const vorher = fs.statSync(ziel).size;
  if (istModell) {
    await optimizeModel(ziel);
    console.log(`✓ ${file}\n    -> ${zielName} (Modell, ${(vorher / 1e6).toFixed(1)} MB -> ${(fs.statSync(ziel).size / 1e6).toFixed(1)} MB)`);
    modelle++;
  } else {
    await stripToAnimation(ziel);
    console.log(`✓ ${file}\n    -> ${zielName} (Animation, ${(vorher / 1e3).toFixed(0)} KB -> ${(fs.statSync(ziel).size / 1e3).toFixed(0)} KB)`);
    animationen++;
  }
}
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nFertig: ${modelle} Modell(e), ${animationen} Animation(en)` +
            (uebersprungen ? `, ${uebersprungen} übersprungen` : '') + ` -> ${outputDir}/`);
if (!modelle && !animationen) process.exit(1);
