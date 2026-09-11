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
const AUTO_X_MAX = RASTER_X1 + 4;
const ORIGIN = -175, PITCH = 50, BLOCKS = 7, SHORE_OX = 336;
const PYL_X = JSON.parse(schnipsel(/const PYL_X = \[[\d, ]*\]/, 'PYL_X').replace('const PYL_X = ', ''));
const PYL_LUECKE = wert(/const PYL_LUECKE = ([\d.]+)/, 'PYL_LUECKE');
const PYL_BEIN_HALB = 1.5;      // halbe Breite eines Pylonbeins, siehe game.js

/* Die Originalfunktionen ausfuehren statt ihren Quelltext zu beschreiben.
   Was hier NICHT steht, steckt in einer 1.000-Zeilen-Funktion und laesst
   sich nicht herausschneiden - siehe docs/ARCHITEKTUR.md 3.3. */
const kasten = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  BR_X0, BR_X1, BR_RAMPE, BR_HOCH, BR_GEH_H, BR_GEH_RAMPE,
  BRIDGE_Z, BRIDGE_HW, PYL_X, PYL_LUECKE,
  ORIGIN, PITCH, BLOCKS, SHORE_OX, AUTO_X_MAX,
  /* Stellvertreter fuer die Bausteine, die brGehTextur benutzt. */
  sidewalkTex: { clone: () => ({ istKopie: true, repeat: { x: 1, y: 1, set(a, b) { this.x = a; this.y = b; } } }) },
  THREE: { MeshLambertMaterial: function (p) { Object.assign(this, p); } },
};
vm.createContext(kasten);
for (const [re, name] of [
  [/function bridgeY\(x\) \{[\s\S]*?\n\}/, 'bridgeY'],
  [/function bridgeGehwegY\(x\) \{[\s\S]*?\n\}/, 'bridgeGehwegY'],
  [/function onBridge\(x, z\) \{[\s\S]*?\n\}/, 'onBridge'],
  [/function ohnePylonen\(a, b\) \{[\s\S]*?\n\}/, 'ohnePylonen'],
  [/function autoAufBruecke\(car\) \{[\s\S]*?\n\}/, 'autoAufBruecke'],
  [/function setzeAutoGrenzen\(car\) \{[\s\S]*?\n\}/, 'setzeAutoGrenzen'],
  [/  function brGehTextur\(laenge, breite\) \{[\s\S]*?\n  \}/, 'brGehTextur'],
]) vm.runInContext(schnipsel(re, name).replace(/^ {2}/gm, ''), kasten);

/* Die Bedingung "faehrt weiter" steht mitten in autoKreuzung und ist
   keine eigene Funktion. Sie wird deshalb als Ausdruck herausgeschnitten
   und mit echten Werten gerechnet - nicht abgeschrieben. */
const drinQuelle = schnipsel(
  /const drin = weiter > car\.sMin - 1[\s\S]*?AUTO_X_MAX\);/, 'Bedingung drin');
kasten.drinPruefen = vm.runInContext(
  '(function (weiter, car, bruecke) { ' + drinQuelle + ' return drin; })', kasten);

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
  /* Und jetzt die Zerlegung selbst durchrechnen, mit der echten Funktion
     aus game.js: kein Stueck Handlauf darf ein Pylonbein beruehren, und
     zwischen den Beinen darf auch keine Luecke bleiben. */
  const stuecke = kasten.ohnePylonen(BR_X0, BR_X1);
  assert.strictEqual(stuecke.length, PYL_X.length + 1,
    PYL_X.length + ' Pylonen muessen den Handlauf in ' + (PYL_X.length + 1) +
    ' Stuecke teilen, es sind ' + stuecke.length);
  for (const [xa, xb] of stuecke) {
    assert.ok(xb > xa, 'leeres Handlaufstueck ' + xa + '..' + xb);
    for (const px of PYL_X) {
      assert.ok(xb <= px - PYL_BEIN_HALB || xa >= px + PYL_BEIN_HALB,
        'Handlaufstueck ' + xa.toFixed(2) + '..' + xb.toFixed(2) +
        ' laeuft in das Pylonbein bei x = ' + px);
    }
  }
  /* Gesamtlaenge: alles ausser den beiden Luecken. */
  const laenge = stuecke.reduce((n, [xa, xb]) => n + (xb - xa), 0);
  assert.strictEqual(+laenge.toFixed(3),
    +((BR_X1 - BR_X0) - PYL_X.length * 2 * PYL_LUECKE).toFixed(3));
});

