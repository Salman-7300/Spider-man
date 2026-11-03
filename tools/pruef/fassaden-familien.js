/* CITY V2 Stufe 8B: Fassaden vorher/nachher mit FESTER Hausauswahl.

   Welche Haeuser district-identity.js je (Haustyp x Bezirk x Programm)
   als erstes findet, haengt vom Stand ab - fuer einen Vergleich muss die
   Auswahl einmal festgehalten werden. "liste" waehlt je Schluessel JE
   Haeuser im aktuellen Stand und schreibt Kamerapunkte (aus 13 m, 7 m
   seitlich, und schraeg aus 9 m, 12 m seitlich - beide auf Augenhoehe
   1,7 m, nur wenn kein Hindernis im Weg steht); "bilder" rendert diese
   Punkte in einem beliebigen Stand. Wagen und Passanten ausgeblendet.

   Aufruf:  node tools/pruef/fassaden-familien.js liste <json> [JE] [NUR=a,b]
            node tools/pruef/fassaden-familien.js bilder <json> <ordner> [zeit] [wurzel=<Spielordner>]
   ========================================================================= */
const path = require('path');
const fs = require('fs');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const WURZEL = path.resolve(arg('wurzel', path.join(__dirname, '..', '..')));
const { starte } = require(path.join(WURZEL, 'tools', 'pruef', 'basis'));
const modus = process.argv[2], datei = process.argv[3];
if (!['liste', 'bilder'].includes(modus) || !datei || (modus === 'bilder' && !process.argv[4])) {
  console.log('Aufruf: node tools/pruef/fassaden-familien.js liste <json> [JE] [NUR=a,b]\n        node tools/pruef/fassaden-familien.js bilder <json> <ordner> [zeit] [wurzel=<Spielordner>]');
  process.exit(1);
}
(async () => {
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true });
  if (modus === 'liste') {
    const JE = +(process.argv[4] || 1), NUR = arg('NUR', '') ? arg('NUR', '').split(',') : null;
    const wahl = await page.evaluate(({ JE, NUR }) => {
      const d = __dbg; const K = d.hausKisten(), B = d.bezirksIdentitaet();
      const drin = (x, z) => d.colliders.some((c) => !c.klein && (c.h || 0) > 2 && x > c.x0 - 0.3 && x < c.x1 + 0.3 && z > c.z0 - 0.3 && z < c.z1 + 0.3);
      const ges = {}, aus = [];
      for (const e of B.liste) {
        if (e.art !== 'sockel') continue;
        const H = K[e.haus];
        const typ = (H.modell || 'kiste').replace('Downtown_', '').replace('Brownstone_', 'BS_');
        const key = typ + '-' + e.bezirk + '-' + e.programm;
        if (NUR && !NUR.some((n) => key.indexOf(n) >= 0)) continue;
        if ((ges[key] || 0) >= JE) continue;
        const l = (e.l0 + e.l1) / 2;
        const ebene = e.nx ? H.x + e.nx * H.w / 2 : H.z + e.nz * H.d / 2;
        const x = e.nx ? ebene : H.x + e.nz * l, z = e.nx ? H.z - e.nx * l : ebene;
        const tx = e.nz, tz = -e.nx;
        const kam = [];
        for (const [AB, SE] of [[13, 7], [9, 12]]) {
          const kx = x + e.nx * AB + tx * SE, kz = z + e.nz * AB + tz * SE;
          if (drin(kx, kz)) { kam.length = 0; break; }
          kam.push([kx, kz]);
        }
        if (!kam.length) continue;
        ges[key] = (ges[key] || 0) + 1;
        aus.push({ name: key + '-' + ges[key], x, z, kam, h: H.h, nr: e.haus });
      }
      return aus;
    }, { JE, NUR });
    fs.writeFileSync(datei, JSON.stringify(wahl, null, 1));
    console.log(wahl.length, 'Haeuser');
  } else {
    const ziel = process.argv[4]; fs.mkdirSync(ziel, { recursive: true });
    const ZEIT = process.argv[5] && process.argv[5].indexOf('=') < 0 ? +process.argv[5] : 0.45;
    const wahl = JSON.parse(fs.readFileSync(datei, 'utf8'));
    for (const w of wahl) for (const [i, k] of w.kam.entries()) {
      await page.evaluate(({ w, k, zeit }) => {
        const d = __dbg; d.frier(true); d.setzeRegen(0); window.__setzeZeit(zeit);
        for (const c of d.civilians) { const r = c.visual && (c.visual.root || c.visual.group); if (r) r.visible = false; }
        for (const c of d.cars) if (c.mesh) c.mesh.visible = false;
        if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
        d.setzePos(k[0] + (k[0] - w.x) * 0.3, 0, k[1] + (k[1] - w.z) * 0.3);
        for (let s = 0; s < 16; s++) d.schritt(1 / 60, 1);
        for (const c of d.cars) if (c.mesh) c.mesh.visible = false;
        const zy = Math.min(w.h * 0.45, 14);
        d.aufnahme(k[0], 1.7, k[1], w.x, zy, w.z); d.aufnahme(k[0], 1.7, k[1], w.x, zy, w.z);
      }, { w, k, zeit: ZEIT });
      await page.screenshot({ path: path.join(ziel, w.name + (i ? '-schraeg' : '') + '.png') });
    }
    console.log('fertig', wahl.length);
  }
  await b.close();
})();
