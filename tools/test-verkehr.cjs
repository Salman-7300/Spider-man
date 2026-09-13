'use strict';
/* Teil 17 - Vorfahrt an der Kreuzung.
   Der Stundenlauf hat zwei Schlangen gefunden, deren Koepfe sich
   gegenseitig blockierten: an der Uferstrasse (175 | -25) standen beide
   bis zu 1379 Sekunden. Ursache war, dass jeder Wagen zu einem ANDEREN
   Punkt rechnete - zu dem auf seiner eigenen Spur, drei Meter neben der
   Kreuzungsmitte.
   Geprueft wird die echte Entscheidung aus game.js, nicht eine Kopie:
   die Funktion wird aus der Quelle geschnitten und ausgefuehrt. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const quelle = fs.readFileSync(path.resolve(__dirname, '..', 'game.js'), 'utf8');
const t = quelle.match(/function querverkehrWarten\(car, dKreuz, liste\) \{[\s\S]*?\n\}/);
assert.ok(t, 'querverkehrWarten nicht in game.js gefunden');

const kasten = {
  Math, PITCH: 50, ROAD_HALF: 6, RIVER_X0: 192,
  /* CITY V2: das Raster hat getrennte Achsen. Die Helfer werden aus
     game.js ausgefuehrt, nicht hier nachgebaut. */
  RASTER_X0: -175, RASTER_X1: 175, RASTER_Z0: -175, RASTER_Z1: 175,
  BLOCKS_X: 7, BLOCKS_Z: 7, clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
};
vm.createContext(kasten);
const helfer = quelle.match(/const rasterO = [\s\S]*?\n\}\n(?=\/\* Liegt ein Punkt)/);
assert.ok(helfer, 'Rasterhelfer nicht in game.js gefunden');
vm.runInContext(helfer[0], kasten);
vm.runInContext(t[0], kasten);
const warten = kasten.querverkehrWarten;

/* Die gemessene Lage: ein Wagen auf der Brueckenspur faehrt nach Westen
   auf die Kreuzung x = 175 zu, ein zweiter auf der Uferstrasse nach
   Norden auf z = -25. Beide sind knapp neun Meter entfernt. */
const brueckenWagen = { axis: 'x', lane: -28, s: 183.8, dir: -1, aus: false };
const uferWagen     = { axis: 'z', lane: 178, s: -33.9, dir: 1, aus: false };
const dBruecke = 183.8 - 175;       // 8,8
const dUfer = -25 - (-33.9);        // 8,9
const beide = [brueckenWagen, uferWagen];

test('An der Kreuzung wartet hoechstens einer von zweien', () => {
  const a = warten(brueckenWagen, dBruecke, beide);
  const b = warten(uferWagen, dUfer, beide);
  assert.ok(!(a && b),
    'beide warten aufeinander - genau das war die Verklemmung an (175 | -25)');
  assert.ok(a || b, 'keiner wartet - dann fahren beide in die Kreuzung');
});

test('Wer naeher an der Kreuzung ist, faehrt zuerst', () => {
  /* Deutlicher Abstand, kein Gleichstand: der Uferwagen ist fuenf Meter
     naeher dran. */
  const nah = { axis: 'z', lane: 178, s: -29, dir: 1, aus: false };
  const fern = { axis: 'x', lane: -28, s: 195, dir: -1, aus: false };
  const liste = [nah, fern];
  assert.strictEqual(warten(nah, -25 - (-29), liste), false, 'der Nahe wartet');
  assert.strictEqual(warten(fern, 195 - 175, liste), true, 'der Ferne faehrt durch');
});

test('Beide Wagen rechnen mit derselben Kreuzung', () => {
  /* Der Kern des Fehlers: wird der Kreuzungspunkt aus der eigenen SPUR
     gebildet, sieht jeder den anderen drei Meter naeher. Deshalb muss die
     Querlage aus der Gitterlinie kommen. */
  assert.match(t[0], /const kQuer = rasterLinieNah\(car\.lane, querAchse\(car\.axis\)\);/);
  assert.ok(!/car\.axis === 'x' \? car\.s \+ car\.dir \* dKreuz : car\.lane/.test(t[0]),
    'der Kreuzungspunkt wird wieder aus der eigenen Spur gebildet');
});

test('Ein Fluchtauto hat immer Vorrang', () => {
  /* Weiter weg als der eigene Abstand (15 gegen 8,8 m) - ohne die
     Fluchtregel wuerde hier NICHT gewartet. Mehr als 24 m zaehlen gar
     nicht mehr, auch nicht bei einer Flucht. */
  const flucht = { axis: 'z', lane: 178, s: -40, dir: 1, aus: false, flucht: true };
  const ohne = { axis: 'z', lane: 178, s: -40, dir: 1, aus: false };
  assert.strictEqual(warten(brueckenWagen, dBruecke, [brueckenWagen, ohne]), false,
    'ohne Flucht wird bei 15 m Abstand nicht gewartet');
  assert.strictEqual(warten(brueckenWagen, dBruecke, [brueckenWagen, flucht]), true);
});

test('Wer die Kreuzung schon hinter sich hat, haelt niemanden auf', () => {
  const weg = { axis: 'z', lane: 178, s: -10, dir: 1, aus: false };   // schon drueber
  assert.strictEqual(warten(brueckenWagen, dBruecke, [brueckenWagen, weg]), false);
});

test('Eine andere Kreuzung zaehlt nicht', () => {
  const anderswo = { axis: 'z', lane: 128, s: -33.9, dir: 1, aus: false };
  assert.strictEqual(warten(brueckenWagen, dBruecke, [brueckenWagen, anderswo]), false);
});
