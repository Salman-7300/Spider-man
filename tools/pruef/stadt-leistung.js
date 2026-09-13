/* CITY V2: Zeichenaufrufe und Dreiecke der Stadt.

   Das Leistungstor der Erweiterung lautet: der MEDIAN der Zeichenaufrufe
   darf um hoechstens ~25 Prozent steigen, der Median der sichtbaren
   Dreiecke um hoechstens ~35. Dieser Pruefstand liefert die Zahl, gegen
   die verglichen wird.

   Bildraten kommen hier NICHT vor. Gerendert wird mit SwiftShader auf
   der CPU; eine Bildrate daraus waere eine Zahl ueber diesen Rechner,
   nicht ueber das Spiel. Zeichenaufrufe und Dreiecke dagegen sind
   dieselben wie auf einer echten Grafikkarte.

   Gemessen wird an festen Kamerastellen, nicht an zufaelligen: die
   Stellen werden aus dem Raster des SPIELS abgeleitet (__dbg.raster()),
   damit derselbe Pruefstand die kleine und die grosse Stadt an
   vergleichbaren Orten misst - Strassenhoehe, Dachhoehe und Luftbild,
   je vier Blickrichtungen.

   Aufruf:  node tools/pruef/stadt-leistung.js [ausgabe.json]
   Vergleich: node tools/pruef/stadt-leistung.js neu.json alt.json
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');

const zielDatei = process.argv[2] || null;
const vergleich = process.argv[3] || null;

(async () => {
  const { b, page } = await starte(1280, 720, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const R = d.raster();

    /* Messpunkte: ein gleichmaessiges Gitter ueber die Stadt, in
       Blockmitten. Fuenf Stuetzstellen je Achse, damit die Zahl der
       Messungen nicht mit der Stadtgroesse explodiert und trotzdem Rand
       wie Mitte vorkommen. */
    const stuetz = (a0, a1, n) => {
      const aus = [];
      for (let i = 0; i < n; i++) aus.push(a0 + (a1 - a0) * (i + 0.5) / n);
      return aus;
    };
    const xs = stuetz(R.x0, R.x1, 5), zs = stuetz(R.z0, R.z1, 5);
    const RICHTUNG = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const LAGEN = [{ name: 'strasse', y: 2.2, ziel: 2.0 },
                   { name: 'dach',    y: 42,  ziel: 30 },
                   { name: 'luft',    y: 120, ziel: 20 }];

    const messe = (px, py, pz, zx, zy, zz) => {
      /* Der erste Durchgang nach einem Kamerawechsel zaehlt anders als
         die folgenden (in lod-stufen.js gemessen: 425 gegen 605 bei
         identischer Szene). Deshalb dreimal zeichnen, den letzten
         nehmen. */
      let r = null;
      for (let i = 0; i < 3; i++) { d.aufnahme(px, py, pz, zx, zy, zz); r = d.renderInfo(); }
      return r;
    };

    const proben = [];
    for (const lage of LAGEN)
      for (const x of xs)
        for (const z of zs)
          for (const [rx, rz] of RICHTUNG) {
            const r = messe(x, lage.y, z, x + rx * 60, lage.ziel, z + rz * 60);
            proben.push({ lage: lage.name, x: +x.toFixed(1), z: +z.toFixed(1),
                          rx, rz, calls: r.calls, dreiecke: r.dreiecke });
          }
    const speicher = d.renderInfo();
    return { raster: R, proben,
             speicher: { texturen: speicher.texturen, geometrien: speicher.geometrien,
                         programme: speicher.programme } };
  });
  await b.close();

  const median = (a) => {
    if (!a.length) return 0;
    const s = [...a].sort((x, y) => x - y);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const stat = (proben) => ({
    n: proben.length,
    callsMed: median(proben.map((p) => p.calls)),
    callsMax: Math.max(...proben.map((p) => p.calls)),
    triMed: median(proben.map((p) => p.dreiecke)),
    triMax: Math.max(...proben.map((p) => p.dreiecke)),
  });
  const bericht = {
    raster: aus.raster, speicher: aus.speicher,
    gesamt: stat(aus.proben), proLage: {},
  };
  for (const lage of ['strasse', 'dach', 'luft'])
    bericht.proLage[lage] = stat(aus.proben.filter((p) => p.lage === lage));

  const R = aus.raster;
  const p = (s) => console.log(s);
  p('');
  p('== Stadt ==');
  p('  Raster ' + R.blocksX + ' x ' + R.blocksZ + ' = ' + (R.blocksX * R.blocksZ) +
    ' Bloecke   x ' + R.x0 + '...' + R.x1 + '   z ' + R.z0 + '...' + R.z1);
  p('  Texturen ' + aus.speicher.texturen + '   Geometrien ' + aus.speicher.geometrien +
    '   Programme ' + aus.speicher.programme);
  p('');
  p('== Zeichenaufrufe und Dreiecke (' + bericht.gesamt.n + ' Aufnahmen) ==');
  p('  Lage        Aufrufe Med   Aufrufe Max      Dreiecke Med   Dreiecke Max');
  const zeile = (name, s) =>
    p('  ' + name.padEnd(12) + String(s.callsMed).padStart(11) +
      String(s.callsMax).padStart(14) + String(s.triMed).padStart(18) +
      String(s.triMax).padStart(15));
  for (const lage of ['strasse', 'dach', 'luft']) zeile(lage, bericht.proLage[lage]);
  zeile('GESAMT', bericht.gesamt);

  if (vergleich && fs.existsSync(vergleich)) {
    const alt = JSON.parse(fs.readFileSync(vergleich, 'utf8'));
    p('');
    p('== Leistungstor gegen ' + vergleich + ' ==');
    const proz = (neu, alt2) => (alt2 ? ((neu / alt2 - 1) * 100) : 0);
    const dCalls = proz(bericht.gesamt.callsMed, alt.gesamt.callsMed);
    const dTri = proz(bericht.gesamt.triMed, alt.gesamt.triMed);
    p('  Aufrufe  Median ' + alt.gesamt.callsMed + ' -> ' + bericht.gesamt.callsMed +
      '   ' + (dCalls >= 0 ? '+' : '') + dCalls.toFixed(1) + ' %   Tor +25 %   ' +
      (dCalls <= 25 ? 'ok' : 'BEFUND'));
    p('  Dreiecke Median ' + alt.gesamt.triMed + ' -> ' + bericht.gesamt.triMed +
      '   ' + (dTri >= 0 ? '+' : '') + dTri.toFixed(1) + ' %   Tor +35 %   ' +
      (dTri <= 35 ? 'ok' : 'BEFUND'));
    bericht.tor = { dCalls: +dCalls.toFixed(1), dTri: +dTri.toFixed(1),
                    bestanden: dCalls <= 25 && dTri <= 35 };
  }
  if (zielDatei) {
    fs.writeFileSync(zielDatei, JSON.stringify(bericht, null, 2));
    p('');
    p('  geschrieben: ' + zielDatei);
  }
  p('');
  process.exit(bericht.tor && !bericht.tor.bestanden ? 1 : 0);
})();
