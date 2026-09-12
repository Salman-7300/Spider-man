'use strict';
/* Der Missions-Innenraum, geprueft ohne Browser.

   mission-interiors.js ist bewusst eine eigene Datei ohne Spielzustand -
   damit laesst sich der Raum wie city-visuals.js direkt in node bauen und
   vermessen. Geprueft wird, was der Human-Playtest am alten Innenraum
   bemaengelt hat: durchlaufbare Moebel, flackernder Boden, Figuren an
   Stellen, an denen kein Platz ist. */
const test = require('node:test');
const assert = require('node:assert');
const THREE = require('../lib/three.min.js');
const factory = require('../mission-interiors.js');
const INT = factory(THREE);

const O = { x: 1000, y: 0, z: 1000 };
const bau = () => INT.createHideout(O);

/* Platzbedarf einer Figur im Spiel (player.radius). */
const FIGUR = 0.45;

function stecktDrin(k, x, z, r, unten, oben) {
  if (k.h <= (unten === undefined ? 0.35 : unten)) return false;
  if (k.y0 !== undefined && (oben === undefined ? 1.75 : oben) < k.y0) return false;
  return x > k.x0 - r && x < k.x1 + r && z > k.z0 - r && z < k.z1 + r;
}

test('Der Innenraum entsteht mit allen Punkten, die die Mission braucht', () => {
  const h = bau();
  for (const feld of ['gruppe', 'kollider', 'bodenY', 'grenzen', 'spielerStart',
                      'geiselPunkt', 'funkPunkt', 'hinterausgang', 'funkWeg',
                      'gegnerPunkte', 'zonen', 'masse']) {
    assert.ok(h[feld] !== undefined && h[feld] !== null, feld + ' fehlt');
  }
  assert.strictEqual(h.bodenY, 0);
  assert.ok(h.gegnerPunkte.length >= 6,
    'nur ' + h.gegnerPunkte.length + ' Gegnerplaetze - der Hauptkampf braucht mindestens 6');
  assert.ok(h.masse.laenge >= 28 && h.masse.laenge <= 32, 'Laenge ausserhalb der Vorgabe');
  assert.ok(h.masse.breite >= 20 && h.masse.breite <= 24, 'Breite ausserhalb der Vorgabe');
  assert.ok(h.masse.hoehe >= 4.5 && h.masse.hoehe <= 6, 'Hoehe ausserhalb der Vorgabe');
});

test('Es gibt genau EINE waagerechte Flaeche auf Bodenhoehe', () => {
  /* Der Playtest meldete flackernden Boden. Die haeufigste Ursache sind
     zwei Flaechen auf derselben Hoehe. Gezaehlt wird jede waagerechte
     Flaeche, deren Hoehe weniger als einen Zentimeter vom Fussboden
     abweicht. */
  const h = bau();
  let aufBoden = 0;
  const gefunden = [];
  h.gruppe.traverse((m) => {
    if (!m.isMesh) return;
    const waagerecht = Math.abs(Math.abs(m.rotation.x) - Math.PI / 2) < 0.01;
    if (!waagerecht) return;
    if (Math.abs(m.position.y - h.bodenY) < 0.01) { aufBoden++; gefunden.push(+m.position.y.toFixed(3)); }
  });
  assert.strictEqual(aufBoden, 1,
    aufBoden + ' waagerechte Flaechen auf Bodenhoehe (' + gefunden.join(', ') +
    ') - zwei davon flackern gegeneinander');
});

test('Bodenmarkierungen liegen hoeher UND haben polygonOffset', () => {
  const h = bau();
  let markierungen = 0;
  h.gruppe.traverse((m) => {
    if (!m.isMesh) return;
    if (Math.abs(Math.abs(m.rotation.x) - Math.PI / 2) > 0.01) return;
    const dy = m.position.y - h.bodenY;
    if (dy <= 0.001 || dy > 0.2) return;        // Boden bzw. Decke
    markierungen++;
    assert.ok(dy >= 0.01,
      'Markierung nur ' + dy.toFixed(4) + ' m ueber dem Boden - zu wenig gegen Flackern');
    assert.ok(m.material.polygonOffset === true,
      'Markierung ohne polygonOffset - der Abstand allein hat in der Stadt schon geflackert');
  });
  assert.ok(markierungen > 0, 'keine Markierung gefunden - der Test prueft nichts');
});

test('Der Raum ist geschlossen: keine Luecke in den vier Aussenwaenden', () => {
  /* Abgetastet wird DICHT an der Innenkante. Kommt eine Figur dort
     hindurch, fuehrt der Weg in die leere Welt. */
  const h = bau();
  const g = h.grenzen;
  const luecken = [];
  for (let x = g.x0; x <= g.x1; x += 0.25) {
    for (const z of [g.z0 - 0.6, g.z1 + 0.6]) {
      if (!h.kollider.some((k) => stecktDrin(k, x, z, FIGUR)))
        luecken.push([+x.toFixed(1), +z.toFixed(1)]);
    }
  }
  for (let z = g.z0; z <= g.z1; z += 0.25) {
    for (const x of [g.x0 - 0.6, g.x1 + 0.6]) {
      if (!h.kollider.some((k) => stecktDrin(k, x, z, FIGUR)))
        luecken.push([+x.toFixed(1), +z.toFixed(1)]);
    }
  }
  assert.deepStrictEqual(luecken.slice(0, 5), [],
    luecken.length + ' Luecken in der Aussenwand, z.B. ' +
    JSON.stringify(luecken.slice(0, 5)));
});

