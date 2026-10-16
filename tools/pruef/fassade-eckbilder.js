/* problem-2, Human Rejection Pass 2: die Restfaelle der Aussenecke als BILD.

   Die Gegenprobe "echte Aussenecke" verliert Stellen, weil die Figur
   dort loslaesst. Ob das richtig ist, entscheidet kein Zaehler: an
   diesen Stellen muss man SEHEN, ob eine Wand da ist oder nicht.

   Gefahren wird genau wie in zeilenuebergang.js: 0,8 m vor der
   Aussenkante an die Wand gesetzt, dann nach aussen kriechen. Alle 15
   Bilder eine Aufnahme mit der echten Spielkamera, dazu eine
   Uebersicht der Schauseite von aussen und eine Nahaufnahme.

   Aufruf:  node tools/pruef/fassade-eckbilder.js <ordner> [seed=4711] [alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2] || 'bilder-fassade-ecke';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, SEED, ALT ? { fassAlt: true } : {});
  /* Dieselbe Auswahl wie in zeilenuebergang.js: das letzte Haus jeder
     Zeile, Aussenkante. Genommen werden nur die Stellen, an denen die
     Figur den Kletterzustand verliert. */
  const stellen = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const kollVon = (k) => {
      for (const c of d.colliderNah(k.x, k.z)) {
        if (!fest(c)) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - k.x) < 0.05 &&
            Math.abs((c.z0 + c.z1) / 2 - k.z) < 0.05) return c;
      }
      return null;
    };
    const zeilen = new Map();
    for (const K of d.hausKisten()) {
      if (!K.zeile) continue;
      for (const seite of ['N', 'S', 'O', 'W']) {
        const key = K.zeile + '|' + seite;
        if (!zeilen.has(key)) zeilen.set(key, []);
        zeilen.get(key).push(Object.assign({}, K, { key, seite }));
      }
    }
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    const aus = [];
    for (const [key, liste] of zeilen) {
      if (liste.length < 2 || aus.length >= 8) continue;
      const seite = key.split('|')[2];
      const laengsX = seite === 'N' || seite === 'S';
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      liste.sort((p, q) => (laengsX ? p.x - q.x : p.z - q.z));
      const E = liste[liste.length - 1];
      const cE = kollVon(E);
      if (!cE) continue;
      const front = nx !== 0 ? (nx > 0 ? cE.x1 : cE.x0) : (nz > 0 ? cE.z1 : cE.z0);
      const aussen = laengsX ? cE.x1 : cE.z1;
      const y = E.h * 0.5;
      const laengs = aussen - 0.8;
      const sx = laengsX ? laengs : front + nx * 0.15;
      const sz = laengsX ? front + nz * 0.15 : laengs;
      los();
      d.setzePos(sx, y, sz);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col: cE };
      P.eckSperre = 0; P.wandUebergaenge = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      const vor = laengsX ? P.pos.x : P.pos.z;
      d.taste('KeyD', true);
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);
      const jetzt = laengsX ? P.pos.x : P.pos.z;
      let taste = 'KeyD';
      if ((jetzt - vor) * (aussen - vor) <= 0) { d.taste('KeyD', false); taste = 'KeyA'; d.taste('KeyA', true); }
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      los();
      if (P.state === 'climb') continue;            // hier ist alles gut
      aus.push({ koll: cE.id, nx, nz, sx, sy: y, sz, taste,
                 modell: E.modell || null, seite,
                 kiste: [+cE.x0.toFixed(2), +cE.x1.toFixed(2),
                         +cE.z0.toFixed(2), +cE.z1.toFixed(2), +(cE.h || 0).toFixed(2)] });
    }
    return aus;
  });
  console.log('  Stellen, an denen die Figur loslaesst: ' + stellen.length);

  const werte = [];
  for (let n = 0; n < stellen.length; n++) {
    const S = stellen[n];
    /* Uebersicht: die ganze Schauseite von aussen. */
    await page.evaluate((S) => {
      const d = __dbg;
      const mx = (S.kiste[0] + S.kiste[1]) / 2, mz = (S.kiste[2] + S.kiste[3]) / 2;
      const fx = S.nx !== 0 ? (S.nx > 0 ? S.kiste[1] : S.kiste[0]) : mx;
      const fz = S.nz !== 0 ? (S.nz > 0 ? S.kiste[3] : S.kiste[2]) : mz;
      const w = Math.max(S.kiste[1] - S.kiste[0], S.kiste[3] - S.kiste[2]);
      d.aufnahme(fx + S.nx * (w + 8), S.sy + 4, fz + S.nz * (w + 8),
                 fx, S.sy, fz);
    }, S);
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    await page.screenshot({ path: path.join(ziel,
      String(n + 1).padStart(2, '0') + '-' + S.modell + '-schauseite.png') });

    /* Und der Weg: alle 15 Bilder eine Aufnahme mit der Spielkamera. */
    await page.evaluate((S) => {
      const d = __dbg, P = d.player;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        d.taste(t, false);
      const col = d.colliderNah(S.sx, S.sz).find((q) => q.id === S.koll);
      d.setzePos(S.sx, S.sy, S.sz);
      P.vel.set(0, 0, 0); P.state = 'climb';
      P.wallInfo = P.wall = { nx: S.nx, nz: S.nz, col };
      P.eckSperre = 0; P.wandUebergaenge = 0;
      d.setzeKamYaw(Math.atan2(-S.nx, -S.nz));
      d.taste(S.taste, true);
    }, S);
    for (let s = 0; s < 6; s++) {
      const m = await page.evaluate(async (S) => {
        const d = __dbg, P = d.player;
        for (let i = 0; i < 15; i++) d.schritt(1 / 60);
        const k = d.kletterLage();
        const t = S.nx !== 0 ? P.pos.z : P.pos.x;
        return { zustand: P.state,
                 pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
                 lage: d.fassLage ? d.fassLage(S.koll, S.nx, S.nz, P.pos.y + 1.0, t) : null };
      }, S);
      await page.evaluate(() => __dbg.zeichne());
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      const nm = String(n + 1).padStart(2, '0') + '-' + S.modell + '-' +
                 String(s + 1).padStart(2, '0') + '-' + m.zustand;
      await page.screenshot({ path: path.join(ziel, nm + '.png') });
      werte.push({ name: nm, koll: S.koll, nx: S.nx, nz: S.nz, ...m });
      console.log('  ' + nm.padEnd(46) + ' ' +
                  (m.lage ? 'halt ' + m.lage.halt + '  Zelle ' + m.lage.zelle +
                            '  seitlich ' + m.lage.wandSeitlich +
                            '  oben ' + m.lage.wandOben : '-'));
    }
    await page.evaluate(() => {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        __dbg.taste(t, false);
    });
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
})();
