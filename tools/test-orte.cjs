'use strict';
/* Mega-Update 1.0, M4: die beiden begehbaren Orte, geprueft ohne Browser.

   Dieselbe Art Pruefung wie test-interior.cjs fuer das Versteck: ein
   Boden auf genau einer Hoehe, geschlossene und nicht kletterbare Waende,
   ein Deckel gegen das Herausspringen, Moebel mit Kollision, freie Wege
   und freie Plaetze fuer Start, Ausgang, Handlungspunkte und stehende
   Figuren. */
const test = require('node:test');
const assert = require('node:assert');
const THREE = require('../lib/three.min.js');
const factory = require('../mission-interiors.js');
const INT = factory(THREE);

const FIGUR = 0.45;
const ORTE = {
  laden: () => INT.createLaden({ x: 1100, y: 0, z: 1000 }),
  buero: () => INT.createBuero({ x: 1200, y: 0, z: 1000 }),
};

function stecktDrin(k, x, z, r) {
  if (k.h <= 0.35) return false;
  if (k.y0 !== undefined && k.y0 > 1.75) return false;     // Deckel ueber Kopfhoehe
  return x > k.x0 - r && x < k.x1 + r && z > k.z0 - r && z < k.z1 + r;
}
const frei = (raum, x, z, r) => !raum.kollider.some((k) => stecktDrin(k, x, z, r));

