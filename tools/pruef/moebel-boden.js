/* Steht das Stadtmoebel wirklich auf dem Boden?

   problem-1, Punkt 1: eine Ampel schwebt ueber dem Gehweg.

   Der Mast wird auf SLAB_H gesetzt - also auf Gehweghoehe, fest
   verdrahtet. Das stimmt nur, wenn an dieser Stelle auch wirklich ein
   Gehweg liegt. Wo der Boden tiefer ist (Fahrbahn, Rampe, Park, Rand
   der Stadt), steht der Mast in der Luft; wo er hoeher ist, steckt er
   im Sockel.

   Gemessen wird fuer jede Stelle der Unterschied zwischen dem Fuss des
   Moebels und groundY() an genau dieser Stelle:

     schwebt   Fuss ueber dem Boden, mehr als 5 cm
     steckt    Fuss unter dem Boden, mehr als 5 cm

   Fuenf Zentimeter, weil der Gehwegsockel selbst 25 cm hoch ist - ein
   Fehler faellt also um ein Vielfaches groesser aus als die Toleranz.

   Aufruf:  node tools/pruef/moebel-boden.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

(async () => {
  const { b, page } = await starte(800, 480, SEED, {});
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const SLAB_H = 0.25;
    const TOL = 0.05;
    /* Alle Moebel, die auf Gehweghoehe gesetzt werden. Der Fuss ist
       ueberall SLAB_H - genau das ist die Annahme, die hier geprueft
       wird. */
    const gruppen = [];
    gruppen.push({ art: 'Ampel', fuss: SLAB_H,
                   stellen: d.ampelStellen().map((a) => [a[0], a[1]]) });
    gruppen.push({ art: 'Laterne', fuss: SLAB_H,
                   stellen: d.laterneStellen().map((a) => [a[0], a[1]]) });
    gruppen.push({ art: 'Bank', fuss: SLAB_H,
                   stellen: d.bankStellen().map((a) => [a[0], a[1]]) });
    for (const name of d.teilArten()) {
      const liste = d.teilStellen(name);
      if (!liste.length) continue;
      gruppen.push({ art: name, fuss: SLAB_H,
                     stellen: liste.map((a) => [a.x !== undefined ? a.x : a[0],
                                                a.z !== undefined ? a.z : a[1]]) });
    }
    const bericht = [];
    const bsp = [];
    for (const g of gruppen) {
      let schwebt = 0, steckt = 0, weitest = 0;
      for (const [x, z] of g.stellen) {
        if (x === undefined || z === undefined) continue;
        const by = d.groundYAt(x, z);
        const diff = g.fuss - by;
        if (Math.abs(diff) > Math.abs(weitest)) weitest = diff;
        if (diff > TOL) {
          schwebt++;
          if (bsp.length < 20) bsp.push({ art: g.art, x: +x.toFixed(1), z: +z.toFixed(1),
                                          boden: +by.toFixed(2), luft: +diff.toFixed(2) });
        } else if (diff < -TOL) {
          steckt++;
          if (bsp.length < 20) bsp.push({ art: g.art, x: +x.toFixed(1), z: +z.toFixed(1),
                                          boden: +by.toFixed(2), tief: +(-diff).toFixed(2) });
        }
      }
      bericht.push({ art: g.art, stellen: g.stellen.length, schwebt, steckt,
                     weitest: +weitest.toFixed(2) });
    }
    return { bericht, bsp };
  });

  console.log('\n== Stadtmoebel auf dem Boden ==');
  console.log('  Art                Stellen   schwebt   steckt   groesste Abweichung');
  let fehler = 0;
  for (const r of aus.bericht) {
    fehler += r.schwebt + r.steckt;
    console.log('  ' + r.art.padEnd(18) + String(r.stellen).padStart(7) +
                String(r.schwebt).padStart(10) + String(r.steckt).padStart(9) +
                (r.weitest.toFixed(2) + ' m').padStart(22));
  }
  if (aus.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }
  console.log('\n  ' + fehler + ' Beanstandungen');
  await b.close();
  process.exitCode = fehler ? 1 : 0;
})();
