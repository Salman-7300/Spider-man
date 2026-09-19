/* Die Figur am Dachaufbau, mit der ECHTEN Spielkamera.

   problem-1, Punkt 5: im Human-Screenshot steht Spider-Man bis zur
   Brust IN einem Lueftungskasten, nur Arme und Beine schauen heraus.

   Hier wird genau das nachgestellt: die Figur laeuft auf dem Dach gegen
   den Aufbau und faellt von oben darauf. Aufgenommen wird an denselben
   Stellen einmal mit und einmal ohne die neuen Hindernisse ("alt").

   Aufruf:  node tools/pruef/dachprop-bilder.js <ordner> [seed=4711] [alt]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'bilder-dachprop';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, seed, ALT ? { dachAlt: true } : {});
  /* Die groessten Aufbauten zuerst - dort sieht man es am deutlichsten.
     Die Auswahl haengt nur an der Stadt, ist also in beiden Laeufen
     dieselbe. */
  const stellen = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    return d.dachProps()
      /* Kein Wasserturm: der Human-Screenshot zeigt einen KASTEN, und
         die Figur verschwindet hinter der Tankhaube. */
      .filter((p) => (p.art === 'Lueftungskasten' || p.art === 'Dachkasten') &&
                     Math.max(p.w, p.d) >= 2.3 && p.h >= 1.5 && p.y0 > 12)
      .sort((a, c) => (c.w * c.d) - (a.w * a.d))
      .slice(0, 4)
      .map((p) => ({ art: p.art, x: p.x, z: p.z, y0: p.y0, w: p.w, h: p.h, d: p.d }));
  });

  const werte = [];
  for (let n = 0; n < stellen.length; n++) {
    for (const art of ['lauf', 'fall']) {
      const mess = await page.evaluate(async (a) => {
        const d = __dbg, P = d.player;
        const p = a.p;
        for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
          d.taste(t, false);
        if (a.art === 'lauf') {
          d.setzePos(p.x - (p.w / 2 + 3), p.y0 + 0.1, p.z);
          P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true;
          P.facing = Math.PI / 2;
          d.taste('KeyW', true);
          for (let i = 0; i < 150; i++) d.schritt(1 / 60);
          d.taste('KeyW', false);
        } else {
          d.setzePos(p.x, p.y0 + p.h + 4, p.z);
          P.vel.set(0, 0, 0); P.state = 'air'; P.onGround = false;
          for (let i = 0; i < 180; i++) d.schritt(1 / 60);
        }
        /* Kamera seitlich auf den Aufbau. Die Figur wird waehrend des
           Nachziehens festgehalten, sonst laeuft oder faellt sie aus
           dem Bild. */
        d.setzeKamYaw(-Math.PI / 2);
        const halt = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
        for (let i = 0; i < 20; i++) {
          d.setzePos(halt.x, halt.y, halt.z);
          P.vel.set(0, 0, 0);
          d.schritt(1 / 60);
        }
        d.setzePos(halt.x, halt.y, halt.z);
        const drin = P.pos.x > p.x - p.w / 2 + 0.02 && P.pos.x < p.x + p.w / 2 - 0.02 &&
                     P.pos.z > p.z - p.d / 2 + 0.02 && P.pos.z < p.z + p.d / 2 - 0.02 &&
                     P.pos.y + 0.9 > p.y0 + 0.02 && P.pos.y + 0.9 < p.y0 + p.h - 0.02;
        return { drin, y: +P.pos.y.toFixed(2), oben: +(p.y0 + p.h).toFixed(2),
                 zustand: P.state };
      }, { p: stellen[n], art });
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => __dbg.zeichne());
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      }
      const name = String(n + 1).padStart(2, '0') + '-' + art;
      await page.screenshot({ path: path.join(ziel, name + '.png') });
      werte.push({ name, art: stellen[n].art, ...mess });
      console.log('  ' + name.padEnd(9) + stellen[n].art.padEnd(16) +
                  ' Figur y ' + String(mess.y).padStart(7) +
                  '  Oberkante ' + String(mess.oben).padStart(7) +
                  (mess.drin ? '   IM AUFBAU' : ''));
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen' + (ALT ? '  (OHNE Hindernisse)' : ''));
})();
