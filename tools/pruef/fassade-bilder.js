/* problem-2, Human Rejection Pass 2, Blocker 1: wie SIEHT es aus?

   fassadentiefe.js zaehlt, wie oft die sichtbare Fassade hinter der
   Kletterebene liegt. Der Human-Befund ist aber ein Bild: die Figur
   haengt in einem Fensterloch. Also wird dieselbe Stelle fotografiert -
   ueber den echten Eingabeweg, mit der echten Spielkamera.

   Aufgenommen wird alle 20 Bilder eines Kletterlaufs, dazu je Aufnahme
   die gemessene Fassadentiefe unter Becken, Brust und Kopf.

   Aufruf:  node tools/pruef/fassade-bilder.js <ordner> [seed] [alt]
            alt = ohne Tiefenkarte (Stand vor dem Eingriff)
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2] || 'bilder-fassade';
const seed = +(process.argv[3] || 4711);
const alt = process.argv.indexOf('alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, seed, alt ? { fassAlt: true } : {});
  /* ---- Die Haeuser aus der Messung, nicht irgendwelche ---- */
  const starts = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const SEITEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const freieTiefe = (c, nx, nz, y, lx, lz) => {
      const sx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : lx;
      const sz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : lz;
      for (let t = 0.1; t <= 9; t += 0.1) {
        const px = sx + nx * t, pz = sz + nz * t;
        for (const n of d.colliderNah(px, pz)) {
          if (n === c || !fest(n)) continue;
          const y0 = n.y0 === undefined ? -1e9 : n.y0;
          if (px > n.x0 && px < n.x1 && pz > n.z0 && pz < n.z1 &&
              y > y0 && y < (n.h || 0)) return t;
        }
      }
      return 9;
    };
    /* Die drei Modelltypen mit den tiefsten Fassaden aus der Messung. */
    const gesucht = ['Downtown_PublicBuilding_1', 'Downtown_ModernOffice_1',
                     'Brownstone_Commercial_1_C'];
    const aus = [];
    for (const o of d.hausModelle()) {
      const K = o.userData && o.userData.hausKiste;
      const nam = o.userData && o.userData.modellName;
      if (!K || gesucht.indexOf(nam) < 0 || K.h < 14) continue;
      if (aus.filter((e) => e.name === nam).length >= 2) continue;
      let koll = null;
      for (const c of d.colliderNah(K.x, K.z))
        if (fest(c) && Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 &&
            Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05) { koll = c; break; }
      if (!koll) continue;
      for (const [nx, nz] of SEITEN) {
        const laengsX = nz !== 0;
        const l0 = laengsX ? koll.x0 : koll.z0, l1 = laengsX ? koll.x1 : koll.z1;
        if (l1 - l0 < 4) continue;
        const m = (l0 + l1) / 2;
        if (freieTiefe(koll, nx, nz, SLAB_H + 3, laengsX ? m : undefined,
                       laengsX ? undefined : m) < 7) continue;
        const fx = nx !== 0 ? (nx > 0 ? koll.x1 : koll.x0) : m;
        const fz = nz !== 0 ? (nz > 0 ? koll.z1 : koll.z0) : m;
        aus.push({ name: nam, koll: koll.id, nx, nz, fx, fz, h: K.h });
        break;
      }
      if (aus.length >= 6) break;
    }
    return aus;
  });

  const werte = [];
  for (let n = 0; n < starts.length; n++) {
    const S = starts[n];
    const klebt = await page.evaluate(async (S) => {
      const d = __dbg, P = d.player;
      const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
      for (const t of alle) d.taste(t, false);
      const SLAB_H = 0.25;
      d.setzePos(S.fx + S.nx * 5, SLAB_H + 0.1, S.fz + S.nz * 5);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-S.nx, -S.nz);
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', true); d.taste('KeyW', true);
      let ok = false;
      for (let i = 0; i < 150 && !ok; i++) { d.schritt(1 / 60); if (P.state === 'climb') ok = true; }
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', false); d.taste('KeyW', false);
      d.taste('KeyD', true);
      return ok;
    }, S);
    if (!klebt) { console.log('  ' + S.name + ' koll ' + S.koll + ': nicht angeklebt'); continue; }
    for (let s = 0; s < 8; s++) {
      const mess = await page.evaluate(async () => {
        const d = __dbg;
        for (let i = 0; i < 20; i++) d.schritt(1 / 60);
        const k = d.kletterLage();
        let tief = null;
        if (k.zustand === 'climb' && k.koll !== null && d.fassTiefe) {
          const t = k.nx !== 0 ? k.pos[2] : k.pos[0];
          tief = [0.9, 1.4, 1.75].map((h) => {
            const q = d.fassTiefe(k.koll, k.nx, k.nz, k.pos[1] + h, t);
            return q ? q.tiefe : null;
          });
        }
        return { zustand: k.zustand, koll: k.koll, nx: k.nx, nz: k.nz,
                 pos: k.pos, imHaus: k.imHaus, tiefe: tief };
      });
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => __dbg.zeichne());
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      }
      const name = String(n + 1).padStart(2, '0') + '-' + S.name + '-' +
                   String(s + 1).padStart(2, '0');
      await page.screenshot({ path: path.join(ziel, name + '.png') });
      /* Dazu eine Nahaufnahme schraeg von der Seite: aus der Spielkamera
         ist die Figur 20 Pixel gross, und ob sie an der Wand haengt oder
         einen halben Meter davor, sieht man darin nicht. */
      await page.evaluate((st) => {
        const d = __dbg, P = d.player;
        const nx = st.nx, nz = st.nz;
        /* seitlich versetzt, leicht ueber Schulterhoehe */
        const sx = -nz, sz = nx;
        d.aufnahme(P.pos.x + nx * 5.5 + sx * 1.6, P.pos.y + 1.6, P.pos.z + nz * 5.5 + sz * 1.6,
                   P.pos.x, P.pos.y + 1.0, P.pos.z);
      }, { nx: S.nx, nz: S.nz });
      await page.screenshot({ path: path.join(ziel, name + '-nah.png') });
      werte.push({ name, koll: S.koll, ...mess });
      console.log('  ' + name.padEnd(42) + mess.zustand +
                  '  Tiefe ' + JSON.stringify(mess.tiefe) +
                  '  imHaus ' + mess.imHaus);
    }
    await page.evaluate(() => {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        __dbg.taste(t, false);
    });
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen' + (alt ? '  (OHNE Tiefenkarte)' : ''));
})();