test('Die Brueckenstrasse ist fuer den Verkehr nicht mehr gesperrt', () => {
  /* AUTO_X_MAX haelt die Wagen aus Promenade und Fluss heraus. Fuer die
     Brueckenspur muss die Ausnahme dastehen, sonst biegt jeder Wagen an
     der letzten Kreuzung zwingend ab und die Bruecke bleibt leer. */
  /* Ein Wagen auf der Brueckenspur und einer auf der Uferstrasse - beide
     mit den echten Funktionen aus game.js durchgerechnet. */
  const aufBruecke = { axis: 'x', lane: BRIDGE_Z + 3, dir: 1, s: BR_X0 };
  /* Die zweite Spur liegt bei z = +25, also eine Strassenlinie weit weg
     von der Bruecke (BRIDGE_Z = -25). */
  const aufUfer = { axis: 'x', lane: 25, dir: 1, s: 0 };
  assert.strictEqual(kasten.autoAufBruecke(aufBruecke), true);
  assert.strictEqual(kasten.autoAufBruecke(aufUfer), false);

  kasten.setzeAutoGrenzen(aufBruecke);
  kasten.setzeAutoGrenzen(aufUfer);
  assert.strictEqual(aufBruecke.sMax, SHORE_OX + 3,
    'der Brueckenwagen darf bis ans Ostufer, nicht nur bis zum Raster');
  assert.strictEqual(aufUfer.sMax, ORIGIN + BLOCKS * PITCH + 3);

  /* Und die Bedingung selbst: in der Mitte der Bruecke (x = 260, weit
     hinter AUTO_X_MAX = 179) faehrt der Brueckenwagen weiter, der Wagen
     auf derselben x-Achse ausserhalb der Bruecke nicht. */
  const mitte = (BR_X0 + BR_X1) / 2;
  assert.strictEqual(kasten.drinPruefen(mitte, aufBruecke, true), true,
    'die Bruecke ist wieder gesperrt - AUTO_X_MAX greift auf der Brueckenspur');
  assert.strictEqual(kasten.drinPruefen(mitte, aufUfer, false), false,
    'ein Wagen ausserhalb der Bruecke duerfte nicht ueber AUTO_X_MAX hinaus');
  assert.ok(mitte > AUTO_X_MAX, 'Testaufbau falsch: Brueckenmitte liegt vor AUTO_X_MAX');
});

test('Die Wagen fahren auf dem Deck, nicht darin', () => {
  /* Genau die Zeile, mit der game.js die Wagenhoehe bestimmt, hier mit
     den echten Funktionen nachgerechnet. */
  const hoehe = (x, z) => (kasten.onBridge(x, z) ? kasten.bridgeY(x) : 0);
  assert.strictEqual(+hoehe((BR_X0 + BR_X1) / 2, BRIDGE_Z + 3).toFixed(3),
    +BR_HOCH.toFixed(3), 'der Wagen auf der Brueckenmitte steckt im Deck');
  assert.strictEqual(hoehe(BR_X0 - BR_RAMPE, BRIDGE_Z + 3), 0,
    'am Rampenfuss muss der Wagen auf Strassenhoehe stehen');
  assert.strictEqual(hoehe(0, -25), 0, 'in der Stadt faehrt niemand erhoeht');
  /* Auf der Rampe steigt die Hoehe streng monoton - kein Absatz. */
  let vor = -1;
  for (let i = 0; i <= 120; i++) {
    const x = BR_X0 - BR_RAMPE + (i / 120) * BR_RAMPE;
    const y = hoehe(x, BRIDGE_Z);
    assert.ok(y >= vor, 'die Auffahrt faellt bei x = ' + x.toFixed(2) + ' wieder ab');
    vor = y;
  }
  assert.strictEqual(+hoehe(BR_X0, BRIDGE_Z).toFixed(3), +BR_HOCH.toFixed(3),
    'oben auf der Rampe ist die Deckhoehe noch nicht erreicht');
});

test('Der Brueckengehweg hat denselben Belag wie die Stadt', () => {
  /* brGehTextur aus game.js wirklich aufrufen, mit Stellvertretern fuer
     Textur und Material. Frueher stand hier nur, dass der Aufruf im
     Quelltext vorkommt - das haette auch bei falschen Zahlen gehalten. */
  const gehBreite = BR_GEH_AUSSEN - BR_GEH_INNEN;
  const lang = BR_X1 - BR_X0;
  const mat = kasten.brGehTextur(lang, gehBreite);
  assert.ok(mat.map && mat.map.istKopie,
    'der Gehweg benutzt nicht den Stadtbelag');
  assert.strictEqual(mat.map.repeat.x, Math.round(lang / 4),
    'die Kachel wird ueber ' + lang.toFixed(0) + ' m gestreckt statt wiederholt');
  assert.strictEqual(mat.map.repeat.y, Math.max(1, Math.round(gehBreite / 4)));
  /* Und sie faellt nie unter eine Wiederholung, auch nicht auf dem
     kurzen Keil der Rampe. */
  const keil = kasten.brGehTextur(BR_GEH_RAMPE, gehBreite);
  assert.ok(keil.map.repeat.x >= 1 && keil.map.repeat.y >= 1);
});

test('Der Gehweg ist breit genug, um am Pylon vorbeizukommen', () => {
  /* Das Pylonbein frisst von aussen in den Gehweg hinein. Was bleibt,
     muss fuer zwei Passanten nebeneinander reichen. */
  const beinInnen = BRIDGE_HW + 0.5 - 1.5;          // Innenkante des Beins
  const frei = Math.min(BR_GEH_AUSSEN, beinInnen) - BR_GEH_INNEN;
  assert.ok(frei >= 3.0,
    'am Pylon bleiben nur ' + frei.toFixed(2) + ' m Gehweg uebrig');
});
