/* problem-2, Punkt C: die gebaute Gleithaltung abstimmen.

   Mehrere Kandidaten in EINEM Browserstart - die Stadt wird nur einmal
   gebaut, die Haltung zur Laufzeit gesetzt. Aufgenommen wird nah genug,
   dass die Figur rund ein Drittel der Bildhoehe einnimmt.

   Aufruf:  node tools/pruef/gleit-bau.js <ordner> [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'bilder-gleitbau';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
fs.mkdirSync(ziel, { recursive: true });

/* Kandidaten: Richtungen im Koerpersystem, q quer / l laengs / h hoch. */
const KANDIDATEN = [
  { name: '1-eng',   oberarm: [0.72, -0.60, -0.05], unterarm: [0.38, -0.86, 0.12] },
  { name: '2-mittel',oberarm: [0.85, -0.45, -0.04], unterarm: [0.66, -0.72, 0.10] },
  { name: '3-weit',  oberarm: [0.93, -0.32, -0.02], unterarm: [0.82, -0.54, 0.08] },
  { name: '4-weitab',oberarm: [0.88, -0.42, -0.14], unterarm: [0.74, -0.62, 0.02] },
];
const RICHTUNGEN = [
  { name: 'seite',  ab: [2.1, 0.15, 0] },
  { name: 'vorn',   ab: [0.5, -0.8, 2.1] },
  { name: 'oben',   ab: [0.2, 2.0, -1.2] },
];

(async () => {
  const { b, page } = await starte(1280, 720, seed, {});
  const start = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space']) d.taste(t, false);
    d.setzeGleitHaltung('D');
    d.setzePos(-120, 170, -40); P.vel.set(0, 0, 18); P.facing = 0;
    P.state = 'air'; P.onGround = false;
    P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0; P.gleitKurve = 0;
    d.taste('ShiftLeft', true);
    let i = 0;
    while (i < 300 && !(P.gleiten && (P.gleitMisch || 0) >= 0.99)) { d.schritt(1 / 60); i++; }
    return { pos: [P.pos.x, P.pos.y, P.pos.z] };
  });

  for (const K of KANDIDATEN) {
    const mess = await page.evaluate(async (a) => {
      const d = __dbg, P = d.player;
      d.setzeGleitBau('cruise', { oberarm: a.oberarm, unterarm: a.unterarm });
      /* Auf der Stelle halten, damit alle Kandidaten dieselbe Lage
         zeigen. */
      const halt = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      for (let k = 0; k < 12; k++) {
        d.setzePos(halt.x, halt.y, halt.z);
        d.schritt(1 / 60);
      }
      d.setzePos(halt.x, halt.y, halt.z);
      const kn = d.animKnochenLokal(['lefthand','righthand','leftfoot','rightfoot']);
      const paar = (l, r) => kn[l] && kn[r]
        ? +(Math.abs(kn[l].x + kn[r].x) + Math.abs(kn[l].y - kn[r].y) +
            Math.abs(kn[l].z - kn[r].z)).toFixed(3) : null;
      /* Spannweite der Haende im Koerpersystem. */
      const spann = kn.lefthand && kn.righthand
        ? +Math.abs(kn.lefthand.x - kn.righthand.x).toFixed(2) : null;
      return { pos: [P.pos.x, P.pos.y, P.pos.z], spann,
               schief: paar('lefthand', 'righthand') };
    }, K);
    for (const r of RICHTUNGEN) {
      await page.evaluate((a) => {
        const p = a.pos, ab = a.ab;
        for (let i = 0; i < 3; i++)
          __dbg.aufnahme(p[0] + ab[0], p[1] + 1.0 + ab[1], p[2] + ab[2],
                         p[0], p[1] + 0.9, p[2]);
      }, { pos: mess.pos, ab: r.ab });
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      await page.screenshot({ path: path.join(ziel, K.name + '-' + r.name + '.png') });
    }
    console.log('  ' + K.name.padEnd(9) + ' Handspannweite ' + mess.spann +
                ' m   Schieflage ' + mess.schief);
  }
  await b.close();
})();
