/* problem-2, K1/K2: SIEHT die Kletterkamera die Figur ueberhaupt?

   Der Human-Screenshot zeigt ein Bild, das praktisch vollstaendig aus
   einer braunen Gebaeudeflaeche besteht. Der bisherige Kamerastand misst
   den ABSTAND und ob die Kamera in einem Kollider steckt - beides kann
   in Ordnung sein, waehrend die Kamera trotzdem nur eine Wand filmt.

   Hier wird deshalb die SICHT gemessen: drei Strahlen von der Kamera zu
   Kopf, Brust und Becken der Figur. Fuer jeden Strahl wird
   festgehalten, ob er frei ist und welcher Kollider ihn sperrt.

     headOccluded          Bilder, in denen der Kopf verdeckt ist
     chestOccluded         dasselbe fuer die Brust
     pelvisOccluded        dasselbe fuer das Becken
     playerFullyOccluded   alle drei gleichzeitig verdeckt

   Gefahren wird ueber den ECHTEN Eingabeweg: Strasse, Anlauf, ankleben,
   hochklettern bis dicht unter die Dachkante. Keine gesetzte Kamera,
   keine gesetzte Figur.

   Aufruf:  node tools/pruef/kletterkamera-sicht.js [seed=4711] [alt] [bilder=ordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, SEED, ALT ? { flaecheAlt: true } : {});
  const stellen = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const flaechen = [];
    const gesehen = new Set();
    for (const K of d.hausKisten()) {
      for (const c of d.colliderNah(K.x, K.z)) {
        if (!fest(c) || (c.h || 0) < 14 || gesehen.has(c.id)) continue;
        gesehen.add(c.id); flaechen.push(c);
      }
    }
    /* Startplaetze mit Anlauf: eine Wand, vor der sieben Meter frei
       sind. Zusaetzlich bevorzugt: ein HOEHERER Nachbar daneben - das
       ist die Lage aus dem Human-Bild. */
    const aus = [];
    for (const c of flaechen) {
      if (aus.length >= 10) break;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (c.x0 + c.x1) / 2;
        const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : (c.z0 + c.z1) / 2;
        let frei = true;
        for (let t = 0.5; t <= 7; t += 0.5) {
          const px = fx + nx * t, pz = fz + nz * t;
          for (const n of d.colliderNah(px, pz)) {
            if (n === c || !fest(n)) continue;
            const y0 = n.y0 === undefined ? -1e9 : n.y0;
            if (px > n.x0 && px < n.x1 && pz > n.z0 && pz < n.z1 &&
                SLAB_H + 3 > y0 && SLAB_H + 3 < (n.h || 0)) { frei = false; break; }
          }
          if (!frei) break;
        }
        if (!frei) continue;
        /* Steht ein hoeherer Nachbar seitlich an? */
        let hoeher = false;
        for (const n of d.colliderNah(fx, fz)) {
          if (n === c || !fest(n)) continue;
          if ((n.h || 0) > (c.h || 0) + 3) { hoeher = true; break; }
        }
        aus.push({ koll: c.id, nx, nz, fx, fz, hoch: +(c.h || 0).toFixed(1), hoeher });
        break;
      }
    }
    aus.sort((a, c2) => (c2.hoeher ? 1 : 0) - (a.hoeher ? 1 : 0));
    return aus;
  });

  const werte = [];
  let kopfV = 0, brustV = 0, beckenV = 0, ganzV = 0, bilder = 0;
  const schlimm = [];
  for (let n = 0; n < stellen.length; n++) {
    const reihe = await page.evaluate(async (S) => {
      const d = __dbg, P = d.player;
      const SLAB_H = 0.25;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        d.taste(t, false);
      const col = d.colliderNah(S.fx, S.fz).find((q) => q.id === S.koll);
      if (!col) return null;
      d.setzePos(S.fx + S.nx * 5, SLAB_H + 0.1, S.fz + S.nz * 5);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-S.nx, -S.nz);
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', true); d.taste('KeyW', true);
      let dran = false;
      for (let i = 0; i < 150 && !dran; i++) { d.schritt(1 / 60); if (P.state === 'climb') dran = true; }
      if (!dran) { for (const t of ['KeyW','ShiftLeft']) d.taste(t, false); return null; }
      d.taste('ShiftLeft', false);
      /* Bis dicht unter die Dachkante hoch. */
      const ziel = (col.h || 0) - 2.2;
      let i = 0;
      while (i < 900 && P.pos.y < ziel && P.state === 'climb') { d.schritt(1 / 60); i++; }
      d.taste('KeyW', false);
      for (let k = 0; k < 20; k++) d.schritt(1 / 60);

      /* ---- Sicht messen ---- */
      const frei = (ax, ay, az, bx, by, bz) => {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const len = Math.hypot(dx, dy, dz);
        const n2 = Math.max(2, Math.ceil(len / 0.12));
        for (let s = 1; s < n2; s++) {
          const t = s / n2;
          const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
          for (const c of d.colliderNah(x, z)) {
            if (c.innen || c.parkAuto) continue;
            const y0 = c.y0 === undefined ? -1e9 : c.y0;
            if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 &&
                y > y0 && y < (c.h || 0))
              return { frei: false, wer: c.id, krone: !!c.krone, klein: !!c.klein,
                       weg: +(len * t).toFixed(2) };
          }
        }
        return { frei: true };
      };
      const reihe = [];
      for (let k = 0; k < 60; k++) {
        d.schritt(1 / 60);
        const kam = d.kamera();
        const kn = d.animKnochen(['head', 'spine2', 'hips']);
        const kp = kam.pos;
        const punkte = { kopf: kn.head, brust: kn.spine2, becken: kn.hips };
        const sicht = {};
        for (const [nm, b2] of Object.entries(punkte)) {
          if (!b2) { sicht[nm] = { frei: true }; continue; }
          sicht[nm] = frei(kp[0], kp[1], kp[2], b2.x, b2.y, b2.z);
        }
        reihe.push({ abst: kam.abstand, steckt: kam.steckt, sicht,
                     pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
                     zustand: P.state, koll: P.wallInfo && P.wallInfo.col
                       ? P.wallInfo.col.id : null });
      }
      return reihe;
    }, stellen[n]);
    if (!reihe) continue;
    let ganzHier = 0;
    for (const r of reihe) {
      bilder++;
      if (!r.sicht.kopf.frei) kopfV++;
      if (!r.sicht.brust.frei) brustV++;
      if (!r.sicht.becken.frei) beckenV++;
      if (!r.sicht.kopf.frei && !r.sicht.brust.frei && !r.sicht.becken.frei) {
        ganzV++; ganzHier++;
        if (schlimm.length < 8) schlimm.push({ stelle: n, ...r });
      }
    }
    werte.push({ stelle: n, koll: stellen[n].koll, hoeher: stellen[n].hoeher,
                 bilder: reihe.length, ganzVerdeckt: ganzHier,
                 abstMin: +Math.min(...reihe.map((r) => r.abst)).toFixed(2) });
    if (BILDER) {
      await page.evaluate(() => __dbg.zeichne());
      await page.screenshot({ path: path.join(BILDER,
        String(n + 1).padStart(2, '0') + '-koll' + stellen[n].koll + '.jpg'),
        type: 'jpeg', quality: 85 });
    }
    console.log('  Stelle ' + (n + 1) + '  Kollider ' + stellen[n].koll +
                (stellen[n].hoeher ? '  (hoeherer Nachbar)' : '') +
                '  kleinster Abstand ' + werte[werte.length - 1].abstMin +
                ' m   ganz verdeckt ' + ganzHier + ' von ' + reihe.length);
  }
  await b.close();
  console.log('\n== Sicht auf die Figur (' + bilder + ' Bilder) ==');
  console.log('  headOccluded          ' + kopfV);
  console.log('  chestOccluded         ' + brustV);
  console.log('  pelvisOccluded        ' + beckenV);
  console.log('  playerFullyOccluded   ' + ganzV);
  if (schlimm.length) {
    console.log('\n  Beispiele ganz verdeckt:');
    for (const e of schlimm) console.log('    ' + JSON.stringify(e));
  }
})();
