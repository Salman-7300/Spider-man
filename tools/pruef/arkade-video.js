/* problem-2, MO1-Arkade: Gameplay-Aufnahme mit der ECHTEN Spielkamera
   ueber den echten Eingabeweg - vorher/nachher vergleichbar.

   Die Figur steht fuenf Meter vor einer Hausseite (Mitte der sichtbaren
   Arkade oder an der Stelle t), Blick auf die Fassade, und faehrt einen
   Tastenplan ab. Aufgenommen wird jedes zweite Bild, dazu ein
   Nahausschnitt derselben Kamera um die Huefte (wie klettervideo.js).

   Aufruf:
     node tools/pruef/arkade-video.js <ordner> koll=<id> seite=<nx,nz>
          [t=<m laengs ab Kistenanfang>] [plan=ALT+W:150,ALT+A+W:120,...]
          [schalter=bodenProfilAlt]
   Plan: Tasten mit + verbunden (W A S D ALT SHIFT Z) und Bildzahl;
         SPRUNG und ROLLE loesen den Sprung bzw. das Ausweichen aus
         (Tastaturereignis), danach laufen die Bilder mit den Tasten des
         Eintrags, z.B. SPRUNG:60 oder ROLLE+ALT+W:50; N:30 = nichts.
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-arkade';
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const KOLL = +arg('koll', 1166);
const SEITE = arg('seite', '-1,0').split(',').map(Number);
const T = arg('t', null);
const CODES = { W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD', ALT: 'AltLeft', SHIFT: 'ShiftLeft', Z: 'KeyZ' };
const PLAN = arg('plan', 'ALT+W:150,ALT+A+W:120,ALT+D+W:240,N:20,SPRUNG:70,ROLLE+ALT+A:60').split(',').map((s) => {
  const [k, n] = s.split(':');
  const teile = k.split('+');
  return { tasten: teile.filter((q) => CODES[q]).map((q) => CODES[q]), sprung: teile.includes('SPRUNG'),
           rolle: teile.includes('ROLLE'), n: +n };
});
const SCHALTER = {};
for (const k of arg('schalter', '').split(',').filter(Boolean)) SCHALTER[k] = true;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, SCHALTER);
  const start = await page.evaluate((a) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ']) d.taste(t, false);
    const c = d.colliders.find((q) => q.id === a.KOLL);
    if (!c) return null;
    const [nx, nz] = a.SEITE, ax = nx !== 0;
    const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
    const l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
    let t = (l0 + l1) / 2;
    if (a.T !== null) t = l0 + (+a.T);
    else if (d.bodenProfil(c.id)) {
      /* Mitte des laengsten Ruecksprungs dieser Seite */
      let best = null;
      for (const r of d.bodenProfil(c.id).ruecksprung)
        if (r.seite[0] === nx && r.seite[1] === nz && (!best || r.t1 - r.t0 > best.t1 - best.t0)) best = r;
      if (best) t = l0 + (best.t0 + best.t1) / 2 * (l1 - l0);
    }
    d.setzePos(ax ? front + nx * 5 : t, 0.25, ax ? t : front + nz * 5);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
    P.facing = Math.atan2(-nx, -nz);
    d.kamStart(Math.atan2(nx, nz), 0.22);
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
    window.__av = { front, ax, nx, nz, l0 };
    return { koll: c.id, t: +(t - l0).toFixed(3), profil: !!d.bodenProfil(c.id) };
  }, { KOLL, SEITE, T });
  if (!start) { console.log('  Kollider nicht gefunden'); await b.close(); return; }
  console.log('  Haus ' + start.koll + ' Seite ' + SEITE + ' bei ' + start.t + ' m, Profil ' + start.profil);
  const werte = [];
  let bild = 0;
  for (const schritt of PLAN) {
    for (let i = 0; i < schritt.n; i += 2) {
      const st = await page.evaluate((a) => {
        const d = __dbg, P = d.player, v = window.__av;
        for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'AltLeft', 'KeyZ']) d.taste(t, a.tasten.includes(t));
        if (a.erstes && (a.sprung || a.rolle)) {
          const code = a.sprung ? 'Space' : 'ControlLeft';
          document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
          d.taste(code, false);
        }
        for (let k = 0; k < 2; k++) d.schritt(1 / 60);
        d.zeichne();
        const kn = d.animKnochen(['hips']).hips || { x: P.pos.x, y: P.pos.y + 1, z: P.pos.z };
        return { zustand: P.state, pos: [+P.pos.x.toFixed(3), +P.pos.y.toFixed(3), +P.pos.z.toFixed(3)],
                 tiefe: +(v.ax ? (v.front - P.pos.x) * v.nx : (v.front - P.pos.z) * v.nz).toFixed(3),
                 laengs: +((v.ax ? P.pos.z : P.pos.x) - v.l0).toFixed(3),
                 sp: d.bildPunkt ? d.bildPunkt(kn.x, kn.y, kn.z) : null };
      }, { tasten: schritt.tasten, sprung: schritt.sprung, rolle: schritt.rolle, erstes: i === 0 });
      await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 82 });
      if (st.sp) {
        const x = Math.max(0, Math.min(960 - 320, Math.round(st.sp[0] - 160)));
        const y = Math.max(0, Math.min(540 - 180, Math.round(st.sp[1] - 90)));
        await page.screenshot({ path: path.join(ziel, 'nah-' + String(bild).padStart(4, '0') + '.jpg'),
                                type: 'jpeg', quality: 90, clip: { x, y, width: 320, height: 180 } });
      }
      werte.push({ bild, ...st, sp: undefined });
      bild++;
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  let maxTiefe = -9, maxSprung = 0;
  for (let i = 0; i < werte.length; i++) {
    if (werte[i].zustand !== 'climb') maxTiefe = Math.max(maxTiefe, werte[i].tiefe);
    if (i > 0) { const p = werte[i - 1].pos, q = werte[i].pos; maxSprung = Math.max(maxSprung, Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])); }
  }
  console.log('  ' + bild + ' Bilder, tiefste Lage hinter der Kistenebene ' + maxTiefe.toFixed(3) + ' m, groesster Ortssprung je Aufnahme ' + maxSprung.toFixed(3) + ' m');
})();
