/* Teil 4: Wandkriechen.
   Der Held wird an eine Fassade gesetzt und kriecht in alle acht
   Richtungen. Gemessen wird mit dem eingebauten Fail-Logger (poseLogAn /
   poseFehler), der genau die Dinge meldet, die im Bild auffallen:
   ein Rumpf zu weit von der Wand, ein Glied IM Haus, eine haengende
   Kampfhaltung. Dazu kommt, ob die Figur ueberhaupt vorankommt.

   Aufruf:  node wandkriechen.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;

    /* Eine hohe, breite Fassade suchen, die frei zugaenglich ist. */
    let haus = null;
    for (const c of d.colliders) {
      if (!c.h || c.h < 40 || c.klein || c.keinKlettern) continue;
      if ((c.x1 - c.x0) < 12 || (c.z1 - c.z0) < 12) continue;
      if (!haus || c.h > haus.h) haus = c;
    }
    if (!haus) return { fehler: 'keine Fassade gefunden' };
    const mx = (haus.x0 + haus.x1) / 2;

    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','KeyZ','Space','KeyX'])
                              d.taste(t, false); };

    /* Anlegen: davor stellen, hineinlaufen, kleben. */
    alleAus();
    d.setzePos(mx, 0.25, haus.z0 - 2.2);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = 0; d.setzeKamYaw(Math.PI);
    d.taste('KeyW', true); d.taste('KeyZ', true);
    for (let i = 0; i < 420; i++) d.schritt(1 / 60);
    const angelegt = P.state === 'climb';
    const startY = P.pos.y;

    /* Jetzt in alle acht Richtungen kriechen, je zwei Sekunden. */
    d.poseLogAn(true, 30);
    const richtungen = [
      ['hoch',        ['KeyW']],
      ['hoch rechts', ['KeyW', 'KeyD']],
      ['rechts',      ['KeyD']],
      ['tief rechts', ['KeyS', 'KeyD']],
      ['tief',        ['KeyS']],
      ['tief links',  ['KeyS', 'KeyA']],
      ['links',       ['KeyA']],
      ['hoch links',  ['KeyW', 'KeyA']],
    ];
    const wege = [];
    for (const [name, tasten] of richtungen) {
      d.taste('KeyW', false); d.taste('KeyA', false);
      d.taste('KeyS', false); d.taste('KeyD', false);
      for (const t of tasten) d.taste(t, true);
      const a = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      let steht = 0, vor = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      for (let i = 0; i < 150; i++) {
        d.schritt(1 / 60);
        const s = Math.hypot(P.pos.x - vor.x, P.pos.y - vor.y, P.pos.z - vor.z);
        if (s < 0.004) steht++;
        vor = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      }
      wege.push({ richtung: name,
        weg: +Math.hypot(P.pos.x - a.x, P.pos.y - a.y, P.pos.z - a.z).toFixed(2),
        hoch: +(P.pos.y - a.y).toFixed(2),
        stillBilder: steht, zustand: P.state });
    }
    d.taste('KeyW', false); d.taste('KeyA', false);
    d.taste('KeyS', false); d.taste('KeyD', false);
    /* Ruhig an der Wand stehen bleiben. */
    for (let i = 0; i < 180; i++) d.schritt(1 / 60);
    const ruheZustand = P.state;

    /* Die tatsaechlichen Abstaende, nicht nur die Meldungen: was liegt
       wie weit von der Fassade weg? */
    const ring = d.poseLog().filter((e) => e.wandAbstand);
    const stat = {};
    for (const e of ring) {
      for (const n in e.wandAbstand) {
        const v = e.wandAbstand[n];
        if (!stat[n]) stat[n] = { n: 0, summe: 0, min: 9, max: -9 };
        stat[n].n++; stat[n].summe += v;
        stat[n].min = Math.min(stat[n].min, v); stat[n].max = Math.max(stat[n].max, v);
      }
    }
    for (const n in stat) {
      stat[n].mittel = +(stat[n].summe / stat[n].n).toFixed(3);
      stat[n].min = +stat[n].min.toFixed(3); stat[n].max = +stat[n].max.toFixed(3);
      delete stat[n].summe;
    }

    const fehler = d.poseFehler();
    const nachArt = {};
    for (const f of fehler) {
      const k = f.art;
      if (!nachArt[k]) nachArt[k] = { n: 0, max: 0, bsp: null };
      nachArt[k].n++;
      const w = typeof f.wert === 'number' ? f.wert
              : (f.wert && (f.wert.abstand || f.wert.tiefe || f.wert.ueberHuefte)) || 0;
      if (w > nachArt[k].max) { nachArt[k].max = +w.toFixed(3); nachArt[k].bsp = f.wert; }
    }
    d.poseLogAn(false);
    alleAus();
    return { haus: { x: +mx.toFixed(0), z: +haus.z0.toFixed(0), h: +haus.h.toFixed(1) },
             angelegt, startY: +startY.toFixed(2), ruheZustand,
             wege, fehler: nachArt, fehlerGesamt: fehler.length,
             abstand: stat, bilder: ring.length };
  });

  if (aus.fehler === undefined && aus.fehler !== 0 && aus.fehlerGesamt === undefined) {
    console.log('FEHLER:', JSON.stringify(aus)); await b.close(); return;
  }
  console.log('Fassade bei x=' + aus.haus.x + ' z=' + aus.haus.z + ', ' + aus.haus.h + ' m hoch');
  console.log('Angelegt: ' + (aus.angelegt ? 'ja, auf ' + aus.startY + ' m' : 'NEIN'));
  console.log('Nach dem Loslassen an der Wand: ' + aus.ruheZustand);
  console.log('\nKriechen, je 2,5 Sekunden:');
  console.log('  Richtung'.padEnd(16) + 'Weg'.padStart(8) + 'davon hoch'.padStart(12) +
              'Bilder still'.padStart(14) + '  Zustand');
  let schlecht = 0;
  for (const w of aus.wege) {
    const ok = w.weg > 0.5 && w.zustand === 'climb';
    if (!ok) schlecht++;
    console.log((ok ? '  ok   ' : '  FEHL ') + w.richtung.padEnd(14) +
      String(w.weg).padStart(6) + ' m' + String(w.hoch).padStart(10) + ' m' +
      String(w.stillBilder).padStart(14) + '  ' + w.zustand);
  }
  console.log('\nAbstand der Glieder zur Fassade ueber ' + aus.bilder + ' Bilder:');
  console.log('  Knochen'.padEnd(16) + 'kleinster'.padStart(11) + 'Mittel'.padStart(10) +
              'groesster'.padStart(11));
  for (const n of ['lefthand','righthand','leftfoot','rightfoot','hips','spine2','head']) {
    const a = aus.abstand[n]; if (!a) continue;
    console.log('  ' + n.padEnd(14) + String(a.min).padStart(11) +
                String(a.mittel).padStart(10) + String(a.max).padStart(11));
  }
  console.log('  (Schwelle des Fail-Loggers fuer den Rumpf: 0,55 m, Teil 4 neu geeicht)');
  console.log('\nMeldungen des Fail-Loggers: ' + aus.fehlerGesamt);
  for (const k in aus.fehler)
    console.log('  ' + k.padEnd(24) + String(aus.fehler[k].n).padStart(6) +
                '   groesster Wert ' + aus.fehler[k].max);
  console.log('\nRichtungen fehlerhaft: ' + schlecht);
  await b.close();
})();
