/* problem-1, Punkt 7: Gleiten mit W sieht falsch aus.

   Der Human-Befund: beim Gleiten mit gedruecktem W wirkt die Figur
   nicht wie in einer kontrollierten Gleithaltung, sondern seitlich
   verdreht, mit weit abgespreizten Gliedern, und die Koerperachse
   passt nicht zur Flugrichtung.

   Gemessen wird deshalb NICHT das Bild, sondern was die Haltung
   erzeugt:

     zustand     der Bewegungszustand des Spielers
     anim        die gewaehlte Bewegung
     gewichte    welche Bewegungen wirklich laufen, mit welchem Gewicht
                 - hier faellt auf, wenn eine Bodenbewegung (Laufen,
                 Sprinten, Fallen) in die Gleithaltung hineinmischt
     lage        Gier, Nick und Roll der Figur im Raum
     abweichung  Winkel zwischen Koerperachse und Flugrichtung
     bahnNick    Neigung der Flugbahn

   Die Matrix aus dem Auftrag: ohne Eingabe, W, A, D, W+A, W+D, dazu
   die Uebergaenge Gleiten -> Fallen und Gleiten -> Schwung.

   Aufruf:  node tools/pruef/gleitflug.js [seed=4711]

   (Die Datei hiess zuerst gleit-test.js. "node --test" sucht sich
   seine Dateien unter anderem nach dem Muster *-test.js zusammen und
   hat diesen Pruefstand deshalb als Unittest gestartet - ohne Browser,
   also mit Fehlschlag. Daher der Name ohne "-test".)
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

/* Welche Bewegungen gehoeren NICHT in eine Gleithaltung? Alles, was am
   Boden spielt oder ein freier Fall ist. Laeuft davon etwas mit
   Gewicht, mischt es sich in die Pose. */
const BODEN = ['idle', 'walk', 'run', 'sprint', 'schleichen', 'ducken',
               'land', 'sturzland', 'fallrolle', 'roll', 'knie'];

/* ---------------------------------------------------------------------
   Das Flattern: wie oft wechselt die Haltungsquelle beim Lenken?
   ------------------------------------------------------------------ */
async function flattern(page) {
  return page.evaluate(async () => {
    const d = __dbg, P = d.player;
    for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
      d.taste(t, false);
    d.setzePos(-120, 200, -40);
    P.vel.set(0, 0, 18); P.facing = 0; P.state = 'air'; P.onGround = false;
    P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0;
    d.taste('ShiftLeft', true);
    for (let i = 0; i < 90; i++) d.schritt(1 / 60);
    /* W antippen, wie man es beim Lenken tut. Genau so pendelt die Nase
       um die Schwelle, an der die Haltungsquelle wechselt. */
    const N = ['lefthand', 'righthand', 'hips'];
    let vorSturz = null, wechsel = 0, maxSprung = 0, vorRel = null;
    for (let i = 0; i < 360; i++) {
      d.taste('KeyW', (Math.floor(i / 12) % 2) === 0);
      d.schritt(1 / 60);
      /* LOKAL messen: in Weltkoordinaten zaehlt jede Drehung des ganzen
         Koerpers als Gliedersprung mit, und gemessen waere die Kippung
         statt der Haltung. */
      const k = d.animKnochenLokal(N);
      if (k && k.hips) {
        const rel = {};
        for (const n of N) if (k[n]) rel[n] = [k[n].x - k.hips.x, k[n].y - k.hips.y,
                                               k[n].z - k.hips.z];
        if (vorRel) for (const n of N) {
          if (!rel[n] || !vorRel[n]) continue;
          const dd = Math.hypot(rel[n][0] - vorRel[n][0], rel[n][1] - vorRel[n][1],
                                rel[n][2] - vorRel[n][2]);
          if (dd > maxSprung) maxSprung = dd;
        }
        vorRel = rel;
      }
      if (vorSturz !== null && !!P.sturzflug !== vorSturz) wechsel++;
      vorSturz = !!P.sturzflug;
    }
    d.taste('KeyW', false); d.taste('ShiftLeft', false);
    return { wechsel, maxSprung: +maxSprung.toFixed(3) };
  });
}

