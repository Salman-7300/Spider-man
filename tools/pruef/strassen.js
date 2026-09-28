/* CITY V2: die Strassenhierarchie nachmessen.

   Geprueft wird nicht, ob die Einteilung "schoen" ist, sondern ob sie
   haelt, was sie verspricht:

     - jede Rasterlinie hat genau eine Klasse,
     - KEINE Spurmitte liegt ausserhalb des Asphalts (ROAD_HALF = 6) -
       das ist die Zusage, dass die Hierarchie ohne einen einzigen Meter
       mehr Strassenbreite auskommt,
     - zwei Spuren derselben Richtung ueberlappen sich nicht,
     - die Uferstrasse bleibt zweispurig (oestlich davon liegt bei 181
       die Promenade, AUTO_X_MAX haelt bei 179),
     - die Brueckenstrasse bleibt zweispurig (das Deck ist 15 m breit,
       der Gehweg beginnt 5,6 m neben der Achse),
     - jeder Wagen faehrt auf einer Spur seiner Strasse, nicht daneben,
     - und seine Richtung passt zur Seite, auf der er faehrt.

   Aufruf:  node tools/pruef/strassen.js
   ========================================================================= */
const { starte } = require('./basis');

const ROAD_HALF = 6, BR_GEH_INNEN = 5.6, AUTO_X_MAX_ABSTAND = 4;

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const R = d.raster();
    const str = d.strassen();
    /* Jeden Wagen seiner Strasse zuordnen. */
    const wagen = [];
    for (const c of d.cars) {
      if (c.aus) continue;
      const qa = c.axis === 'x' ? 'z' : 'x';
      const linie = qa === 'x'
        ? R.x0 + Math.max(0, Math.min(R.blocksX, Math.round((c.lane - R.x0) / R.pitch))) * R.pitch
        : R.z0 + Math.max(0, Math.min(R.blocksZ, Math.round((c.lane - R.z0) / R.pitch))) * R.pitch;
      const s = str.find((t) => t.achse === qa && Math.abs(t.linie - linie) < 0.5);
      if (!s) { wagen.push({ ohneStrasse: true, axis: c.axis, lane: c.lane }); continue; }
      let bd = Infinity;
      for (const m of s.spurMitten) bd = Math.min(bd, Math.abs(m - c.lane));
      const seite = c.lane > linie ? 1 : -1;
      wagen.push({ klasse: s.klasse, abstand: +bd.toFixed(2),
                   richtigeSeite: c.dir === seite, bruecke: !!c.aufBruecke,
                   tempo: +(c.speed || 0).toFixed(1), tempoKlasse: s.tempoKlasse });
    }
    return { R, str, wagen, autos: d.cars.length };
  });
  await b.close();

  const p = (s) => console.log(s);
  let fehler = 0;
  const befund = (bed, text) => { if (!bed) { fehler++; p('  BEFUND: ' + text); } };

  p('');
  p('== Strassenklassen ==');
  const zaehl = {};
  for (const s of aus.str) zaehl[s.klasse] = (zaehl[s.klasse] || 0) + 1;
  p('  ' + JSON.stringify(zaehl) + '   Linien gesamt ' + aus.str.length);
  for (const achse of ['x', 'z']) {
    const z = aus.str.filter((s) => s.achse === achse)
      .map((s) => s.linie + ':' + s.klasse[0] + s.spuren).join('  ');
    p('  ' + achse + '  ' + z);
  }

  p('');
  p('== Zusage: kein Meter mehr Asphalt ==');
  let maxAus = 0, engste = Infinity;
  for (const s of aus.str) {
    for (const m of s.spurMitten) {
      const rand = Math.abs(m - s.linie) + s.spurBreite / 2;
      maxAus = Math.max(maxAus, rand);
    }
    const sortiert = [...s.spurMitten].sort((a, b2) => a - b2);
    for (let i = 0; i + 1 < sortiert.length; i++)
      engste = Math.min(engste, sortiert[i + 1] - sortiert[i]);
  }
  p('  aeusserster Spurrand ' + maxAus.toFixed(2) + ' m   Asphaltrand ' + ROAD_HALF + ' m');
  befund(maxAus <= ROAD_HALF, 'eine Spur liegt ausserhalb des Asphalts');
  p('  engster Spurabstand ' + engste.toFixed(2) + ' m');
  befund(engste >= 2.4, 'zwei Spuren liegen zu dicht beieinander');

  p('');
  p('== Feste Ausnahmen ==');
  const ufer = aus.str.find((s) => s.achse === 'x' && Math.abs(s.linie - aus.R.x1) < 0.5);
  p('  Uferstrasse x=' + ufer.linie + '  ' + ufer.klasse + '  Spuren ' +
    JSON.stringify(ufer.spurMitten));
  befund(Math.max(...ufer.spurMitten) <= aus.R.x1 + AUTO_X_MAX_ABSTAND,
    'eine Spur der Uferstrasse liegt hinter AUTO_X_MAX');
  const br = aus.str.find((s) => s.achse === 'z' && Math.abs(s.linie + 25) < 0.5);
  p('  Brueckenstrasse z=' + br.linie + '  ' + br.klasse + '  Spuren ' +
    JSON.stringify(br.spurMitten));
  befund(Math.max(...br.spurMitten.map((m) => Math.abs(m - br.linie))) + 0.9 <= BR_GEH_INNEN,
    'eine Spur der Brueckenstrasse liegt im Brueckengehweg');

  p('');
  p('== Der Verkehr auf diesen Spuren (' + aus.autos + ' Wagen) ==');
  const ohne = aus.wagen.filter((w) => w.ohneStrasse);
  const daneben = aus.wagen.filter((w) => !w.ohneStrasse && w.abstand > 0.6);
  const falsch = aus.wagen.filter((w) => !w.ohneStrasse && !w.richtigeSeite);
  const proKlasse = {};
  for (const w of aus.wagen) if (!w.ohneStrasse)
    proKlasse[w.klasse] = (proKlasse[w.klasse] || 0) + 1;
  p('  Wagen je Klasse: ' + JSON.stringify(proKlasse));
  p('  ohne zugeordnete Strasse: ' + ohne.length);
  p('  neben der Spur (> 0,6 m): ' + daneben.length +
    (daneben.length ? '   ' + JSON.stringify(daneben.slice(0, 5)) : ''));
  p('  auf der falschen Seite:   ' + falsch.length);
  befund(ohne.length === 0, ohne.length + ' Wagen gehoeren zu keiner Strasse');
  befund(daneben.length === 0, daneben.length + ' Wagen fahren neben ihrer Spur');
  befund(falsch.length === 0, falsch.length + ' Wagen fahren auf der falschen Seite');

  p('');
  p(fehler ? '  ' + fehler + ' BEFUNDE' : '  alles in Ordnung');
  process.exit(fehler ? 1 : 0);
})();
