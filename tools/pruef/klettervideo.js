/* problem-2, Exterior Climb Shell: Gameplay-Aufnahmen mit der ECHTEN
   Spielkamera, ueber den echten Eingabeweg.

   Die Figur steht fuenf Meter vor einer Schauseite, rennt hinein
   (Shift+W, die Wandlauflogik entscheidet selbst ueber den Ansprung) und
   faehrt danach einen Tastenplan ab. Aufgenommen wird jedes zweite Bild,
   dazu ein Nahausschnitt derselben Kamera um die Huefte.

   Aufruf:
     node tools/pruef/klettervideo.js <ordner> koll=<id> seite=<nx,nz>
          [f=0.5] [plan=W:120,D:150,W:60,A:200] [start=wand|haus3]

     start=haus3  statt einer Wand: der Weg vom Boden aus hausStellen[3]
                  (wie topout.js) - geradeaus mit W.
     start=kit    an einem begehbaren Kit-Haus (wie innenklettern.js):
                  raum=<Index in KIT_INNEN | haus3>  seite=<nx,nz>
                  art=innen (im Laden auf die Innenwand zu) | aussen
                  (fuenf Meter vor derselben Wand). Anlauf mit Shift+W,
                  danach der Plan.
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-klettern';
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const KOLL = +arg('koll', 0);
const SEITE = arg('seite', '0,1').split(',').map(Number);
const F = +arg('f', 0.5);
const PLAN = arg('plan', 'W:150,D:150,W:60,A:200').split(',').map((s) => { const [t, n] = s.split(':'); return ['Key' + t, +n]; });
const START = arg('start', 'wand');
const RAUM = arg('raum', 'haus3');
/* Bilder Anlauf mit W (Shift bis zum Ansprung). Nach dem Ansprung haelt
   W weiter - bei 150 traegt der Wandlauf die Figur bei niedrigen Haeusern
   bis aufs Dach; fuer Seitwaerts-Faelle kuerzer waehlen. */
const ANLAUF = +arg('anlauf', 150);
/* Gegenproben: schalter=fadeAlt,... setzt die gleichnamigen Optionen von
   starte (basis.js), etwa die Kamera-Ueberblendung aus. */
