/* CITY V2, Stufe 5: immer dieselben sechs Aufnahmen.

   Zahlen entscheiden nicht, ob eine Stadt richtig aussieht. Diese sechs
   Stellen zeigen das, worum es in Stufe 5 geht - Haeuserzeile,
   Stadtteile, Silhouette - und zwar von der Strasse aus, wo der Spieler
   steht, nicht aus der Vogelperspektive.

   WICHTIG: die Kamera steht auf einer RASTERLINIE (25 + 50k). Eine
   Kamera auf einer Blockmitte steht seit Stufe 5 im Haus.

   Aufruf:  node tools/pruef/stufe5-bilder.js <ordner> [hybridschwelle]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');

const ziel = process.argv[2] || 'bilder-stufe5';
const hybrid = +(process.argv[3] || 0);
fs.mkdirSync(ziel, { recursive: true });

const STELLEN = [
  /* Name, Kamera x/y/z, Blickziel x/y/z */
  ['downtown-strasse',  25, 2.3,  -60,    25,  4,  110],
  ['downtown-dach',     25,  40,  -60,    25, 28,   90],
  ['mixed-street',    -225, 2.3,   40,  -225,  4,  210],
  ['commercial-avenue', -260, 2.3,  25,   -60,  5,   25],
  ['residential-local', -325, 2.3, 140,  -325,  4,  300],
  ['skyline',         -400,  70,   60,   -60, 25,   20],
];

(async () => {
  const { b, page } = await starte(1280, 720, 4711, hybrid ? { hybrid } : undefined);
  const info = await page.evaluate(() => {
    __dbg.frier(true); __dbg.setzeRegen(0);
    return __dbg.hausInfo();
  });
  for (const [name, px, py, pz, zx, zy, zz] of STELLEN) {
    /* Erst die Figur hinbringen - sonst ist dort alles weggeschnitten. */
    await page.evaluate(([x, y, z]) => { __dbg.setzePos(x, y, z); }, [px, py, pz]);
    /* Dreimal zeichnen: SwiftShader liefert sonst einen halb fertigen
       Puffer - derselbe Fehler wie im Innenraum-Pruefstand. */
    for (let i = 0; i < 3; i++) {
      await page.evaluate(([a, b2, c, d, e, f]) => { __dbg.aufnahme(a, b2, c, d, e, f); },
                          [px, py, pz, zx, zy, zz]);
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    }
    await page.screenshot({ path: path.join(ziel, name + '.png') });
    console.log('  ' + name);
  }
  await b.close();
  console.log('  MODEL ' + info.model + '   MERGED ' + info.merged +
              '   Schwelle ' + info.schwelle +
              (info.fehler ? '   FEHLER: ' + info.fehler : ''));
})();
