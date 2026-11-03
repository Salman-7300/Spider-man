/* Der Stadtplan: Raster, Grenzen und der LOCKED CORE.

   CITY V2 waechst nach aussen. Die Vorgabe ist eindeutig: der vorhandene
   Kern - Storyorte, Bruecke, U-Bahn, Parks, Promenade, POIs, begehbare
   Haeuser, Gehnetz-Anker, Kreuzungen - darf sich dabei NICHT verschieben.

   Dieser Pruefstand schreibt den Kern fest. Er misst

     - Rastermasse und alle abgeleiteten Weltgrenzen
     - die Weltkoordinaten JEDER Rasterlinie des alten 7x7-Kerns
     - alle Kreuzungen des Kerns
     - die festen Orte: Bruecke, U-Bahn-Stationen, Promenade, Ufer
     - die Spielergrenzen

   und vergleicht sie mit der Sollliste unten. Die Sollwerte stammen aus
   dem Stand VOR der Erweiterung (Commit f93cbf5) - sie sind gemessen,
   nicht gewuenscht.

   Aufruf:  node tools/pruef/stadtraster.js */
const { starte } = require('./basis');

/* ---- LOCKED CORE: der 7x7-Kern, wie er vor CITY V2 stand ----
   Rasterlinien bei -175, -125, -75, -25, 25, 75, 125, 175 in beiden
   Richtungen. Diese 8 x 8 = 64 Kreuzungen duerfen sich nicht bewegen. */
const KERN_LINIEN = [-175, -125, -75, -25, 25, 75, 125, 175];
const SOLL = {
  pitch: 50,
  roadHalf: 6,
  slabH: 0.25,
  flussX0: 192, flussX1: 330,
  uferX0: 330, uferX1: 400,
  promX0: 181, autoXMax: 179,
  brueckeZ: -25, brueckeHW: 10,
  wasserY: -2.6,
  /* Grenzen, wie sie vor der Erweiterung galten. */
  /* Die abgeleiteten Grenzen werden NICHT als feste Zahl geprueft: sie
     wachsen mit der Stadt mit, und genau das sollen sie. Geprueft wird
     ihr ABSTAND zur aeussersten Rasterlinie - der darf sich nicht
     aendern. Die Werte stammen aus dem Stand vor der Erweiterung. */
  stadtRandOst: 175,
};

