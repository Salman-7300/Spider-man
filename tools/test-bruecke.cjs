'use strict';
/* Teil 20 - die Bruecke.
   Geprueft wird, was beim Nachlaufen und auf den Bildern aufgefallen ist:
   der Gehweg brach an beiden Enden als 20 bis 25 cm hohe Kante ab, das
   Gelaender lief mitten durch beide Pylonbeine, und ueber die Bruecke
   fuhr kein einziges Auto - die extra dafuer gebaute Grenze war durch
   AUTO_X_MAX unerreichbar.
   Die Hoehenfunktionen werden dabei nicht nachgebaut, sondern aus
   game.js herausgeschnitten und ausgefuehrt. Sonst prueft der Test seine
   eigene Kopie statt des Spiels. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const wurzel = path.resolve(__dirname, '..');
const quelle = fs.readFileSync(path.join(wurzel, 'game.js'), 'utf8');

function schnipsel(regex, was) {
  const t = quelle.match(regex);
  assert.ok(t, 'nicht in game.js gefunden: ' + was);
  return t[0];
}
function wert(regex, was) {
  const t = quelle.match(regex);
  assert.ok(t, 'nicht in game.js gefunden: ' + was);
  return parseFloat(t[1]);
}

const BRIDGE_Z = wert(/const BRIDGE_Z = (-?[\d.]+)/, 'BRIDGE_Z');
const BRIDGE_HW = wert(/BRIDGE_HW = ([\d.]+)/, 'BRIDGE_HW');
const BR_GEH_INNEN = wert(/const BR_GEH_INNEN = ([\d.]+)/, 'BR_GEH_INNEN');
const BR_GEH_AUSSEN = wert(/const BR_GEH_AUSSEN = ([\d.]+)/, 'BR_GEH_AUSSEN');
const BR_GEH_H = wert(/const BR_GEH_H = ([\d.]+)/, 'BR_GEH_H');
const BR_HOCH = wert(/BR_HOCH = ([\d.]+)/, 'BR_HOCH');
const BR_RAMPE = wert(/BR_RAMPE = ([\d.]+)/, 'BR_RAMPE');
const BR_GEH_RAMPE = wert(/const BR_GEH_RAMPE = ([\d.]+)/, 'BR_GEH_RAMPE');
const RASTER_X1 = 175, RIVER_X1 = 330;
const BR_X0 = RASTER_X1 + 6, BR_X1 = RIVER_X1 + 4;

/* Die beiden Hoehenfunktionen im Original ausfuehren. */
const kasten = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  BR_X0, BR_X1, BR_RAMPE, BR_HOCH, BR_GEH_H, BR_GEH_RAMPE,
};
vm.createContext(kasten);
vm.runInContext(schnipsel(/function bridgeY\(x\) \{[\s\S]*?\n\}/, 'bridgeY'), kasten);
vm.runInContext(schnipsel(/function bridgeGehwegY\(x\) \{[\s\S]*?\n\}/, 'bridgeGehwegY'), kasten);

test('Der Brueckengehweg hat an keinem Ende eine Stufe', () => {
  /* In Zentimeterschritten ueber beide Enden. Aussen liegt der Gehweg
     auf Strassenhoehe, auf dem Deck 20 cm darueber - dazwischen darf es
     keinen Sprung geben. */
  let maxSprung = 0, wo = null;
  let vor = kasten.bridgeGehwegY(BR_X0 - BR_RAMPE - 5);
  for (let x = BR_X0 - BR_RAMPE - 5; x <= BR_X1 + BR_RAMPE + 5; x += 0.01) {
    const y = kasten.bridgeGehwegY(x);
    if (Math.abs(y - vor) > maxSprung) { maxSprung = Math.abs(y - vor); wo = +x.toFixed(2); }
    vor = y;
  }
  assert.ok(maxSprung < 0.01,
    'Stufe von ' + maxSprung.toFixed(3) + ' m im Gehweg bei x = ' + wo);
  /* Und die Eckwerte stimmen: draussen Strassenhoehe, in der Mitte
     Deckhoehe plus Bordstein. */
  assert.strictEqual(+kasten.bridgeGehwegY(BR_X0 - BR_RAMPE).toFixed(3), 0);
  assert.strictEqual(+kasten.bridgeGehwegY(BR_X0).toFixed(3), +BR_HOCH.toFixed(3));
  assert.strictEqual(+kasten.bridgeGehwegY((BR_X0 + BR_X1) / 2).toFixed(3),
                     +(BR_HOCH + BR_GEH_H).toFixed(3));
  assert.strictEqual(+kasten.bridgeGehwegY(BR_X1).toFixed(3), +BR_HOCH.toFixed(3));
});

