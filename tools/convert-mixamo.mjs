#!/usr/bin/env node
/* =========================================================================
   Wandelt Mixamo-FBX-Dateien in spielfertige GLB-Dateien um.

   AUTOMATIK (Standard): Einfach ALLE heruntergeladenen Dateien in einen
   Ordner werfen – das Skript erkennt selbst, was Modell und was Animation
   ist, und verteilt alles richtig. Dateinamen dürfen bleiben, wie Mixamo
   sie vergibt ("Running (7).fbx", "Warrok W Kurniawan.fbx", ...).

   Weil alle Mixamo-Figuren dasselbe Skelett benutzen, gelten die
   Animationen für ALLE Figuren – ein Satz reicht.

   Aufruf:
     node tools/convert-mixamo.mjs <eingabe> <ausgabe>            (Automatik)
     node tools/convert-mixamo.mjs <eingabe> <ausgabe> --slot=thug (nur eine Figur)
     ... --map="warrok:thug,remy:civilian"   (feste Zuordnung nach Namensteil)

   Ausgabe:
     <slot>.glb          – Modell (Texturen auf max. 1024 px)
     <slot>@<anim>.glb   – Animation (winzig, nur Bewegung)
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
/* Reihenfolge, in der gefundene Modelle verteilt werden.
   "hero" bleibt frei: Der Held soll standardmäßig sein Netz-Kostüm behalten. */
const AUTO_REIHENFOLGE = ['civilian', 'civilian2', 'civilian3'];
/* Figuren, die nach Schurke aussehen -> Gegner */
const GEGNER_NAMEN = /warrok|brute|thug|goon|zombie|mutant|monster|maw|vampire|boss|ninja|guard|swat|joe|shae|mremireh|castle/i;
/* Figuren, die nach Held klingen */
const HELD_NAMEN = /hero|spider|spinne|held/i;

