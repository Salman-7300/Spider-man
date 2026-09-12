/* Die drei Haltungen ansehen, die der Fail-Logger am haeufigsten meldet.
   Gemessen sagt er: im Sturzflug steht der Fuss 74 cm ueber der Huefte,
   beim Wandsprung 68 cm, und im Wandkriechen ist der Rumpf bis 88 cm von
   der Fassade weg. Ob das ein Fehler ist oder die Haltung des Clips,
   entscheidet kein Zaehler, sondern das Bild aus der Spielkamera.

   Aufruf:  node pruef/haltung-bilder.js [Zielordner]
*/
const fs = require('fs');
const path = require('path');
const { starte } = require('./basis');

const ZIEL = process.argv[2] || '/tmp/claude-0/haltung';

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { b, page } = await starte(1100, 700, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    if (d.setzeMissionCd) d.setzeMissionCd(1e9);

    /* Eine hohe Fassade suchen, an der sich alles zeigen laesst. */
    let wand = null, bh = 0;
    for (const c of d.colliderNah(0, 0)) {
      if (c.klein) continue;
      if ((c.h || 0) > bh) { bh = c.h || 0; wand = c; }
    }
    return { wand: wand ? { x0: +wand.x0.toFixed(1), x1: +wand.x1.toFixed(1),
                           z0: +wand.z0.toFixed(1), z1: +wand.z1.toFixed(1),
                           h: +bh.toFixed(1) } : null };
  });
  if (!aus.wand) { console.log('keine Fassade gefunden'); await b.close(); return; }
  const W = aus.wand;
  const zm = (W.z0 + W.z1) / 2;

  const szenen = [
    ['sturzflug', async () => page.evaluate(([x, z]) => {
      const d = __dbg, P = d.player;
      /* Hoch genug ansetzen und nur so lange fallen lassen, dass der
         Sturzflug steht - sonst ist die Figur beim Bild schon gelandet. */
      d.setzePos(x, 90, z);
      P.state = 'air'; P.onGround = false; P.vel.set(0, -24, 0); P.gleiten = false;
      for (let i = 0; i < 14; i++) d.schritt(1 / 30);
    }, [W.x0 - 14, zm])],
    /* Nicht P.state = 'climb' setzen: updatePlayer liest dann
       player.wallInfo, das es ohne echten Anflug gar nicht gibt, und die
       Seite bricht ab. Die Figur muss die Wand selbst greifen. */
    ['wandsprung', async () => page.evaluate(([x, z]) => {
      const d = __dbg, P = d.player;
      d.setzePos(x - 2.2, 18, z);
      P.state = 'air'; P.onGround = false; P.vel.set(4.5, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(Math.PI / 2 + Math.PI);
      d.taste('KeyZ', true); d.taste('KeyW', true);
      for (let i = 0; i < 90 && P.state !== 'climb'; i++) d.schritt(1 / 30);
      for (let i = 0; i < 20; i++) d.schritt(1 / 30);
      d.taste('KeyW', false);
      d.tippeSprung();
      for (let i = 0; i < 6; i++) d.schritt(1 / 30);
    }, [W.x0, zm])],
    ['wandkriechen', async () => page.evaluate(([x, z]) => {
      const d = __dbg, P = d.player;
      d.setzePos(x - 2.2, 14, z);
      P.state = 'air'; P.onGround = false; P.vel.set(4.5, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(Math.PI / 2 + Math.PI);
      d.taste('KeyZ', true); d.taste('KeyW', true);
      for (let i = 0; i < 90 && P.state !== 'climb'; i++) d.schritt(1 / 30);
      for (let i = 0; i < 60; i++) d.schritt(1 / 30);
    }, [W.x0, zm])],
  ];

  const bericht = [];
  for (const [name, stellen] of szenen) {
    await stellen();
    const werte = await page.evaluate(() => {
      const d = __dbg, P = d.player;
      const pl = d.poseLog ? d.poseLog() : null;
      const hv = d.heroVisual;
      return { zustand: P.state, clip: hv && hv.aktuellerClip ? hv.aktuellerClip : null,
               pos: [+P.pos.x.toFixed(1), +P.pos.y.toFixed(1), +P.pos.z.toFixed(1)],
               wandAbstand: pl && pl.wandAbstand !== undefined ? pl.wandAbstand : null,
               fussHoch: pl && pl.fussHoch ? pl.fussHoch : null };
    });
    /* Kamera wie im Spiel: schraeg hinter und ueber der Figur. */
    await page.evaluate(([nx, ny, nz]) => {
      const d = __dbg, P = d.player;
      d.aufnahme(P.pos.x + nx, P.pos.y + ny, P.pos.z + nz, P.pos.x, P.pos.y + 0.9, P.pos.z);
    }, [-3.2, 1.2, 3.2]);
    const datei = path.join(ZIEL, name + '.png');
    await page.screenshot({ path: datei });
    bericht.push({ name, datei, ...werte });
    console.log(name.padEnd(14) + JSON.stringify(werte));
  }
  console.log('');
  console.log('Bilder in ' + ZIEL);
  await b.close();
})();
