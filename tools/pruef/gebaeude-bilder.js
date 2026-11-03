/* Qualitaets-Pass, Paket 2: Gebaeude vorher/nachher mit FESTER Hausauswahl.

   "liste" waehlt im aktuellen Stand je Gebaeudetyp (Familie bei den
   prozeduralen Haeusern, Modellname bei den Modellhaeusern, zwei Tuerme)
   ein Haus mit freier Strassenseite und legt fuenf Kamerapunkte fest:
     strasse  Strassenabstand: 16 m vor der Front, 5 m seitlich, Augenhoehe
     nah      4,5 m vor der Front, Blick auf 4 m Hoehe (1. OG)
     schraeg  streifend: 3,5 m vor der Front, 20 m seitlich - zeigt, ob die
              Fassade bei flachem Winkel zu Brei wird (Filterung)
     oben     Obergeschosse: 18 m vor der Front auf 60 % der Haushoehe
     nacht    wie strasse, Tageszeit 0,92
   Ein Punkt gilt nur, wenn dort kein Hindernis steht und zwischen Kamera
   und Front kein fremdes Haus liegt. "bilder" rendert die Punkte in einem
   beliebigen Stand (wurzel=). Wagen, Passanten und Figur ausgeblendet.

   Aufruf:  node tools/pruef/gebaeude-bilder.js liste <json>
            node tools/pruef/gebaeude-bilder.js bilder <json> <ordner> [wurzel=<Spielordner>]
   ========================================================================= */
