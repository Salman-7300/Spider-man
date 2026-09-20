/* problem-2, Punkt A: ruckelt der Wechsel von Gebaeude A auf Gebaeude B?

   Der bisherige Uebergangstest fragt: WO ist die Figur NACHHER? Das
   Human-Video zeigt aber ein Problem WAEHREND des Uebergangs - die
   Bewegung springt sichtbar. Ein Endzustand kann richtig sein und der
   Weg dorthin trotzdem ruckeln.

   Gemessen wird deshalb Bild fuer Bild, ueber den echten Eingabeweg
   (Figur klettert wirklich, keine gesetzten Zustaende):

     koll          Kennung der Kletterflaeche  -> Flattern A/B/A/B
     nx,nz         Wandnormale                 -> Normalensprung
     pos           Ort der Figur               -> Ortssprung
     wandAbstand   Abstand zur Fassadenebene   -> Absacken/Schnappen
     Kamera        Ort und Blickrichtung       -> Kamerasprung

   Die Grenzwerte werden NICHT erfunden. Zuerst laeuft eine
   Kontrollmessung mitten auf EINER Wand; daraus ergibt sich, wie gross
   die Aenderung von Bild zu Bild im Normalfall ist. Der Uebergang wird
   dagegen gehalten.

   Aufruf:  node tools/pruef/kletterstetigkeit.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
/* "alt" misst den Stand vor der Sprungdaempfung der Kamera. */
const ALT = process.argv.indexOf('alt') > 0;

