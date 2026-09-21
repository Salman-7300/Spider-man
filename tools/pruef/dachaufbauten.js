/* Stehen die Dachaufbauten auf dem Dach - und sind sie ueberhaupt da?

   problem-1 nennt zwei Dinge, die beide das Dach betreffen: die Figur
   steckt in Dachaufbauten, und irgendwo im Dach gibt es eine
   "Zwischenebene". Beides laesst sich an der Geometrie messen, ohne das
   Video zu kennen.

   Gemessen wird fuer jeden Klotz, der auf einem Hausdach steht:

     schwebt      Fuss ueber der Dachflaeche
     steckt       Fuss unter der Dachflaeche
     ohneHalt     kein Hindernis an seiner Stelle - die Figur laeuft
                  einfach hindurch

   deko() legt nur Geometrie in das gemeinsame Sammel-Mesh und legt KEIN
   Hindernis an; merkeTeil() ebenso wenig. Ein Dachaufbau ist damit von
   Haus aus durchlaessig, solange ihn niemand eigens eintraegt.

   Die Toleranz ist 0,15 m, weil dekoIm() die Orte auf eine Nachkomma-
   stelle rundet. Die gesuchten Fehler sind ein Vielfaches davon.

   Aufruf:  node tools/pruef/dachaufbauten.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
/* "alt" misst dieselbe Stadt OHNE die neuen Hindernisse - das Vorher zu
   problem-1 Punkt 5. "duenn-alt" laesst nur Rohre und Antennen
   durchlaessig - das Vorher zu problem-2 Punkt B. */
const ALT = process.argv.indexOf('alt') > 0;
const DUENN = process.argv.indexOf('duenn-alt') > 0;

/* ---------------------------------------------------------------------
   5A/5C: Inventar der Dachaufbauten und die harten Kennzahlen
   ------------------------------------------------------------------ */
async function inventar(page) {
  return page.evaluate(() => {
    const d = __dbg;
    const props = d.dachProps();
    const jeArt = {};
    for (const p of props) {
      const a = jeArt[p.art] || (jeArt[p.art] = {
        art: p.art, n: 0, fest: 0,
        wMin: 1e9, wMax: 0, hMin: 1e9, hMax: 0, dMin: 1e9, dMax: 0 });
      a.n++; if (p.fest) a.fest++;
      a.wMin = Math.min(a.wMin, p.w); a.wMax = Math.max(a.wMax, p.w);
      a.hMin = Math.min(a.hMin, p.h); a.hMax = Math.max(a.hMax, p.h);
      a.dMin = Math.min(a.dMin, p.d); a.dMax = Math.max(a.dMax, p.d);
    }
    /* Passt zu jedem FESTEN Aufbau auch wirklich ein Hindernis, und
       deckt es das Sichtbare? */
    let mismatch = 0, unsichtbar = 0;
    const bsp = [];
    for (const p of props) {
      const treffer = p.koll;                       // der EIGENE, kein Nachbar
      if (p.fest && !treffer) {
        mismatch++;
        if (bsp.length < 8) bsp.push({ was: 'fest ohne Hindernis', ...p });
      }
      if (!p.fest && treffer) {
        unsichtbar++;
        if (bsp.length < 8) bsp.push({ was: 'Deko MIT Hindernis', ...p });
      }
      /* Deckt das Hindernis das Sichtbare, ohne es zu ueberragen? */
      if (treffer) {
        const ueber = Math.max((treffer.x1 - treffer.x0) - p.w,
                               (treffer.z1 - treffer.z0) - p.d,
                               treffer.h - (p.y0 + p.h),
                               p.y0 - treffer.y0);
        const fehlt = Math.max(p.w - (treffer.x1 - treffer.x0),
                               p.d - (treffer.z1 - treffer.z0),
                               (p.y0 + p.h) - treffer.h);
        if (ueber > 0.12 || fehlt > 0.12) {
          mismatch++;
          if (bsp.length < 8) bsp.push({ was: 'Hindernis passt nicht zum Sichtbaren',
                                         ueber: +ueber.toFixed(2),
                                         fehlt: +fehlt.toFixed(2), ...p });
        }
      }
    }
    /* Steht ein Hindernis eines Aufbaus im NACHBARGEBAEUDE? */
    let imNachbarn = 0;
    for (const p of props) {
      if (!p.fest) continue;
      for (const c of d.colliderNah(p.x, p.z)) {
        if (c.dachProp || c.klein || c.innen || c.parkAuto) continue;
        if (c.h === undefined || c.h <= p.y0 + 0.05) continue;   // Haus darunter
        if (p.x > c.x0 + 0.05 && p.x < c.x1 - 0.05 &&
            p.z > c.z0 + 0.05 && p.z < c.z1 - 0.05 && c.h > p.y0 + 0.2) {
          imNachbarn++;
          break;
        }
      }
    }
    return { jeArt: Object.values(jeArt), gesamt: props.length,
             roofPropColliderMismatch: mismatch,
             invisibleRoofCollision: unsichtbar,
             propImNachbarhaus: imNachbarn, bsp };
  });
}