(async () => {
  const { b, page } = await starte(900, 540, SEED, {});
  const aus = await page.evaluate(async (BODEN) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const faelle = [
      { name: 'ohne Eingabe', tasten: [] },
      { name: 'W', tasten: ['KeyW'] },
      { name: 'A', tasten: ['KeyA'] },
      { name: 'D', tasten: ['KeyD'] },
      { name: 'W+A', tasten: ['KeyW', 'KeyA'] },
      { name: 'W+D', tasten: ['KeyW', 'KeyD'] },
    ];
    const ergebnis = [];
    for (const f of faelle) {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      d.setzePos(-120, 95, -40);
      P.vel.set(0, 0, 18);
      P.facing = 0;
      P.state = 'air'; P.onGround = false;
      P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0; P.gleitKurve = 0;
      d.taste('ShiftLeft', true);
      for (const t of f.tasten) d.taste(t, true);
      /* Drei Sekunden: der Sturzflug baut sich ueber rund eine Sekunde
         auf, danach ist die Haltung eingeschwungen. */
      for (let i = 0; i < 180; i++) d.schritt(1 / 60);
      const g = d.animGewichte();
      const stoer = {};
      for (const k in g) {
        const kl = k.toLowerCase();
        if (BODEN.some((n) => kl.indexOf(n) >= 0)) stoer[k] = g[k].w;
      }
      const lage = d.heroLage();
      ergebnis.push({
        fall: f.name, zustand: P.state, anim: P.anim,
        gleiten: !!P.gleiten, sturzflug: !!P.sturzflug,
        nase: +(P.gleitNase || 0).toFixed(2), kurve: +(P.gleitKurve || 0).toFixed(2),
        misch: +(P.gleitMisch || 0).toFixed(2),
        sinken: +P.vel.y.toFixed(1),
        tempo: +Math.hypot(P.vel.x, P.vel.z).toFixed(1),
        lage, gewichte: g, stoer,
      });
    }
    /* Uebergaenge. */
    const uebergang = [];
    for (const art of ['fallen', 'schwung']) {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      d.setzePos(-120, 95, -40);
      P.vel.set(0, 0, 18); P.facing = 0;
      P.state = 'air'; P.onGround = false;
      P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0;
      d.taste('ShiftLeft', true); d.taste('KeyW', true);
      for (let i = 0; i < 120; i++) d.schritt(1 / 60);
      if (art === 'fallen') { d.taste('ShiftLeft', false); d.taste('KeyW', false); }
      else { d.taste('Space', true); }
      for (let i = 0; i < 60; i++) d.schritt(1 / 60);
      uebergang.push({ art, zustand: P.state, anim: P.anim,
                       gleiten: !!P.gleiten, lage: d.heroLage() });
      d.taste('Space', false);
    }
    return { ergebnis, uebergang };
  }, BODEN);

  console.log('\n== Gleitflug: Zustand und Haltung ==');
  console.log('  Fall          Zustand  Bewegung     Nase  Kurve  Sinken  Tempo' +
              '   Gier   Nick   Roll  Abw.');
  for (const e of aus.ergebnis) {
    const L = e.lage || {};
    console.log('  ' + e.fall.padEnd(13) + String(e.zustand).padEnd(9) +
                String(e.anim).padEnd(12) +
                String(e.nase).padStart(6) + String(e.kurve).padStart(7) +
                String(e.sinken).padStart(8) + String(e.tempo).padStart(7) +
                String(L.gier).padStart(7) + String(L.nick).padStart(7) +
                String(L.roll).padStart(7) + String(L.abweichung).padStart(7));
  }

  console.log('\n== Welche Bewegungen mischen mit? ==');
  let stoerungen = 0;
  for (const e of aus.ergebnis) {
    const namen = Object.keys(e.gewichte)
      .map((k) => k + ' ' + e.gewichte[k].w).join('   ');
    console.log('  ' + e.fall.padEnd(13) + namen);
    const s = Object.keys(e.stoer);
    if (s.length) {
      stoerungen += s.length;
      console.log('      FREMD: ' + s.map((k) => k + ' ' + e.stoer[k]).join('  '));
    }
  }

  console.log('\n== Uebergaenge ==');
  for (const u of aus.uebergang)
    console.log('  ' + u.art.padEnd(10) + ' Zustand ' + String(u.zustand).padEnd(8) +
                ' Bewegung ' + String(u.anim).padEnd(12) +
                ' gleitet ' + (u.gleiten ? 'ja' : 'nein'));

  /* Harte Kennzahlen. */
  const gleitFaelle = aus.ergebnis.filter((e) => e.gleiten);
  const schief = gleitFaelle.filter((e) => e.lage &&
                                    Math.abs(e.lage.abweichung) > 0.6);
  console.log('\n== Kennzahlen ==');
  console.log('  Gleitflug erreicht            ' + gleitFaelle.length +
              ' von ' + aus.ergebnis.length);
  console.log('  fremde Bewegung in der Pose   ' + stoerungen);
  console.log('  Koerper quer zur Flugrichtung ' + schief.length +
              '   (ueber 34 Grad)');
  for (const e of schief)
    console.log('      ' + e.fall + '   Abweichung ' +
                (e.lage.abweichung * 180 / Math.PI).toFixed(0) + ' Grad');
  const fl = await flattern(page);
  console.log('\n== Flattern beim Lenken (6 s, W im Wechsel) ==');
  console.log('  Wechsel der Haltungsquelle    ' + fl.wechsel);
  console.log('  groesster Gliedersprung       ' + fl.maxSprung + ' m je Bild');
  /* Ueber fuenf Zentimeter je Bild sieht man als Ruck. */
  const flattert = fl.wechsel > 2 || fl.maxSprung > 0.05;

  console.log('\n  ' + (stoerungen + schief.length + (flattert ? 1 : 0)) +
              ' Beanstandungen');
  await b.close();
  process.exitCode = (stoerungen + schief.length + (flattert ? 1 : 0)) ? 1 : 0;
})();