/* Mixamo-Animationsnamen -> Bezeichnung im Spiel */
const ANIM_KEYWORDS = [
  /* Reihenfolge zählt: Die erste passende Regel gewinnt. Mixamo-Namen
     enthalten oft mehrere Stichwörter, deshalb steht das jeweils
     genauere Wort weiter oben:
       "Falling To Landing"          -> Landung, nicht Fall
       "Falling Back Death"          -> K.o., nicht Fall
       "Falling Idle"                -> Fall, nicht Stehen
       "Standing React Small"        -> Treffer, nicht Stehen
       "Hanging Idle"                -> Netzschwung, nicht Stehen  */
  /* Neue Sonderbewegungen zuerst – ihre Dateinamen enthalten sonst
     Wörter, die schon von allgemeineren Regeln gefangen würden
     ("Jump Attack" enthält "jump", "Hook Punch" enthält "punch"). */
  /* mixamo-7: Wandlauf, Aufwärtshaken, Wurf, Landerolle und ruhige
     Bewegungen für Zivilisten. Alle Namen enthalten Wörter, die weiter
     unten schon gefangen würden ("Falling To Roll" -> roll, "Wall Run" ->
     run, "Standing Idle Looking" -> idle). */
  [/falling[ ._-]?to[ ._-]?roll/i, 'fallrolle'],
  [/wall[ ._-]?run/i, 'wandlauf'],
  [/uppercut/i, 'uppercut'],
  [/torch/i, 'wurf'],
  [/talking[ ._-]?on[ ._-]?phone|phone/i, 'telefon'],
  [/standing[ ._-]?idle[ ._-]?looking/i, 'warten'],
  [/looking[ ._-]?behind/i, 'umschauen'],

  /* mixamo-6: Kante und Festhalten. Beide Namen enthalten Wörter, die
     weiter unten schon gefangen würden ("Climbing Ledge" -> climb,
     "Hanging Idle" -> swing), deshalb stehen sie ganz oben. */
  [/ledge|climb(ing)?[ ._-]?to[ ._-]?top|mantle|clamber|hang[ ._-]?to[ ._-]?crouch/i, 'kante'],
  [/hanging[ ._-]?idle|braced[ ._-]?hang[ ._-]?idle/i, 'haengen'],

  /* mixamo-5: Wandklettern und seitliches Ausweichen. Diese Namen enthalten
     Wörter, die weiter unten schon von allgemeineren Regeln gefangen würden
     ("Climbing Up Wall" und "Freehang Climb" landen beide auf "climb",
     "Standing Dodge Left" auf "roll"). */
  [/climb(ing)?[ ._-]?up[ ._-]?wall|wall[ ._-]?climb/i, 'climb'],
  [/freehang/i, 'klettern_frei'],
  [/shimmy/i, 'klettern_seit'],
  [/dodge[ ._-]?left/i, 'ausweichenL'],
  [/dodge[ ._-]?right/i, 'ausweichenR'],
  [/falling[ ._-]?to[ ._-]?landing/i, 'land'],
  [/falling[ ._-]?idle/i, 'fall'],

  [/cheer|applaud|jubel/i, 'jubel'],
  [/block|guard|deckung/i, 'block'],
  [/taunt|battlecry|provoke/i, 'taunt'],
  [/knee/i, 'knie'],
  [/(jump|air)[ ._-]?attack/i, 'luftangriff'],
  [/hook/i, 'hook'],
  [/combo[ ._-]?punch/i, 'punch3'],

  [/land/i, 'land'],
  [/climb|ladder/i, 'climb'],
  [/swing|hang|brachiat|fly/i, 'swing'],
  [/roll|dodge|evade/i, 'roll'],
  [/dying|death|knock/i, 'sit'],
  [/react|stagger|impact|hit/i, 'hit'],
  [/kick/i, 'kick'],
  [/punch|jab|hook|boxing|elbow/i, 'punch'],
  [/jump|leap/i, 'jump'],
  [/fall|air/i, 'fall'],
  [/idle|breathing|standing/i, 'idle'],
  [/walk/i, 'walk'],
  [/run|jog|sprint/i, 'run'],
  [/sit|crouch/i, 'sit'],
];

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const opt = (name) => (args.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=') || null;
const slotArg = opt('slot');
const mapArg = opt('map');
const inputDir = positional[0] || 'tools/input';
const outputDir = positional[1] || 'assets';

if (slotArg && !SLOTS.includes(slotArg)) {
  console.error(`Unbekannter Slot "${slotArg}". Erlaubt: ${SLOTS.join(', ')}`);
  process.exit(1);
}
/* --map="warrok:thug,remy:civilian" -> [[/warrok/i,'thug'], ...] */
const festeZuordnung = (mapArg || '').split(',').filter(Boolean).map((paar) => {
  const [teil, slot] = paar.split(':');
  if (!SLOTS.includes(slot)) {
    console.error(`Unbekannter Slot "${slot}" in --map`);
    process.exit(1);
  }
  return [new RegExp(teil.trim(), 'i'), slot];
});

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

/* Verrät, was in einer GLB-Datei steckt */
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

/* Aus einer Animationsdatei alles entfernen außer der Bewegung */
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

function animTypFuer(name) {
  for (const [re, typ] of ANIM_KEYWORDS) if (re.test(name)) return typ;
  return null;
}

/* Slot aus dem Dateinamen ableiten (falls vorangestellt oder per --map) */
function slotAusName(name) {
  for (const [re, slot] of festeZuordnung) if (re.test(name)) return slot;
  const m = name.toLowerCase().replace(/[\s_]+/g, '-').match(/^([a-z0-9]+)-/);
  if (m && SLOTS.includes(m[1])) return m[1];
  return null;
}

if (!fs.existsSync(inputDir)) {
  console.error(`Eingabeordner ${inputDir} fehlt.`);
  process.exit(1);
}
fs.mkdirSync(outputDir, { recursive: true });

const files = fs.readdirSync(inputDir).filter((f) => /\.fbx$/i.test(f));
if (!files.length) {
  console.error(`Keine FBX-Dateien in ${inputDir} gefunden.`);
  process.exit(1);
}
/* Nach Änderungszeit sortieren – so bleibt die Download-Reihenfolge erhalten */
files.sort((a, b) => fs.statSync(path.join(inputDir, a)).mtimeMs
                   - fs.statSync(path.join(inputDir, b)).mtimeMs);

console.log(`${files.length} FBX-Datei(en) gefunden` +
            (slotArg ? ` (feste Figur: ${slotArg})` : ' (Automatik)') + '\n');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fbx-'));
const gefundeneModelle = [];   // {name, tmp}
const gefundeneAnims = [];     // {name, tmp, typ, groesse, slot}
let fehler = 0;

/* ---------- 1. Durchgang: alles umwandeln und einordnen ---------- */
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const tmp = path.join(tmpDir, `${i}.glb`);
  try {
    fbxToGlb(path.join(inputDir, file), tmp);
  } catch (e) {
    console.warn(`⚠ ${file}: konnte nicht umgewandelt werden – übersprungen.`);
    fehler++;
    continue;
  }
  const info = inspectGlb(tmp);
  const name = file.replace(/\.fbx$/i, '');
  const typ = animTypFuer(name);
  /* Einordnung:
     - keine Meshes  -> reine Animation ("Without Skin"-Download)
     - Meshes + Bewegungsname im Dateinamen -> Animation ("With Skin")
     - Meshes ohne Bewegungsname -> Charaktermodell (z. B. "Remy.fbx").
       Mixamo legt auch in T-Pose-Exporte eine "T-Pose"-Spur, deshalb darf
       die Anwesenheit einer Animation hier nicht entscheiden. */
  if (!info.hatMeshes && info.animationen > 0) {
    gefundeneAnims.push({ name, tmp, typ, groesse: fs.statSync(tmp).size,
                          slot: slotArg || slotAusName(name) });
  } else if (info.hatMeshes && typ) {
    gefundeneAnims.push({ name, tmp, typ, groesse: fs.statSync(tmp).size,
                          slot: slotArg || slotAusName(name) });
  } else if (info.hatMeshes) {
    gefundeneModelle.push({ name, tmp });
  } else {
    console.warn(`⚠ ${file}: weder Modell noch Animation – übersprungen.`);
    fehler++;
  }
}

