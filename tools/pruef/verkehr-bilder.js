/* CITY V2 Stufe 8B: Verkehr vorher/nachher - Bilder UND Zaehlung.

   Ein Einzelbild sagt ueber Verkehr wenig: im Augenblick der Aufnahme kann
   eine volle Strasse leer sein und umgekehrt. Deshalb zaehlt dieser
   Pruefstand nach 90 s Vorlauf (Tageszeit 0,45, Held unverwundbar und
   abseits) an neun festen Ansichten 60-mal im Sekundenabstand, wie viele
   fahrende Wagen wirklich zu sehen sind: im Bildkegel, hoechstens 150 m
   entfernt und nicht hinter einem Haus (Sichtlinie gegen alle Hindernisse
   mit mehr als 3 x 3 m Grundflaeche und mehr als 4 m Hoehe). Danach je
   Ansicht drei Bilder im Abstand von 8 s.

   Aufruf:  node tools/pruef/verkehr-bilder.js <ordner> [wurzel=<Spielordner>]
   wurzel= misst einen anderen Stand (z. B. einen git worktree) mit
   dessen basis.js.
   ========================================================================= */
const path = require('path');
const fs = require('fs');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const WURZEL = path.resolve(arg('wurzel', path.join(__dirname, '..', '..')));
const { starte } = require(path.join(WURZEL, 'tools', 'pruef', 'basis'));
const ziel = process.argv[2];
if (!ziel || ziel.indexOf('=') >= 0) { console.log('Aufruf: node tools/pruef/verkehr-bilder.js <ordner> [wurzel=<Spielordner>]'); process.exit(1); }
fs.mkdirSync(ziel, { recursive: true });
/* name, Kamera, Ziel, Held (Gehweg, nicht auf der Fahrbahn) */
const ORTE = [
  ['1-boulevard-mitte', [-40, 1.7, 25], [120, 1.2, 25], [-46, 33.5]],
  ['2-boulevard-hoch', [-130, 14, 25], [40, 0, 25], [-136, 33.5]],
  ['3-avenue-hoch', [25, 14, -160], [25, 0, 10], [33.5, -166]],
  ['4-wohnstrasse', [-264, 1.7, 117], [-200, 1.2, 119.5], [-268, 116.5]],
  ['5-wohnstrasse-hoch', [-285, 9, 125], [-200, 0, 121.5], [-289, 116.5]],
  ['6-zentrum', [-33.5, 1.7, -64], [-31, 1.2, 0], [-33.5, -68]],
  ['7-geschaeft', [-133.5, 1.7, -86], [-131, 1.2, -150], [-133.5, -82]],
  ['8-boulevard-achse-30m', [-200, 30, 25], [100, 0, 25], [-196, 33.5]],
  ['9-zentrum-luft', [40, 70, -75], [-10, 0, 30], [33.5, -70]],
];
(async () => {
  const { b, page } = await starte(1280, 720, 4711, {});
  await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    d.player.iFrames = 1e9; d.setzePos(-200, 0, -150);
    for (let i = 0; i < 60 * 90; i++) { if (i % 60 === 0) window.__setzeZeit(0.45); d.schritt(1 / 60); }
  });
  const zaehl = await page.evaluate((ORTE) => {
    const d = __dbg, cam = d.camera, T = window.THREE;
    const fr = new T.Frustum(), M = new T.Matrix4(), v = new T.Vector3();
    const aus = {}, hohe = {}; for (const o of ORTE) aus[o[0]] = [];
    for (let s = 0; s < 60; s++) {
      for (let i = 0; i < 60; i++) { if (i === 0) window.__setzeZeit(0.45); d.schritt(1 / 60); }
      for (const [name, k, z] of ORTE) {
        cam.position.set(...k); cam.up.set(0, 1, 0); cam.lookAt(...z); cam.updateMatrixWorld(true);
        M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(M);
        /* nur wer wirklich zu sehen ist: Sichtlinie gegen Haeuser (Grundflaeche ueber 3 x 3 m, hoeher als 4 m) */
        if (!hohe[name]) hohe[name] = d.colliders.filter((c) => !c.klein && !c.parkAuto && (c.h || 0) > 4 && c.x1 - c.x0 > 3 && c.z1 - c.z0 > 3 &&
          Math.max(Math.abs((c.x0 + c.x1) / 2 - k[0]) - (c.x1 - c.x0) / 2, Math.abs((c.z0 + c.z1) / 2 - k[2]) - (c.z1 - c.z0) / 2) < 160);
        const frei = (a, p) => { const dx = p.x - a.x, dy = p.y - a.y, dz = p.z - a.z;
          for (const c of hohe[name]) { let t0 = 0, t1 = 1;
            for (const [o, dd, lo, hi] of [[a.x, dx, c.x0, c.x1], [a.y, dy, c.y0 === undefined ? -1 : c.y0, c.h], [a.z, dz, c.z0, c.z1]]) {
              if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
              let u0 = (lo - o) / dd, u1 = (hi - o) / dd; if (u0 > u1) { const t = u0; u0 = u1; u1 = t; }
              t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); if (t0 > t1) break; }
            if (t0 <= t1 && t0 < 0.999) return false; }
          return true; };
        let n = 0;
        for (const c of d.cars) { if (c.aus || !c.mesh || !c.mesh.visible) continue; v.copy(c.mesh.position); v.y += 0.8;
          if (v.distanceTo(cam.position) <= 150 && fr.containsPoint(v) && frei(cam.position, v)) n++; }
        aus[name].push(n);
      }
    }
    const erg = {};
    for (const n in aus) { const a = aus[n].slice().sort((p, q) => p - q); erg[n] = { mittel: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2), median: (a[29] + a[30]) / 2, max: a[59], leer: a.filter((x) => x === 0).length }; }
    return { erg, autos: d.cars.length, aktiv: d.cars.filter((c) => !c.aus).length };
  }, ORTE);
  console.log('Wagen im Umlauf ' + zaehl.autos + ', unterwegs ' + zaehl.aktiv);
  console.log('Ansicht                     sichtbar Mittel  Median  Max  leere Proben (von 60)');
  for (const n in zaehl.erg) { const e = zaehl.erg[n]; console.log('  ' + n.padEnd(26) + String(e.mittel).padStart(8) + String(e.median).padStart(8) + String(e.max).padStart(5) + String(e.leer).padStart(8)); }
  fs.writeFileSync(path.join(ziel, 'zaehlung.json'), JSON.stringify(zaehl, null, 1));
  for (let m = 0; m < 3; m++) {
    for (const [name, k, z, h] of ORTE) {
      await page.evaluate(({ k, z, h }) => {
        const d = __dbg;
        d.setzePos(h[0], d.groundYAt(h[0], h[1]), h[1]);
        for (let i = 0; i < 16; i++) d.schritt(1 / 60);
        window.__setzeZeit(0.45);
        const ms = document.getElementById('msg'); if (ms) ms.style.display = 'none';
        if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
        d.aufnahme(...k, ...z); d.aufnahme(...k, ...z); d.aufnahme(...k, ...z);
      }, { k, z, h });
      await page.screenshot({ path: path.join(ziel, name + '-' + m + '.png') });
    }
    await page.evaluate(() => { const d = __dbg; for (let i = 0; i < 60 * 8; i++) { if (i % 60 === 0) window.__setzeZeit(0.45); d.schritt(1 / 60); } });
  }
  await b.close();
})();