test('Der Bordstein steht nur dort, wo der Gehweg wirklich hoeher liegt', () => {
  const t = quelle.match(/ohneZebraX\(zM - 0\.11, zM \+ 0\.11,\s*([^)]*)\)/);
  assert.ok(t, 'Bordstein der Bruecke nicht gefunden');
  assert.match(t[1], /BR_X0 \+ BR_GEH_RAMPE/);
  assert.match(t[1], /BR_X1 - BR_GEH_RAMPE/);
});

test('Das Gelaender laeuft nicht durch die Pylonbeine', () => {
  const PYL_X = JSON.parse(quelle.match(/const PYL_X = (\[[\d, ]*\])/)[1]);
  const luecke = wert(/const PYL_LUECKE = ([\d.]+)/, 'PYL_LUECKE');
  /* Das Bein ist 3 m breit, also 1,5 m ab Mitte. Die Luecke im Handlauf
     muss darueber hinausgehen. */
  assert.ok(luecke > 1.5, 'Luecke ' + luecke + ' m ist schmaler als das Pylonbein');
  /* Und die Seilebene liegt so, dass das Bein den Handlauf ueberhaupt
     trifft - sonst waere die Luecke ueberfluessig. */
  const SEIL_Z = BRIDGE_HW + 0.5;
  const zHand = BR_GEH_AUSSEN + 0.25;
  assert.ok(Math.abs(zHand - SEIL_Z) < 1.5,
    'Handlauf und Pylonbein beruehren sich gar nicht mehr - Luecke pruefen');
  /* Der Handlauf wird wirklich in Stuecken gebaut. */
  assert.match(quelle, /for \(const \[xa, xb\] of ohnePylonen\(BR_X0, BR_X1\)\)/);
  assert.ok(PYL_X.length === 2);
});

test('Die Brueckenstrasse ist fuer den Verkehr nicht mehr gesperrt', () => {
  /* AUTO_X_MAX haelt die Wagen aus Promenade und Fluss heraus. Fuer die
     Brueckenspur muss die Ausnahme dastehen, sonst biegt jeder Wagen an
     der letzten Kreuzung zwingend ab und die Bruecke bleibt leer. */
  assert.match(quelle,
    /const drin = weiter > car\.sMin - 1 && weiter < car\.sMax \+ 1 &&\s*!\(car\.axis === 'x' && !bruecke && weiter > AUTO_X_MAX\);/);
  assert.match(quelle, /const bruecke = autoAufBruecke\(car\);/);
  /* Abgebogen wird trotzdem nie nach Osten hinaus. */
  assert.match(quelle, /if \(neuesX > AUTO_X_MAX\) return false;/);
});

test('Die Wagen fahren auf dem Deck, nicht darin', () => {
  assert.match(quelle, /const zh = onBridge\(zx, zz\) \? bridgeY\(zx\) : 0;/);
  assert.match(quelle, /car\.mesh\.position\.set\(zx, zh, zz\);/);
  assert.match(quelle, /car\.mesh\.position\.y = lerp\(car\.mesh\.position\.y, zh, k\);/);
});

test('Der Brueckengehweg hat denselben Belag wie die Stadt', () => {
  assert.ok(!/new THREE\.MeshLambertMaterial\(\{ color: 0xb8bcc0 \}\)/.test(quelle),
    'der Gehweg ist wieder einfarbig hell');
  assert.match(quelle, /const t = sidewalkTex\.clone\(\);/);
  /* Und die Kachel wird auf die Laenge verteilt, sonst verschmiert sie. */
  assert.match(quelle, /t\.repeat\.set\(Math\.max\(1, Math\.round\(laenge \/ 4\)\)/);
});

test('Der Gehweg ist breit genug, um am Pylon vorbeizukommen', () => {
  /* Das Pylonbein frisst von aussen in den Gehweg hinein. Was bleibt,
     muss fuer zwei Passanten nebeneinander reichen. */
  const beinInnen = BRIDGE_HW + 0.5 - 1.5;          // Innenkante des Beins
  const frei = Math.min(BR_GEH_AUSSEN, beinInnen) - BR_GEH_INNEN;
  assert.ok(frei >= 3.0,
    'am Pylon bleiben nur ' + frei.toFixed(2) + ' m Gehweg uebrig');
});
