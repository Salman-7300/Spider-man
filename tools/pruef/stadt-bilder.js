/* CITY V2: Bilder der Stadt aus der echten Spielkamera.

   Zahlen allein entscheiden nicht, ob eine Stadt richtig aussieht. Dieser
   Pruefstand macht immer dieselben Aufnahmen - Luftbild von vier Seiten,
   Dachhoehe, Strassenhoehe -, damit sich zwei Ausbaustufen Bild fuer Bild
   vergleichen lassen. Die Kamerastellen kommen aus dem Raster des Spiels,
   nicht aus festen Zahlen: so zeigt dasselbe Bild in der kleinen und in
   der grossen Stadt dieselbe Stelle.

   Aufruf:  node tools/pruef/stadt-bilder.js [zielordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');

const ziel = process.argv[2] || 'bilder-city';
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, 4711);
  const R = await page.evaluate(() => {
    __dbg.frier(true); __dbg.setzeRegen(0);
    return __dbg.raster();
  });
  const mx = (R.x0 + R.x1) / 2, mz = (R.z0 + R.z1) / 2;
  const spanne = Math.max(R.x1 - R.x0, R.z1 - R.z0);
  const bilder = [
    ['luft-sued',  mx, spanne * 0.85, R.z1 + spanne * 0.55, mx, 0, mz],
    ['luft-west',  R.x0 - spanne * 0.55, spanne * 0.85, mz, mx, 0, mz],
    ['luft-nord',  mx, spanne * 0.85, R.z0 - spanne * 0.55, mx, 0, mz],
    ['luft-ost',   R.x1 + spanne * 0.30, spanne * 0.75, mz, mx, 0, mz],
    ['dach-mitte', mx, 60, mz + 90, mx, 25, mz],
    ['dach-west',  R.x0 + 60, 60, mz + 90, R.x0 + 60, 25, mz],
    ['strasse-mitte', mx + 25, 2.2, mz, mx + 120, 8, mz],
    ['strasse-west',  R.x0 + 25, 2.2, mz, R.x0 + 120, 8, mz],
    ['strasse-nord',  mx, 2.2, R.z0 + 25, mx, 8, R.z0 + 120],
    ['uferstrasse',   R.x1, 2.2, mz, R.x1, 8, mz + 120],
    /* CITY V2 Stufe 3: eine Strasse jeder Klasse von oben, damit sich
       Spuren und Mittelstreifen vergleichen lassen. */
    ['boulevard-x',  -125, 22, mz - 40, -125, 2, mz + 60],
    ['boulevard-z',  mx - 40, 22, 25, mx + 60, 2, 25],
    ['avenue-z',     mx - 40, 22, -125, mx + 60, 2, -125],
    ['local-rand',   R.x0, 22, mz - 40, R.x0, 2, mz + 60],
    /* CITY V2 Stufe 4: Strassenhoehe je Klasse, plus Bruecke,
       Wohnblock und Downtown - die Lagen aus dem Human-Test. */
    ['s4-boulevard', -125, 2.3, -55, -125, 3, 130],
    ['s4-avenue',    -55, 2.3, -125, 130, 3, -125],
    ['s4-street',    -75, 2.3, -55, -75, 3, 130],
    ['s4-local',     R.x0, 2.3, -55, R.x0, 3, 130],
    ['s4-bruecke',   172, 3.0, -60, 300, 3, -25],
    ['s4-wohnblock', -225, 2.3, 105, -225, 3, 230],
    ['s4-downtown',  25, 2.3, -5, 25, 3, 120],
  ];
  for (const [name, px, py, pz, zx, zy, zz] of bilder) {
    /* Dreimal zeichnen: SwiftShader liefert sonst einen halb fertigen
       Puffer - derselbe Fehler wie im Innenraum-Pruefstand. */
    for (let i = 0; i < 3; i++) {
      await page.evaluate((a) => __dbg.aufnahme(a[0], a[1], a[2], a[3], a[4], a[5]),
                          [px, py, pz, zx, zy, zz]);
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    }
    const datei = path.join(ziel, name + '.png');
    await page.screenshot({ path: datei });
    console.log('  ' + datei);
  }
  console.log('  Raster ' + R.blocksX + ' x ' + R.blocksZ +
              '   x ' + R.x0 + '...' + R.x1 + '   z ' + R.z0 + '...' + R.z1);
  await b.close();
})();
