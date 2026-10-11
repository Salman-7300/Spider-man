/* problem-3, finaler struktureller Pass, Blocker 1: schraege MODEL-
   Fassade mit der ECHTEN Spielkamera.

   ModernOffice_1 (Kollider 1166): die -x-Seite ist gerade, die Ecke zur
   +z-Seite ist eine Fase (43/47 Grad zu den Kistenseiten), die +z-Seite
   (Rueckseite) steht 10-15 Grad schraeg zur Kiste. Die Fahrt geht ueber
   den echten Eingabeweg: an der geraden Seite seitwaerts zur Fase, ueber
   die Fase auf die schraege Rueckseite, dort hoch, dann zurueck ueber
   die Fase auf die gerade Seite.

   Je Bild wird mitgeschrieben: Kistenseite, Winkel der Kletternormale
   zur Kistennormale, Abstand der Figur zur Kistenebene.

   Aufruf:  node tools/pruef/schraeg-video.js <ordner> [koll=1166]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-schraeg';
const kArg = process.argv.find((v) => v.indexOf('koll=') === 0);
const KOLL = kArg === undefined ? 1166 : +kArg.slice(5);
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, {});
  const start = await page.evaluate((k) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const c = d.colliders.find((q) => q.id === k);
    if (!c) return null;
    /* gerade -x-Seite, 6 m vor der Fase */
    const y = 0.25 + (c.h - 0.25) * 0.3;
    d.setzePos(c.x0 - 0.15, y, c.z1 - 7);
    P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
    P.wallInfo = P.wall = { nx: -1, nz: 0, col: c };
    P.eckSperre = 0;
    d.kamStart(Math.atan2(-1, 0), 0.1);
    for (let i = 0; i < 60; i++) d.schritt(1 / 60);
    return { x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1, h: c.h };
  }, KOLL);
  if (!start) { console.log('  Kollider ' + KOLL + ' nicht gefunden'); await b.close(); return; }

  /* D = nach rechts: an der -x-Seite Richtung +z (zur Fase), an der
     +z-Seite Richtung +x (die Rueckseite entlang). */
  const plan = [['gerade Seite, seitwaerts zur Fase', 'KeyD', 150],
                ['ueber die Fase auf die Rueckseite', 'KeyD', 150],
                ['schraege Rueckseite hoch', 'KeyW', 90],
                ['zurueck ueber die Fase', 'KeyA', 300]];
  const werte = [];
  let bild = 0;
  for (const [abschnitt, taste, n] of plan) {
    for (let i = 0; i < n; i += 2) {
      const st = await page.evaluate((a) => {
        const d = __dbg, P = d.player;
        for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) d.taste(t, t === a.taste);
        for (let k = 0; k < 2; k++) d.schritt(1 / 60);
        d.zeichne();
        const w = P.wallInfo;
        const hn = P.hautN && P.wallInfo === w ? P.hautN : null;
        let winkel = null;
        if (w && hn) winkel = Math.acos(Math.max(-1, Math.min(1, hn.x * w.nx + hn.z * w.nz))) * 180 / Math.PI;
        const kl = d.kletterLage();
        /* Wo steht die Figur im Bild? Fuer den Nahausschnitt. */
        const kn = d.animKnochen(['hips']).hips || { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z };
        const sp = d.bildPunkt ? d.bildPunkt(kn.x, kn.y, kn.z) : null;
        return { zustand: P.state, seite: w ? [w.nx, w.nz] : null,
                 pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
                 winkel: winkel === null ? null : +winkel.toFixed(1),
                 haut: +(P.hautTiefe || 0).toFixed(2), abst: kl.wandAbstand == null ? null : +kl.wandAbstand.toFixed(2),
                 drin: kl.imHaus || 0, sp };
      }, { taste });
      await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'),
                              type: 'jpeg', quality: 82 });
      /* Nahausschnitt derselben Spielkamera um die Huefte (320 x 180,
         im Video vergroessert) - die Figur ist im Vollbild klein. */
      if (st.sp) {
        const x = Math.max(0, Math.min(960 - 320, Math.round(st.sp[0] - 160)));
        const y = Math.max(0, Math.min(540 - 180, Math.round(st.sp[1] - 90)));
        await page.screenshot({ path: path.join(ziel, 'nah-' + String(bild).padStart(4, '0') + '.jpg'),
                                type: 'jpeg', quality: 90, clip: { x, y, width: 320, height: 180 } });
      }
      werte.push({ bild, abschnitt, ...st });
      bild++;
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  let maxSprung = 0, drin = 0, wechsel = 0;
  for (let i = 1; i < werte.length; i++) {
    const a = werte[i - 1].pos, c = werte[i].pos;
    maxSprung = Math.max(maxSprung, Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
    if (werte[i].drin) drin++;
    if (String(werte[i].seite) !== String(werte[i - 1].seite)) wechsel++;
  }
  console.log('  ' + bild + ' Bilder' + ', Seitenwechsel ' + wechsel +
              ', groesster Ortssprung je Aufnahme ' + maxSprung.toFixed(3) + ' m, Figur in Kiste ' + drin);
  for (const w of werte) if (w.bild % 15 === 0) console.log('  ' + JSON.stringify(w));
})();
