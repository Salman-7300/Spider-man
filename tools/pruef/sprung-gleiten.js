/* Teil 8: Sprung, Doppelsprung, freier Fall und Gleiten.
   Alles aus der Bewegung selbst gemessen, nicht aus dem Code gelesen:
   Sprunghoehen aus Stand, Lauf und Sprint, was der zweite Sprung noch
   bringt, wie schnell die Figur im freien Fall sinkt und wie weit das
   Gleiten traegt (Gleitzahl: Weg nach vorn je Meter Hoehenverlust).

   Aufruf:  node sprung-gleiten.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;

    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyX','KeyZ'])
                              d.taste(t, false); };
    /* Freie, ebene Strasse ohne Verkehr. */
    const aufDieStrasse = () => {
      alleAus();
      d.setzePos(-120, 0, -25);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      for (let i = 0; i < 60; i++) d.schritt(1 / 60);
    };

    /* ---- 1. Sprunghoehen ----
       Der zweite Sprung wird UEBER DEM FLUSS gemessen. Auf der Strasse
       findet die Leertaste in der Luft immer einen Anker, und dann ist
       sie der Netzschwung - der Doppelsprung ist ausdruecklich nur der
       Rueckfall, wenn kein Haus in Reichweite ist. Im ersten Anlauf kamen
       dadurch fuer alle drei Sprungarten 0,02 m heraus: es war gar kein
       Sprung, sondern ein beginnender Schwung. */
    const spruenge = [];
    for (const [name, vorlauf, tasten] of [
      ['Stand', 0, []], ['Lauf', 150, ['KeyW']], ['Sprint', 240, ['KeyW', 'ShiftLeft']]]) {
      aufDieStrasse();
      for (const t of tasten) d.taste(t, true);
      for (let i = 0; i < vorlauf; i++) d.schritt(1 / 60);
      const y0 = P.pos.y, x0 = P.pos.x, z0 = P.pos.z;
      const tempo = Math.hypot(P.vel.x, P.vel.z);
      d.tippeSprung();
      let hoch = y0, zweit = null, weit = 0, t = 0;
      let zweitGemacht = false;
      for (let i = 0; i < 60 * 5; i++) {
        d.schritt(1 / 60); t += 1 / 60;
        hoch = Math.max(hoch, P.pos.y);
        /* Der zweite Sprung am Scheitel - hier nicht, siehe unten. */
        if (false && !zweitGemacht && P.vel.y < 0 && !P.onGround) {
          zweitGemacht = true; const vorher = P.pos.y;
          d.tippeSprung();
          for (let k = 0; k < 60 * 3; k++) { d.schritt(1 / 60); zweit = Math.max(zweit || 0, P.pos.y); }
          zweit = +(zweit - vorher).toFixed(2);
          break;
        }
        if (P.onGround && t > 0.3) break;
      }
      weit = Math.hypot(P.pos.x - x0, P.pos.z - z0);
      alleAus();
      spruenge.push({ art: name, tempo: +tempo.toFixed(1),
        hoehe: +(hoch - y0).toFixed(2), zweiterSprung: zweit,
        weite: +weit.toFixed(1) });
    }

    /* ---- 1b. Der zweite Sprung, ueber dem Fluss ---- */
    const doppel = [];
    for (const [name, hoehe] of [['aus 30 m', 30], ['aus 60 m', 60]]) {
      alleAus();
      d.setzePos(260, hoehe, 100);       // mitten ueber dem Fluss
      P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
      P.jumps = 1;
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      const vorher = P.pos.y, vVorher = P.vel.y;
      const anker = !!d.findAnchor();
      d.tippeSprung();
      const vNachher = P.vel.y;
      let hoechste = P.pos.y;
      for (let i = 0; i < 90; i++) { d.schritt(1 / 60); hoechste = Math.max(hoechste, P.pos.y); }
      doppel.push({ art: name, ankerDa: anker, jumps: P.jumps,
        vVorher: +vVorher.toFixed(1), vNachher: +vNachher.toFixed(1),
        gewinn: +(hoechste - vorher).toFixed(2), zustand: P.state });
    }

    /* ---- 2. Freier Fall: Sinkgeschwindigkeit ---- */
    alleAus();
    d.setzePos(-120, 140, -25); P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
    let fallMax = 0;
    for (let i = 0; i < 60 * 6; i++) { d.schritt(1 / 60); fallMax = Math.min(fallMax, P.vel.y); }
    const fall = { sinken: +(-fallMax).toFixed(1), zustand: P.state, gleitet: !!P.gleiten };

    /* ---- 2b. Faengt ein duenner Boden den schnellen Fall? ----
       Bei 30 m/s^2 und ohne Endgeschwindigkeit legt die Figur im letzten
       Bild vor dem Aufschlag ueber anderthalb Meter zurueck. Ein 0,6 m
       dickes Brueckendeck oder ein Dach koennte sie durchschlagen. */
    const boeden = [];
    for (const [name, x, z, hoehe] of [
      ['Brueckendeck', 255, -25, 140],
      ['Dach (hoechstes Haus)', null, null, 60],   // Hoehe wird unten aufs Dach gelegt
      ['Strasse', -120, -25, 140],
      ['Uferpromenade', 186, 5, 140],
    ]) {
      let px = x, pz = z, dach = null;
      if (px === null) {
        let h = null;
        for (const c of d.colliders) {
          if (!c.h || c.h < 40 || c.klein) continue;
          if ((c.x1 - c.x0) < 12 || (c.z1 - c.z0) < 12) continue;
          if (!h || c.h > h.h) h = c;
        }
        px = (h.x0 + h.x1) / 2; pz = (h.z0 + h.z1) / 2; dach = h.h;
      }
      alleAus();
      /* groundY kennt keine Daecher - fuer das Dach zaehlt die Oberkante
         des Kolliders. Im ersten Anlauf fiel die Figur deshalb INNEN durch
         das Haus bis auf den Gehweg. */
      const grund = dach !== null ? dach : d.groundYAt(px, pz);
      d.setzePos(px, grund + hoehe, pz);
      P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
      let vMax = 0, tiefste = P.pos.y;
      for (let i = 0; i < 60 * 12; i++) {
        d.schritt(1 / 60);
        vMax = Math.min(vMax, P.vel.y);
        tiefste = Math.min(tiefste, P.pos.y);
        if (P.onGround) break;
      }
      boeden.push({ ort: name, sollBoden: +grund.toFixed(2),
        gelandetAuf: +P.pos.y.toFixed(2), tiefste: +tiefste.toFixed(2),
        aufprall: +(-vMax).toFixed(1), zustand: P.state,
        durchgefallen: P.pos.y < grund - 0.5 });
    }

    /* ---- 3. Gleiten: Gleitzahl ---- */
    const gleitReihe = [];
    for (const [name, tasten] of [['gerade', ['ShiftLeft']],
                                  ['Nase runter', ['ShiftLeft', 'KeyW']]]) {
      alleAus();
      d.setzePos(-160, 150, -25); P.state = 'air'; P.onGround = false;
      P.vel.set(12, 0, 0); P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);      // Scheitel abwarten
      for (const t of tasten) d.taste(t, true);
      let anT = 0;
      const y0 = P.pos.y, x0 = P.pos.x, z0 = P.pos.z;
      let sinkMax = 0, tempoMax = 0;
      for (let i = 0; i < 60 * 12; i++) {
        d.schritt(1 / 60);
        if (P.gleiten) anT++;
        sinkMax = Math.min(sinkMax, P.vel.y);
        tempoMax = Math.max(tempoMax, Math.hypot(P.vel.x, P.vel.z));
        if (P.onGround) break;
      }
      const dh = y0 - P.pos.y;
      const dw = Math.hypot(P.pos.x - x0, P.pos.z - z0);
      alleAus();
      gleitReihe.push({ art: name, gleitBilder: anT,
        hoehenverlust: +dh.toFixed(1), weite: +dw.toFixed(1),
        gleitzahl: dh > 0.5 ? +(dw / dh).toFixed(2) : null,
        sinken: +(-sinkMax).toFixed(1), tempo: +tempoMax.toFixed(1) });
    }

    /* ---- 4. Uebergaenge: welcher Clip laeuft wann ---- */
    alleAus();
    d.setzePos(-120, 60, -25); P.state = 'air'; P.onGround = false; P.vel.set(8, 0, 0);
    const kette = [];
    let letzter = null;
    d.taste('ShiftLeft', true);
    for (let i = 0; i < 60 * 10; i++) {
      d.schritt(1 / 60);
      const s = d.heroVisual.laufStand();
      const k = (s ? s.clip : '-') + ' | ' + P.state + (P.gleiten ? ' | gleitet' : '');
      if (k !== letzter) { kette.push({ t: +(i / 60).toFixed(1), was: k }); letzter = k; }
      if (P.onGround && i > 60) break;
    }
    alleAus();
    return { spruenge, doppel, fall, boeden, gleitReihe, kette };
  });

  console.log('Spruenge:');
  console.log('  Art'.padEnd(10) + 'Anlauf'.padStart(9) + 'Hoehe'.padStart(9) + 'Weite'.padStart(9));
  for (const s of aus.spruenge)
    console.log('  ' + s.art.padEnd(8) + (s.tempo + ' m/s').padStart(9) +
      (s.hoehe + ' m').padStart(9) + (s.weite + ' m').padStart(9));

  console.log('\nZweiter Sprung ueber dem Fluss (kein Anker in Reichweite):');
  console.log('  Art'.padEnd(12) + 'Anker'.padStart(8) + 'v vorher'.padStart(11) +
              'v nachher'.padStart(12) + 'Gewinn'.padStart(10) + 'jumps'.padStart(8));
  for (const z of aus.doppel)
    console.log('  ' + z.art.padEnd(10) + (z.ankerDa ? 'ja' : 'nein').padStart(8) +
      (z.vVorher + ' m/s').padStart(11) + (z.vNachher + ' m/s').padStart(12) +
      (z.gewinn + ' m').padStart(10) + String(z.jumps).padStart(8));

  console.log('\nFreier Fall aus 140 m: Sinken bis ' + aus.fall.sinken +
              ' m/s, Zustand ' + aus.fall.zustand +
              ', Gleiten ' + (aus.fall.gleitet ? 'AN' : 'aus'));

  console.log('\nSchneller Fall auf verschiedene Boeden:');
  console.log('  Ort'.padEnd(26) + 'Soll'.padStart(9) + 'gelandet'.padStart(11) +
              'tiefster'.padStart(11) + 'Aufprall'.padStart(11) + '  Zustand');
  for (const bo of aus.boeden)
    console.log((bo.durchgefallen ? '  FEHL ' : '  ok   ') + bo.ort.padEnd(24) +
      String(bo.sollBoden).padStart(7) + String(bo.gelandetAuf).padStart(11) +
      String(bo.tiefste).padStart(11) + (bo.aufprall + ' m/s').padStart(11) +
      '  ' + bo.zustand);

  console.log('\nGleiten aus 150 m:');
  console.log('  Art'.padEnd(14) + 'Bilder'.padStart(8) + 'Hoehe ab'.padStart(11) +
              'Weite'.padStart(9) + 'Gleitzahl'.padStart(11) +
              'Sinken'.padStart(9) + 'Tempo'.padStart(9));
  for (const g of aus.gleitReihe)
    console.log('  ' + g.art.padEnd(12) + String(g.gleitBilder).padStart(8) +
      (g.hoehenverlust + ' m').padStart(11) + (g.weite + ' m').padStart(9) +
      String(g.gleitzahl).padStart(11) + (g.sinken + ' m/s').padStart(9) +
      (g.tempo + ' m/s').padStart(9));

  console.log('\nKette vom Sprung bis zum Boden (Gleittaste gehalten):');
  for (const k of aus.kette) console.log('  ' + String(k.t).padStart(5) + ' s   ' + k.was);
  await b.close();
})();
