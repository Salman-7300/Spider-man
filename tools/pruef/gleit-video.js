/* problem-1, Punkt 7D: derselbe Gleitflug vorher und nachher.

   Aufgenommen wird eine feste Folge mit der echten Spielkamera, von
   derselben Stelle, in derselben Hoehe, mit demselben Tempo:

     1  Gleiten ohne Eingabe
     2  kurze W-Stoesse          <- hier sass das Flattern
     3  W dauerhaft halten
     4  W loslassen
     5  A
     6  D
     7  W+A
     8  W+D
     9  Uebergang Gleiten -> Sturzflug
    10  Sturzflug -> Gleiten zurueck

   Mit "alt" laeuft dieselbe Folge auf der alten Schwelle ohne
   Hysterese. Die Bilder sind damit Bild fuer Bild vergleichbar.

   "nah" setzt die Kamera dicht hinter die Figur, damit die Haltung zu
   beurteilen ist (problem-2, C6) - die Spielkamera zeigt sie sonst nur
   als Fleck. Ohne "nah" laeuft die echte Spielkamera.

   Aufruf:  node tools/pruef/gleit-video.js <ordner> [seed=4711] [alt] [nah]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'video-gleit';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
const NAH = process.argv.indexOf('nah') > 0;
const HALT = (process.argv.find((v) => v.indexOf('haltung=') === 0) || '').slice(8);
fs.mkdirSync(ziel, { recursive: true });

/* Die Folge: Name, Dauer in Simulationsbildern, gehaltene Tasten.
   "tippen" schaltet W im Takt von 12 Bildern - so lenkt man wirklich,
   und genau so pendelte die Nase um die alte Schwelle. */
const FOLGE = [
  { name: '1 ohne Eingabe', n: 90,  tasten: [] },
  { name: '2 W-Stoesse',    n: 180, tasten: [], tippen: true },
  { name: '3 W halten',     n: 90,  tasten: ['KeyW'] },
  { name: '4 W los',        n: 90,  tasten: [] },
  { name: '5 A',            n: 90,  tasten: ['KeyA'] },
  { name: '6 D',            n: 90,  tasten: ['KeyD'] },
  { name: '7 W+A',          n: 90,  tasten: ['KeyW', 'KeyA'] },
  { name: '8 W+D',          n: 90,  tasten: ['KeyW', 'KeyD'] },
  { name: '9 in den Sturz', n: 60,  tasten: ['KeyW'] },
  { name: '10 zurueck',     n: 60,  tasten: [] },
];

(async () => {
  const { b, page } = await starte(960, 540, seed, ALT ? { sturzAlt: true } : {});
  await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
      d.taste(t, false);
    /* Hoch genug, dass die ganze Folge in der Luft bleibt. */
    d.setzePos(-120, 260, -60);
    P.vel.set(0, 0, 18); P.facing = 0;
    P.state = 'air'; P.onGround = false;
    P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0; P.gleitKurve = 0;
    d.setzeKamYaw(Math.PI);
    d.taste('ShiftLeft', true);
  });
  if (HALT) await page.evaluate((h) => __dbg.setzeGleitHaltung(h), HALT);
  /* Einschwingen, bevor die Aufnahme laeuft. */
  await page.evaluate(() => { for (let i = 0; i < 90; i++) __dbg.schritt(1 / 60); });

  let bild = 0;
  const werte = [];
  for (const abschnitt of FOLGE) {
    for (let i = 0; i < abschnitt.n; i += 4) {
      const st = await page.evaluate((a) => {
        const d = __dbg, P = d.player;
        for (const t of ['KeyW','KeyA','KeyD']) d.taste(t, false);
        for (let k = 0; k < 4; k++) {
          if (a.tippen) d.taste('KeyW', (Math.floor((a.i + k) / 12) % 2) === 0);
          else for (const t of a.tasten) d.taste(t, true);
          d.schritt(1 / 60);
        }
        return { nase: +(P.gleitNase || 0).toFixed(2), sturz: !!P.sturzflug,
                 anim: P.anim, y: +P.pos.y.toFixed(1) };
      }, { tasten: abschnitt.tasten, tippen: !!abschnitt.tippen, i });
      if (NAH) {
        /* Dicht hinter und etwas ueber der Figur, mitfliegend. */
        await page.evaluate(() => {
          const P = __dbg.player;
          const v = Math.hypot(P.vel.x, P.vel.z) || 1;
          const hx = P.vel.x / v, hz = P.vel.z / v;
          __dbg.aufnahme(P.pos.x - hx * 3.2 + 1.2, P.pos.y + 1.6, P.pos.z - hz * 3.2,
                         P.pos.x, P.pos.y + 0.9, P.pos.z);
        });
      } else await page.evaluate(() => __dbg.zeichne());
      await page.screenshot({ path: path.join(ziel, String(bild).padStart(4, '0') + '.jpg'),
                              type: 'jpeg', quality: 80 });
      werte.push({ bild, abschnitt: abschnitt.name, ...st });
      bild++;
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  let wechsel = 0;
  for (let i = 1; i < werte.length; i++)
    if (werte[i].sturz !== werte[i - 1].sturz) wechsel++;
  console.log('  ' + bild + ' Bilder' + (ALT ? '  (alte Schwelle)' : '  (mit Hysterese)'));
  console.log('  Wechsel Gleiten/Sturzflug ueber die ganze Folge: ' + wechsel);
})();
