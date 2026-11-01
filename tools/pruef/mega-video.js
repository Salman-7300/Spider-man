/* Mega-Update 1.0: Bilder fuer die Human-Abnahme.
   =========================================================================
   Spielt die Ablaeufe mit dem Bot aus mega-bot.js - genau die Eingaben,
   die tools/pruef/mega-ereignisse.js misst - und haelt jedes 4. Bild fest
   (15 Bilder/s = Echtzeit). Normale Spielkamera, HUD sichtbar (Zieltext,
   Hinweis "C ..."), damit man sieht, was der Spieler sieht.

   Aufruf:  node tools/pruef/mega-video.js <ordner> [faelle=laden,autodieb,direkt,dach,unfall]
                                           [vorlauf=0] [max=90]
   Je Fall ein Unterordner mit nummerierten JPEGs; daraus macht ffmpeg das
   Video (siehe docs/abnahme-mega-1.0/README.md).
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const { botCode } = require('./mega-bot');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const ZIEL = process.argv[2];
if (!ZIEL) { console.log('Aufruf: node tools/pruef/mega-video.js <ordner> [faelle=...]'); process.exit(1); }
const FAELLE = arg('faelle', 'laden,autodieb,direkt,dach,unfall').split(',');
const MAX = Number(arg('max', 90));            // Sekunden je Fall hoechstens im Bild

(async () => {
  const { b, page } = await starte(960, 540, Number(arg('keim', 4711)), { frierSofort: true });
  await page.evaluate(botCode);
  await page.evaluate(() => {
    const o = document.getElementById('overlay'); if (o) o.style.display = 'none';
    const h = document.getElementById('hud'); if (h) h.style.display = 'block';
  });
  for (const fall of FAELLE) {
    const ordner = path.join(ZIEL, fall);
    fs.mkdirSync(ordner, { recursive: true });
    const st = await page.evaluate((f) => window.__mb.start(f), fall);
    let bild = 0, t = 0, letzte = null;
    const spur = [];
    while (true) {
      const z = await page.evaluate(() => window.__mb.takt(4));
      t += 4 / 60;
      if (z.phase === 'fertig') break;
      /* Nach dem Ende noch 4 s zeigen (Dank, Polizei), dann weiter. */
      if (z.phase === 'nach' && letzte === null) letzte = t;
      if (letzte !== null && t - letzte > 4) break;
      if (t > MAX) break;
      await page.evaluate(() => __dbg.zeichne());
      fs.writeFileSync(path.join(ordner, String(bild++).padStart(4, '0') + '.jpg'),
                       await page.screenshot({ type: 'jpeg', quality: 84 }));
      if (z.ev && (!spur.length || spur[spur.length - 1][1] !== z.ev.phase)) spur.push([+t.toFixed(1), z.ev.phase]);
    }
    /* Den Rest des Falls ohne Bild zu Ende rechnen (Aufraeumen). */
    const r = await page.evaluate(() => { while (window.__mb.takt(60).phase !== 'fertig'); return window.__mb.ergebnis(); });
    fs.writeFileSync(path.join(ordner, 'ergebnis.json'), JSON.stringify({ aufbau: st.aufbau, spur, ergebnis: r }, null, 1));
    console.log(fall + ': ' + bild + ' Bilder, Ausgang ' + r.ausgang + ', Phasen ' +
                (r.phasen || []).map((p) => p[0]).join(' > ') + ', harte Fehler ' +
                Object.values(r.hart).reduce((a, v) => a + v, 0));
  }
  await b.close();
})();
