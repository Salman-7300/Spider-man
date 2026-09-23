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
/* "alt" misst den Stand vor der Korrektur des Strahlanfangs
   (problem-2, Punkt A.1). */
const ALT = process.argv.indexOf('alt') > 0;
/* Vergleichslauf ohne die Tiefenkarte der sichtbaren Fassade. */
const FASS_ALT = process.argv.indexOf('fassAlt') > 0;

(async () => {
  const { b, page } = await starte(900, 540, SEED,
    Object.assign({}, ALT ? { kamEngAlt: true } : {},
                  FASS_ALT ? { fassAlt: true } : {}));
  const aus = await page.evaluate(async () => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const P = d.player;
    const SLAB_H = 0.25;

    /* ---- Nur FREIE Schauseiten beklettern ----
       Der erste Stand hat einfach die Ostwand genommen. In einer
       Haeuserzeile ist die aber oft im Nachbarn vergraben: gemessen
       stand die Figur dort in 598 Bildern "im Gebaeude", weil Kollider
       32 bei x1 = -305,335 endet und Kollider 49 bei x0 = -305,33
       beginnt. Sie kletterte also in der Fuge zwischen zwei buendigen
       Haeusern - ein Fehler der Auswahl, kein Fehler des Spiels. */
    /* lx/lz: die Stelle LAENGS der Wand, an der wirklich gestartet
       wird. Ohne sie wurde in der Flaechenmitte geprueft - und eine
       Wand kann in der Mitte frei sein und an ihrem Ende im Nachbarn
       stecken. Genau daher kamen die angeblichen Faelle "Figur im
       Gebaeude" (problem-2, Punkt A.2). */
    const freieSeite = (c, y, lx, lz) => {
      const seiten = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [nx, nz] of seiten) {
        const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 1.0
                            : (lx === undefined ? (c.x0 + c.x1) / 2 : lx);
        const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 1.0
                            : (lz === undefined ? (c.z0 + c.z1) / 2 : lz);
        let frei = true;
        for (const n of d.colliderNah(px, pz)) {
          if (n === c || n.klein || n.innen || n.parkAuto || n.dachProp) continue;
          const y0 = n.y0 === undefined ? -1e9 : n.y0;
          if (px > n.x0 && px < n.x1 && pz > n.z0 && pz < n.z1 &&
              y > y0 && y < (n.h || 0)) { frei = false; break; }
        }
        if (frei) return { nx, nz };
      }
      return null;
    };
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
        if (k.imHaus && k.drinWer) {
          drinGes.gesamt++;
          if (k.imBogen) drinGes.imBogen++;
          if (drinRoh.length < 4)
            drinRoh.push({ pos: k.pos, aufKoll: k.koll, imBogen: !!k.imBogen,
                           drin: k.drinWer });
        }
        const kam = d.kamera();
        reihe.push({ ...k, kam: kam.pos, blick: kam.blick,
                     kamAbst: kam.abstand, kamSteckt: kam.steckt,
                     block: d.kamBlock() });
      }
      d.taste(taste, false);
      return reihe;
    }

    /* Aus einer Reihe die Spruenge von Bild zu Bild ziehen. */
    function werte(reihe) {
      let posMax = 0, wandMax = 0, kamMax = 0, blickMax = 0, abstMax = 0;
      let flattern = 0, normalen = 0, wechsel = 0, imHaus = 0, kamDrin = 0;
      /* Getrennt nach Ursache: die eigene Dachkrone ragt aus der
         bekletterten Fassade heraus, das Nachbarhaus steht davor. */
      let imEigenen = 0, imFremden = 0;
      /* Der Human-Befund ist "die Kamera klebt an der Figur". Das ist
         genau der Fall, in dem der freie Anteil auf null faellt. Er
         wird nach der Ursache getrennt gezaehlt:
           frei    der Blickpunkt steht neben dem Hindernis - das ist
                   der Kamerafehler und muss null werden
           imHaus  der Blickpunkt steckt IM Hindernis - dann ist schon
                   die Figur im Gebaeude, ein anderer Fehler
           Boden   Strasse oder Dach unter der Kamera */
      let zuFrei = 0, zuImHaus = 0, zuBoden = 0;
      let zuFreiBsp = null;
      let drinBsp = null;
      let schlimmste = null, schlimmsteKam = null;
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
        if (dk > kamMax) { kamMax = dk; schlimmsteKam = { i, vor: a, nach: c,
                                                         dk: +dk.toFixed(3) }; }
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
        if (c.kamSteckt) kamDrin++;
        if (c.block && c.block.geklemmt <= 0.001) {
          if (!c.block.blocker) zuBoden++;
          else if (c.block.blocker.luft > 0) {
            zuFrei++;
            if (!zuFreiBsp) zuFreiBsp = { i, pos: c.pos, koll: c.koll,
                                          nx: c.nx, nz: c.nz, block: c.block };
          }
          else zuImHaus++;
        }
        if (c.imHaus && c.drinWer) {
          if (c.drinWer.krone || c.drinWer.eigene) imEigenen++; else imFremden++;
        }
        if (c.imHaus) { imHaus++; if (!drinBsp) drinBsp = { pos: c.pos, koll: c.koll,
                                                           wer: c.drinWer }; }
      }
      return { bilder: reihe.length,
               posSprung: +posMax.toFixed(4), wandSprung: +wandMax.toFixed(4),
               kamSprung: +kamMax.toFixed(4), blickSprung: +blickMax.toFixed(4),
               abstSprung: +abstMax.toFixed(4),
               flaechenWechsel: wechsel, surfaceOscillation: flattern,
               normalenWechsel: normalen, playerInsideBuilding: imHaus,
               kameraImHindernis: kamDrin,
               imEigenen, imFremden,
               kameraZuFrei: zuFrei, kameraZuImHaus: zuImHaus,
               kameraZuBoden: zuBoden, zuFreiBsp,
               schlimmste, schlimmsteKam };
    }

    const drinRoh = [];
    const drinGes = { gesamt: 0, imBogen: 0 };
    const clamp = (v, a, b2) => Math.max(a, Math.min(b2, v));
    const kisten = d.hausKisten().filter((k) => k.h > 16);

    /* ---- Kontrolle: mitten auf EINER Wand, hoch und seitwaerts ---- */
    const kontrolle = [];
    let n = 0;
    for (const K of kisten) {
      if (n >= 6) break;
      const c = kollVon(K);
      if (!c) continue;
      const oben = SLAB_H + K.h;
      const S = freieSeite(c, oben - 12);
      if (!S) continue;
      const sx0 = S.nx !== 0 ? (S.nx > 0 ? c.x1 : c.x0) + S.nx * 0.15 : (c.x0 + c.x1) / 2;
      const sz0 = S.nz !== 0 ? (S.nz > 0 ? c.z1 : c.z0) + S.nz * 0.15 : (c.z0 + c.z1) / 2;
      for (const taste of ['KeyW', 'KeyD']) {
        const r = fahrt(sx0, oben - 12, sz0, S.nx, S.nz, c, taste, 120);
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
      /* Kurz vor der Kante ansetzen und seitwaerts darueber. Geprueft
         wird die Schauseite an GENAU DIESER Stelle, nicht in ihrer
         Mitte. */
      const kx = clamp(c.x1 - 1.2, c.x0 + 0.5, c.x1 - 0.5);
      const kz = clamp(c.z1 - 1.2, c.z0 + 0.5, c.z1 - 0.5);
      const S2 = freieSeite(c, oben - 10, kx, kz);
      if (!S2) continue;
      const ux = S2.nx !== 0 ? (S2.nx > 0 ? c.x1 : c.x0) + S2.nx * 0.15 : kx;
      const uz = S2.nz !== 0 ? (S2.nz > 0 ? c.z1 : c.z0) + S2.nz * 0.15 : kz;
      const r = fahrt(ux, oben - 10, uz, S2.nx, S2.nz, c, 'KeyD', 150);
      const w = werte(r);
      if (w.flaechenWechsel > 0) { uebergang.push(w); m++; }
    }

    const fasse = (liste) => {
      if (!liste.length) return null;
      const max = (f) => Math.max(...liste.map((x) => x[f]));
      const sum = (f) => liste.reduce((a, x) => a + x[f], 0);
      const arg = liste.slice().sort((x, y) => y.posSprung - x.posSprung)[0];
      const argK = liste.slice().sort((x, y) => y.kamSprung - x.kamSprung)[0];
      return { faelle: liste.length, schlimmste: arg && arg.schlimmste,
               schlimmsteKam: argK && argK.schlimmsteKam,
               posSprung: +max('posSprung').toFixed(4),
               wandSprung: +max('wandSprung').toFixed(4),
               kamSprung: +max('kamSprung').toFixed(4),
               blickSprung: +max('blickSprung').toFixed(4),
               abstSprung: +max('abstSprung').toFixed(4),
               flaechenWechsel: sum('flaechenWechsel'),
               surfaceOscillation: sum('surfaceOscillation'),
               normalenWechsel: sum('normalenWechsel'),
               playerInsideBuilding: sum('playerInsideBuilding'),
               kameraImHindernis: sum('kameraImHindernis'),
               imEigenen: sum('imEigenen'), imFremden: sum('imFremden'),
               kameraZuFrei: sum('kameraZuFrei'),
               kameraZuImHaus: sum('kameraZuImHaus'),
               kameraZuBoden: sum('kameraZuBoden'),
               zuFreiBsp: (liste.find((x) => x.zuFreiBsp) || {}).zuFreiBsp,
               drinBsp: (liste.find((x) => x.drinBsp) || {}).drinBsp };
    };
    return { kontrolle: fasse(kontrolle), uebergang: fasse(uebergang), drinRoh, drinGes };
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
    console.log('  playerInsideBuilding       ' + w.playerInsideBuilding);
    console.log('    davon eigene Dachkrone   ' + w.imEigenen);
    console.log('    davon Nachbargebaeude    ' + w.imFremden);
    console.log('  Kamera in einem Hindernis  ' + w.kameraImHindernis);
    console.log('  Kamera klebt, Punkt frei   ' + w.kameraZuFrei);
    console.log('  Kamera klebt, Punkt im Haus' + w.kameraZuImHaus);
    console.log('  Kamera klebt, Boden im Weg ' + w.kameraZuBoden);
    if (w.zuFreiBsp) console.log('    Beispiel: ' + JSON.stringify(w.zuFreiBsp));
    if (w.drinBsp) console.log('    Beispiel: ' + JSON.stringify(w.drinBsp));
    if (w.schlimmsteKam) {
      console.log('  groesster KAMERAsprung im Bild ' + w.schlimmsteKam.i + ':');
      const kurz = (e) => ({ pos: e.pos, nx: e.nx, nz: e.nz, koll: e.koll,
                             kam: e.kam, kamAbst: e.kamAbst, block: e.block });
      console.log('    vor : ' + JSON.stringify(kurz(w.schlimmsteKam.vor)));
      console.log('    nach: ' + JSON.stringify(kurz(w.schlimmsteKam.nach)));
    }
    if (w.schlimmste) {
      console.log('  groesster Sprung im Bild ' + w.schlimmste.i + ':');
      console.log('    vor : ' + JSON.stringify(w.schlimmste.vor));
      console.log('    nach: ' + JSON.stringify(w.schlimmste.nach));
    }
  };
  if (aus.drinGes) console.log('\n  im Haus gesamt ' + aus.drinGes.gesamt +
      ', davon waehrend des Eckbogens ' + aus.drinGes.imBogen);
  if (aus.drinRoh && aus.drinRoh.length) {
    console.log('\n== Wo steckt die Figur angeblich? ==');
    for (const e of aus.drinRoh) console.log('  ' + JSON.stringify(e));
  }
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