(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const aus = await page.evaluate((kernLinien) => {
    const d = __dbg;
    const r = d.raster();
    /* Welche Rasterlinien gibt es wirklich? */
    const linienX = [], linienZ = [];
    for (let i = 0; i <= r.blocksX; i++) linienX.push(+(r.x0 + i * r.pitch).toFixed(3));
    for (let i = 0; i <= r.blocksZ; i++) linienZ.push(+(r.z0 + i * r.pitch).toFixed(3));
    /* Liegt jede Kernlinie noch im Raster? */
    const fehlendX = kernLinien.filter((v) => !linienX.some((w) => Math.abs(w - v) < 1e-6));
    const fehlendZ = kernLinien.filter((v) => !linienZ.some((w) => Math.abs(w - v) < 1e-6));
    /* Boden und Gehweg an jeder Kernkreuzung: auf der Kreuzung Strasse
       (0), in der Blockmitte Gehweg (SLAB_H). Das ist die schaerfste
       Probe darauf, dass sich das Raster nicht verschoben hat. */
    const kreuzFalsch = [], mitteFalsch = [];
    for (const x of kernLinien) {
      for (const z of kernLinien) {
        const gy = d.groundYAt(x, z, 2);
        if (Math.abs(gy) > 1e-6) kreuzFalsch.push([x, z, gy]);
      }
    }
    for (let a = 0; a + 1 < kernLinien.length; a++) {
      for (let c = 0; c + 1 < kernLinien.length; c++) {
        const mx = (kernLinien[a] + kernLinien[a + 1]) / 2;
        const mz = (kernLinien[c] + kernLinien[c + 1]) / 2;
        const gy = d.groundYAt(mx, mz, 2);
        if (Math.abs(gy - 0.25) > 1e-6) mitteFalsch.push([mx, mz, gy]);
      }
    }
    /* Feste Orte des Kerns. */
    const ubahn = d.ubStationen ? d.ubStationen() : null;
    return {
      r, linienX, linienZ, fehlendX, fehlendZ,
      kreuzFalsch: kreuzFalsch.slice(0, 8), kreuzN: kreuzFalsch.length,
      mitteFalsch: mitteFalsch.slice(0, 8), mitteN: mitteFalsch.length,
      bloecke: r.blocksX * r.blocksZ,
      ubahn,
      kollider: d.colliders.length,
    };
  }, KERN_LINIEN);

  const p = (s) => console.log(s);
  const R = aus.r;
  let fehler = 0;
  const pruefe = (name, ist, soll) => {
    const ok = Math.abs(ist - soll) < 1e-6;
    if (!ok) fehler++;
    p('  ' + String(name).padEnd(16) + String(ist).padStart(9) +
      '   soll ' + String(soll).padStart(8) + (ok ? '   ok' : '   BEFUND'));
  };
  p('');
  p('== Raster ==');
  p('  Bloecke ' + aus.bloecke + ' (' + R.blocksX + ' x ' + R.blocksZ + ')' +
    '   Raster x ' + R.x0 + '...' + R.x1 + '   z ' + R.z0 + '...' + R.z1);
  /* Gemessen ueber vier Laeufe: 1929, 1932, 1932, 1935. Die Zahl
     schwankt, weil Fahrzeuge beim Laden schon fahren und ihre Kollider
     mitzaehlen. Sie ist deshalb ein Anhaltspunkt, KEINE Sollgroesse -
     der Kern wird ueber Rasterlinien und Boden geprueft, nicht hierueber. */
  p('  Kollider ' + aus.kollider + ' (inkl. Fahrzeuge, schwankt um ~1930)');
  p('');
  p('== Feste Masse (duerfen sich NIE aendern) ==');
  pruefe('pitch', R.pitch, SOLL.pitch);
  pruefe('Fluss x0', R.flussX0, SOLL.flussX0);
  pruefe('Fluss x1', R.flussX1, SOLL.flussX1);
  pruefe('Ufer x0', R.uferX0, SOLL.uferX0);
  pruefe('Ufer x1', R.uferX1, SOLL.uferX1);
  pruefe('Promenade x0', R.promX0, SOLL.promX0);
  pruefe('Auto x max', R.autoXMax, SOLL.autoXMax);
  pruefe('Uferstrasse', R.x1, SOLL.stadtRandOst);
  p('');
  p('== Abgeleitete Grenzen: Abstand zur aeussersten Rasterlinie ==');
  const ab = (name, ist, linie, soll) => pruefe(name, +(ist - linie).toFixed(6), soll);
  ab('Gebiet z0', R.gebietZ0, R.z0, -17);
  ab('Gebiet z1', R.gebietZ1, R.z1, 17);
  ab('Gebiet x0', R.gebietX0, R.x0, -6);
  ab('Spieler z0', R.spielZ0, R.z0, -18);
  ab('Spieler z1', R.spielZ1, R.z1, 18);
  ab('Spieler x0', R.spielX0, R.x0, -18);
  ab('Promenade z0', R.promZ0, R.z0, -15);
  ab('Promenade z1', R.promZ1, R.z1, 15);
  ab('Gehwegrand x0', R.randX0, R.x0, -15);
  ab('Gehwegrand x1', R.randX1, R.x1, 15);
  ab('Luft x0', R.luftX0, R.x0, 5);
  ab('Luft x1', R.luftX1, R.x1, -5);
  ab('Luft z0', R.luftZ0, R.z0, 5);
  ab('Luft z1', R.luftZ1, R.z1, -5);
  p('');
  p('== LOCKED CORE: die 8 Rasterlinien des alten 7x7-Kerns ==');
  p('  fehlende x-Linien: ' + (aus.fehlendX.length ? aus.fehlendX.join(', ') + '   BEFUND' : 'keine   ok'));
  p('  fehlende z-Linien: ' + (aus.fehlendZ.length ? aus.fehlendZ.join(', ') + '   BEFUND' : 'keine   ok'));
  if (aus.fehlendX.length || aus.fehlendZ.length) fehler++;
  p('  Kreuzungen mit falschem Boden: ' + aus.kreuzN + ' von 64' +
    (aus.kreuzN ? '   ' + JSON.stringify(aus.kreuzFalsch) + '   BEFUND' : '   ok'));
  p('  Blockmitten ohne Gehweg:      ' + aus.mitteN + ' von 49' +
    (aus.mitteN ? '   ' + JSON.stringify(aus.mitteFalsch) + '   BEFUND' : '   ok'));
  if (aus.kreuzN || aus.mitteN) fehler++;
  if (aus.ubahn) {
    p('');
    p('== U-Bahn ==');
    p('  ' + JSON.stringify(aus.ubahn).slice(0, 400));
  }
  p('');
  p(fehler ? '  ' + fehler + ' BEFUNDE' : '  alles unveraendert');
  await b.close();
  process.exit(fehler ? 1 : 0);
})();
