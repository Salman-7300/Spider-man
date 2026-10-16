'use strict';
/* Fragt der Lader nur Animationen an, die es auch gibt?

   Im Human-Playtest stand die Konsole voll mit Zeilen wie
   "thug@wandsprung.glb 404", "thug@netzwurf.glb 404", "thug@sturzflug.glb
   404". Die Ursache war keine fehlende Datei, sondern eine falsche Liste:
   33 Bewegungen, die es nur fuer den Helden gibt, standen in
   GLB_ANIM_PARTS - der Liste FUER ALLE Slots. Bei jedem Seitenaufruf
   ergab das 99 vergebliche Anfragen, dazu 'attack', das es fuer keinen
   einzigen Slot gibt: zusammen 100.

   Dieser Test vergleicht die Listen mit dem tatsaechlichen Dateibestand
   in assets/. Er faellt in beide Richtungen auf:
     - angefragt, aber nicht vorhanden  -> 404 beim Laden
     - vorhanden, aber nie angefragt    -> Datei liegt ungenutzt herum */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const wurzel = path.resolve(__dirname, '..');
const quelle = fs.readFileSync(path.join(wurzel, 'game.js'), 'utf8');

/* Ein Array-Literal aus game.js ueber die Klammerbilanz herausschneiden -
   nicht ueber einen Regex, die Listen sind mehrzeilig und voller
   Kommentare. */
function liste(name) {
  const a = quelle.indexOf('const ' + name + ' = [');
  assert.ok(a >= 0, name + ' nicht in game.js gefunden - umbenannt?');
  let i = quelle.indexOf('[', a), t = 0, j = i;
  for (; j < quelle.length; j++) {
    const c = quelle[j];
    if (c === '[') t++;
    else if (c === ']') { t--; if (!t) break; }
  }
  const roh = quelle.slice(i, j + 1)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return [...roh.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const dateien = new Set(fs.readdirSync(path.join(wurzel, 'assets'))
  .filter((f) => f.endsWith('.glb'))
  .map((f) => f.slice(0, -4)));

const ALLE = liste('GLB_ANIM_PARTS');
const NUR_HELD = liste('HELD_NUR_PARTS');
const ZIVI = liste('ZIVI_ANIM_PARTS');
const RICHT = liste('RICHT_8');
/* HELD_ANIM_PARTS wird zusammengesetzt - hier genauso nachgebaut wie in
   game.js, damit der Test die WIRKLICH angefragte Menge prueft. */
const HELD = [].concat(
  RICHT.map((r) => 'ausw_' + r),
  RICHT.map((r) => 'rolle_' + r),
  ['spin_l', 'spin_r', 'sprint_lang', 'gleiten'],
  NUR_HELD);

const SLOTS = liste('GLB_ANIM_SLOTS');

function angefragt(slot) {
  return [].concat(ALLE,
    slot === 'hero' ? HELD : [],
    slot === 'civilian' ? ZIVI : []);
}

test('Die Slot-Liste ist die erwartete', () => {
  assert.deepStrictEqual(SLOTS.slice().sort(),
    ['civilian', 'civilian2', 'hero', 'thug'],
    'GLB_ANIM_SLOTS hat sich geaendert - dieser Test muss nachgezogen werden');
});

test('Jede angefragte Animation existiert als Datei', () => {
  const fehlt = [];
  for (const slot of SLOTS) {
    for (const teil of angefragt(slot)) {
      if (!dateien.has(slot + '@' + teil)) fehlt.push(slot + '@' + teil + '.glb');
    }
  }
  assert.deepStrictEqual(fehlt, [],
    fehlt.length + ' Anfragen ohne Datei - genau so viele 404 bei jedem ' +
    'Seitenaufruf: ' + fehlt.slice(0, 12).join(', ') +
    (fehlt.length > 12 ? ' ...' : ''));
});

test('Jede vorhandene Animationsdatei wird auch angefragt', () => {
  const ungenutzt = [];
  for (const slot of SLOTS) {
    const gewollt = new Set(angefragt(slot));
    for (const d of dateien) {
      if (!d.startsWith(slot + '@')) continue;
      const teil = d.slice(slot.length + 1);
      if (!gewollt.has(teil)) ungenutzt.push(d + '.glb');
    }
  }
  assert.deepStrictEqual(ungenutzt, [],
    ungenutzt.length + ' Dateien liegen in assets/, werden aber nie ' +
    'geladen: ' + ungenutzt.slice(0, 12).join(', '));
});

test('Keine Bewegung steht in zwei Listen', () => {
  /* Stuende ein Name sowohl in GLB_ANIM_PARTS als auch in
     HELD_NUR_PARTS, wuerde der Held ihn zweimal laden. */
  const doppelt = NUR_HELD.filter((n) => ALLE.indexOf(n) >= 0);
  assert.deepStrictEqual(doppelt, [],
    'in beiden Listen: ' + doppelt.join(', ') + ' - der Held laedt sie doppelt');
  const zd = ZIVI.filter((n) => ALLE.indexOf(n) >= 0);
  assert.deepStrictEqual(zd, [], 'Zivilistenbewegung auch in der Liste fuer alle: ' + zd.join(', '));
});

test('Die Heldenliste enthaelt die frueher falsch einsortierten Namen', () => {
  /* Regressionsschutz fuer genau die Namen, die im Playtest als 404 zu
     sehen waren. Landen sie wieder in der Liste fuer alle, faellt das
     hier auf und nicht erst in der Konsole eines Menschen. */
  for (const n of ['wandsprung', 'netzwurf', 'sturzflug', 'schwung2', 'ziehen',
                   'stampfen', 'zip_dreh', 'flip_v', 'flip_h', 'wandkriech_h']) {
    assert.ok(NUR_HELD.indexOf(n) >= 0,
      n + ' fehlt in HELD_NUR_PARTS - wenn es in GLB_ANIM_PARTS steht, ' +
      'fragen Gegner und Zivilisten es wieder vergeblich an');
    assert.ok(ALLE.indexOf(n) < 0, n + ' steht wieder in der Liste fuer alle Slots');
  }
});