console.log(`Erkannt: ${gefundeneModelle.length} Modell(e), ${gefundeneAnims.length} Animation(en)\n`);

/* Kein reines Modell dabei? Dann dient die kleinste Datei mit Netz als Modell. */
if (!gefundeneModelle.length) {
  const mitMesh = gefundeneAnims
    .filter((a) => inspectGlb(a.tmp).hatMeshes)
    .sort((a, b) => a.groesse - b.groesse)[0];
  if (mitMesh) {
    console.log(`Kein eigenes Charaktermodell gefunden – "${mitMesh.name}" wird als Modell verwendet.\n`);
    gefundeneModelle.push({ name: mitMesh.name, tmp: mitMesh.tmp });
  }
}

/* ---------- 2. Modelle den Figuren zuordnen ---------- */
const belegt = new Map();      // slot -> {name, tmp}
const freieSlots = [...AUTO_REIHENFOLGE];

for (const modell of gefundeneModelle) {
  let slot = slotArg || slotAusName(modell.name);
  if (!slot) {
    if (HELD_NAMEN.test(modell.name) && !belegt.has('hero')) slot = 'hero';
    else if (GEGNER_NAMEN.test(modell.name) && !belegt.has('thug')) slot = 'thug';
    else slot = freieSlots.shift() || null;
  }
  if (!slot) {
    console.warn(`⚠ ${modell.name}: keine freie Figur mehr – übersprungen.`);
    continue;
  }
  if (belegt.has(slot)) {
    console.warn(`⚠ ${modell.name}: Figur "${slot}" schon vergeben – übersprungen.`);
    continue;
  }
  belegt.set(slot, modell);
  const idx = freieSlots.indexOf(slot);
  if (idx >= 0) freieSlots.splice(idx, 1);
}

