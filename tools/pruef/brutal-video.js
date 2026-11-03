/* problem-2, Brutal_1-Halle: Gameplay-Aufnahme mit der ECHTEN Spielkamera
   ueber den echten Eingabeweg - vorher (schalter=bodenRasterAlt, ganze
   Hauskiste) und nachher (Grundriss-Raster) an denselben Orten.

   Die Figur startet an einem Punkt der Hauskiste (Bruchteile u, w von
   x0..x1 und z0..z1), um vor=<m> gegen die Laufrichtung nach aussen
   versetzt, mit Blick in die Laufrichtung, und faehrt einen Tastenplan
   ab. Aufgenommen wird jedes zweite Bild.

   Aufruf:
     node tools/pruef/brutal-video.js <ordner> [koll=2780] start=<u,w>
          [vor=4] richtung=<dx,dz> plan=ALT+W:150,... [schalter=bodenRasterAlt]
          [trocken=1]
   Plan: Tasten mit + verbunden (W A S D ALT SHIFT Z) und Bildzahl;
         SPRUNG und ROLLE loesen Sprung bzw. Ausweichen aus, KAM<grad>
         dreht die Kamera je Bild um <grad> (KAM3+N:120 = einmal rundum),
         N = keine Taste.
   trocken=1: keine Bilder, nur Lage je 10 Bilder (zum Abstimmen). */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-brutal';
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const KOLL = +arg('koll', 2780);
const START = arg('start', '1,0.5').split(',').map(Number);
const VOR = +arg('vor', '4');
const RICHTUNG = arg('richtung', '-1,0').split(',').map(Number);
const TROCKEN = arg('trocken', '0') === '1';
const CODES = { W: 'KeyW', A: 'KeyA', S: 'KeyS', D: 'KeyD', ALT: 'AltLeft', SHIFT: 'ShiftLeft', Z: 'KeyZ' };
const PLAN = arg('plan', 'ALT+W:150').split(',').map((s) => {
  const [k, n] = s.split(':');
  const teile = k.split('+');
  const kam = teile.find((q) => /^KAM-?[\d.]+$/.test(q));
  return { tasten: teile.filter((q) => CODES[q]).map((q) => CODES[q]), sprung: teile.includes('SPRUNG'),
           rolle: teile.includes('ROLLE'), kam: kam ? +kam.slice(3) * Math.PI / 180 : 0, n: +n };
});
const SCHALTER = {};
for (const k of arg('schalter', '').split(',').filter(Boolean)) SCHALTER[k] = true;
if (!TROCKEN) fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, SCHALTER);
  const start = await page.evaluate((a) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ']) d.taste(t, false);
    const c = d.colliders.find((q) => q.id === a.KOLL);
    if (!c) return null;
    const [dx, dz] = a.RICHTUNG, dl = Math.hypot(dx, dz) || 1;
    d.setzePos(c.x0 + a.START[0] * (c.x1 - c.x0) - dx / dl * a.VOR, 0.25, c.z0 + a.START[1] * (c.z1 - c.z0) - dz / dl * a.VOR);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
    P.facing = Math.atan2(dx, dz);
    d.kamStart(Math.atan2(-dx, -dz), 0.22);
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
    window.__bv = { x0: c.x0, z0: c.z0, gier: Math.atan2(-dx, -dz) };
    return { koll: c.id, raster: !!(d.bodenProfil(c.id) && d.bodenProfil(c.id).raster), pos: [P.pos.x - c.x0, P.pos.z - c.z0],
             kiste: [c.x1 - c.x0, c.z1 - c.z0] };
  }, { KOLL, START, RICHTUNG, VOR });
  if (!start) { console.log('  Kollider nicht gefunden'); await b.close(); return; }
  console.log('  Haus ' + start.koll + ' Kiste ' + start.kiste.map((q) => q.toFixed(2)).join(' x ') + ' Start ' + start.pos.map((q) => q.toFixed(2)).join('/') + ' Raster ' + start.raster);
  const werte = [];
  let bild = 0;
  for (const schritt of PLAN) {
    for (let i = 0; i < schritt.n; i += 2) {
      const st = await page.evaluate((a) => {
        const d = __dbg, P = d.player, v = window.__bv;
        for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'AltLeft', 'KeyZ']) d.taste(t, a.tasten.includes(t));
        if (a.erstes && (a.sprung || a.rolle)) {
          const code = a.sprung ? 'Space' : 'ControlLeft';
          document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
          document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
          d.taste(code, false);
        }
        for (let k = 0; k < 2; k++) {
          if (a.kam) d.setzeKamYaw(d.kamWinkel().gier + a.kam);
          d.schritt(1 / 60);
        }
        if (!a.trocken) d.zeichne();
        const cam = d.camera.position;
        return { zustand: P.state, pos: [+(P.pos.x - v.x0).toFixed(3), +P.pos.y.toFixed(3), +(P.pos.z - v.z0).toFixed(3)],
                 kamAbst: +Math.hypot(cam.x - P.pos.x, cam.y - P.pos.y - 1.6, cam.z - P.pos.z).toFixed(2) };
      }, { tasten: schritt.tasten, sprung: schritt.sprung, rolle: schritt.rolle, kam: schritt.kam, erstes: i === 0, trocken: TROCKEN });
      if (!TROCKEN) await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 82 });
      else if (bild % 5 === 0) console.log('  ' + String(bild * 2).padStart(4) + ' ' + st.zustand.padEnd(7) + ' x/z ' + st.pos[0].toFixed(2) + '/' + st.pos[2].toFixed(2) + ' y ' + st.pos[1].toFixed(2) + '  Kamera ' + st.kamAbst);
      werte.push({ bild, ...st });
      bild++;
    }
  }
  await b.close();
  if (!TROCKEN) fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  const e = werte[werte.length - 1];
  console.log('  ' + bild + ' Bilder, Ende x/z ' + e.pos[0].toFixed(2) + '/' + e.pos[2].toFixed(2) + ' y ' + e.pos[1].toFixed(2) + ' ' + e.zustand);
})();