const path = require('path');
const fs = require('fs');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const WURZEL = path.resolve(arg('wurzel', path.join(__dirname, '..', '..')));
const { starte } = require(path.join(WURZEL, 'tools', 'pruef', 'basis'));
const modus = process.argv[2], datei = process.argv[3];
if (!['liste', 'bilder'].includes(modus) || !datei || (modus === 'bilder' && !process.argv[4])) {
  console.log('Aufruf: node tools/pruef/gebaeude-bilder.js liste <json>\n        node tools/pruef/gebaeude-bilder.js bilder <json> <ordner> [wurzel=<Spielordner>]');
  process.exit(1);
}
/* Typ -> Treffer: Familienname oder Modellname (Teilstring) */
const TYPEN = [
  ['Wohnhaus', (H) => H.familie === 'Wohnhaus'],
  ['Stadthaus', (H) => H.familie === 'Stadthaus'],
  ['Uferhaus', (H) => H.familie === 'Uferhaus'],
  ['Brownstone', (H) => /Brownstone_FlatFacade_6/.test(H.modell || '')],
  ['Brownstone2', (H) => /Brownstone_Harlem_1_B|Brownstone_Lowrise_1/.test(H.modell || '')],
  ['ModernOffice1', (H) => /Downtown_ModernOffice_1$/.test(H.modell || '')],
  ['ModernOffice2', (H) => /Downtown_ModernOffice_2$/.test(H.modell || '')],
  ['PublicBuilding', (H) => /Downtown_PublicBuilding_1/.test(H.modell || '')],
  ['Brutal', (H) => /Downtown_Brutal_1/.test(H.modell || '')],
  ['Residential', (H) => /Downtown_Residential_3/.test(H.modell || '')],
  ['Turm-a', (H) => /^Turm_1$/.test(H.modell || '')],
  ['Turm-b', (H) => /^Turm_3$/.test(H.modell || '')],
];
(async () => {
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true });
  if (modus === 'liste') {
    const wahl = await page.evaluate((typen) => {
      const d = __dbg, K = d.hausKisten(), R = d.raster();
      const fns = typen.map(([n, f]) => [n, eval('(' + f + ')')]);
      const frei = (x, y, z) => !d.colliders.some((c) => !c.klein && (c.h || 0) > y - 0.5 && (c.y0 === undefined || c.y0 < y) &&
        x > c.x0 - 0.4 && x < c.x1 + 0.4 && z > c.z0 - 0.4 && z < c.z1 + 0.4);
      /* Sichtlinie: Punkte zwischen Kamera und Ziel in keinem fremden Haus */
      const sicht = (H, kx, ky, kz, tx, ty, tz) => {
        for (let i = 1; i < 20; i++) {
          const f = i / 20, x = kx + (tx - kx) * f, y = ky + (ty - ky) * f, z = kz + (tz - kz) * f;
          for (const c of d.colliders) {
            if (c.klein || (c.h || 0) < y) continue;
            if (Math.abs((c.x0 + c.x1) / 2 - H.x) < 0.5 && Math.abs((c.z0 + c.z1) / 2 - H.z) < 0.5) continue;
            if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return false;
          }
        }
        return true;
      };
      const aus = [];
      for (const [name, f] of fns) {
        let fertig = null;
        for (const H of K) {
          if (!f(H) || H.w < 8 || H.d < 8) continue;
          /* Seite zur naechsten Strasse */
          const u = (v, a) => { const o = a === 'x' ? R.x0 : R.z0; const q = ((v - o) % R.pitch + R.pitch) % R.pitch; return q < R.pitch / 2 ? -q : R.pitch - q; };
          const seiten = [[Math.sign(u(H.x, 'x')) || 1, 0, Math.abs(u(H.x, 'x')) - H.w / 2], [0, Math.sign(u(H.z, 'z')) || 1, Math.abs(u(H.z, 'z')) - H.d / 2]]
            .filter((s) => s[2] < 12).sort((p, q) => p[2] - q[2]);
          for (const [nx, nz] of seiten) {
            const ex = nx ? H.x + nx * H.w / 2 : H.x, ez = nz ? H.z + nz * H.d / 2 : H.z;
            const tx = nz, tz = -nx;                       // laengs der Front
            const breite = nx ? H.d : H.w;
            const kam = {}, ok = [];
            const setze = (k, ab, se, ky, zy, zse) => {
              const kx = ex + nx * ab + tx * se, kz = ez + nz * ab + tz * se;
              const zx = ex + tx * (zse || 0) + nx * 0.2, zz = ez + tz * (zse || 0) + nz * 0.2;
              if (!frei(kx, ky, kz) || !sicht(H, kx, ky, kz, zx, zy, zz)) return;
              kam[k] = [kx, ky, kz, zx, zy, zz]; ok.push(k);
            };
            const zy = Math.min(H.h * 0.35, 8);
            setze('strasse', 16, 5, 1.7, zy, 0);
            setze('nah', 4.5, 1.5, 1.7, 4.0, 0);
            setze('schraeg', 3.5, Math.min(20, breite / 2 + 12), 1.7, zy * 0.8, -breite * 0.15);
            setze('oben', 18, 4, Math.min(H.h * 0.6, 40), Math.min(H.h * 0.55, 38), 0);
            if (ok.length === 4) { fertig = { typ: name, modell: H.modell, familie: H.familie, x: H.x, z: H.z, h: H.h, kam }; break; }
          }
          if (fertig) break;
        }
        if (fertig) aus.push(fertig); else aus.push({ typ: name, fehlt: true });
      }
      return aus;
    }, TYPEN.map(([n, f]) => [n, f.toString()]));
    fs.writeFileSync(datei, JSON.stringify(wahl, null, 1));
    for (const w of wahl) console.log(w.typ.padEnd(15), w.fehlt ? 'KEIN HAUS GEFUNDEN' : (w.modell || w.familie) + ' bei ' + w.x + '/' + w.z + ' h ' + w.h);
  } else {
    const ziel = process.argv[4]; fs.mkdirSync(ziel, { recursive: true });
    const wahl = JSON.parse(fs.readFileSync(datei, 'utf8'));
    const ansichten = [['strasse', 0.45], ['nah', 0.45], ['schraeg', 0.45], ['oben', 0.45], ['nacht', 0.92, 'strasse']];
    for (const w of wahl) {
      if (w.fehlt) continue;
      for (const [an, zeit, kamName] of ansichten) {
        const k = w.kam[kamName || an];
        await page.evaluate(({ k, zeit }) => {
          const d = __dbg; d.frier(true); d.setzeRegen(0); window.__setzeZeit(zeit);
          d.setzePos(k[0], d.groundYAt(k[0], k[2]), k[2]);
          for (let s = 0; s < 16; s++) d.schritt(1 / 60, 1);
          window.__setzeZeit(zeit); d.schritt(1 / 60, 1);
          for (const c of d.civilians) { const r = c.visual && (c.visual.root || c.visual.group); if (r) r.visible = false; }
          for (const c of d.cars) if (c.mesh) c.mesh.visible = false;
          if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
          d.aufnahme(k[0], k[1], k[2], k[3], k[4], k[5]); d.aufnahme(k[0], k[1], k[2], k[3], k[4], k[5]);
        }, { k, zeit });
        await page.screenshot({ path: path.join(ziel, w.typ + '-' + an + '.png') });
      }
    }
    console.log('fertig', wahl.filter((w) => !w.fehlt).length);
  }
  await b.close();
})();