(async () => {
  const { b, page } = await starte(900, 540, SEED,
    ALT ? { kamSprungAlt: true } : {});
  const aus = await page.evaluate(async () => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const P = d.player;
    const SLAB_H = 0.25;

    const kollVon = (k) => {
      for (const c of d.colliderNah(k.x, k.z)) {
        if (c.klein || c.innen || c.parkAuto || c.dachProp) continue;
        if (Math.abs((c.x0 + c.x1) / 2 - k.x) < 0.05 &&
            Math.abs((c.z0 + c.z1) / 2 - k.z) < 0.05) return c;
      }
      return null;
    };

    /* Eine Kletterfahrt aufzeichnen. Die Figur wird EINMAL an die Wand
       gesetzt, danach laeuft alles ueber Tasten. */
    function fahrt(startX, startY, startZ, nx, nz, col, taste, bilder) {
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      d.setzePos(startX, startY, startZ);
      P.vel.set(0, 0, 0);
      P.state = 'climb';
      P.wallInfo = P.wall = { nx, nz, col };
      P.eckSperre = 0;
      d.setzeKamYaw(Math.atan2(-nx, -nz));
      /* ---- Erst einschwingen lassen ----
         Das Setzen der Figur ist selbst ein Sprung: die Kamera steht
         noch woanders und zieht nach. Im ersten Stand dieser Messung
         steckte genau das in den Zahlen - die KONTROLLE meldete 0,50 m
         Ortssprung und 6,8 m Kamerasprung je Bild, mitten auf einer
         glatten Wand, wo gar nichts passiert. Gemessen wurde das
         Teleportieren, nicht das Klettern. */
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      d.taste(taste, true);
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      const reihe = [];
      for (let i = 0; i < bilder; i++) {
        d.schritt(1 / 60);
        const k = d.kletterLage();
        const kam = d.kamera();
        reihe.push({ ...k, kam: kam.pos, blick: kam.blick,
                     kamAbst: kam.abstand, kamSteckt: kam.steckt });
      }
      d.taste(taste, false);
      return reihe;
    }

    /* Aus einer Reihe die Spruenge von Bild zu Bild ziehen. */
    function werte(reihe) {
      let posMax = 0, wandMax = 0, kamMax = 0, blickMax = 0, abstMax = 0;
      let flattern = 0, normalen = 0, wechsel = 0;
      let schlimmste = null;
      const gesehen = [];
      for (let i = 1; i < reihe.length; i++) {
        const a = reihe[i - 1], c = reihe[i];
        if (a.zustand !== 'climb' || c.zustand !== 'climb') continue;
        const dp = Math.hypot(c.pos[0] - a.pos[0], c.pos[1] - a.pos[1],
                              c.pos[2] - a.pos[2]);
        if (dp > posMax) { posMax = dp; schlimmste = { i, vor: a, nach: c,
                                                       dp: +dp.toFixed(3) }; }
        if (a.wandAbstand !== null && c.wandAbstand !== null) {
          const dw = Math.abs(c.wandAbstand - a.wandAbstand);
          if (dw > wandMax) wandMax = dw;
        }
        const dk = Math.hypot(c.kam[0] - a.kam[0], c.kam[1] - a.kam[1],
                              c.kam[2] - a.kam[2]);
        if (dk > kamMax) kamMax = dk;
        const da = Math.abs((c.kamAbst || 0) - (a.kamAbst || 0));
        if (da > abstMax) abstMax = da;
        const db = Math.hypot(c.blick[0] - a.blick[0], c.blick[1] - a.blick[1],
                              c.blick[2] - a.blick[2]);
        if (db > blickMax) blickMax = db;
        if (c.koll !== a.koll) {
          wechsel++;
          gesehen.push(c.koll);
          /* Flattern: dieselbe Flaeche kommt nach einem Wechsel zurueck. */
          if (gesehen.length >= 3 &&
              gesehen[gesehen.length - 1] === gesehen[gesehen.length - 3])
            flattern++;
        }
        if (c.nx !== a.nx || c.nz !== a.nz) normalen++;
      }
      return { bilder: reihe.length,
               posSprung: +posMax.toFixed(4), wandSprung: +wandMax.toFixed(4),
               kamSprung: +kamMax.toFixed(4), blickSprung: +blickMax.toFixed(4),
               abstSprung: +abstMax.toFixed(4),
               flaechenWechsel: wechsel, surfaceOscillation: flattern,
               normalenWechsel: normalen, schlimmste };
    }

    const kisten = d.hausKisten().filter((k) => k.h > 16);

    /* ---- Kontrolle: mitten auf EINER Wand, hoch und seitwaerts ---- */
    const kontrolle = [];
    let n = 0;
    for (const K of kisten) {
      if (n >= 6) break;
      const c = kollVon(K);
      if (!c) continue;
      const oben = SLAB_H + K.h;
      for (const taste of ['KeyW', 'KeyD']) {
        const r = fahrt(c.x1 + 0.15, oben - 12, K.z, 1, 0, c, taste, 120);
        const w = werte(r);
        if (w.bilder > 60) kontrolle.push(w);
      }
      n++;
    }

    /* ---- Uebergang: an die KANTE der Wand, dann seitwaerts weiter ----
       Dort, wo ein zweites Gebaeude anschliesst, wechselt die
       Kletterflaeche wirklich. */
    const uebergang = [];
    let m = 0;
    for (const K of kisten) {
      if (m >= 20) break;
      const c = kollVon(K);
      if (!c) continue;
      /* Steht rechts daneben ein weiteres Haus auf gleicher Hoehe? */
      let nachbar = null;
      for (const N of d.colliderNah(c.x1 + 0.6, c.z1 + 0.6)) {
        if (N === c || N.klein || N.innen || N.parkAuto || N.dachProp) continue;
        if (Math.abs(N.x0 - c.x1) > 3 && Math.abs(N.z0 - c.z1) > 3) continue;
        if ((N.h || 0) < SLAB_H + 10) continue;
        nachbar = N; break;
      }
      if (!nachbar) continue;
      const oben = SLAB_H + K.h;
      /* Kurz vor der Kante ansetzen und seitwaerts darueber. */
      const r = fahrt(c.x1 + 0.15, oben - 10, c.z1 - 1.2, 1, 0, c, 'KeyD', 150);
      const w = werte(r);
      if (w.flaechenWechsel > 0) { uebergang.push(w); m++; }
    }

    const fasse = (liste) => {
      if (!liste.length) return null;
      const max = (f) => Math.max(...liste.map((x) => x[f]));
      const sum = (f) => liste.reduce((a, x) => a + x[f], 0);
      const arg = liste.slice().sort((x, y) => y.posSprung - x.posSprung)[0];
      return { faelle: liste.length, schlimmste: arg && arg.schlimmste,
               posSprung: +max('posSprung').toFixed(4),
               wandSprung: +max('wandSprung').toFixed(4),
               kamSprung: +max('kamSprung').toFixed(4),
               blickSprung: +max('blickSprung').toFixed(4),
               abstSprung: +max('abstSprung').toFixed(4),
               flaechenWechsel: sum('flaechenWechsel'),
               surfaceOscillation: sum('surfaceOscillation'),
               normalenWechsel: sum('normalenWechsel') };
    };
    return { kontrolle: fasse(kontrolle), uebergang: fasse(uebergang) };
  });

  const zeig = (name, w) => {
    console.log('\n== ' + name + ' ==');
    if (!w) { console.log('  keine Faelle gefunden'); return; }
    console.log('  Faelle                     ' + w.faelle);
    console.log('  groesster Ortssprung       ' + w.posSprung + ' m je Bild');
    console.log('  groesster Wandabstand      ' + w.wandSprung + ' m je Bild');
    console.log('  groesster Kamerasprung     ' + w.kamSprung + ' m je Bild');
    console.log('  groesster Blicksprung      ' + w.blickSprung + ' je Bild');
    console.log('  groesster Abstandssprung   ' + w.abstSprung + ' m je Bild');
    console.log('  Flaechenwechsel            ' + w.flaechenWechsel);
    console.log('  surfaceOscillation         ' + w.surfaceOscillation);
    console.log('  Normalenwechsel            ' + w.normalenWechsel);
    if (w.schlimmste) {
      console.log('  groesster Sprung im Bild ' + w.schlimmste.i + ':');
      console.log('    vor : ' + JSON.stringify(w.schlimmste.vor));
      console.log('    nach: ' + JSON.stringify(w.schlimmste.nach));
    }
  };
  zeig('Kontrolle: mitten auf EINER Wand', aus.kontrolle);
  zeig('Uebergang: ueber die Gebaeudekante', aus.uebergang);

  if (aus.kontrolle && aus.uebergang) {
    console.log('\n== Uebergang gegen Kontrolle ==');
    const f = (a, b2) => b2 > 0 ? (a / b2).toFixed(1) + 'x' : '-';
    console.log('  Ortssprung     ' + f(aus.uebergang.posSprung, aus.kontrolle.posSprung));
    console.log('  Wandabstand    ' + f(aus.uebergang.wandSprung, aus.kontrolle.wandSprung));
    console.log('  Kamerasprung   ' + f(aus.uebergang.kamSprung, aus.kontrolle.kamSprung));
  }
  await b.close();
})();