/* ---------------------------------------------------------------------
   5C dynamisch: Die Figur darf nicht IM Aufbau stecken oder darin landen
   ------------------------------------------------------------------ */
async function figurProbe(page) {
  return page.evaluate(() => {
    const d = __dbg, P = d.player;
    /* Ausgewaehlt wird nach der GEOMETRIE, nicht nach dem Hindernis:
       im Vergleichslauf hat keiner der Aufbauten eines, und die Probe
       haette sonst null Stichproben. So ist es in beiden Laeufen
       dieselbe Auswahl. */
    const props = d.dachProps().filter((p) => Math.max(p.w, p.d) >= 0.6);
    /* Ueber die ganze Liste verteilt, damit nicht nur ein Haus
       geprueft wird. */
    const schritt = Math.max(1, Math.floor(props.length / 60));
    const proben = [];
    for (let i = 0; i < props.length && proben.length < 60; i += schritt)
      proben.push(props[i]);

    const drin = (x, y, z, k) =>
      x > k.x0 + 0.02 && x < k.x1 - 0.02 &&
      z > k.z0 + 0.02 && z < k.z1 - 0.02 &&
      y > k.y0 + 0.02 && y < k.h - 0.02;

    let laufenRein = 0, landenRein = 0, obenGelandet = 0, danebenGefallen = 0;
    const bsp = [];
    for (const p of proben) {
      /* Die Kiste aus dem SICHTBAREN, damit beide Laeufe dieselbe
         Frage stellen: steckt die Figur in dem, was man sieht? */
      const k = { x0: p.x - p.w / 2, x1: p.x + p.w / 2,
                  z0: p.z - p.d / 2, z1: p.z + p.d / 2,
                  y0: p.y0, h: p.y0 + p.h };
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);

      /* 1. Von der Seite dagegenlaufen. Start drei Meter vor der Mitte,
            auf Dachhoehe, Blick auf den Aufbau. */
      d.setzePos(p.x - (p.w / 2 + 3), p.y0 + 0.1, p.z);
      P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true;
      P.facing = Math.PI / 2;
      d.setzeKamYaw(-Math.PI / 2);
      d.taste('KeyW', true);
      for (let i = 0; i < 150; i++) d.schritt(1 / 60);
      d.taste('KeyW', false);
      /* Die Huefte liegt rund einen Meter ueber den Fuessen. */
      if (drin(P.pos.x, P.pos.y + 0.9, P.pos.z, k)) {
        laufenRein++;
        if (bsp.length < 8) bsp.push({ was: 'hineingelaufen', art: p.art,
                                       x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2),
                                       z: +P.pos.z.toFixed(2) });
      }

      /* 2. Von oben daraufplumpsen. */
      d.setzePos(p.x, p.y0 + p.h + 4, p.z);
      P.vel.set(0, 0, 0); P.state = 'air'; P.onGround = false;
      for (let i = 0; i < 180; i++) d.schritt(1 / 60);
      if (drin(P.pos.x, P.pos.y + 0.9, P.pos.z, k)) {
        landenRein++;
        if (bsp.length < 8) bsp.push({ was: 'hineingefallen', art: p.art,
                                       x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2),
                                       z: +P.pos.z.toFixed(2) });
      } else if (Math.abs(P.pos.y - k.h) < 0.25) obenGelandet++;
      else danebenGefallen++;
    }
    return { proben: proben.length, playerInsideRoofProp: laufenRein,
             landingInsideRoofProp: landenRein, obenGelandet, danebenGefallen, bsp };
  });
}

