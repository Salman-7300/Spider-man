/* Stehen die Dachaufbauten auf dem Dach - und sind sie ueberhaupt da?

   problem-1 nennt zwei Dinge, die beide das Dach betreffen: die Figur
   steckt in Dachaufbauten, und irgendwo im Dach gibt es eine
   "Zwischenebene". Beides laesst sich an der Geometrie messen, ohne das
   Video zu kennen.

   Gemessen wird fuer jeden Klotz, der auf einem Hausdach steht:

     schwebt      Fuss ueber der Dachflaeche
     steckt       Fuss unter der Dachflaeche
     ohneHalt     kein Hindernis an seiner Stelle - die Figur laeuft
                  einfach hindurch

   deko() legt nur Geometrie in das gemeinsame Sammel-Mesh und legt KEIN
   Hindernis an; merkeTeil() ebenso wenig. Ein Dachaufbau ist damit von
   Haus aus durchlaessig, solange ihn niemand eigens eintraegt.

   Die Toleranz ist 0,15 m, weil dekoIm() die Orte auf eine Nachkomma-
   stelle rundet. Die gesuchten Fehler sind ein Vielfaches davon.

   Aufruf:  node tools/pruef/dachaufbauten.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

(async () => {
  const { b, page } = await starte(800, 480, SEED, {});
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const SLAB_H = 0.25, TOL = 0.15;
    const kisten = d.hausKisten();
    let klotz = 0, schwebt = 0, steckt = 0, ohneHalt = 0;
    let hoechsteLuft = 0, tiefstesStecken = 0;
    const bsp = [];
    /* Nur eine Stichprobe von Daechern - alle 617 abzufragen dauert, und
       der Fehler ist keine Frage der Menge. Jedes zwoelfte Haus. */
    for (let i = 0; i < kisten.length; i += 12) {
      const K = kisten[i];
      const dach = SLAB_H + K.h;
      /* Das Gesims reicht 0,55 m unter die Dachflaeche - es wird nicht
         mitgezaehlt, es IST das Dach. */
      /* Der Suchquader war einen Meter groesser als das Haus und zwoelf
         Meter hoch. Damit fing er die Dachaufbauten des NACHBARN mit,
         wenn der hoeher ist - der erste Stand meldete daraufhin eine
         "hoechste Luft" von 11,11 m, und das war der Nachbar, nicht ein
         schwebender Klotz. Jetzt genau die Grundflaeche des Hauses, und
         nur bis sechs Meter ueber das Dach: hoeher ist kein Aufbau mehr,
         sondern ein anderes Haus. */
      const teile = d.dekoIm(K.x - K.w / 2, K.x + K.w / 2,
                             dach + 0.02, dach + 6,
                             K.z - K.d / 2, K.z + K.d / 2, 0);
      for (const [tw, th, td, tx, ty, tz] of teile) {
        /* Das Gesims ist breiter als das Haus - es steht rundum vor. */
        if (tw > K.w || td > K.d) continue;
        klotz++;
        const fuss = ty - th / 2;
        const luft = fuss - dach;
        if (luft > TOL) {
          schwebt++;
          if (luft > hoechsteLuft) hoechsteLuft = luft;
          if (bsp.length < 12) bsp.push({ was: 'schwebt', x: tx, z: tz,
                                          hoch: +th.toFixed(2), luft: +luft.toFixed(2) });
        } else if (luft < -TOL) {
          steckt++;
          if (-luft > tiefstesStecken) tiefstesStecken = -luft;
          if (bsp.length < 12) bsp.push({ was: 'steckt', x: tx, z: tz,
                                          hoch: +th.toFixed(2), tief: +(-luft).toFixed(2) });
        }
        /* Haelt an dieser Stelle irgendetwas die Figur auf? Gefragt wird
           auf halber Klotzhoehe, also genau dort, wo sie hineinlaufen
           wuerde. */
        const yM = ty;
        let halt = false;
        for (const c of d.colliderNah(tx, tz)) {
          if (c.parkAuto) continue;
          const y0 = c.y0 === undefined ? -1e9 : c.y0;
          if (tx > c.x0 && tx < c.x1 && tz > c.z0 && tz < c.z1 &&
              yM > y0 && yM < c.h) { halt = true; break; }
        }
        if (!halt) {
          ohneHalt++;
          if (bsp.length < 12) bsp.push({ was: 'ohneHalt', x: tx, z: tz,
                                          hoch: +th.toFixed(2) });
        }
      }
    }
    return { daecher: Math.ceil(kisten.length / 12), klotz, schwebt, steckt, ohneHalt,
             hoechsteLuft: +hoechsteLuft.toFixed(2),
             tiefstesStecken: +tiefstesStecken.toFixed(2), bsp };
  });

  console.log('\n== Dachaufbauten ==');
  console.log('  Daecher in der Stichprobe   ' + aus.daecher);
  console.log('  Kloetze darauf              ' + aus.klotz);
  console.log('  schwebt                     ' + aus.schwebt +
              '   hoechste Luft ' + aus.hoechsteLuft + ' m');
  console.log('  steckt                      ' + aus.steckt +
              '   tiefstes Stecken ' + aus.tiefstesStecken + ' m');
  console.log('  ohne Hindernis              ' + aus.ohneHalt);
  if (aus.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }
  const fehler = aus.schwebt + aus.steckt;
  console.log('\n  ' + fehler + ' Beanstandungen (Sitz auf dem Dach)');
  console.log('  ' + aus.ohneHalt + ' Kloetze ohne Hindernis');
  await b.close();
  process.exitCode = fehler ? 1 : 0;
})();
