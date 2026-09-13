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

/* ======================= Strassenhierarchie (CITY V2, Stufe 3) =======
   Geprueft wird die ECHTE Einteilung aus game.js, nicht eine Kopie: der
   Abschnitt wird herausgeschnitten und ausgefuehrt. Die Zusage lautet,
   dass die Hierarchie OHNE einen Meter mehr Asphalt auskommt - das ist
   eine Rechnung, die sich hier offline pruefen laesst. */
const hier = quelle.match(
  /const STR_TEMPO = \{[\s\S]*?\nfunction strasseTempo\(achse, linie\) \{[\s\S]*?\n\}/);
assert.ok(hier, 'die Strassenhierarchie wurde in game.js nicht gefunden');
const kasten2 = {
  Math, PITCH: 50, RASTER_X0: -325, RASTER_X1: 175, RASTER_Z0: -275, RASTER_Z1: 275,
  BLOCKS_X: 10, BLOCKS_Z: 11, BRIDGE_Z: -25,
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
};
kasten2.rasterO = (a) => (a === 'x' ? kasten2.RASTER_X0 : kasten2.RASTER_Z0);
kasten2.rasterE = (a) => (a === 'x' ? kasten2.RASTER_X1 : kasten2.RASTER_Z1);
kasten2.rasterN = (a) => (a === 'x' ? kasten2.BLOCKS_X : kasten2.BLOCKS_Z);
kasten2.querAchse = (a) => (a === 'x' ? 'z' : 'x');
kasten2.rasterLinien = (a) => {
  const o = kasten2.rasterO(a), n = kasten2.rasterN(a), aus = [];
  for (let i = 0; i <= n; i++) aus.push(o + i * 50);
  return aus;
};
vm.createContext(kasten2);
/* const-Deklarationen landen in einer vm nicht auf dem Kontextobjekt -
   sie liegen im lexikalischen Bereich des Skripts. Deshalb werden sie
   ausdruecklich herausgereicht. */
vm.runInContext(hier[0] + '\nglobalThis.__H = { STR_TEMPO, STR_KLASSEN };', kasten2);
const KLASSEN = kasten2.__H.STR_KLASSEN;
const ROAD_HALF_T = 6;

test('Keine Spur liegt ausserhalb des Asphalts', () => {
  /* Das ist die ganze Begruendung dafuer, dass die Hierarchie den Kern
     nicht verschiebt: sie braucht keinen Millimeter mehr Strasse. */
  for (const [name, k] of Object.entries(KLASSEN)) {
    for (const m of k.mitten) {
      const rand = Math.abs(m) + k.spurBreite / 2;
      assert.ok(rand <= ROAD_HALF_T,
        name + ': Spurmitte ' + m + ' reicht bis ' + rand.toFixed(2) +
        ' m, der Asphalt endet bei ' + ROAD_HALF_T);
    }
    assert.strictEqual(k.mitten.length, k.spuren,
      name + ': spuren sagt ' + k.spuren + ', es sind ' + k.mitten.length + ' Spurmitten');
  }
});

test('Spuren derselben Richtung ueberlappen sich nicht', () => {
  for (const [name, k] of Object.entries(KLASSEN)) {
    const s = [...k.mitten].sort((a, b) => a - b);
    for (let i = 0; i + 1 < s.length; i++)
      assert.ok(s[i + 1] - s[i] >= k.spurBreite - 0.01,
        name + ': Spuren bei ' + s[i] + ' und ' + s[i + 1] +
        ' liegen enger als ihre Breite ' + k.spurBreite);
  }
});

test('spurMitten liefert nur Spuren der gefragten Richtung', () => {
  for (const achse of ['x', 'z'])
    for (const linie of kasten2.rasterLinien(achse))
      for (const dir of [1, -1]) {
        const m = kasten2.spurMitten(achse, linie, dir);
        assert.ok(m.length >= 1, achse + ' ' + linie + ': keine Spur fuer Richtung ' + dir);
        for (const v of m)
          assert.ok(Math.sign(v - linie) === dir,
            achse + ' ' + linie + ': Spur ' + v + ' gehoert nicht zu Richtung ' + dir);
      }
});

test('Uferstrasse und Brueckenstrasse behalten ihre zwei Spuren', () => {
  /* Beide sind eingebaut: oestlich der Uferstrasse liegt die Promenade,
     und das Brueckendeck hat ab 5,6 m Gehweg. Vier Spuren passen dort
     nicht - das ist keine Geschmacksfrage, sondern Geometrie. */
  assert.strictEqual(kasten2.strasseKlasse('x', 175), 'STREET');
  assert.strictEqual(kasten2.strasseKlasse('z', -25), 'STREET');
  /* Aus der vm kommen fremde Array-Prototypen - deshalb kopiert
     vergleichen, nicht als Verweis. */
  assert.deepStrictEqual([...kasten2.strasseInfo('x', 175).mitten], [-3, 3]);
  assert.deepStrictEqual([...kasten2.strasseInfo('z', -25).mitten], [-3, 3]);
});

test('Die Randstrassen sind Nebenstrassen', () => {
  assert.strictEqual(kasten2.strasseKlasse('x', -325), 'LOCAL');
  assert.strictEqual(kasten2.strasseKlasse('z', -275), 'LOCAL');
  assert.strictEqual(kasten2.strasseKlasse('z', 275), 'LOCAL');
});

test('Es gibt von jeder Klasse mindestens eine Strasse', () => {
  const zaehl = {};
  for (const achse of ['x', 'z'])
    for (const linie of kasten2.rasterLinien(achse)) {
      const k = kasten2.strasseKlasse(achse, linie);
      zaehl[k] = (zaehl[k] || 0) + 1;
    }
  for (const k of ['LOCAL', 'STREET', 'AVENUE', 'BOULEVARD'])
    assert.ok(zaehl[k] > 0, 'keine einzige Strasse der Klasse ' + k);
  /* Die Stadt darf nicht nur aus Hauptstrassen bestehen. */
  const gesamt = Object.values(zaehl).reduce((a, b) => a + b, 0);
  assert.ok(zaehl.STREET / gesamt > 0.4,
    'nur ' + zaehl.STREET + ' von ' + gesamt + ' Linien sind normale Strassen');
});

test('Abgebogen wird auf die Linie der BISHERIGEN Fahrachse', () => {
  /* Die Falle: linie ist eine Linie auf der Achse, auf der das Auto
     GERADE faehrt - dort liegt nach dem Abbiegen seine neue Spur. Mit
     querAchse(car.axis) landet es auf Linien, die es dort nicht gibt.
     Im quadratischen Raster faellt so etwas nie auf. */
  const ak = quelle.match(/function autoKreuzung\(car, linie\)[\s\S]*?\n\}/);
  assert.ok(ak, 'autoKreuzung nicht gefunden');
  assert.match(ak[0], /const neueLane = pick\(spurMitten\(car\.axis, linie, nd\)\);/);
  const rl = quelle.match(/function respLenke\(car, linie\)[\s\S]*?\n\}/);
  assert.ok(rl, 'respLenke nicht gefunden');
  assert.match(rl[0], /const neueLane = pick\(spurMitten\(car\.axis, linie, nd\)\);/);
});
