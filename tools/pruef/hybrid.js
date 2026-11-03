/* CITY V2, Stufe 5: wie viele Haeuser brauchen ein eigenes Modell?

   Jede Modellkopie kostet Zeichenaufrufe; die verschmolzene prozedurale
   Fassade kostet zwei Aufrufe JE KACHEL, egal wie viele Haeuser darin
   stehen. Die Frage ist also nicht "Modell oder nicht", sondern "wo ist
   die Grenze, ab der man den Unterschied sieht".

   Dieser Pruefstand misst mehrere Schwellen mit demselben Kamerasatz wie
   stadt-leistung.js (Strasse, Dach, Luft, vier Richtungen), damit sich
   die Zahlen mit dem Leistungstor vergleichen lassen.

   Aufruf:  node tools/pruef/hybrid.js [schwelle ...]
            node tools/pruef/hybrid.js 20 26 32 39
   ========================================================================= */
const { starte } = require('./basis');

const SCHWELLEN = process.argv.slice(2).map(Number).filter((n) => n > 0);
const KANDIDATEN = SCHWELLEN.length ? SCHWELLEN : [20, 26, 32, 39];

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function messe(schwelle) {
  const { b, page } = await starte(1280, 720, 4711, { hybrid: schwelle });
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const R = d.raster();
    const stuetz = (a0, a1, n) => {
      const q = [];
      for (let i = 0; i < n; i++) q.push(a0 + (a1 - a0) * (i + 0.5) / n);
      return q;
    };
    const xs = stuetz(R.x0, R.x1, 5), zs = stuetz(R.z0, R.z1, 5);
    const RICHTUNG = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const LAGEN = [{ name: 'strasse', y: 2.2, ziel: 2.0 },
                   { name: 'dach',    y: 42,  ziel: 30 },
                   { name: 'luft',    y: 120, ziel: 20 }];
    const proben = [];
    for (const lage of LAGEN)
      for (const x of xs)
        for (const z of zs)
          for (const [rx, rz] of RICHTUNG) {
            let r = null;
            for (let i = 0; i < 3; i++) {
              d.aufnahme(x, lage.y, z, x + rx * 60, lage.ziel, z + rz * 60);
              r = d.renderInfo();
            }
            proben.push({ lage: lage.name, calls: r.calls, dreiecke: r.dreiecke });
          }
    let objekte = 0;
    d.szene.traverse(() => objekte++);
    return { proben, info: d.hausInfo(), objekte,
             speicher: d.renderInfo(), kollider: d.colliders.length };
  });
  await b.close();
  const je = (n) => aus.proben.filter((p) => p.lage === n);
  return {
    schwelle, info: aus.info, objekte: aus.objekte, kollider: aus.kollider,
    calls: median(aus.proben.map((p) => p.calls)),
    tri: median(aus.proben.map((p) => p.dreiecke)),
    strasse: median(je('strasse').map((p) => p.calls)),
    dach: median(je('dach').map((p) => p.calls)),
    luft: median(je('luft').map((p) => p.calls)),
    geometrien: aus.speicher.geometrien, texturen: aus.speicher.texturen,
  };
}

(async () => {
  const BASIS = 719;            // Zeichenaufrufe nach Stufe 4.1, gemessen
  const BASIS_TRI = 3081212;
  const TOR = Math.round(BASIS * 1.25);
  console.log('');
  console.log('Grundlage Stufe 4.1: ' + BASIS + ' Zeichenaufrufe, ' +
              BASIS_TRI + ' Dreiecke');
  console.log('Tor: hoechstens ' + TOR + ' Aufrufe (+25 %) und ' +
              Math.round(BASIS_TRI * 1.35) + ' Dreiecke (+35 %)');
  console.log('');
  console.log('  Schwelle  MODEL  MERGED  Aufrufe  Strasse  Dach  Luft' +
              '   gg. 4.1   Dreiecke    gg. 4.1   Objekte');
  const zeilen = [];
  for (const s of KANDIDATEN) {
    const r = await messe(s);
    zeilen.push(r);
    const d1 = ((r.calls / BASIS - 1) * 100).toFixed(1);
    const d2 = ((r.tri / BASIS_TRI - 1) * 100).toFixed(1);
    console.log('  ' + String(r.schwelle).padStart(8) +
      String(r.info.model).padStart(7) + String(r.info.merged).padStart(8) +
      String(r.calls).padStart(9) + String(r.strasse).padStart(9) +
      String(r.dach).padStart(6) + String(r.luft).padStart(6) +
      ((d1 >= 0 ? '+' : '') + d1 + ' %').padStart(10) +
      String(r.tri).padStart(11) + ((d2 >= 0 ? '+' : '') + d2 + ' %').padStart(11) +
      String(r.objekte).padStart(10) +
      (r.calls <= TOR ? '   ok' : '   ueber dem Tor'));
  }
  console.log('');
  for (const r of zeilen) {
    console.log('  Schwelle ' + r.schwelle + ': Fassadenmeshes ' +
      r.info.fassadenProd + ' dauerhaft + ' + r.info.fassadenFall + ' Rueckfall' +
      ' (davon sichtbar ' + r.info.prodSichtbar + ' / ' + r.info.fallSichtbar + ')' +
      '   Kollider ' + r.kollider +
      (r.info.fehler ? '   FEHLER: ' + r.info.fehler : ''));
  }
  console.log('');
})();
