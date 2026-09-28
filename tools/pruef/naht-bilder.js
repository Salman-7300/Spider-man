/* Die Naht zwischen zwei Reihenhaeusern, mit der ECHTEN Spielkamera.

   Der Human-Befund nennt zwei Dinge: die Figur geraet zwischen die
   Haeuser, und die Kamera wird dabei in den Spalt gedrueckt und zeigt
   fast nur noch Wand. Die Zahlen zur Figur stehen in
   zeilenuebergang.js; hier geht es um das, was man SIEHT.

   Aufgenommen wird an denselben Stellen, einmal mit und einmal ohne die
   Uebergabe an den Nachbarn - dieselbe Naht, dieselbe Hoehe, dieselbe
   Zahl von Bildern.

   Zusaetzlich gemessen, weil ein Bild allein nichts beweist:
     kameraAbstand   Abstand der Kamera zur Figur
     kameraSteckt    steht die Kamera in einem Hindernis?
     wandAnteil      wieviel Prozent des Bildes sind naeher als zwei
                     Meter an der Kamera - das ist "zeigt nur noch Wand",
                     in einer Zahl

   Aufruf:  node tools/pruef/naht-bilder.js <ordner> [seed] [alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2] || 'bilder-naht';
const seed = +(process.argv[3] || 4711);
const alt = process.argv.indexOf('alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, seed, alt ? { nahtAlt: true } : {});
  /* Die Stellen einmal bestimmen - sie haengen nur an der Stadt, nicht
     am Verhalten, und sind damit in beiden Laeufen dieselben. */
  const stellen = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const K = d.hausKisten().filter((h) => h.zeile);
    const kollVon = (h) => {
      for (const c of d.colliderNah(h.x, h.z)) {
        if (c.klein || c.innen || c.parkAuto) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - h.x) < 0.02 &&
            Math.abs((c.z0 + c.z1) / 2 - h.z) < 0.02) return c;
      }
      return null;
    };
    const zeilen = new Map();
    for (const h of K) {
      if (!zeilen.has(h.zeile)) zeilen.set(h.zeile, []);
      zeilen.get(h.zeile).push(h);
    }
    const aus = [];
    for (const [key, liste] of zeilen) {
      if (liste.length < 2) continue;
      const seite = key.split('|')[2];
      const laengsX = seite === 'N' || seite === 'S';
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      liste.sort((p, q) => (laengsX ? p.x - q.x : p.z - q.z));
      for (let i = 1; i < liste.length && aus.length < 400; i++) {
        const A = liste[i - 1], B = liste[i];
        const cA = kollVon(A), cB = kollVon(B);
        if (!cA || !cB) continue;
        /* Nur hohe Nachbarn - dort klettert man wirklich. */
        if (Math.min(A.h, B.h) < 14) continue;
        aus.push({ key, seite, laengsX, nx, nz,
                   naht: laengsX ? (cA.x1 + cB.x0) / 2 : (cA.z1 + cB.z0) / 2,
                   front: nx !== 0 ? (nx > 0 ? cA.x1 : cA.x0)
                                   : (nz > 0 ? cA.z1 : cA.z0),
                   y: Math.min(A.h, B.h) * 0.55,
                   ax: A.x, az: A.z, art: A.art });
      }
    }
    /* Sechs Stellen, gleichmaessig ueber die Liste verteilt. */
    const schritt = Math.max(1, Math.floor(aus.length / 6));
    const w = [];
    for (let i = 0; i < aus.length && w.length < 6; i += schritt) w.push(aus[i]);
    return w;
  });

  const werte = [];
  for (let n = 0; n < stellen.length; n++) {
    const mess = await page.evaluate(async (st) => {
      const d = __dbg, P = d.player;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','KeyZ','Space','KeyX'])
        d.taste(t, false);
      const kollAn = (x, z) => d.colliderNah(x, z);
      const px = st.laengsX ? st.naht - 0.8 : st.front + st.nx * 0.15;
      const pz = st.laengsX ? st.front + st.nz * 0.15 : st.naht - 0.8;
      d.setzePos(px, st.y, pz);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx: st.nx, nz: st.nz,
        col: kollAn(st.ax, st.az).find((c) => !c.klein && !c.innen && !c.parkAuto &&
          Math.abs((c.x0 + c.x1) / 2 - st.ax) < 0.02) };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-st.nx, -st.nz));
      const vor = st.laengsX ? P.pos.x : P.pos.z;
      d.taste('KeyD', true);
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);
      const jetzt = st.laengsX ? P.pos.x : P.pos.z;
      if ((jetzt - vor) * (st.naht - vor) <= 0) {
        d.taste('KeyD', false); d.taste('KeyA', true);
      }
      /* Bis kurz hinter die Naht kriechen. */
      for (let i = 0; i < 70; i++) d.schritt(1 / 60);
      for (const t of ['KeyA','KeyD']) d.taste(t, false);
      /* Ein paar ruhige Bilder, damit die Kamera nachzieht. */
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      const k = d.kamera ? d.kamera() : null;
      return { pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
               zustand: P.state,
               wand: P.wall ? { nx: P.wall.nx, nz: P.wall.nz } : null,
               kam: k };
    }, stellen[n]);
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => __dbg.zeichne());
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
    }
    const name = String(n + 1).padStart(2, '0') + '-' + stellen[n].seite +
                 '-' + (stellen[n].art || 'x');
    await page.screenshot({ path: path.join(ziel, name + '.png') });
    werte.push({ name, ...mess });
    console.log('  ' + name + '   Zustand ' + mess.zustand +
                '   Wand ' + JSON.stringify(mess.wand) +
                '   Figur ' + mess.pos.join(' / '));
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen' + (alt ? '  (OHNE Uebergabe)' : ''));
})();
