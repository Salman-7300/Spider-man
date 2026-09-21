/* problem-2, Punkt A.1: warum klebt die Kletterkamera an der Fassade?

   Der Befund ist reproduziert: Flaeche, Normale und Wandabstand bleiben
   gleich, die Figur bewegt sich 0,043 m - und trotzdem faellt der
   Kameraabstand auf 1,365 m. Es liegt also nicht am Eckwechsel.

   Hier wird mit der ECHTEN Spielkamera geklettert und Bild fuer Bild
   festgehalten, WER die Sicht einengt: gewuenschter Abstand, geklemmter
   Abstand, und der Kollider, der den Strahl trifft - mit Kennung und
   Masskasten, nicht nur "Sicht versperrt".

   Drei Lagen werden verglichen:

     frei    gerade Fassade mit viel Platz davor
     ecke    an einer Aussenecke
     eng     Fassade mit einem Nachbarn dicht davor

   Aufruf:  node tools/pruef/kletterkamera.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

(async () => {
  const { b, page } = await starte(900, 540, SEED, {});
  const aus = await page.evaluate(async () => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const P = d.player;
    const SLAB_H = 0.25;
    const kollVon = (k) => {
      for (const c of d.colliderNah(k.x, k.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - k.x) < 0.05 &&
            Math.abs((c.z0 + c.z1) / 2 - k.z) < 0.05) return c;
      }
      return null;
    };
    /* Wie viel Platz ist vor dieser Schauseite? */
    const platz = (c, nx, nz, y) => {
      for (let t = 1; t <= 14; t += 1) {
        const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * t : (c.x0 + c.x1) / 2;
        const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * t : (c.z0 + c.z1) / 2;
        for (const n of d.colliderNah(px, pz)) {
          if (n === c || n.klein || n.innen || n.parkAuto || n.dachProp) continue;
          const y0 = n.y0 === undefined ? -1e9 : n.y0;
          if (px > n.x0 && px < n.x1 && pz > n.z0 && pz < n.z1 &&
              y > y0 && y < (n.h || 0)) return t;
        }
      }
      return 99;
    };

    function fahrt(c, nx, nz, y, taste, bilder) {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.15 : (c.x0 + c.x1) / 2;
      const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 0.15 : (c.z0 + c.z1) / 2;
      d.setzePos(px, y, pz);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: c };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      for (let i = 0; i < 120; i++) d.schritt(1 / 60);
      d.taste(taste, true);
      const reihe = [];
      for (let i = 0; i < bilder; i++) {
        d.schritt(1 / 60);
        reihe.push(d.kamBlock());
      }
      d.taste(taste, false);
      return reihe;
    }

    function fasse(reihe) {
      if (!reihe.length) return null;
      const g = reihe.map((r) => r.geklemmt);
      const eng = reihe.filter((r) => r.geklemmt < r.wunsch - 0.3);
      const eigen = eng.filter((r) => r.eigeneWand).length;
      const zaehl = {};
      for (const r of eng) {
        const k = r.blocker ? ('id' + r.blocker.id +
                   (r.blocker.krone ? ' KRONE' : '') +
                   (r.blocker.dachProp ? ' DACHPROP' : '') +
                   (r.blocker.klein ? ' klein' : '')) : r.grund;
        zaehl[k] = (zaehl[k] || 0) + 1;
      }
      return { bilder: reihe.length,
               wunsch: +reihe[0].wunsch.toFixed(2),
               kleinster: +Math.min(...g).toFixed(3),
               mittel: +(g.reduce((a, x) => a + x, 0) / g.length).toFixed(3),
               eingeengt: eng.length, eigeneWand: eigen,
               blocker: zaehl,
               bsp: eng.length ? eng[Math.floor(eng.length / 2)] : null };
    }

    const kisten = d.hausKisten().filter((k) => k.h > 18);
    /* Der reproduzierte Fehlerfall lag TIEF an der Wand (y = 4,73 m).
       Weiter oben klemmt die Kamera in keiner der drei Lagen - die
       Hoehe gehoert also mit in den Vergleich. */
    const lagen = { frei: null, eng: null, tief: null };
    for (const K of kisten) {
      const c = kollVon(K);
      if (!c) continue;
      const y = SLAB_H + K.h - 10;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const pl = platz(c, nx, nz, y);
        if (pl > 20 && !lagen.frei) lagen.frei = { c, nx, nz, y, platz: pl };
        if (pl <= 8 && pl > 1 && !lagen.eng) lagen.eng = { c, nx, nz, y, platz: pl };
        if (pl > 20 && !lagen.tief)
          lagen.tief = { c, nx, nz, y: SLAB_H + 4.5, platz: pl };
      }
      if (lagen.frei && lagen.eng && lagen.tief) break;
    }
    const aus2 = {};
    if (lagen.frei) aus2.frei = { platz: lagen.frei.platz,
      ...fasse(fahrt(lagen.frei.c, lagen.frei.nx, lagen.frei.nz, lagen.frei.y, 'KeyW', 150)) };
    if (lagen.eng) aus2.eng = { platz: lagen.eng.platz,
      ...fasse(fahrt(lagen.eng.c, lagen.eng.nx, lagen.eng.nz, lagen.eng.y, 'KeyW', 150)) };
    if (lagen.tief) aus2.tief = { platz: lagen.tief.platz,
      ...fasse(fahrt(lagen.tief.c, lagen.tief.nx, lagen.tief.nz, lagen.tief.y, 'KeyW', 150)) };
    if (lagen.frei) aus2.ecke = { platz: lagen.frei.platz,
      ...fasse(fahrt(lagen.frei.c, lagen.frei.nx, lagen.frei.nz, lagen.frei.y, 'KeyD', 220)) };
    return aus2;
  });

  for (const [name, w] of Object.entries(aus)) {
    console.log('\n== ' + name + ' (Platz vor der Wand ' + w.platz + ' m) ==');
    if (!w.bilder) { console.log('  keine Daten'); continue; }
    console.log('  gewuenschter Abstand        ' + w.wunsch + ' m');
    console.log('  kleinster geklemmter        ' + w.kleinster + ' m');
    console.log('  mittlerer geklemmter        ' + w.mittel + ' m');
    console.log('  Bilder eingeengt            ' + w.eingeengt + ' von ' + w.bilder);
    console.log('  davon durch die EIGENE Wand ' + w.eigeneWand);
    console.log('  Blocker: ' + JSON.stringify(w.blocker));
    if (w.bsp) console.log('  Beispiel: ' + JSON.stringify(w.bsp));
  }
  await b.close();
})();