for (const [id, bau] of Object.entries(ORTE)) {
  test(id + ': alle Felder, die game.js braucht', () => {
    const r = bau();
    for (const feld of ['gruppe', 'kollider', 'bodenY', 'grenzen', 'spielerStart', 'spielerBlick',
                        'ausgang', 'personen', 'aktionen', 'masse', 'wegFehler', 'zahlen']) {
      assert.ok(r[feld] !== undefined && r[feld] !== null, feld + ' fehlt');
    }
    assert.strictEqual(r.id, id);
    assert.strictEqual(r.bodenY, 0);
    assert.ok(r.personen.length >= 3, 'zu wenige Personen: ' + r.personen.length);
    assert.ok(r.aktionen.length >= 1, 'kein Handlungspunkt');
  });

  test(id + ': genau EINE waagerechte Flaeche auf Bodenhoehe', () => {
    const r = bau();
    let n = 0;
    r.gruppe.traverse((m) => {
      if (!m.isMesh || !m.geometry || m.geometry.type !== 'PlaneGeometry') return;
      if (Math.abs(Math.abs(m.rotation.x) - Math.PI / 2) > 0.01) return;
      if (Math.abs(m.position.y - r.bodenY) < 0.01) n++;
    });
    assert.strictEqual(n, 1, n + ' Flaechen auf Bodenhoehe - Flackergefahr');
  });

  test(id + ': geschlossene, nicht kletterbare Waende und ein Deckel', () => {
    const r = bau();
    const g = r.grenzen;
    const waende = r.kollider.filter((k) => k.keinKlettern && !k.klein && (k.y0 === undefined || k.y0 <= 0.01) &&
                                           k.h >= r.masse.hoehe - 0.01);
    assert.ok(waende.length >= 4, 'nur ' + waende.length + ' Aussenwaende');
    const deckel = r.kollider.find((k) => k.y0 !== undefined && Math.abs(k.y0 - r.masse.hoehe) < 0.01);
    assert.ok(deckel && deckel.keinKlettern, 'kein Deckel ueber dem Raum');
    /* Jeder Punkt am Rand der Raumgrenzen hat dahinter eine Wand. */
    for (const [x, z] of [[g.x0 - 0.7, (g.z0 + g.z1) / 2], [g.x1 + 0.7, (g.z0 + g.z1) / 2],
                          [(g.x0 + g.x1) / 2, g.z0 - 0.7], [(g.x0 + g.x1) / 2, g.z1 + 0.7]]) {
      assert.ok(waende.some((k) => x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1), 'Loch in der Wand bei ' + x + '/' + z);
    }
  });

  test(id + ': Start, Ausgang und Handlungspunkte frei, Wege frei', () => {
    const r = bau();
    assert.ok(frei(r, r.spielerStart.x, r.spielerStart.z, FIGUR), 'Start steckt');
    assert.ok(frei(r, r.ausgang.x, r.ausgang.z, FIGUR), 'Ausgang steckt');
    for (const h of r.aktionen) assert.ok(frei(r, h.x, h.z, FIGUR), 'Handlungspunkt ' + h.id + ' steckt');
    assert.strictEqual(r.wegFehler.length, 0, 'blockierte Wege: ' + r.wegFehler.join(' | '));
  });

  test(id + ': stehende Figuren frei, sitzende auf einem Moebel', () => {
    const r = bau();
    for (const p of r.personen) {
      if (p.sitz === undefined) {
        assert.ok(frei(r, p.x, p.z, 0.25), p.rolle + ' steht in einem Moebel');
      } else {
        const unter = r.kollider.find((k) => k.klein && p.x > k.x0 - 0.05 && p.x < k.x1 + 0.05 &&
                                             p.z > k.z0 - 0.05 && p.z < k.z1 + 0.05);
        assert.ok(unter, p.rolle + ' sitzt auf keinem Moebel');
        assert.ok(Math.abs(unter.h - p.sitz) < 0.06, p.rolle + ': Sitzhoehe ' + p.sitz + ', Moebel ' + unter.h);
      }
    }
  });

  test(id + ': jedes sichtbare Teil liegt im Raum (auch die gebuendelten Waren)', () => {
    /* Gegen den Fehler aus dem ersten Spielbild: die Warengeometrie stand
       in Raumkoordinaten ohne Verschiebung an den Ursprung - 1,5 km neben
       dem Raum. */
    const r = bau();
    const g = r.grenzen;
    r.gruppe.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const draussen = [];
    r.gruppe.traverse((m) => {
      if (!m.isMesh) return;
      box.setFromObject(m);
      if (box.min.x < g.x0 - 1.5 || box.max.x > g.x1 + 1.5 || box.min.z < g.z0 - 1.5 || box.max.z > g.z1 + 1.5 ||
          box.min.y < r.bodenY - 0.05 || box.max.y > r.bodenY + r.masse.hoehe + 0.05) {
        draussen.push((m.name || m.geometry.type) + ' ' + box.min.x.toFixed(1) + '..' + box.max.x.toFixed(1));
      }
    });
    assert.deepStrictEqual(draussen, []);
  });

  test(id + ': dasselbe Licht wie im Versteck (ein Halbkugel-, sieben Punktlichter)', () => {
    const r = bau();
    let halb = 0, punkt = 0;
    r.gruppe.traverse((o) => { if (o.isHemisphereLight) halb++; if (o.isPointLight) punkt++; });
    const v = INT.createHideout({ x: 1000, y: 0, z: 1000 });
    let vh = 0, vp = 0;
    v.gruppe.traverse((o) => { if (o.isHemisphereLight) vh++; if (o.isPointLight) vp++; });
    assert.deepStrictEqual([halb, punkt], [vh, vp]);
  });

  test(id + ': liegt weit ausserhalb der Stadt und nicht im Versteck', () => {
    const r = bau();
    const g = r.grenzen;
    assert.ok(g.x0 > 900, 'zu nah an der Stadt');
    const v = INT.createHideout({ x: 1000, y: 0, z: 1000 }).grenzen;
    const ueberlapp = g.x0 < v.x1 && g.x1 > v.x0 && g.z0 < v.z1 && g.z1 > v.z0;
    assert.ok(!ueberlapp, 'ueberlappt mit dem Versteck');
  });
}

test('Laden und Buero ueberlappen sich nicht', () => {
  const a = ORTE.laden().grenzen, b = ORTE.buero().grenzen;
  assert.ok(!(a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0));
});
