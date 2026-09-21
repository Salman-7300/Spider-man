/* problem-2, Punkt A.1: warum klebt die Kletterkamera an der Fassade?

   Der Befund ist reproduziert: Flaeche, Normale und Wandabstand bleiben
   gleich, die Figur bewegt sich 0,043 m - und trotzdem faellt der
   Kameraabstand auf 1,365 m. Es liegt also nicht am Eckwechsel.

   Hier wird mit der ECHTEN Spielkamera geklettert und Bild fuer Bild
   festgehalten, WER die Sicht einengt: gewuenschter Abstand, geklemmter
   Abstand, und der Kollider, der den Strahl trifft - mit Kennung und
   Masskasten, nicht nur "Sicht versperrt".

   Die Lagen, die verglichen werden:

     frei    gerade Fassade mit viel Platz davor
     ecke    an einer Aussenecke
     eng     Fassade mit einem Nachbarn dicht davor
     tief    dieselbe freie Fassade, aber weit unten
     naht    dicht unter der Dachkante eines NIEDRIGEN Hauses, dessen
             hoeherer Nachbar buendig daneben steht

   "naht" ist die Lage aus dem Human-Video. Sie ist die einzige der
   fuenf, in der die Kamera wirklich klemmte: gemessen faellt der
   Abstand dort von 6,4 m auf 0, weil der Blickpunkt in der um den
   Kameraradius aufgeblasenen Huelle des Nachbarn liegt.

   "alt" misst den Stand vor der Korrektur des Strahlanfangs.

   Aufruf:  node tools/pruef/kletterkamera.js [seed=4711] [alt]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

(async () => {
  const ALT = process.argv.indexOf('alt') > 0;
  const { b, page } = await starte(900, 540, SEED, ALT ? { kamEngAlt: true } : {});
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

    function fahrt(c, nx, nz, y, taste, bilder, festX, festZ) {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      const px = festX !== undefined ? festX
               : nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.15 : (c.x0 + c.x1) / 2;
      const pz = festZ !== undefined ? festZ
               : nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 0.15 : (c.z0 + c.z1) / 2;
      d.setzePos(px, y, pz);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: c };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      for (let i = 0; i < 120; i++) d.schritt(1 / 60);
      /* Ohne Taste wird im Stehen gemessen - fuer die Naht, wo schon
         das Hochklettern die Stelle wieder verlaesst. */
      if (taste) d.taste(taste, true);
      const reihe = [];
      for (let i = 0; i < bilder; i++) {
        d.schritt(1 / 60);
        reihe.push(d.kamBlock());
      }
      if (taste) d.taste(taste, false);
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
    /* ---- Die Lage aus dem Human-Video suchen ----
       Ein niedrigeres Haus, dessen hoeherer Nachbar mit derselben
       Fassadenflucht danebensteht. Dicht unter der Dachkante des
       niedrigen Hauses liegt der Blickpunkt ueber dessen Dach, der
       Nachbar steht dort aber noch. */
    /* ---- Alle Kletterflaechen einsammeln ----
       Der erste Versuch suchte nur unter den Hauskisten. Die Wand aus
       dem Human-Video ist aber ein eigener Kollider, der zu KEINER
       Hauskiste gehoert - die Suche fand deshalb null Stellen, obwohl
       die Naht im selben Keim nachweislich existiert. Gesammelt werden
       daher die Kollider selbst. */
    const flaechen = [];
    const gesehen = new Set();
    for (const K of d.hausKisten()) {
      for (const c of d.colliderNah(K.x, K.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if ((c.h || 0) < 12 || gesehen.has(c.id)) continue;
        gesehen.add(c.id); flaechen.push(c);
      }
    }

    let naht = null;
    for (const c of flaechen) {
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (c.x0 + c.x1) / 2;
        const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : (c.z0 + c.z1) / 2;
        for (const n of d.colliderNah(fx, fz)) {
          if (n === c || n.klein || n.innen || n.parkAuto || n.dachProp) continue;
          if ((n.h || 0) < (c.h || 0) + 1.5) continue;
          const buendig = nx !== 0
            ? Math.abs(nx > 0 ? n.x1 - c.x1 : n.x0 - c.x0) < 0.5
            : Math.abs(nz > 0 ? n.z1 - c.z1 : n.z0 - c.z0) < 0.5;
          if (!buendig) continue;
          /* ---- Die Stelle ist die NAHT, nicht die Mitte ----
             Der hoehere Nachbar liegt neben c, er ueberlappt es nicht.
             Gesucht ist daher ein Punkt auf der Wand von c, der dicht
             an der gemeinsamen Grenze liegt: 0,10 m davor ist weniger
             als der Kameraradius von 0,30 m, der Blickpunkt liegt also
             in der aufgeblasenen Huelle des Nachbarn. Genau diese
             Stelle zeigt das Human-Video. */
          const quer = nx !== 0 ? [n.z0 - 0.1, n.z1 + 0.1] : [n.x0 - 0.1, n.x1 + 0.1];
          const tief = nx !== 0 ? [c.z0 + 0.05, c.z1 - 0.05] : [c.x0 + 0.05, c.x1 - 0.05];
          const q = quer.find((v) => v > tief[0] && v < tief[1]);
          if (q === undefined) continue;
          const y = (c.h || 0) - 0.5;
          const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.15 : q;
          const pz = nx !== 0 ? q : (nz > 0 ? c.z1 : c.z0) + nz * 0.15;
          naht = { c, nx, nz, y, x: px, z: pz, nachbar: n.id };
          break;
        }
        if (naht) break;
      }
      if (naht) break;
    }
    const aus2 = {};
    if (lagen.frei) aus2.frei = { platz: lagen.frei.platz,
      ...fasse(fahrt(lagen.frei.c, lagen.frei.nx, lagen.frei.nz, lagen.frei.y, 'KeyW', 150)) };
    if (lagen.eng) aus2.eng = { platz: lagen.eng.platz,
      ...fasse(fahrt(lagen.eng.c, lagen.eng.nx, lagen.eng.nz, lagen.eng.y, 'KeyW', 150)) };
    if (lagen.tief) aus2.tief = { platz: lagen.tief.platz,
      ...fasse(fahrt(lagen.tief.c, lagen.tief.nx, lagen.tief.nz, lagen.tief.y, 'KeyW', 150)) };
    if (naht) aus2.naht = { platz: 0, nachbar: naht.nachbar,
      ...fasse(fahrt(naht.c, naht.nx, naht.nz, naht.y, null, 90, naht.x, naht.z)) };
    if (lagen.frei) aus2.ecke = { platz: lagen.frei.platz,
      ...fasse(fahrt(lagen.frei.c, lagen.frei.nx, lagen.frei.nz, lagen.frei.y, 'KeyD', 220)) };
    return aus2;
  });

  for (const [name, w] of Object.entries(aus)) {
    console.log('\n== ' + name + ' (Platz vor der Wand ' + w.platz + ' m' +
      (w.nachbar ? ', hoeherer Nachbar ' + w.nachbar : '') + ') ==');
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
