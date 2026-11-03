/* problem-2, Human Rejection Pass 2: die Waende, die nicht mehr aufs
   Dach fuehren - als BILD.

   dachhohlraum.js meldet, an welchen Waenden die Figur nicht mehr oben
   ankommt. Ob das richtig ist, entscheidet kein Zaehler: man muss
   sehen, ob dort oben eine Wand ist oder ein Loch.

   Gefahren wird genau wie dort: sechs Meter unter der Dachkante an die
   Wand, dann hoch. Aufgenommen wird die Stelle, an der es aufhoert -
   mit der echten Spielkamera, dazu die ganze Schauseite von aussen.

   Aufruf:  node tools/pruef/dach-restbilder.js <ordner> [seed=4711] [alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2] || 'bilder-dachrest';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, SEED, ALT ? { fassAlt: true } : {});
  const stellen = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    const aus = [];
    for (const K of d.hausKisten()) {
      if (aus.length >= 6 || K.h < 12) continue;
      let c = null;
      for (const q of d.colliderNah(K.x, K.z))
        if (fest(q) && Math.abs((q.x0 + q.x1) / 2 - K.x) < 0.05 &&
            Math.abs((q.z0 + q.z1) / 2 - K.z) < 0.05) { c = q; break; }
      if (!c) continue;
      const oben = SLAB_H + K.h;
      const nx = 1, nz = 0;
      const wandX = c.x1;
      /* Ist vor der Ostwand ueberhaupt Platz? */
      let verbaut = false;
      for (const n of d.colliderNah(wandX + 1.2, K.z)) {
        if (n === c || !fest(n)) continue;
        if (wandX + 1.2 > n.x0 && wandX + 1.2 < n.x1 &&
            K.z > n.z0 && K.z < n.z1 && oben - 6 < (n.h || 0)) { verbaut = true; break; }
      }
      if (verbaut) continue;
      los();
      d.setzePos(wandX + 0.15, oben - 6, K.z);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: c };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      d.taste('KeyW', true);
      const startY = P.pos.y;
      for (let s = 0; s < 60; s++) d.schritt(1 / 60);
      if (P.pos.y < startY + 0.5) { los(); continue; }
      /* ---- Wo hoert das Hochklettern auf, und warum? ----
         Mitgeschrieben wird jeder Zustandswechsel und die hoechste
         erreichte Hoehe. Ohne das laesst sich "losgelassen" nicht von
         "haengt still" unterscheiden. */
      let vor = P.state, wechsel = [], maxY = P.pos.y, stillSeit = 0, letzteY = P.pos.y;
      for (let s = 0; s < 240; s++) {
        d.schritt(1 / 60);
        if (P.state !== vor) {
          if (wechsel.length < 8)
            wechsel.push(vor + '->' + P.state + ' @ ' + P.pos.y.toFixed(2));
          vor = P.state;
        }
        if (P.pos.y > maxY) maxY = P.pos.y;
        if (Math.abs(P.pos.y - letzteY) < 0.001 && P.state === 'climb') stillSeit++;
        else stillSeit = 0;
        letzteY = P.pos.y;
      }
      d.taste('KeyW', false);
      for (let s = 0; s < 30; s++) d.schritt(1 / 60);
      los();
      if (P.pos.y >= oben - 0.25) continue;          // oben angekommen
      const t = P.pos.z;
      aus.push({ koll: c.id, nx, nz, x: K.x, z: K.z, h: K.h,
                 modell: K.modell || null, oben: +oben.toFixed(2),
                 endY: +P.pos.y.toFixed(2), zustand: P.state,
                 sx: wandX + 0.15, sy: oben - 6, sz: K.z,
                 kiste: [+c.x0.toFixed(2), +c.x1.toFixed(2),
                         +c.z0.toFixed(2), +c.z1.toFixed(2)],
                 maxY: +maxY.toFixed(2), stillSeit, wechsel,
                 lage: d.fassLage ? d.fassLage(c.id, nx, nz, P.pos.y + 1.0, t) : null,
                 lageMax: d.fassLage ? d.fassLage(c.id, nx, nz, maxY + 1.0, t) : null,
                 lageDrueber: d.fassLage ? d.fassLage(c.id, nx, nz, maxY + 2.2, t) : null });
    }
    return aus;
  });
  console.log('  Waende ohne Dachankunft: ' + stellen.length);
  for (let n = 0; n < stellen.length; n++) {
    const S = stellen[n];
    console.log('  ' + String(n + 1).padStart(2) + '  ' + (S.modell || '?').padEnd(26) +
                ' Dach ' + S.oben + '  Ende ' + S.endY + '  ' + S.zustand +
                '  halt ' + (S.lage && S.lage.halt) +
                '  maxY ' + S.maxY + '  still ' + S.stillSeit +
                '  ' + JSON.stringify(S.wechsel) +
                '  halt@max ' + (S.lageMax && S.lageMax.halt) +
                '  halt 2,2 m darueber ' + (S.lageDrueber && S.lageDrueber.halt));
    /* Uebersicht: die Ostseite von aussen. */
    await page.evaluate((S) => {
      const d = __dbg;
      d.aufnahme(S.kiste[1] + 26, S.oben - 3, S.z, S.kiste[1], S.oben - 5, S.z);
    }, S);
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    await page.screenshot({ path: path.join(ziel,
      String(n + 1).padStart(2, '0') + '-' + (S.modell || 'x') + '-schauseite.png') });
    /* Und die Stelle, an der es aufhoert - mit der Spielkamera. */
    await page.evaluate(async (S) => {
      const d = __dbg, P = d.player;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        d.taste(t, false);
      const col = d.colliderNah(S.sx, S.sz).find((q) => q.id === S.koll);
      d.setzePos(S.sx, S.sy, S.sz);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx: S.nx, nz: S.nz, col };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      d.taste('KeyW', true);
      for (let s = 0; s < 300; s++) d.schritt(1 / 60);
      d.taste('KeyW', false);
      for (let s = 0; s < 30; s++) d.schritt(1 / 60);
      d.zeichne();
    }, S);
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    await page.evaluate(() => __dbg.zeichne());
    await page.screenshot({ path: path.join(ziel,
      String(n + 1).padStart(2, '0') + '-' + (S.modell || 'x') + '-spielkamera.png') });
    /* Nahaufnahme schraeg von der Seite. */
    await page.evaluate((S) => {
      const d = __dbg, P = d.player;
      d.aufnahme(P.pos.x + 5.0, P.pos.y + 1.4, P.pos.z + 2.2,
                 P.pos.x, P.pos.y + 1.0, P.pos.z);
    }, S);
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    await page.screenshot({ path: path.join(ziel,
      String(n + 1).padStart(2, '0') + '-' + (S.modell || 'x') + '-nah.png') });
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(stellen, null, 1));
})();
