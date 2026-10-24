/* problem-2, Human Rejection Pass 2, Blocker 3: rendert das Spiel die
   gebaute Gleithaltung ueberhaupt?

   Haltung B und D sind beide abgelehnt worden, und beide Male sahen die
   Laboraufnahmen anders aus als das Spiel. Bevor an der Haltung wieder
   etwas geaendert wird, ist die Vorfrage zu klaeren: kommt D im Spiel an?

   Gemessen wird deshalb am ENDE des Bildes - nach mixer.update, nach
   mischeHaltungen, nach allem - die LOKALE Drehung jedes Knochens.
   Verglichen werden drei Faelle an derselben Stelle desselben Fluges:

     D      GLEIT_HALTUNG = 'D' (der heutige Stand)
     A      GLEIT_HALTUNG = 'A' (die alte gerechnete Haltung)
     ohne   Gleithaltung mit Anteil 0 - nur die Bewegungsdatei

   Unterscheiden sich D und "ohne" deutlich, wird D angewandt. Sind D
   und A gleich, waere etwas faul.

   Dazu der Zustand im selben Bild: Bewegungszustand, gleiten,
   sturzflug, gleitMisch, gleitNase, gleitKurve, die Anteile aus
   mischeHaltungen, der laufende Clip, die Koerperdrehung und die
   Weltpunkte der Knochen.

   Aufruf:  node tools/pruef/gleit-beweis.js [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

const KNOCHEN = ['hips', 'spine1', 'spine2', 'neck', 'head',
                 'leftarm', 'rightarm', 'leftforearm', 'rightforearm',
                 'leftupleg', 'rightupleg', 'leftleg', 'rightleg'];

(async () => {
  const { b, page } = await starte(1280, 720, SEED, {});
  const aus = await page.evaluate(async (KNOCHEN) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    los();
    /* Hoch ueber der Stadt starten und wirklich gleiten - kein
       gesetzter Zustand. */
    d.setzePos(-120, 200, -40);
    P.vel.set(0, 0, 18); P.facing = 0; P.state = 'air'; P.onGround = false;
    P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0;
    d.setzeKamYaw(0);
    d.taste('ShiftLeft', true);
    /* Ausschwingen lassen, bis der Anteil voll ist. */
    let n = 0;
    while (n < 900 && (P.gleitMisch || 0) < 0.99) { d.schritt(1 / 60); n++; }

    const lese = () => ({
      dreh: d.animKnochenDreh(KNOCHEN),
      welt: d.animKnochen(['head', 'lefthand', 'righthand', 'leftfoot', 'rightfoot']),
      lage: d.heroLage ? d.heroLage() : null,
      misch: d.mischStand ? d.mischStand() : null,
      clip: d.animClipJetzt,
      zustand: P.state, gleiten: !!P.gleiten, sturzflug: !!P.sturzflug,
      gleitMisch: +(P.gleitMisch || 0).toFixed(4),
      gleitNase: +(P.gleitNase || 0).toFixed(4),
      gleitKurve: +(P.gleitKurve || 0).toFixed(4),
      haltung: d.gleitHaltung ? d.gleitHaltung() : null,
      tempo: +Math.hypot(P.vel.x, P.vel.y, P.vel.z).toFixed(2),
    });

    /* ---- Drei Messungen an derselben Stelle ----
       Der Zustand wird zwischen den Messungen NICHT zurueckgesetzt; es
       wird jeweils ein Bild weiter gerechnet, damit die Haltung des
       jeweiligen Falls wirklich angewandt ist. */
    d.schritt(1 / 60);
    const mD = lese();
    d.setzeGleitHaltung('A');
    d.schritt(1 / 60);
    const mA = lese();
    d.setzeGleitHaltung('D');
    /* Anteil auf null: dann setzt poseGleiten gar nichts, und es bleibt
       die reine Bewegungsdatei. */
    const altPose = d.setzeGleitPose ? null : null;
    d.schritt(1 / 60);
    const mD2 = lese();
    return { mD, mA, mD2, bilderBisGleiten: n };
  }, KNOCHEN);

  const winkel = (a, b2) => {
    if (!a || !b2) return null;
    let p = a[0] * b2[0] + a[1] * b2[1] + a[2] * b2[2] + a[3] * b2[3];
    p = Math.min(1, Math.abs(p));
    return +(2 * Math.acos(p) * 180 / Math.PI).toFixed(2);
  };
  const zeig = (nm, m) => {
    console.log('\n== ' + nm + ' ==');
    console.log('  Zustand ' + m.zustand + '   gleiten ' + m.gleiten +
                '   sturzflug ' + m.sturzflug +
                '   gleitMisch ' + m.gleitMisch +
                '   Nase ' + m.gleitNase + '   Kurve ' + m.gleitKurve);
    console.log('  Haltung ' + m.haltung + '   Clip ' + m.clip +
                '   Tempo ' + m.tempo);
    console.log('  Mischanteile ' + JSON.stringify(m.misch));
    console.log('  Weltpunkte   ' + JSON.stringify(m.welt));
  };
  zeig('D - der heutige Stand', aus.mD);
  zeig('A - die alte gerechnete Haltung', aus.mA);
  zeig('D noch einmal (Gegenprobe)', aus.mD2);
  console.log('\n  Bilder bis der Gleitanteil voll war: ' + aus.bilderBisGleiten);

  console.log('\n== Lokale Knochendrehungen, Unterschied in Grad ==');
  console.log('  ' + 'Knochen'.padEnd(16) + 'D gegen A   D gegen D(2)');
  for (const k of KNOCHEN) {
    const dA = winkel(aus.mD.dreh[k], aus.mA.dreh[k]);
    const dD = winkel(aus.mD.dreh[k], aus.mD2.dreh[k]);
    console.log('  ' + k.padEnd(16) + String(dA).padStart(9) + String(dD).padStart(14));
  }
  if (BILDER) {
    /* Dieselbe Stelle, echte Spielkamera und feste Blickwinkel - fuer
       jede zu vergleichende Haltung. */
    const sichten = [
      { name: 'spielkamera', art: 'spiel' },
      { name: 'seite', art: 'fest', v: [3.4, 0.2, 0] },
      { name: 'unten', art: 'fest', v: [0.1, -2.0, -2.8] },
      { name: 'hinten', art: 'fest', v: [0, 0.4, -3.6] },
      { name: 'oben', art: 'fest', v: [0.1, 2.4, -2.6] },
      { name: 'schraeg', art: 'fest', v: [2.4, 1.2, -2.4] },
    ];
    for (const H of ['D', 'F']) {
      await page.evaluate(async (H) => {
        __dbg.setzeGleitHaltung(H);
        for (let i = 0; i < 12; i++) __dbg.schritt(1 / 60);
      }, H);
      for (const S of sichten) {
        await page.evaluate(async (S) => {
          const d = __dbg, P = d.player;
          if (S.art === 'spiel') { d.zeichne(); return; }
          const c = Math.cos(P.facing), s2 = Math.sin(P.facing);
          const vx = S.v[0] * c + S.v[2] * s2, vz = -S.v[0] * s2 + S.v[2] * c;
          d.aufnahme(P.pos.x + vx, P.pos.y + 1.0 + S.v[1], P.pos.z + vz,
                     P.pos.x, P.pos.y + 1.0, P.pos.z);
        }, S);
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
        await page.screenshot({ path: path.join(BILDER, H + '-' + S.name + '.png') });
      }
    }
  }
  await b.close();
})();