/* ---------------------------------------------------------------------
   problem-2, Punkt B: MIT DEM KOERPER hindurch, ueber den ganzen Weg
   ------------------------------------------------------------------ */
/* Was der bisherige Stand NICHT gemessen hat, und warum der
   Human-Befund trotzdem stimmt:

   1. figurProbe() waehlt nur Aufbauten ab 0,60 m Breite aus - also
      genau die, die ein Hindernis bekommen haben. Rohre (0,35 m) und
      Antennen (0,22 m) sind absichtlich ohne Hindernis und wurden
      deshalb nie angelaufen. Das sind 1518 der 4612 Aufbauten.
   2. Geprueft wurde nur die ENDLAGE. Wer durch einen Aufbau
      hindurchlaeuft, steht am Ende dahinter - und faellt nicht auf.
   3. Geprueft wurde ein PUNKT auf Huefthoehe, kein Koerper. Das Video
      zeigt einen Kasten, der die Figur auf Huefthoehe schneidet; dabei
      steckt nicht die Mitte im Kasten, sondern die Schulter.

   Hier laeuft die Figur deshalb ueber den ganzen Weg, Bild fuer Bild,
   und gemessen wird der KOERPER: Kapsel (Radius 0,45 m), Becken und
   Brust. */
async function durchlauf(page) {
  return page.evaluate(() => {
    const d = __dbg, P = d.player;
    const props = d.dachProps();
    /* Gleichmaessig ueber alle Arten, damit duenne und dicke Aufbauten
       beide vorkommen - und mindestens hundert Begegnungen. */
    const jeArt = new Map();
    for (const p of props) {
      if (!jeArt.has(p.art)) jeArt.set(p.art, []);
      jeArt.get(p.art).push(p);
    }
    const proben = [];
    for (const [art, liste] of jeArt) {
      const schritt = Math.max(1, Math.floor(liste.length / 20));
      for (let i = 0; i < liste.length && proben.length < 200; i += schritt)
        proben.push(liste[i]);
    }

    const kiste = (p) => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2,
                            z0: p.z - p.d / 2, z1: p.z + p.d / 2,
                            y0: p.y0, h: p.y0 + p.h });
    /* Liegt ein Punkt im Kasten? Mit kleiner Toleranz, weil dekoIm()
       die Orte auf eine Nachkommastelle rundet. */
    const punktDrin = (x, y, z, k) =>
      x > k.x0 + 0.02 && x < k.x1 - 0.02 && z > k.z0 + 0.02 && z < k.z1 - 0.02 &&
      y > k.y0 + 0.02 && y < k.h - 0.02;
    /* Und die KAPSEL? Gefragt wird nach der EINDRINGTIEFE, nicht nach
       einer Beruehrung: wer korrekt vor einem Hindernis steht, steht
       genau einen Koerperradius davor, und das ist kein Fehler. Erst
       wenn der Koerper mehr als 0,10 m tiefer im Sichtbaren steckt,
       zaehlt es. Sonst meldete die Messung jedes richtig aufgehaltene
       Hindernis als Fehler. */
    const R = P.radius === undefined ? 0.45 : P.radius;
    const KAPSEL_TIEFE = 0.10;
    const kapselTiefe = (x, y, z, k) => {
      if (y + 1.8 <= k.y0 + 0.02 || y >= k.h - 0.02) return 0;
      const dx = Math.max(k.x0 - x, 0, x - k.x1);
      const dz = Math.max(k.z0 - z, 0, z - k.z1);
      const ab = Math.sqrt(dx * dx + dz * dz);
      return Math.max(0, R - ab);
    };

    let kapsel = 0, becken = 0, brust = 0, begegnet = 0, durch = 0;
    const jeArtZahl = {};
    const bsp = [], bspFest = [];
    for (const p of proben) {
      const k = kiste(p);
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      /* Drei Meter davor los, quer durch die Mitte und drei Meter
         dahinter wieder heraus. */
      d.setzePos(p.x - (p.w / 2 + 3), p.y0 + 0.1, p.z);
      P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true;
      P.facing = Math.PI / 2;
      d.setzeKamYaw(-Math.PI / 2);
      d.taste('KeyW', true);
      let tiefe = 0, hatBecken = false, hatBrust = false;
      let start = P.pos.x;
      for (let i = 0; i < 220; i++) {
        d.schritt(1 / 60);
        const x = P.pos.x, y = P.pos.y, z = P.pos.z;
        tiefe = Math.max(tiefe, kapselTiefe(x, y, z, k));
        if (punktDrin(x, y + 0.9, z, k)) hatBecken = true;
        if (punktDrin(x, y + 1.3, z, k)) hatBrust = true;
      }
      const hatKapsel = tiefe > KAPSEL_TIEFE;
      d.taste('KeyW', false);
      begegnet++;
      const a = jeArtZahl[p.art] || (jeArtZahl[p.art] = { n: 0, kapsel: 0, durch: 0,
                                                         tiefste: 0 });
      a.n++;
      a.tiefste = Math.max(a.tiefste, +tiefe.toFixed(2));
      if (hatKapsel) { kapsel++; a.kapsel++; }
      if (hatBecken) becken++;
      if (hatBrust) brust++;
      /* Ganz hindurch: hinter dem Aufbau angekommen, obwohl er im Weg
         stand. */
      if (P.pos.x > k.x1 + 0.1 && start < k.x0) { durch++; a.durch++; }
      /* Getrennte Beispiele: die FESTEN Aufbauten sind der
         ueberraschende Fall - dort steht ein Hindernis und der Koerper
         steckt trotzdem drin. */
      if (hatKapsel && p.fest && bspFest.length < 8)
        bspFest.push({ art: p.art, w: p.w, d: p.d, h: p.h, y0: p.y0,
                       x: p.x, z: p.z, tiefe: +tiefe.toFixed(2),
                       koll: p.koll ? 1 : 0,
                       endeX: +P.pos.x.toFixed(2), endeY: +P.pos.y.toFixed(2),
                       endeZ: +P.pos.z.toFixed(2),
                       becken: hatBecken, brust: hatBrust });
      if (hatKapsel && bsp.length < 8)
        bsp.push({ art: p.art, w: p.w, d: p.d, h: p.h, fest: p.fest,
                   x: p.x, z: p.z, tiefe: +tiefe.toFixed(2),
                   endeX: +P.pos.x.toFixed(2), becken: hatBecken, brust: hatBrust });
    }
    return { begegnet, playerCapsuleInsideRoofProp: kapsel,
             pelvisInsideRoofProp: becken, torsoInsideRoofProp: brust,
             durchgelaufen: durch, jeArt: jeArtZahl, bsp, bspFest };
  });
}

