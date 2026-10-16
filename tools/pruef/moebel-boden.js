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
    /* Die Laterne bringt ihre wirkliche Fusshoehe mit - sie steht nicht
       ueberall auf Gehweghoehe, auf der Bruecke liegt der Gehweg auf
       0,50 m. Wer hier wieder SLAB_H annimmt, misst die Annahme. */
    gruppen.push({ art: 'Laterne', eigen: true,
                   stellen: d.laterneStellen().map((a) => [a[0], a[1], a[3]]) });
    gruppen.push({ art: 'Bank', fuss: SLAB_H,
                   stellen: d.bankStellen().map((a) => [a[0], a[1]]) });
    /* Die Requisiten aus TEIL_STELLEN bringen ihre EIGENE Fusshoehe mit,
       und die ist nicht ueberall die Gehweghoehe: ein Klimageraet steht
       auf dem Dach, ein Kanaldeckel auf der Fahrbahn. Der erste Stand
       dieser Pruefung hat fuer alle SLAB_H angenommen und daraufhin 33
       schwebende Kanaldeckel und 8 steckende Klimageraete gemeldet -
       beides war die Annahme, nicht die Stadt.

       Gefragt wird deshalb nur noch dort, wo das Moebel ueberhaupt auf
       dem BODEN stehen soll: bis zwei Meter ueber Gehweghoehe. Was
       hoeher sitzt, steht auf einem Dach und wird in
       dachaufbauten.js geprueft, nicht hier. */
    for (const name of d.teilArten()) {
      const liste = d.teilStellen(name);
      if (!liste.length) continue;
      const amBoden = liste.filter((a) => a.y !== undefined && a.y < SLAB_H + 2);
      if (!amBoden.length) continue;
      gruppen.push({ art: name, eigen: true, aufDach: liste.length - amBoden.length,
                     stellen: amBoden.map((a) => [a.x, a.z, a.y]) });
    }
    const bericht = [];
    const bsp = [];
    for (const g of gruppen) {
      let schwebt = 0, steckt = 0, weitest = 0;
      for (const [x, z, eigenY] of g.stellen) {
        if (x === undefined || z === undefined) continue;
        const by = d.groundYAt(x, z);
        const diff = (g.eigen ? eigenY : g.fuss) - by;
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
                     aufDach: g.aufDach || 0, weitest: +weitest.toFixed(2) });
    }
    return { bericht, bsp };
  });

  console.log('\n== Stadtmoebel auf dem Boden ==');
  console.log('  Art                Stellen   schwebt   steckt   auf Dach   groesste Abw.');
  let fehler = 0;
  for (const r of aus.bericht) {
    fehler += r.schwebt + r.steckt;
    console.log('  ' + r.art.padEnd(18) + String(r.stellen).padStart(7) +
                String(r.schwebt).padStart(10) + String(r.steckt).padStart(9) +
                String(r.aufDach).padStart(11) +
                (r.weitest.toFixed(2) + ' m').padStart(16));
  }
  if (aus.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }
  console.log('\n  ' + fehler + ' Beanstandungen');
  await b.close();
  process.exitCode = fehler ? 1 : 0;
})();