const SCHALTER = {};
for (const k of arg('schalter', '').split(',').filter(Boolean)) SCHALTER[k] = true;
const ART = arg('art', 'aussen');
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, SCHALTER);
  const start = await page.evaluate((a) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) d.taste(t, false);
    if (a.START === 'kit') {
      const raeume = d.kitInnen();
      let r = null;
      if (a.RAUM === 'haus3') {
        const haus = d.hausStellen[3];
        r = raeume.find((q) => haus.x > q.x0 - 2 && haus.x < q.x1 + 2 && haus.z > q.z0 - 2 && haus.z < q.z1 + 2);
      } else r = raeume[+a.RAUM];
      if (!r) return null;
      const [nx, nz] = a.SEITE, WAND = 0.8;
      const mx = (r.x0 + r.x1) / 2 + Math.min(2.5, (r.x1 - r.x0) / 2 - 1),
            mz = (r.z0 + r.z1) / 2 + Math.min(2.5, (r.z1 - r.z0) / 2 - 1);
      let sx, sz, y0;
      if (a.ART === 'innen') {
        const ab = Math.min(4, (nx !== 0 ? (r.x1 - r.x0) : (r.z1 - r.z0)) / 2 - 0.6);
        const fx = nx !== 0 ? (nx > 0 ? r.x1 : r.x0) : mx, fz = nz !== 0 ? (nz > 0 ? r.z1 : r.z0) : mz;
        sx = fx - nx * ab; sz = fz - nz * ab; y0 = r.boden + 0.05;
      } else {
        const fx = nx !== 0 ? (nx > 0 ? r.x1 + WAND : r.x0 - WAND) : mx, fz = nz !== 0 ? (nz > 0 ? r.z1 + WAND : r.z0 - WAND) : mz;
        sx = fx + nx * 5; sz = fz + nz * 5; y0 = 0.35;
        /* Nicht im Laden eines ANDEREN Hauses starten (wie
           innenklettern.js) - gemessen: hausStellen[3] Ostseite lag im
           Nachbarladen, die Aufnahme zeigte dessen Regale. */
        if (raeume.some((q) => q !== r && [[sx, sz], [(sx + fx) / 2, (sz + fz) / 2]].some(([x, z]) =>
              x > q.x0 - WAND && x < q.x1 + WAND && z > q.z0 - WAND && z < q.z1 + WAND)))
          return { fehler: 'Aussenstart liegt in einem anderen Kit-Haus - andere Seite waehlen' };
      }
      d.setzePos(sx, y0, sz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.wallInfo = null; P.wall = null;
      /* Blick auf die Wand: innen nach (nx,nz), aussen nach -(nx,nz) */
      const bx = a.ART === 'innen' ? nx : -nx, bz = a.ART === 'innen' ? nz : -nz;
      P.facing = Math.atan2(bx, bz);
      d.setzeKamYaw(Math.atan2(-bx, -bz));
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      return { kit: true, raum: [r.x0, r.x1, r.z0, r.z1].map((v) => +v.toFixed(1)) };
    }
    if (a.START === 'haus3') {
      const haus = d.hausStellen[3];
      d.setzePos(haus.x, 0.25, haus.z - 8);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.facing = 0;
      P.wallInfo = null; P.wall = null;
      d.kamStart(Math.PI, 0.22);
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      return { haus3: true };
    }
    const c = d.colliders.find((q) => q.id === a.KOLL);
    if (!c) return null;
    const [nx, nz] = a.SEITE;
    const ax = nx !== 0, l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
    const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
    const t = l0 + (l1 - l0) * a.F;
    d.setzePos(ax ? front + nx * 5 : t, 0.3, ax ? t : front + nz * 5);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.wallInfo = null; P.wall = null;
    P.facing = Math.atan2(-nx, -nz);
    /* Blick zur Wand: die Kamera steht auf der Aussenseite (wie in
       innenklettern.js) - W fuehrt dann auf die Wand zu */
    d.setzeKamYaw(Math.atan2(nx, nz));
    for (let i = 0; i < 20; i++) d.schritt(1 / 60);
    return { koll: c.id, h: c.h };
  }, { KOLL, SEITE, F, START, RAUM, ART });
  if (!start) { console.log('  Kollider nicht gefunden'); await b.close(); return; }
  if (start.fehler) { console.log('  ' + start.fehler); await b.close(); return; }

  /* Anlauf (bzw. beim Hausweg einfach W), dann der Plan */
  const plan = START === 'haus3' ? [['KeyW', 700]] : [['ANLAUF', ANLAUF]].concat(PLAN);
  const werte = [];
  let bild = 0;
  for (const [taste, n] of plan) {
    for (let i = 0; i < n; i += 2) {
      const st = await page.evaluate((a) => {
        const d = __dbg, P = d.player;
        const anlauf = a.taste === 'ANLAUF';
        for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) d.taste(t, anlauf ? t === 'KeyW' : t === a.taste);
        d.taste('ShiftLeft', anlauf && P.state !== 'climb');
        for (let k = 0; k < 2; k++) d.schritt(1 / 60);
        d.zeichne();
        const w = P.wallInfo, kl = d.kletterLage();
        const kn = d.animKnochen(['hips']).hips || { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z };
        return { zustand: P.state, wand: w ? w.col.id + ':' + w.nx + ',' + w.nz : null,
                 pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
                 haut: +(P.hautTiefe || 0).toFixed(2),
                 n: P.hautN ? [+P.hautN.x.toFixed(2), +P.hautN.z.toFixed(2)] : null,
                 imHaus: kl.imHaus || 0, drin: kl.drinWer ? kl.drinWer.id : null,
                 fremd: kl.insideForeign || 0,
                 sp: d.bildPunkt ? d.bildPunkt(kn.x, kn.y, kn.z) : null };
      }, { taste });
      await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 82 });
      if (st.sp) {
        const x = Math.max(0, Math.min(960 - 320, Math.round(st.sp[0] - 160)));
        const y = Math.max(0, Math.min(540 - 180, Math.round(st.sp[1] - 90)));
        await page.screenshot({ path: path.join(ziel, 'nah-' + String(bild).padStart(4, '0') + '.jpg'),
                                type: 'jpeg', quality: 90, clip: { x, y, width: 320, height: 180 } });
      }
      werte.push({ bild, taste, ...st });
      bild++;
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  let maxSprung = 0, fremd = 0, kletter = 0;
  for (let i = 1; i < werte.length; i++) {
    const p = werte[i - 1].pos, q = werte[i].pos;
    maxSprung = Math.max(maxSprung, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]));
    if (werte[i].zustand === 'climb') kletter++;
    /* fremdes GEBAEUDE (kletterLage().insideForeign) - die eigene grobe
       Kiste zaehlt nicht, dort liegt die Kletterhaut */
    if (werte[i].fremd > 0 && (werte[i].zustand === 'climb' || werte[i].zustand === 'kante')) fremd++;
  }
  console.log('  ' + bild + ' Bilder, klettern ' + kletter + ', groesster Ortssprung je Aufnahme ' + maxSprung.toFixed(3) +
              ' m, im fremden Gebaeude beim Klettern ' + fremd);
  for (const w of werte) if (w.bild % 25 === 0) console.log('  ' + JSON.stringify(Object.assign({}, w, { sp: undefined })));
})();