test('Jedes sichtbar massive Requisit hat einen Kollisionskasten', () => {
  /* Human-Playtest: "Man konnte durch Moebel durchlaufen."
     Geprueft wird die Umkehrung: jeder sichtbare Kasten, der groesser als
     ein Dekostueck ist und auf Figurhoehe steht, muss von einem
     Kollisionskasten gedeckt sein. */
  const h = bau();
  const ohne = [];
  h.gruppe.traverse((m) => {
    if (!m.isMesh || m.geometry.type !== 'BoxGeometry') return;
    const s = m.scale, p = m.position;
    const gross = s.x > 0.7 && s.z > 0.7 && s.y > 0.5;
    if (!gross) return;
    const unten = p.y - s.y / 2, oben = p.y + s.y / 2;
    if (oben <= h.bodenY + 0.35) return;          // Stufe, kein Hindernis
    if (unten > h.bodenY + 1.9) return;           // haengt ueber dem Kopf
    const gedeckt = h.kollider.some((k) =>
      p.x > k.x0 - 0.05 && p.x < k.x1 + 0.05 && p.z > k.z0 - 0.05 && p.z < k.z1 + 0.05 &&
      k.h > h.bodenY + 0.35);
    if (!gedeckt) ohne.push({ p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
                              gr: [+s.x.toFixed(1), +s.y.toFixed(1), +s.z.toFixed(1)] });
  });
  assert.deepStrictEqual(ohne, [],
    ohne.length + ' massive Requisiten ohne Kollision: ' + JSON.stringify(ohne));
});

test('Kein Gegnerplatz steckt in einem Kollisionskasten', () => {
  const h = bau();
  const schlecht = h.gegnerPunkte.filter((p) =>
    h.kollider.some((k) => stecktDrin(k, p.x, p.z, 0.45)));
  assert.deepStrictEqual(schlecht, [],
    schlecht.length + ' von ' + h.gegnerPunkte.length + ' Gegnerplaetzen stecken fest');
});

test('Geisel, Funker und Hinterausgang stehen frei', () => {
  const h = bau();
  for (const [name, p] of [['Geisel', h.geiselPunkt], ['Funker', h.funkPunkt],
                           ['Hinterausgang', h.hinterausgang],
                           ['Spielerstart', h.spielerStart]]) {
    const treffer = h.kollider.filter((k) => stecktDrin(k, p.x, p.z, 0.5));
    assert.deepStrictEqual(treffer.map((k) => [k.x0, k.x1, k.z0, k.z1]), [],
      name + ' steckt in einem Kollisionskasten');
    assert.ok(p.x > h.grenzen.x0 && p.x < h.grenzen.x1 &&
              p.z > h.grenzen.z0 && p.z < h.grenzen.z1, name + ' liegt ausserhalb des Raums');
  }
});

test('Der Weg des Funkers zum Hinterausgang ist frei', () => {
  /* Abgetastet wird die Strecke selbst, nicht nur die Stationen: ein
     freier Wegpunkt hinter einer Kiste hilft niemandem. */
  const h = bau();
  let vor = { x: h.funkPunkt.x, z: h.funkPunkt.z };
  const blockiert = [];
  for (const w of h.funkWeg) {
    const n = Math.ceil(Math.hypot(w.x - vor.x, w.z - vor.z) / 0.3);
    for (let i = 1; i <= n; i++) {
      const x = vor.x + (w.x - vor.x) * (i / n), z = vor.z + (w.z - vor.z) * (i / n);
      if (h.kollider.some((k) => stecktDrin(k, x, z, 0.4)))
        blockiert.push([+x.toFixed(1), +z.toFixed(1)]);
    }
    vor = { x: w.x, z: w.z };
  }
  assert.deepStrictEqual(blockiert.slice(0, 5), [],
    blockiert.length + ' blockierte Stellen auf dem Funkerweg, z.B. ' +
    JSON.stringify(blockiert.slice(0, 5)));
});

test('Die Hauptwege sind breit genug fuer Spieler und Gegner', () => {
  /* Vorgabe aus dem Auftrag: Hauptwege rund 2 m frei. Geprueft wird die
     Achse vom Eingang zum Hinterausgang. */
  const h = bau();
  const eng = [];
  for (let x = h.grenzen.x0 + 1; x <= h.grenzen.x1 - 1; x += 0.5) {
    let breite = 0;
    for (let z = h.zonen.halle.z0; z <= h.zonen.halle.z1; z += 0.25) {
      if (h.kollider.some((k) => stecktDrin(k, x, z, FIGUR))) { breite = 0; continue; }
      breite += 0.25;
      if (breite >= 2.0) break;
    }
    if (breite < 2.0) eng.push(+x.toFixed(1));
  }
  assert.deepStrictEqual(eng, [],
    'bei x = ' + eng.join(', ') + ' ist kein 2 m breiter Durchgang frei');
});

test('Zwei Aufrufe liefern denselben Raum - nichts wird gewuerfelt', () => {
  const a = bau(), b = bau();
  assert.strictEqual(a.kollider.length, b.kollider.length);
  assert.strictEqual(a.gegnerPunkte.length, b.gegnerPunkte.length);
  for (let i = 0; i < a.gegnerPunkte.length; i++) {
    assert.deepStrictEqual(a.gegnerPunkte[i], b.gegnerPunkte[i],
      'Gegnerplatz ' + i + ' unterscheidet sich zwischen zwei Aufrufen');
  }
});
