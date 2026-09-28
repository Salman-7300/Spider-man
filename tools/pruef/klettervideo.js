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
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, {});
  const start = await page.evaluate((a) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) d.taste(t, false);
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
  }, { KOLL, SEITE, F, START });
  if (!start) { console.log('  Kollider nicht gefunden'); await b.close(); return; }

  /* Anlauf (bzw. beim Hausweg einfach W), dann der Plan */
  const plan = START === 'haus3' ? [['KeyW', 700]] : [['ANLAUF', 150]].concat(PLAN);
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
    if (werte[i].imHaus && werte[i].wand && werte[i].drin !== +werte[i].wand.split(':')[0]) fremd++;
  }
  console.log('  ' + bild + ' Bilder, klettern ' + kletter + ', groesster Ortssprung je Aufnahme ' + maxSprung.toFixed(3) +
              ' m, in fremdem Kollider ' + fremd);
  for (const w of werte) if (w.bild % 25 === 0) console.log('  ' + JSON.stringify(Object.assign({}, w, { sp: undefined })));
})();
