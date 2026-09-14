/* CITY V2, Stufe 5 Teil E: zehn feste Aufnahmen fuer den Vergleich.

   Teil E aendert nichts an der Anlage der Stadt, sondern nur daran, wie
   sich Nachbarn voneinander unterscheiden. Ob das wirkt, entscheidet
   kein Zahlenwert, sondern das Bild. Ein Pixelvergleich taugt dafuer
   NICHT: zwei Laeufe derselben Fassung unterscheiden sich bereits in 3
   bis 10 Prozent aller Bildpunkte, weil Verkehr und Passanten laufen.
   Diese Bilder sind zum Ansehen da.

   Dieselbe Kamera, derselbe Seed, einmal mit und einmal ohne die
   Wiederholungsbremsen:

     node tools/pruef/stufe5e-bilder.js bilder/e-neu 4711
     node tools/pruef/stufe5e-bilder.js bilder/e-alt 4711 alt

   WICHTIG: die Kamera steht auf einer RASTERLINIE (25 + 50k). Eine
   Kamera auf einer Blockmitte steht seit Stufe 5 im Haus.
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');

const ziel = process.argv[2] || 'bilder-stufe5e';
const seed = +(process.argv[3] || 4711);
const alt = process.argv[4] === 'alt';
fs.mkdirSync(ziel, { recursive: true });

/* Zehn Stellen, die genau das zeigen, worum es in Teil E geht:
   Wiederholung entlang einer Zeile und der Hoehenrhythmus darueber. */
const STELLEN = [
  /* Name,                  Kamera x/y/z,        Blickziel x/y/z */
  ['01-wohnzeile-laengs',   -325, 2.3,  140,   -325,   5,  300],
  ['02-wohnzeile-schraeg',  -275, 2.3,  175,   -175,   8,  275],
  ['03-wohn-dachlinie',     -325,  26,  120,   -325,  16,  280],
  ['04-mischung-strasse',   -225, 2.3,   40,   -225,   5,  210],
  ['05-mischung-dachlinie', -225,  30,   25,   -225,  18,  190],
  ['06-geschaeft-avenue',   -260, 2.3,   25,    -60,   6,   25],
  ['07-geschaeft-dachlinie', -260,  34,   25,   -60,  22,   25],
  ['08-downtown-strasse',     25, 2.3,  -60,     25,   5,  110],
  ['09-ufer-zeile',          175, 2.3,  -75,    175,   6,   85],
  ['10-skyline',            -400,  70,   60,    -60,  25,   20],
];

(async () => {
  const { b, page } = await starte(1280, 720, seed, alt ? { wdhAlt: true } : {});
  const info = await page.evaluate(() => {
    __dbg.frier(true); __dbg.setzeRegen(0);
    return __dbg.hausInfo();
  });
  for (const [name, px, py, pz, zx, zy, zz] of STELLEN) {
    await page.evaluate(([x, z]) => { __dbg.setzePos(x, z); }, [px, pz]);
    /* Dreimal zeichnen: SwiftShader liefert sonst einen halb fertigen
       Puffer. */
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
              '   Schwelle ' + info.schwelle + (alt ? '   BREMSEN AUS' : ''));
})();
