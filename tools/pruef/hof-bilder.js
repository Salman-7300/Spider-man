/* Die Innenhoefe der Uferbloecke, mit der ECHTEN Spielkamera.

   problem-1 meldet einen senkrechten Schacht zwischen zwei Haeusern.
   Gemessen kam er aus buildFarShore: vier Haeuser um einen Hof, der
   Abstand fest, die Breite unabhaengig gewuerfelt - je nach Wurf 6 m Hof
   oder 1,4 m Schlitz.

   Zahlen allein reichen hier nicht: ein Hof, der auf dem Papier 3,6 m
   breit ist, kann im Bild trotzdem falsch aussehen. Aufgenommen wird
   deshalb an den Bloecken, an denen die Schaechte gemessen wurden -
   einmal von der Strasse, einmal von oben ueber der Hofmitte.

   Die Bloeckmitten haengen nur am Raster, nicht am Wurf; dieselben
   Stellen lassen sich also vor und nach der Aenderung aufnehmen.

   Aufruf:  node tools/pruef/hof-bilder.js <ordner> [seed]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'bilder-hof';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
fs.mkdirSync(ziel, { recursive: true });

/* Die fuenf Uferbloecke, an denen bei Keim 4711 Schaechte gemessen
   wurden - als feste Weltkoordinaten, damit beide Laeufe dasselbe
   zeigen. */
const BLOECKE = [
  { x: 352, z: 112 }, { x: 384, z: -144 }, { x: 384, z: 48 },
  { x: 384, z: -80 }, { x: 352, z: -16 },
];

(async () => {
  const { b, page } = await starte(1280, 720, seed, {});
  const werte = [];
  for (let n = 0; n < BLOECKE.length; n++) {
    for (const sicht of ['strasse', 'oben']) {
      const mess = await page.evaluate(async (a) => {
        const d = __dbg; d.frier(true); d.setzeRegen(0);
        const P = d.player;
        for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
          d.taste(t, false);
        /* Von Westen auf den Block schauen - dort liegt der Fluss, die
           Blickachse ist also frei. Von oben aus 26 m ueber der
           Hofmitte. */
        const setz = () => {
          if (a.sicht === 'strasse') d.setzePos(a.b.x - 26, 1.0, a.b.z);
          else d.setzePos(a.b.x - 12, 30, a.b.z);
          P.vel.set(0, 0, 0);
          P.state = 'idle';
        };
        /* Blick nach Osten auf den Block. Die Figur faellt in der
           Obensicht sonst waehrend des Nachziehens weg - also nach jedem
           Schritt wieder auf die Stelle setzen. */
        d.setzeKamYaw(-Math.PI / 2);
        for (let i = 0; i < 20; i++) { setz(); d.schritt(1 / 60); }
        setz();
        /* Wieviel steht wirklich auf diesem Block, und wie breit ist
           der engste Zwischenraum darauf? */
        const k = d.hausKisten().filter((h) => Math.abs(h.x - a.b.x) < 15 &&
                                               Math.abs(h.z - a.b.z) < 15);
        let eng = null;
        for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
          const A = k[i], B = k[j];
          const dx = Math.abs(A.x - B.x) - (A.w + B.w) / 2;
          const dz = Math.abs(A.z - B.z) - (A.d + B.d) / 2;
          let s = null;
          if (dx < -0.10 && dz >= -0.001) s = dz;
          else if (dz < -0.10 && dx >= -0.001) s = dx;
          if (s !== null && (eng === null || s < eng)) eng = s;
        }
        return { haeuser: k.length, engster: eng === null ? null : +eng.toFixed(2),
                 kam: d.kamera ? d.kamera() : null };
      }, { b: BLOECKE[n], sicht });
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => __dbg.zeichne());
        await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      }
      const name = String(n + 1).padStart(2, '0') + '-' + sicht;
      await page.screenshot({ path: path.join(ziel, name + '.png') });
      if (sicht === 'oben') {
        werte.push({ block: BLOECKE[n], ...mess });
        console.log('  Block ' + BLOECKE[n].x + ' / ' + BLOECKE[n].z +
                    '   Haeuser ' + mess.haeuser +
                    '   engster Zwischenraum ' + mess.engster + ' m');
      }
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length * 2 + ' Aufnahmen in ' + ziel);
})();
