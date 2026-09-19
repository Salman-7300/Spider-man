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
/* "alt" misst dieselbe Stadt OHNE die neuen Hindernisse - das Vorher. */
const ALT = process.argv.indexOf('alt') > 0;

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

(async () => {
  const { b, page } = await starte(800, 480, SEED, ALT ? { dachAlt: true } : {});
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

  const hart = inv.roofPropColliderMismatch + inv.invisibleRoofCollision +
               inv.propImNachbarhaus + fp.playerInsideRoofProp +
               fp.landingInsideRoofProp;
  await b.close();
  process.exitCode = (fehler + hart) ? 1 : 0;
})();