(async () => {
  const { b, page } = await starte(800, 480, SEED,
    ALT ? { dachAlt: true } : DUENN ? { duennAlt: true } : {});
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const SLAB_H = 0.25, TOL = 0.15;
    const kisten = d.hausKisten();
    let klotz = 0, schwebt = 0, steckt = 0, ohneHalt = 0;
    let hoechsteLuft = 0, tiefstesStecken = 0;
    const bsp = [];
    /* Nur eine Stichprobe von Daechern - alle 617 abzufragen dauert, und
       der Fehler ist keine Frage der Menge. Jedes zwoelfte Haus. */
    for (let i = 0; i < kisten.length; i += 12) {
      const K = kisten[i];
      const dach = SLAB_H + K.h;
      /* Das Gesims reicht 0,55 m unter die Dachflaeche - es wird nicht
         mitgezaehlt, es IST das Dach. */
      /* Der Suchquader war einen Meter groesser als das Haus und zwoelf
         Meter hoch. Damit fing er die Dachaufbauten des NACHBARN mit,
         wenn der hoeher ist - der erste Stand meldete daraufhin eine
         "hoechste Luft" von 11,11 m, und das war der Nachbar, nicht ein
         schwebender Klotz. Jetzt genau die Grundflaeche des Hauses, und
         nur bis sechs Meter ueber das Dach: hoeher ist kein Aufbau mehr,
         sondern ein anderes Haus. */
      const teile = d.dekoIm(K.x - K.w / 2, K.x + K.w / 2,
                             dach + 0.02, dach + 6,
                             K.z - K.d / 2, K.z + K.d / 2, 0);
      for (const [tw, th, td, tx, ty, tz] of teile) {
        /* Das Gesims ist breiter als das Haus - es steht rundum vor. */
        if (tw > K.w || td > K.d) continue;
        klotz++;
        const fuss = ty - th / 2;
        const luft = fuss - dach;
        if (luft > TOL) {
          schwebt++;
          if (luft > hoechsteLuft) hoechsteLuft = luft;
          if (bsp.length < 12) bsp.push({ was: 'schwebt', x: tx, z: tz,
                                          hoch: +th.toFixed(2), luft: +luft.toFixed(2) });
        } else if (luft < -TOL) {
          steckt++;
          if (-luft > tiefstesStecken) tiefstesStecken = -luft;
          if (bsp.length < 12) bsp.push({ was: 'steckt', x: tx, z: tz,
                                          hoch: +th.toFixed(2), tief: +(-luft).toFixed(2) });
        }
        /* Haelt an dieser Stelle irgendetwas die Figur auf? Gefragt wird
           auf halber Klotzhoehe, also genau dort, wo sie hineinlaufen
           wuerde. */
        const yM = ty;
        let halt = false;
        for (const c of d.colliderNah(tx, tz)) {
          if (c.parkAuto) continue;
          const y0 = c.y0 === undefined ? -1e9 : c.y0;
          if (tx > c.x0 && tx < c.x1 && tz > c.z0 && tz < c.z1 &&
              yM > y0 && yM < c.h) { halt = true; break; }
        }
        if (!halt) {
          ohneHalt++;
          if (bsp.length < 12) bsp.push({ was: 'ohneHalt', x: tx, z: tz,
                                          hoch: +th.toFixed(2) });
        }
      }
    }
    return { daecher: Math.ceil(kisten.length / 12), klotz, schwebt, steckt, ohneHalt,
             hoechsteLuft: +hoechsteLuft.toFixed(2),
             tiefstesStecken: +tiefstesStecken.toFixed(2), bsp };
  });

  console.log('\n== Dachaufbauten ==');
  console.log('  Daecher in der Stichprobe   ' + aus.daecher);
  console.log('  Kloetze darauf              ' + aus.klotz);
  console.log('  schwebt                     ' + aus.schwebt +
              '   hoechste Luft ' + aus.hoechsteLuft + ' m');
  console.log('  steckt                      ' + aus.steckt +
              '   tiefstes Stecken ' + aus.tiefstesStecken + ' m');
  console.log('  ohne Hindernis              ' + aus.ohneHalt);
  if (aus.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of aus.bsp) console.log('    ' + JSON.stringify(e));
  }
  const fehler = aus.schwebt + aus.steckt;
  console.log('\n  ' + fehler + ' Beanstandungen (Sitz auf dem Dach)');
  /* ohneHalt zaehlt ueber die Deko-Geometrie und kennt die Einstufung
     nicht - Rohre und Antennen sind dort ABSICHTLICH ohne Hindernis.
     Die belastbare Zahl steht unter 5C. */

  const inv = await inventar(page);
  console.log('\n== 5A: Inventar der Dachaufbauten ==');
  console.log('  Art                 Anzahl    fest   Breite         Hoehe');
  inv.jeArt.sort((p, q) => q.n - p.n);
  for (const a of inv.jeArt)
    console.log('  ' + a.art.padEnd(20) + String(a.n).padStart(6) +
                String(a.fest).padStart(8) + '   ' +
                (a.wMin.toFixed(2) + '-' + a.wMax.toFixed(2)).padEnd(14) +
                a.hMin.toFixed(2) + '-' + a.hMax.toFixed(2));
  console.log('  ' + inv.gesamt + ' Aufbauten insgesamt');

  console.log('\n== 5C: harte Kennzahlen ==');
  console.log('  roofPropColliderMismatch   ' + inv.roofPropColliderMismatch);
  console.log('  invisibleRoofCollision     ' + inv.invisibleRoofCollision);
  console.log('  propImNachbarhaus          ' + inv.propImNachbarhaus);
  if (inv.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of inv.bsp) console.log('    ' + JSON.stringify(e));
  }
  const fp = await figurProbe(page);
  console.log('\n== 5C: die Figur am Aufbau (' + fp.proben + ' Stichproben) ==');
  console.log('  playerInsideRoofProp       ' + fp.playerInsideRoofProp);
  console.log('  landingInsideRoofProp      ' + fp.landingInsideRoofProp);
  console.log('  davon oben gelandet        ' + fp.obenGelandet);
  console.log('  davon daneben gefallen     ' + fp.danebenGefallen);
  if (fp.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of fp.bsp) console.log('    ' + JSON.stringify(e));
  }

  const dl = await durchlauf(page);
  console.log('\n== Punkt B: mit dem Koerper hindurch (' + dl.begegnet +
              ' Begegnungen) ==');
  console.log('  playerCapsuleInsideRoofProp ' + dl.playerCapsuleInsideRoofProp);
  console.log('  pelvisInsideRoofProp        ' + dl.pelvisInsideRoofProp);
  console.log('  torsoInsideRoofProp         ' + dl.torsoInsideRoofProp);
  console.log('  ganz hindurchgelaufen       ' + dl.durchgelaufen);
  console.log('  Art                 Anlaeufe  Kapsel drin  hindurch  tiefste');
  for (const [art, a] of Object.entries(dl.jeArt))
    console.log('  ' + art.padEnd(20) + String(a.n).padStart(8) +
                String(a.kapsel).padStart(13) + String(a.durch).padStart(10) +
                (a.tiefste.toFixed(2) + ' m').padStart(9));
  if (dl.bspFest.length) {
    console.log('\n  Beispiele MIT Hindernis (der ueberraschende Fall):');
    for (const e of dl.bspFest) console.log('    ' + JSON.stringify(e));
  }
  if (dl.bsp.length) {
    console.log('\n  Beispiele:');
    for (const e of dl.bsp) console.log('    ' + JSON.stringify(e));
  }

  const hart = inv.roofPropColliderMismatch + inv.invisibleRoofCollision +
               inv.propImNachbarhaus + fp.playerInsideRoofProp +
               fp.landingInsideRoofProp + dl.playerCapsuleInsideRoofProp;
  await b.close();
  process.exitCode = (fehler + hart) ? 1 : 0;
})();
