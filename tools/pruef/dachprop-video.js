/* problem-2, Punkt B1: dieselbe Stelle wie im Human-Video, nachher.

   Das alte Video zeigt bei etwa 49-51 s, wie die Figur ueber ein Dach
   laeuft und dabei durch die Aufbauten hindurchgeht - ein Kasten
   schneidet sie auf Huefthoehe. Hier wird genau das nachgefahren:
   dasselbe Dach, dieselben Aufbauten, derselbe Weg, dieselbe Kamera.

   Aufgenommen wird mit der ECHTEN Spielkamera, nicht mit einer freien
   Debugkamera. Mit "duenn-alt" laeuft derselbe Weg auf dem Stand vor
   Punkt B, in derselben Stadt - die Bilder sind damit Bild fuer Bild
   vergleichbar.

   Aufruf:  node tools/pruef/dachprop-video.js <ordner> [seed=4711] [duenn-alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-dachprop';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
const DUENN = process.argv.indexOf('duenn-alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, seed, DUENN ? { duennAlt: true } : {});
  /* Ein Dach mit moeglichst vielen Aufbauten auf einer Linie - dort
     laeuft die Figur in der Folge durch mehrere hintereinander. */
  const weg = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const props = d.dachProps().filter((p) => p.y0 > 12);
    /* Nach Dachhoehe gruppieren: was auf derselben Hoehe steht, steht
       auf demselben Dach. */
    const jeDach = new Map();
    for (const p of props) {
      const k = p.y0.toFixed(1);
      if (!jeDach.has(k)) jeDach.set(k, []);
      jeDach.get(k).push(p);
    }
    let best = null;
    for (const [k, liste] of jeDach) {
      if (liste.length < 4) continue;
      /* Eine Linie in z suchen, auf der mehrere Aufbauten liegen. */
      for (const p of liste) {
        const reihe = liste.filter((q) => Math.abs(q.z - p.z) < 1.2);
        const duenn = reihe.filter((q) => Math.max(q.w, q.d) < 0.6).length;
        if (reihe.length < 3 || duenn < 1) continue;
        const xs = reihe.map((q) => q.x).sort((a, c) => a - c);
        const spanne = xs[xs.length - 1] - xs[0];
        if (spanne < 6) continue;
        if (!best || reihe.length > best.n) {
          best = { y0: +k, z: p.z, x0: xs[0], x1: xs[xs.length - 1],
                   n: reihe.length, duenn };
        }
      }
    }
    if (best) {
      /* ---- Der Start muss AUF dem Dach liegen ----
         Der erste Versuch hat vier Meter vor dem ersten Aufbau
         angesetzt - und das lag ausserhalb des Hauses. Die Figur stand
         dann auf der Strasse, und das Video zeigte eine Fassade statt
         eines Daches. */
      for (const c of d.colliderNah(best.x0, best.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if (Math.abs((c.h || 0) - best.y0) > 0.35) continue;
        best.hausX0 = c.x0; best.hausX1 = c.x1;
        break;
      }
    }
    return best;
  });
  if (!weg) { console.log('  keine passende Dachreihe gefunden'); await b.close(); return; }
  console.log('  Dach auf ' + weg.y0.toFixed(1) + ' m, ' + weg.n +
              ' Aufbauten auf einer Linie, davon duenn ' + weg.duenn +
              (weg.hausX0 === undefined ? '   (kein Haus gefunden)' : ''));

  await page.evaluate((w) => {
    const d = __dbg, P = d.player;
    for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
      d.taste(t, false);
    const sx = w.hausX0 === undefined ? w.x0 - 4
             : Math.max(w.x0 - 4, w.hausX0 + 1.0);
    d.setzePos(sx, w.y0 + 0.1, w.z);
    P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true;
    P.facing = Math.PI / 2;
    d.setzeKamYaw(-Math.PI / 2);
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
    d.taste('KeyW', true);
  }, weg);

  const werte = [];
  let bild = 0;
  for (let i = 0; i < 300; i += 3) {
    const st = await page.evaluate(() => {
      const d = __dbg, P = d.player;
      for (let k = 0; k < 3; k++) d.schritt(1 / 60);
      return { x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2),
               z: +P.pos.z.toFixed(2), zustand: P.state };
    });
    await page.evaluate(() => __dbg.zeichne());
    await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'),
                            type: 'jpeg', quality: 82 });
    werte.push({ bild, ...st });
    bild++;
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + bild + ' Bilder' + (DUENN ? '  (Stand VOR Punkt B)' : '  (jetzt)'));
})();
