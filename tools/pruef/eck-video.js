/* problem-2, Punkt A: der Eckenwechsel mit der ECHTEN Spielkamera.

   Gezeigt wird eine Fahrt ueber den echten Eingabeweg: an der Wand
   hoch, dann seitwaerts um mehrere Aussenecken desselben Hauses. Mit
   "alt" laeuft dieselbe Fahrt mit dem alten Sprung statt dem Bogen -
   Bild fuer Bild vergleichbar.

   Aufruf:  node tools/pruef/eck-video.js <ordner> [seed=4711] [alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-ecke';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
/* "frei" nimmt mit einer freien Kamera auf, die in festem Abstand um
   das Haus mitfaehrt. Die echte Spielkamera zeigt an dieser Stelle vor
   allem den NOCH NICHT behobenen Kamerafehler - sie wird von der
   Sichtbegrenzung an die Wand gedrueckt und das Bild ist dunkel. Um zu
   beurteilen, ob die FIGUR sauber um die Ecke faehrt, braucht es einen
   Blick von aussen. */
const FREI = process.argv.indexOf('frei') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, seed, ALT ? { eckAlt: true } : {});
  const start = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const kollVon = (k) => {
      for (const c of d.colliderNah(k.x, k.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - k.x) < 0.05 &&
            Math.abs((c.z0 + c.z1) / 2 - k.z) < 0.05) return c;
      }
      return null;
    };
    /* Ein freistehendes Haus: dort sind alle vier Ecken echte
       Aussenecken, nicht Naehte. */
    for (const K of d.hausKisten().filter((k) => k.h > 18 && k.h < 40)) {
      const c = kollVon(K);
      if (!c) continue;
      let frei = true;
      for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 1.5 : (c.x0 + c.x1) / 2;
        const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 1.5 : (c.z0 + c.z1) / 2;
        for (const n of d.colliderNah(px, pz)) {
          if (n === c || n.klein || n.innen || n.parkAuto || n.dachProp) continue;
          if (px > n.x0 && px < n.x1 && pz > n.z0 && pz < n.z1 &&
              (n.h || 0) > SLAB_H + 6) { frei = false; break; }
        }
        if (!frei) break;
      }
      if (!frei) continue;
      const P = d.player;
      d.setzePos(c.x1 + 0.15, SLAB_H + K.h - 8, (c.z0 + c.z1) / 2);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx: 1, nz: 0, col: c };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-1, 0));
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      return { x: +K.x.toFixed(1), z: +K.z.toFixed(1), h: +K.h.toFixed(1),
               r: +(Math.max(K.w, K.d) / 2).toFixed(2) };
    }
    return null;
  });
  if (!start) { console.log('  kein freistehendes Haus gefunden'); await b.close(); return; }
  console.log('  Haus bei ' + start.x + ' / ' + start.z + ', Hoehe ' + start.h);

  /* Seitwaerts um das Haus herum - dabei kommen alle vier Ecken. */
  let bild = 0, ecken = 0;
  const werte = [];
  for (let i = 0; i < 900; i += 3) {
    const st = await page.evaluate((a) => {
      const d = __dbg, P = d.player;
      d.taste('KeyD', true);
      /* Zwischendurch ein Stueck hoch, damit man die Wand wechseln
         sieht und nicht nur im Kreis laeuft. */
      d.taste('KeyW', (Math.floor(a.i / 120) % 2) === 1);
      for (let k = 0; k < 3; k++) d.schritt(1 / 60);
      const kl = d.kletterLage();
      return { pos: kl.pos, koll: kl.koll, nx: kl.nx, nz: kl.nz,
               bogen: !!kl.imBogen, zustand: kl.zustand };
    }, { i });
    if (FREI) {
      await page.evaluate((q) => {
        const d = __dbg, P = d.player;
        /* Von schraeg aussen auf die Figur, Abstand fest. */
        /* Nah genug, dass man die Figur sieht: radial vom Hausmittel-
           punkt nach aussen, leicht ueber Schulterhoehe. 26 m waren zu
           weit - da fuellt die Stadt das Bild und die Figur ist ein
           Punkt. */
        const w = Math.atan2(P.pos.x - q.x, P.pos.z - q.z);
        d.aufnahme(q.x + Math.sin(w) * (q.r + 7.5), P.pos.y + 2.2,
                   q.z + Math.cos(w) * (q.r + 7.5),
                   P.pos.x, P.pos.y + 1.0, P.pos.z);
      }, { x: start.x, z: start.z, r: start.r });
    } else {
      await page.evaluate(() => __dbg.zeichne());
    }
    await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'),
                            type: 'jpeg', quality: 80 });
    if (werte.length && (st.nx !== werte[werte.length - 1].nx ||
                         st.nz !== werte[werte.length - 1].nz)) ecken++;
    werte.push({ bild, ...st });
    bild++;
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  let maxSprung = 0;
  for (let i = 1; i < werte.length; i++) {
    const a = werte[i - 1].pos, c = werte[i].pos;
    const dp = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    if (dp > maxSprung) maxSprung = dp;
  }
  console.log('  ' + bild + ' Bilder, ' + ecken + ' Wandwechsel' +
              (ALT ? '  (alter Sprung)' : '  (mit Bogen)'));
  console.log('  groesster Ortssprung je Aufnahme: ' + maxSprung.toFixed(3) + ' m');
})();
