/* Qualitaets-Pass, Paket 3: Stellen mit frueherer Leuchtreklame, vorher/nachher.

   "liste" baut die Stadt MIT Leuchtreklame (Pruefschalter neonAn) und
   waehlt Stellen:
     - die Lage aus dem Human-Screenshot: ein Stadthaus mit liegendem
       magentafarbenem Band ueber dem Erdgeschoss, daneben (dieselbe
       Strassenseite, bis 30 m) ein Modellhaus mit roter Tafel,
     - je Stadtteil (ZENTRUM, GESCHAEFT, MISCHUNG, WOHN, UFER) die
       tiefste Tafel einer Farbe, die dort noch nicht vorkam,
     - ein Hochhaus mit mehreren Tafeln.
   Kamera auf Augenhoehe (1,7 m) 10 bis 16 m vor der Tafel, 3 m seitlich,
   nur wenn dort nichts steht und kein fremdes Haus die Sicht nimmt.
   "bilder" rendert die Stellen am Tag (0,45) und die ersten drei auch
   nachts (0,92) - mit neon=an wie vorher.

   Aufruf:  node tools/pruef/leuchttafel-bilder.js liste <json>
            node tools/pruef/leuchttafel-bilder.js bilder <json> <ordner> [neon=an]
   ========================================================================= */
const path = require('path');
const fs = require('fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const modus = process.argv[2], datei = process.argv[3];
if (!['liste', 'bilder'].includes(modus) || !datei || (modus === 'bilder' && !process.argv[4])) {
  console.log('Aufruf: node tools/pruef/leuchttafel-bilder.js liste <json>\n        node tools/pruef/leuchttafel-bilder.js bilder <json> <ordner> [neon=an]');
  process.exit(1);
}
(async () => {
  const neonAn = modus === 'liste' || arg('neon', '') === 'an';
  const { b, page } = await starte(1280, 720, 4711, { frierSofort: true, neonAn });
  if (modus === 'liste') {
    const wahl = await page.evaluate(() => {
      const d = __dbg, K = d.hausKisten(), N = d.neonKisten();
      const frei = (x, y, z) => !d.colliders.some((c) => !c.klein && (c.h || 0) > y - 0.5 && (c.y0 === undefined || c.y0 < y) &&
        x > c.x0 - 0.4 && x < c.x1 + 0.4 && z > c.z0 - 0.4 && z < c.z1 + 0.4);
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
      const kamera = (q, H) => {
        const tx = q.nz, tz = -q.nx;
        for (const ab of [12, 10, 14, 16]) for (const se of [3, -3, 6, -6]) {
          const kx = q.x0 + q.nx * ab + tx * se, kz = q.z0 + q.nz * ab + tz * se;
          if (frei(kx, 1.7, kz) && sicht(H, kx, 1.7, kz, q.x0, q.y, q.z0)) return [kx, 1.7, kz, q.x0, Math.min(q.y, 9), q.z0];
        }
        return null;
      };
      const liegend = (q) => Math.max(q.w, q.d) > 2.4 && q.h < 1.3;
      const aus = [];
      /* 1. Screenshot-Lage */
      for (const q of N) {
        const H = K[q.haus];
        if (H.familie !== 'Stadthaus' || q.farbe !== 0xff45c8 || !liegend(q) || q.y > 6) continue;
        const nachbar = N.find((r) => r.haus !== q.haus && r.nx === q.nx && r.nz === q.nz && r.farbe === 0xff2d55 && K[r.haus].modell &&
          !/^Turm_/.test(K[r.haus].modell) && Math.hypot(r.x0 - q.x0, r.z0 - q.z0) < 30 &&
          (q.nx ? Math.abs(r.x0 - q.x0) < 3 : Math.abs(r.z0 - q.z0) < 3));
        if (!nachbar) continue;
        const k = kamera({ x0: (q.x0 + nachbar.x0) / 2, z0: (q.z0 + nachbar.z0) / 2, nx: q.nx, nz: q.nz, y: 6 }, H);
        if (!k) continue;
        aus.push({ name: '1-screenshot-lage', titel: 'wie Screenshot: Stadthaus mit magenta Band, daneben ' + K[nachbar.haus].modell + ' mit roter Tafel', kam: k, bezirk: H.art });
        break;
      }
      /* 2. je Stadtteil */
      const farbenGesehen = new Set();
      for (const art of ['ZENTRUM', 'GESCHAEFT', 'MISCHUNG', 'WOHN', 'UFER']) {
        const kand = N.filter((q) => K[q.haus].art === art && q.y < 7.5 && !farbenGesehen.has(q.farbe)).sort((p, q) => p.y - q.y);
        for (const q of kand) {
          const k = kamera(q, K[q.haus]);
          if (!k) continue;
          farbenGesehen.add(q.farbe);
          aus.push({ name: (aus.length + 1) + '-' + art.toLowerCase(), titel: art + ': ' + (K[q.haus].modell || K[q.haus].familie || 'Haus') + ', Tafel #' + q.farbe.toString(16), kam: k, bezirk: art });
          break;
        }
      }
      /* 3. Hochhaus mit mehreren Tafeln */
      const jeHaus = new Map();
      for (const q of N) if (/^Turm_/.test(K[q.haus].modell || '')) jeHaus.set(q.haus, (jeHaus.get(q.haus) || []).concat([q]));
      for (const [h, l] of [...jeHaus].sort((p, q) => q[1].length - p[1].length)) {
        const q = l.sort((p, r) => p.y - r.y)[0];
        const tx = q.nz, tz = -q.nx;
        const kx = q.x0 + q.nx * 22 + tx * 6, kz = q.z0 + q.nz * 22 + tz * 6;
        if (!d.colliders.some((c) => !c.klein && (c.h || 0) > 1.2 && kx > c.x0 - 0.4 && kx < c.x1 + 0.4 && kz > c.z0 - 0.4 && kz < c.z1 + 0.4)) {
          aus.push({ name: (aus.length + 1) + '-hochhaus', titel: 'Hochhaus ' + K[h].modell + ' mit ' + l.length + ' Tafeln', kam: [kx, 1.7, kz, q.x0, 16, q.z0], bezirk: K[h].art });
          break;
        }
      }
      return aus;
    });
    fs.writeFileSync(datei, JSON.stringify(wahl, null, 1));
    for (const w of wahl) console.log(w.name.padEnd(22), w.titel);
  } else {
    const ziel = process.argv[4]; fs.mkdirSync(ziel, { recursive: true });
    const wahl = JSON.parse(fs.readFileSync(datei, 'utf8'));
    for (const [i, w] of wahl.entries()) for (const zeit of i < 3 ? [0.45, 0.92] : [0.45]) {
      const k = w.kam;
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
      await page.screenshot({ path: path.join(ziel, w.name + (zeit > 0.8 ? '-nacht' : '') + '.png') });
    }
    console.log('fertig', wahl.length);
  }
  await b.close();
})();
