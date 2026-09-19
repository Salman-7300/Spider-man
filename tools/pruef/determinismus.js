/* CITY V2, Stufe 5 Teil F: baut derselbe Weltkeim wirklich dieselbe Stadt?

   Stufe 5 hat die Architektur deterministisch gemacht: Lotbreiten,
   Fassadenwahl und Modellwahl haengen am Weltkeim, am Block und an der
   Zeile - nicht an einem frei laufenden Zufall. Teil E hat gezeigt, wie
   leicht ein einzelner zusaetzlicher randi()-Aufruf das kippt.

   Dieser Pruefstand laedt dieselbe Stadt mehrfach neu und vergleicht
   einen Fingerabdruck: Zahl und Masse aller Haeuser, ihre Stadtteile,
   ihre Fassadentexturen und ihre Modellzuordnung. Unterscheidet sich
   etwas, ist irgendwo Zufall im Spiel, der nicht am Keim haengt.

   Aufruf:  node tools/pruef/determinismus.js [seed] [laeufe]
   ========================================================================= */
const { starte } = require('./basis');
const zahl = (v, standard) => {
  const n = Number(v);
  return (v === undefined || v === '-' || v === '' || !isFinite(n)) ? standard : n;
};
const seed = zahl(process.argv[2], 4711);
const laeufe = zahl(process.argv[3], 3);

/* Ein einfacher, stabiler Fingerabdruck - keine Kryptografie noetig,
   nur eine Zahl, die sich bei jeder Abweichung aendert. */
function finger(s) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = ((h1 ^ s.charCodeAt(i)) * 16777619) >>> 0;
    h2 = ((h2 + s.charCodeAt(i) * (i + 1)) * 2654435761) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

(async () => {
  const ergebnisse = [];
  for (let n = 0; n < laeufe; n++) {
    const { b, page } = await starte(800, 480, seed);
    const r = await page.evaluate(() => {
      const d = __dbg; d.frier(true);
      const K = d.hausKisten();
      /* In Baureihenfolge, damit auch die REIHENFOLGE mitgeprueft wird. */
      const teile = K.map((h) => [h.x, h.z, h.w, h.d, h.h, h.visual,
                                  h.textur, h.modell || '-', h.art || '-',
                                  h.zeile || '-'].join(','));
      const info = d.hausInfo();
      const R = d.raster();
      const hoehen = K.map((h) => h.h).sort((a, b2) => a - b2);
      return {
        haeuser: K.length, model: info.model, merged: info.merged,
        text: teile.join(';'),
        lots: teile.map((t) => t.split(',').slice(0, 4).join(',')).join(';'),
        hoehen: hoehen.join(','),
        modelle: K.map((h) => h.modell || '-').join(','),
        fassaden: K.map((h) => h.textur).join(','),
        stadtteile: K.map((h) => h.art || '-').join(','),
        kollider: d.colliders.length,
        raster: [R.blocksX, R.blocksZ, R.pitch].join(','),
      };
    });
    await b.close();
    ergebnisse.push({
      haeuser: r.haeuser, model: r.model, merged: r.merged, kollider: r.kollider,
      raster: r.raster,
      gesamt: finger(r.text), lots: finger(r.lots), hoehen: finger(r.hoehen),
      modelle: finger(r.modelle), fassaden: finger(r.fassaden),
      stadtteile: finger(r.stadtteile),
    });
    console.log('  Lauf ' + (n + 1) + ': ' + r.haeuser + ' Haeuser, '
                + r.kollider + ' Kollider, Fingerabdruck ' + finger(r.text));
  }

  const p = (s) => console.log(s);
  const e0 = ergebnisse[0];
  const felder = ['haeuser', 'model', 'merged', 'kollider', 'raster',
                  'gesamt', 'lots', 'hoehen', 'modelle', 'fassaden', 'stadtteile'];
  p('');
  p('== Determinismus (Keim ' + seed + ', ' + laeufe + ' Laeufe) ==');
  p('');
  let abweichungen = 0;
  for (const f of felder) {
    const gleich = ergebnisse.every((e) => String(e[f]) === String(e0[f]));
    if (!gleich) abweichungen++;
    p('  ' + f.padEnd(12) + String(e0[f]).padStart(18) + '   '
      + (gleich ? 'in allen Laeufen gleich' : 'ABWEICHUNG: '
         + ergebnisse.map((e) => e[f]).join(' / ')));
  }
  p('');
  p(abweichungen === 0
    ? '  Derselbe Weltkeim baut dieselbe Stadt - in allen geprueften Merkmalen.'
    : '  ' + abweichungen + ' Merkmale weichen ab.');
  p('');
})();