/* Übergangs-Animationen ("Idle To Braced Hang") wechseln nur einmal von
   einer Haltung in die andere und taugen nicht als Dauerbewegung. Gibt es
   für dieselbe Bewegungsart auch eine durchgehende Datei, gewinnt die. */
const istUebergang = (name) => /(^|[ ._-])to([ ._-]|$)/i.test(name);

/* Sonst gewinnt die kleinste Datei – das ist der "Without Skin"-Download. */
function besser(neu, alt) {
  const u1 = istUebergang(neu.name), u2 = istUebergang(alt.name);
  if (u1 !== u2) return u2;               // Übergang verliert gegen Dauerbewegung
  return neu.groesse < alt.groesse;
}

/* ---------- 3. Beste Animation je Bewegungsart wählen ---------- */
/* Bei mehreren Dateien derselben Bewegung gewinnt die kleinste
   (das ist der "Without Skin"-Download – die anderen enthalten
   überflüssigerweise das ganze Modell). */
const besteAnims = new Map();  // "slot|typ" oder "*|typ" -> eintrag
let ohneTyp = 0;
for (const anim of gefundeneAnims) {
  if (!anim.typ) {
    ohneTyp++;
    console.warn(`⚠ ${anim.name}: Bewegungsart nicht erkennbar – übersprungen.`);
    continue;
  }
  const key = `${anim.slot || '*'}|${anim.typ}`;
  const vorhanden = besteAnims.get(key);
  if (!vorhanden || besser(anim, vorhanden)) besteAnims.set(key, anim);
}

/* ---------- 4. Schreiben ---------- */
const ausAnims = [...new Set(gefundeneAnims.map((a) => a.slot).filter(Boolean))];
const zielSlots = belegt.size ? [...belegt.keys()]
  : (slotArg ? [slotArg]
  /* Sonst gelten die Bewegungen für alle Figuren, die es schon gibt –
     alle Mixamo-Figuren teilen sich dasselbe Skelett. */
  : (ausAnims.length ? ausAnims
  : SLOTS.filter((sl) => fs.existsSync(path.join(outputDir, sl + '.glb')))));

let geschriebeneModelle = 0, geschriebeneAnims = 0;

for (const [slot, modell] of belegt) {
  const ziel = path.join(outputDir, `${slot}.glb`);
  fs.copyFileSync(modell.tmp, ziel);
  const vorher = fs.statSync(ziel).size;
  await optimizeModel(ziel);
  console.log(`✓ Modell   "${modell.name}" -> ${slot}.glb ` +
              `(${(vorher / 1e6).toFixed(1)} MB -> ${(fs.statSync(ziel).size / 1e6).toFixed(1)} MB)`);
  geschriebeneModelle++;
}

for (const [key, anim] of besteAnims) {
  const [keySlot, typ] = key.split('|');
  // Animationen ohne feste Figur gelten für alle Figuren (gleiches Skelett)
  const slots = keySlot === '*' ? zielSlots : [keySlot];
  for (const slot of slots) {
    const ziel = path.join(outputDir, `${slot}@${typ}.glb`);
    fs.copyFileSync(anim.tmp, ziel);
    const vorher = fs.statSync(ziel).size;
    await stripToAnimation(ziel);
    console.log(`✓ Bewegung "${anim.name}" -> ${slot}@${typ}.glb ` +
                `(${(vorher / 1e3).toFixed(0)} KB -> ${(fs.statSync(ziel).size / 1e3).toFixed(0)} KB)`);
    geschriebeneAnims++;
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nFertig: ${geschriebeneModelle} Modell(e), ${geschriebeneAnims} Animationsdatei(en) -> ${outputDir}/`);
if (belegt.size) {
  console.log('Zuordnung:');
  for (const [slot, m] of belegt) console.log(`  ${slot.padEnd(10)} = ${m.name}`);
  if (!belegt.has('hero')) console.log('  hero       = eingebautes Netz-Kostüm (unverändert)');
}
if (fehler || ohneTyp) console.log(`Hinweis: ${fehler + ohneTyp} Datei(en) übersprungen.`);
if (!geschriebeneModelle && !geschriebeneAnims) process.exit(1);
