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
     npm i -D playwright three@0.128.0
     npx playwright install chromium
   Liegt Chromium schon irgendwo, hilft PLAYWRIGHT_CHROMIUM.

   Die Version 0.128.0 ist KEINE Vorsichtsmassnahme, sondern noetig:
   das Spiel laedt genau diese (siehe index.html), und ab three 0.15x
   liegt in build/ gar keine three.min.js mehr. Ein schlichtes
   "npm i -D three" installiert dann etwas, das dieser Pruefstand nicht
   ausliefern kann - jeder Browser-Pruefstand bricht mit "three fehlt"
   ab, obwohl das Paket da ist.

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
/* opt.autos setzt die Zahl der Fahrzeuge im Umlauf, bevor die Stadt
   gebaut wird - fuer den Vergleich von Verkehrsdichten. */
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
  await page.addInitScript((ein) => {
    window.__WEBHERO_TEST__ = true;
    if (ein.seed !== null) window.__WEBHERO_SEED = ein.seed;
    if (ein.autos) window.__WEBHERO_AUTOS = ein.autos;
    if (ein.park !== null) window.__WEBHERO_PARKAUTOS = ein.park;
    if (ein.streetSpur) window.__WEBHERO_STREETSPUR = ein.streetSpur;
    /* CITY V2 Stufe 5: Hoehenschwelle, ab der ein Haus ein echtes Modell
       bekommt statt prozedural zu bleiben. Damit lassen sich Kandidaten
       vergleichen, ohne game.js anzufassen. */
    if (ein.hybrid) window.__WEBHERO_HYBRID = ein.hybrid;
    /* Nur fuer den Pruefstand: so tun, als waere eine der vorbereiteten
       Modellplatzierungen ungueltig - nach so vielen Stueck wird
       abgebrochen. */
    if (ein.modellFehler) window.__WEBHERO_MODELLFEHLER = ein.modellFehler;
    /* Nur zum Messen: die Wiederholungsbremsen aus Teil E abschalten,
       damit derselbe Pruefstand beide Verhaltensweisen messen kann. */
    if (ein.wdhAlt) window.__WEBHERO_WDH_ALT = 1;
    /* Nur zum Messen: welche der drei Wiederholungsbremsen aus Teil E an
       sind - A ungleiche Lotbreiten, B Fassade, C Modellwahl. */
    if (ein.bremsen !== null) window.__WEBHERO_BREMSEN = ein.bremsen;
    /* Nur zum Messen: die Wandsuche an der Zeilennaht abschalten, damit
       derselbe Pruefstand das Verhalten vor und nach der Korrektur
       messen kann. */
    if (ein.nahtAlt) window.__WEBHERO_NAHT_ALT = 1;
  }, { seed: seed === undefined ? null : seed, autos: (opt && opt.autos) || 0,
       park: (opt && opt.park !== undefined) ? opt.park : null,
       streetSpur: (opt && opt.streetSpur) || 0,
       hybrid: (opt && opt.hybrid) || 0,
       modellFehler: (opt && opt.modellFehler) || 0,
       wdhAlt: !!(opt && opt.wdhAlt),
       bremsen: (opt && typeof opt.bremsen === 'string') ? opt.bremsen : null,
       nahtAlt: !!(opt && opt.nahtAlt),
       ohneHaeuser: !!(opt && opt.ohneHaeuser) });
  /* ---- Rueckfalltest: haeuser.glb mit 404 beantworten ----
     WICHTIG: diese Route wird NACH der Sammelroute registriert. Playwright
     nimmt bei mehreren passenden Routen die ZULETZT registrierte - stand
     sie davor, lieferte die Sammelroute die Datei trotzdem aus, und der
     Test mass dann einen ganz normalen Lauf. Genau das ist passiert:
     "ohne haeuser.glb" meldete 413 gesetzte Modelle. */
  if (opt && opt.ohneHaeuser) {
    await page.route('**/assets/haeuser.glb',
      (r) => r.fulfill({ status: 404, body: 'nicht da' }));
  }
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
  /* Beim Rueckfalltest wird haeuser.glb absichtlich nicht ausgeliefert -
     dann auf die Modelle zu warten hiesse, eine Minute auf etwas zu
     warten, das per Absicht nicht kommt. */
  if (!(opt && opt.ohneHaeuser || opt && opt.modellFehler)) {
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
  } else {
    /* Trotzdem warten, bis der Ladeversuch durch ist - beim erzwungenen
       Fehlschlag laedt die Datei ja, es wird nur nichts gesetzt. */
    await page.waitForTimeout(8000);
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const o = document.getElementById('overlay');
    if (o) o.style.display = 'none';
  });
  return { b, page };
}

/* ---- "-" ist kein Dateiname ----
   Mehrere Pruefstaende nehmen ihren Ausgabepfad aus argv und schreiben
   ihn mit writeFileSync. Wird "-" als Platzhalter uebergeben, weil erst
   das NAECHSTE Argument gemeint ist, legen sie eine Datei namens "-" an.
   Genau das ist passiert: die Datei landete im Repo und wurde
   mitversioniert - sie liess sich nur mit "./-" wieder loeschen.
   Pruefstaende benutzen dafuer ausgabePfad(). */
function ausgabePfad(v) {
  return (!v || v === '-') ? null : v;
}

module.exports = { starte, ausgabePfad };
