/* Wie sieht der Gleitflug aus - mit und ohne W?

   problem-1, Punkt 7: "Gleiten und dabei W sieht falsch aus." Das
   Video dazu ist von hier aus nicht erreichbar, die BEDINGUNG aber
   schon: Gleitflug, W gedrueckt. Genau die wird hier hergestellt und
   fotografiert, mit der echten Spielkamera.

   Aufgenommen werden drei Laeufe ueber dieselbe Strecke:

     frei    Gleitflug ohne Richtungstaste
     w       Gleitflug mit W (Nase herunter, ab 0,55 der Sturzflug)
     s       Gleitflug mit S (Nase hoch) - als Gegenprobe

   Dazu die Zahlen, die die Haltung bestimmen: gleitNase, sturzflug,
   der Name der laufenden Bewegung, Sinken und Tempo. Ein Bild allein
   sagt nicht, ob Haltung und Bewegung zueinander passen.

   Aufruf:  node tools/pruef/gleit-bilder.js <ordner> [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'bilder-gleit';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
fs.mkdirSync(ziel, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, seed, {});
  const werte = [];
  for (const lauf of ['frei', 'w', 's']) {
    /* Drei Zeitpunkte je Lauf: kurz nach dem Ausbreiten, in der Mitte,
       am Ende - der Sturzflug baut sich erst ueber eine Sekunde auf. */
    for (const bis of [40, 110, 200]) {
      const mess = await page.evaluate(async (a) => {
        const d = __dbg, P = d.player;
        d.frier(true); d.setzeRegen(0);
        for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
          d.taste(t, false);
        /* Hoch ueber der Stadt, mit Tempo nach Norden - so, wie man aus
           einem Netzschwung in den Gleitflug geht. */
        d.setzePos(-120, 95, -40);
        P.vel.set(0, 0, 18);
        P.facing = 0;
        P.state = 'air';
        P.onGround = false;
        P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0; P.gleitKurve = 0;
        d.setzeKamYaw(Math.PI * 0.75);
        /* Die Gleittaste ist dieselbe wie Sprinten. */
        d.taste('ShiftLeft', true);
        if (a.lauf === 'w') d.taste('KeyW', true);
        if (a.lauf === 's') d.taste('KeyS', true);
        for (let i = 0; i < a.bis; i++) d.schritt(1 / 60);
        return { gleiten: !!P.gleiten, nase: +(P.gleitNase || 0).toFixed(2),
                 sturzflug: !!P.sturzflug, anim: P.anim,
                 sinken: +P.vel.y.toFixed(1),
                 tempo: +Math.hypot(P.vel.x, P.vel.z).toFixed(1),
                 hoehe: +P.pos.y.toFixed(1) };
      }, { lauf, bis });
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => __dbg.zeichne());
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      }
      const name = lauf + '-' + String(bis).padStart(3, '0');
      await page.screenshot({ path: path.join(ziel, name + '.png') });
      werte.push({ name, ...mess });
      console.log('  ' + name.padEnd(8) +
                  ' Nase ' + String(mess.nase).padStart(5) +
                  '  Sturzflug ' + (mess.sturzflug ? 'ja ' : 'nein') +
                  '  Bewegung ' + String(mess.anim).padEnd(10) +
                  '  Sinken ' + String(mess.sinken).padStart(6) +
                  '  Tempo ' + String(mess.tempo).padStart(5));
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen in ' + ziel);
})();
