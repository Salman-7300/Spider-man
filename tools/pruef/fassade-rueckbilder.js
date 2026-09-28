/* problem-2, Blocker 1A: die zurueckgesetzten Waende als BILD.

   Die Messung zaehlt 405 Bilder "zurueckgesetzte Wand ~1,194 m". 405
   Bilder sind aber nicht 405 Probleme - der Pruefstand haelt die Taste
   420 Bilder lang, und die Figur steht dabei oft an derselben Stelle.

   Dieser Stand faehrt dieselben 26 Anlaeufe und fasst die Bilder zu
   EINDEUTIGEN ORTEN zusammen: gleiche Kletterflaeche, gleiche
   Wandnormale, gleiche Zelle der Tiefenkarte. Je Ort wird berichtet,
   was dort wirklich steht, und von den staerksten Orten werden vier
   Ansichten aufgenommen:

     front    frontal auf die Fassade
     seite    quer dazu, damit der Abstand Brust-Wand zu sehen ist
     spiel    die echte Spielkamera
     folge    eine Bildfolge beim Klettern (fuer ein kurzes Video)

   KEINE Aenderung am Spiel. Nur messen und zeigen.

   Aufruf:  node tools/pruef/fassade-rueckbilder.js <ordner> [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2] || 'bilder-rueck';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const TIEF = 1.0;                        // ab hier gilt eine Wand als zurueck
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, SEED, {});
  /* ---- 1. Die Orte sammeln ---- */
  const orte = await page.evaluate(async (TIEF) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25, VOR = 2.5;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const RC = new THREE.Raycaster();
    const O = new THREE.Vector3(), D = new THREE.Vector3();
    const sicht = (obj, c, nx, nz, y, t) => {
      const fx = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : t;
      const fz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) : t;
      O.set(fx + nx * VOR, y, fz + nz * VOR);
      D.set(-nx, 0, -nz);
      RC.set(O, D); RC.near = 0; RC.far = VOR + 10;
      const tr = RC.intersectObject(obj, true);
      return tr.length ? +(tr[0].distance - VOR).toFixed(3) : null;
    };
    const modelle = d.hausModelle();
    const objNachKoll = new Map(), namNachKoll = new Map();
    for (const o of modelle) {
      const K = o.userData && o.userData.hausKiste;
      if (!K) continue;
      for (const c of d.colliderNah(K.x, K.z))
        if (fest(c) && Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 &&
            Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05) {
          objNachKoll.set(c.id, o);
          namNachKoll.set(c.id, o.userData.modellName || o.name || '?');
          break;
        }
    }
    /* Dieselben Startplaetze wie in fassadentiefe.js. */
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
    const SEITEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const starts = [], proTyp = new Map();
    for (const o of modelle) {
      const K = o.userData && o.userData.hausKiste;
      if (!K || K.h < 14 || starts.length >= 26) continue;
      const nam = o.userData.modellName || o.name || '?';
      if ((proTyp.get(nam) || 0) >= 4) continue;
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
        starts.push({ koll: koll.id, nx, nz,
                      fx: nx !== 0 ? (nx > 0 ? koll.x1 : koll.x0) : m,
                      fz: nz !== 0 ? (nz > 0 ? koll.z1 : koll.z0) : m,
                      name: nam });
        proTyp.set(nam, (proTyp.get(nam) || 0) + 1);
        break;
      }
    }
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    const nachOrt = new Map();
    for (const S of starts) {
      los();
      d.setzePos(S.fx + S.nx * 5, SLAB_H + 0.1, S.fz + S.nz * 5);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(-S.nx, -S.nz);
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', true); d.taste('KeyW', true);
      let klebt = false;
      for (let i = 0; i < 150 && !klebt; i++) { d.schritt(1 / 60); if (P.state === 'climb') klebt = true; }
      if (!klebt) { los(); continue; }
      for (let i = 0; i < 100; i++) d.schritt(1 / 60);
      d.taste('ShiftLeft', false); d.taste('KeyW', false);
      d.taste('KeyD', true);
      for (let i = 0; i < 420; i++) {
        d.schritt(1 / 60);
        const k = d.kletterLage();
        if (k.zustand !== 'climb' || k.koll === null) continue;
        const obj = objNachKoll.get(k.koll);
        if (!obj) continue;
        let c = null;
        for (const q of d.colliderNah(k.pos[0], k.pos[2])) if (q.id === k.koll) { c = q; break; }
        if (!c) continue;
        const t = k.nx !== 0 ? k.pos[2] : k.pos[0];
        const brust = sicht(obj, c, k.nx, k.nz, k.pos[1] + 1.4, t);
        if (brust === null || brust <= TIEF) continue;
        const L = d.fassLage(k.koll, k.nx, k.nz, k.pos[1] + 1.0, t);
        if (!L || !L.karte || L.ausserhalb) continue;
        const schl = k.koll + ':' + k.nx + ',' + k.nz + ':' + L.ci + ',' + L.cj;
        const e = nachOrt.get(schl);
        if (e) { e.bilder++; continue; }
        const kn = d.animKnochen(['spine2', 'lefthand', 'righthand', 'leftfoot', 'rightfoot']);
        const kam = d.kamera();
        nachOrt.set(schl, {
          schl, bilder: 1, koll: k.koll, modell: namNachKoll.get(k.koll),
          nx: k.nx, nz: k.nz, pos: k.pos, ci: L.ci, cj: L.cj,
          /* Was steht dort wirklich? Strahl auf drei Hoehen und auf drei
             Handstellen. */
          strahlBrust: brust,
          strahlBecken: sicht(obj, c, k.nx, k.nz, k.pos[1] + 0.9, t),
          strahlKopf: sicht(obj, c, k.nx, k.nz, k.pos[1] + 1.75, t),
          strahlHandL: sicht(obj, c, k.nx, k.nz, k.pos[1] + 1.4, t - 0.45),
          strahlHandR: sicht(obj, c, k.nx, k.nz, k.pos[1] + 1.4, t + 0.45),
          strahlArmL: sicht(obj, c, k.nx, k.nz, k.pos[1] + 1.4, t - 0.9),
          strahlArmR: sicht(obj, c, k.nx, k.nz, k.pos[1] + 1.4, t + 0.9),
          karte: { zelle: L.zelle, mit1: L.mit1, mit2: L.mit2, halt: L.halt,
                   wandSeitlich: L.wandSeitlich, wandOben: L.wandOben,
                   zellBreit: L.zellBreit, zellHoch: L.zellHoch },
          wandAbstand: k.wandAbstand,
          knochen: kn, kam: kam.pos, kamAbstand: kam.abstand,
          kiste: [+c.x0.toFixed(2), +c.x1.toFixed(2), +c.z0.toFixed(2),
                  +c.z1.toFixed(2), +(c.h || 0).toFixed(2)],
        });
      }
      los();
    }
    return [...nachOrt.values()].sort((a, c) => c.bilder - a.bilder);
  }, TIEF);

  console.log('\n== Eindeutige Orte mit zurueckgesetzter Wand (> ' + TIEF + ' m) ==');
  console.log('  Orte gesamt: ' + orte.length +
              '   Bilder gesamt: ' + orte.reduce((a, e) => a + e.bilder, 0));
  console.log('\n  ' + 'Modell'.padEnd(26) + 'Koll  Seite  Bilder  Brust  Becken  Kopf   HandL  HandR  ArmL   ArmR   Karte');
  for (const e of orte)
    console.log('  ' + (e.modell || '?').padEnd(26) + String(e.koll).padStart(5) +
                ('  ' + e.nx + ',' + e.nz).padEnd(8) + String(e.bilder).padStart(6) +
                String(e.strahlBrust).padStart(7) + String(e.strahlBecken).padStart(8) +
                String(e.strahlKopf).padStart(7) + String(e.strahlHandL).padStart(7) +
                String(e.strahlHandR).padStart(7) + String(e.strahlArmL).padStart(7) +
                String(e.strahlArmR).padStart(7) + '   ' + e.karte.halt +
                ' ' + e.karte.mit1);
  console.log('\n  Einzeln:');
  for (const e of orte) console.log('    ' + JSON.stringify(e));

  /* ---- 2. Die staerksten Orte fotografieren ---- */
  const wahl = orte.slice(0, 8);
  for (let n = 0; n < wahl.length; n++) {
    const e = wahl[n];
    const vor = String(n + 1).padStart(2, '0') + '-' + (e.modell || 'x') + '-' + e.koll;
    /* Die Figur an die gemessene Stelle setzen - sie ist ueber den
       echten Eingabeweg dorthin gekommen, hier wird nur fotografiert. */
    await page.evaluate(async (e) => {
      const d = __dbg, P = d.player;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        d.taste(t, false);
      const col = d.colliderNah(e.pos[0], e.pos[2]).find((q) => q.id === e.koll);
      d.setzePos(e.pos[0], e.pos[1], e.pos[2]);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx: e.nx, nz: e.nz, col };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-e.nx, -e.nz));
      for (let i = 0; i < 40; i++) d.schritt(1 / 60);
    }, e);
    const sichten = [
      { nm: 'front', v: [0, 0.4, 5.0] },
      { nm: 'seite', v: [3.2, 0.3, 1.6] },
    ];
    for (const S of sichten) {
      await page.evaluate(({ e, S }) => {
        const d = __dbg, P = d.player;
        /* v ist im Wandsystem: x quer zur Wand, z vor der Wand. */
        const ax = e.nx * S.v[2] + (-e.nz) * S.v[0];
        const az = e.nz * S.v[2] + (e.nx) * S.v[0];
        d.aufnahme(P.pos.x + ax, P.pos.y + 1.2 + S.v[1], P.pos.z + az,
                   P.pos.x, P.pos.y + 1.2, P.pos.z);
      }, { e, S });
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      await page.screenshot({ path: path.join(ziel, vor + '-' + S.nm + '.png') });
    }
    await page.evaluate(() => __dbg.zeichne());
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    await page.screenshot({ path: path.join(ziel, vor + '-spielkamera.png') });
    /* Und eine Folge beim Klettern - 80 Bilder, jedes zweite aufgenommen. */
    const fdir = path.join(ziel, 'folge-' + vor);
    fs.mkdirSync(fdir, { recursive: true });
    await page.evaluate((e) => {
      const d = __dbg, P = d.player;
      const col = d.colliderNah(e.pos[0], e.pos[2]).find((q) => q.id === e.koll);
      d.setzePos(e.pos[0], e.pos[1] - 2.0, e.pos[2]);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx: e.nx, nz: e.nz, col };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-e.nx, -e.nz));
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      d.taste('KeyW', true);
    }, e);
    for (let f = 0; f < 70; f++) {
      await page.evaluate(() => { for (let i = 0; i < 2; i++) __dbg.schritt(1 / 60); __dbg.zeichne(); });
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      await page.screenshot({ path: path.join(fdir, String(f).padStart(4, '0') + '.jpg'),
                              type: 'jpeg', quality: 80 });
    }
    await page.evaluate(() => { for (const t of ['KeyW','KeyD']) __dbg.taste(t, false); });
    console.log('  aufgenommen: ' + vor);
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'orte.json'), JSON.stringify(orte, null, 1));
})();
