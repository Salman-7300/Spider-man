/* =========================================================================
   Pruefstand: das ECHTE Spiel in einem Browser starten und messen.

   Die Werkzeuge in tools/ lesen Dateien. Vieles laesst sich so aber gar
   nicht beantworten - ob ein Wagen ueber die Bruecke faehrt, ob ein Fuss
   beim Gehen rutscht, ob ein Passant stecken bleibt. Dafuer muss das
   Spiel laufen.

   Dieser Aufbau serviert index.html, game.js und die Assets aus dem Repo
   an einen kopflosen Chromium, wartet bis die Figuren geladen sind und
   gibt Playwrights page zurueck. Alles weitere laeuft ueber window.__dbg
   im Spiel.

   WICHTIG, sonst misst man Standbilder:
     d.frier(true)   haelt animate() an
     d.schritt(dt)   rechnet EINEN Schritt - OHNE zu zeichnen
     d.zeichne()     zeichnet
     d.aufnahme(...) setzt die Kamera und zeichnet sofort
   Ein Bildschirmfoto ohne zeichne() oder aufnahme() zeigt das Bild von
   vor dem Einfrieren.

   Voraussetzungen (bewusst NICHT in tools/package.json, weil sie einen
   ganzen Browser nachladen):
     npm i -D playwright three
     npx playwright install chromium
   Liegt Chromium schon irgendwo, hilft PLAYWRIGHT_CHROMIUM.

   Aufruf aus einem eigenen Skript:
     const { starte } = require('./basis');
     const { b, page } = await starte(800, 480, 4711);
   ========================================================================= */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WURZEL = path.resolve(__dirname, '..', '..');
/* three.min.js wird im Spiel vom CDN geholt. Im Pruefstand gibt es kein
   Netz, deshalb wird die Anfrage auf die lokale Kopie umgebogen. */
const THREE_DATEI = path.join(WURZEL, 'tools', 'node_modules', 'three', 'build', 'three.min.js');

/* opt: { touch: true } schaltet den Browser auf Beruehrung um - nur dann
   baut das Spiel seine Touch-Bedienung auf. */
async function starte(breite, hoehe, seed, opt) {
  if (!fs.existsSync(THREE_DATEI)) {
    throw new Error('three fehlt: npm i -D three im Ordner tools/');
  }
  const start = { args: ['--use-gl=angle', '--use-angle=swiftshader',
                         '--enable-unsafe-swiftshader'] };
  if (process.env.PLAYWRIGHT_CHROMIUM) start.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
  const b = await chromium.launch(start);
  const seiteEin = { viewport: { width: breite || 800, height: hoehe || 500 } };
  if (opt && opt.touch) { seiteEin.hasTouch = true; seiteEin.isMobile = true; }
  const page = await b.newPage(seiteEin);
  page.on('pageerror', (e) => console.log('SEITENFEHLER:', e.message));
  await page.route('**/cdn.jsdelivr.net/**',
    (r) => r.fulfill({ path: THREE_DATEI, contentType: 'application/javascript' }));
  await page.route('http://webhero.test/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    const f = path.join(WURZEL, p === '/' ? '/index.html' : p);
    if (!f.startsWith(WURZEL) || !fs.existsSync(f)) return route.fulfill({ status: 404, body: 'nf' });
    const t = f.endsWith('.html') ? 'text/html; charset=utf-8'
            : f.endsWith('.js') ? 'application/javascript'
            : 'application/octet-stream';
    route.fulfill({ path: f, contentType: t });
  });
  await page.addInitScript((s) => {
    window.__WEBHERO_TEST__ = true;
    if (s !== null) window.__WEBHERO_SEED = s;
  }, seed === undefined ? null : seed);
  await page.goto('http://webhero.test/');
  await page.waitForFunction(() => window.__dbg && window.__dbg.actorsReady, { timeout: 150000 });
  /* ---- Warten, bis die STADT wirklich steht ----
     actorsReady meldet nur die Figuren. assets/haeuser.glb (2,8 MB) wird
     als LETZTE aller rund 300 GLB-Dateien angefordert; erst danach
     ersetzt setzeHausModelle() die einfachen Fassadenkisten durch 287
     Hausmodelle und 37 gebaute Hochhaeuser.
     Gemessen: 1,8 Sekunden nach actorsReady steht davon NICHTS, nach drei
     Sekunden alles. Wer frueher misst, misst eine andere Stadt - mir sind
     damit eine LOD-Messung und eine Reihe Bildschirmfotos verdorben. */
  await page.waitForFunction(() => {
    let n = 0;
    window.__dbg.szene.traverse((o) => {
      if (o.userData && o.userData.visualKind === 'tower') n++;
    });
    return n > 0;
  }, { timeout: 60000 }).catch(() => {
    console.log('WARNUNG: die Hausmodelle sind nicht erschienen - '
              + 'die Messung laeuft auf den einfachen Fassadenkisten.');
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const o = document.getElementById('overlay');
    if (o) o.style.display = 'none';
  });
  return { b, page };
}

module.exports = { starte };
