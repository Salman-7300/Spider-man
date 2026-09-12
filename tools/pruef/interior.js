/* Der Missions-Innenraum im laufenden Spiel.

   mission-interiors.js selbst ist ohne Browser geprueft
   (tools/test-interior.cjs). Hier geht es um alles, was erst im Spiel
   entsteht: der Uebergang, die Weltpause, die Sichtbarkeit, die
   Renderlast, die Kamera, die Kollision und das Verhalten ueber viele
   Ein- und Austritte.

   Aufruf:  node tools/pruef/interior.js [teil]
            teil = 1-6 (gefroren, ohne Bild) | last (mit Bild) | alle */
const { starte } = require('./basis');
const TEIL = process.argv[2] || 'alle';
const will = (n) => TEIL === String(n) || TEIL === 'alle';

(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const E = {};

  /* ============ Teil "last": Renderzahlen, mit laufendem Bild ============
     Muss VOR dem Einfrieren laufen - d.frier(true) haelt animate() an, und
     ohne Bild sagt renderer.info nichts ueber die Last. */
  if (TEIL === 'last' || TEIL === 'alle') {
    const bild = () => page.evaluate(() => new Promise((res) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        res({ render: __dbg.renderInfo(), sichtbar: __dbg.szeneSichtbar(),
              innen: __dbg.innenAktiv, blende: __dbg.innenBlende });
      }));
    }));
    const warte = async (bed, sek) => {
      const bis = Date.now() + sek * 1000;
      while (Date.now() < bis) {
        const z = await bild();
        if (bed(z)) return z;
      }
      return null;
    };
    E.lastA = await bild();
    await page.evaluate(() => __dbg.innenBetreten({ x: __dbg.player.pos.x,
      y: __dbg.player.pos.y, z: __dbg.player.pos.z }, 0));
    const drin = await warte((z) => z.innen && z.blende <= 0, 40);
    E.lastB = drin || await bild();
    await page.evaluate(() => __dbg.innenVerlassen());
    const raus = await warte((z) => !z.innen && z.blende <= 0, 40);
    E.lastC = raus || await bild();
  }

  const aus = await page.evaluate(async (TEIL) => {
    const d = __dbg, P = d.player;
    const will = (n) => TEIL === String(n) || TEIL === 'alle';
    const R = {};
    d.frier(true);
    /* Nebenauftraege aus dem Weg - siehe Kommentar in mission6.js. */
    d.setzeMissionCd(1e9);

    const schritte = (n, h) => { for (let i = 0; i < n; i++) d.schritt(h || 1 / 60); };
    /* Ein vollstaendiger Uebergang: Blende zu, Wechsel, Blende auf. */
    const uebergang = (start) => {
      const t0 = d.elapsed ? d.elapsed() : 0;
      let bilder = 0;
      start();
      while (d.innen.phase && bilder < 600) { d.schritt(1 / 60); bilder++; }
      return { bilder, sekunden: +(bilder / 60).toFixed(3) };
    };

    /* ---------- 1: Aufbau und Ort ---------- */
    if (will(1)) {
      const vorher = d.colliders.length;
      const r = d.innenRaum();
      R.t1 = {
        gebaut: !!r,
        masse: r ? r.masse : null,
        zahlen: r ? r.zahlen : null,
        kolliderVorher: vorher,
        kolliderNachher: d.colliders.length,
        bodenAmOrt: d.groundYAt(r.spielerStart.x, r.spielerStart.z, 2),
        wasserAmOrt: d.inWasser(r.spielerStart.x, r.spielerStart.z),
        /* Zweiter Aufruf darf KEINEN zweiten Raum bauen. */
        zweiterAufrufGleich: d.innenRaum() === r,
        kolliderNachZweitem: d.colliders.length,
      };
    }

    /* ---------- 2: Eintritt und Austritt ---------- */
    if (will(2)) {
      const r = d.innenRaum();
      d.setzePos(30, 0.05, 30);
      P.state = 'ground'; P.onGround = true;
      const vorPos = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      const sichtbarVor = d.szeneSichtbar();
      /* WELCHE Objekte sichtbar sind, nicht nur wie viele: ein Unterschied
         von zwei bei 121 laesst sich sonst nicht beurteilen. */
      const namen = () => d.szene.children.filter((o) => o.visible)
        .map((o, i) => (o.name || o.type) + '#' + d.szene.children.indexOf(o));
      const vorNamen = namen();
      /* Waehrend des Uebergangs darf die Figur nie ausserhalb eines
         schwarzen Bildes springen: gemessen wird der groesste Sprung je
         Bild ZUSAMMEN mit der Blende in diesem Bild. */
      let maxSprungOffen = 0, letzte = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      const beobachte = () => {
        const dd = Math.hypot(P.pos.x - letzte.x, P.pos.y - letzte.y, P.pos.z - letzte.z);
        if (d.innenBlende < 0.999 && dd > maxSprungOffen) maxSprungOffen = dd;
        letzte = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      };
      const rein = (() => {
        d.innenBetreten(vorPos, 0, { x: 40, y: null, z: 40 }, 1.0);
        let bilder = 0;
        while (d.innen.phase && bilder < 600) { d.schritt(1 / 60); beobachte(); bilder++; }
        return { bilder, sekunden: +(bilder / 60).toFixed(3) };
      })();
      const drinPos = { x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2) };
      const sichtbarDrin = d.szeneSichtbar();
      const amStart = Math.hypot(P.pos.x - r.spielerStart.x, P.pos.z - r.spielerStart.z);
      letzte = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      const raus = (() => {
        d.innenVerlassen();
        let bilder = 0;
        while (d.innen.phase && bilder < 600) { d.schritt(1 / 60); beobachte(); bilder++; }
        return { bilder, sekunden: +(bilder / 60).toFixed(3) };
      })();
      R.t2 = {
        rein, raus, drinPos, amStart: +amStart.toFixed(2),
        sichtbarVor, sichtbarDrin, sichtbarNach: d.szeneSichtbar(),
        drausenPos: { x: +P.pos.x.toFixed(2), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(2) },
        maxSprungOffenesBild: +maxSprungOffen.toFixed(3),
        innenAktivDanach: d.innenAktiv,
        fehlenNachher: vorNamen.filter((n2) => namen().indexOf(n2) < 0),
        neuNachher: namen().filter((n2) => vorNamen.indexOf(n2) < 0),
      };
    }

    /* ---------- 3: Weltpause ---------- */
    if (will(3)) {
      /* Autos fuehren ihre Lage in mesh.position, Figuren in pos - der
         erste Anlauf las blind .pos und starb an den Autos. */
      const ortVon = (o) => o.pos || (o.mesh && o.mesh.position) || o.position || null;
      const merk = (liste, n) => liste.slice(0, n).map((o) => {
        const q = ortVon(o);
        return q ? { x: +q.x.toFixed(3), z: +q.z.toFixed(3) } : null;
      });
      const abweichung = (a, liste) => {
        let m = 0;
        for (let i = 0; i < a.length; i++) {
          const o = liste[i], q = o && ortVon(o);
          if (!q || !a[i]) continue;
          m = Math.max(m, Math.hypot(q.x - a[i].x, q.z - a[i].z));
        }
        return +m.toFixed(3);
      };
      /* Draussen: die Welt MUSS sich bewegen, sonst misst der Test nichts. */
      const a0 = merk(d.cars, 10), z0 = merk(d.civilians, 10);
      const g0 = merk(d.enemies.filter((e) => !e.storyGegner), 8);
      schritte(120);
      const drausen = { autos: abweichung(a0, d.cars), zivilisten: abweichung(z0, d.civilians),
                        gegner: abweichung(g0, d.enemies.filter((e) => !e.storyGegner)) };
      /* Drinnen: nichts davon darf sich noch bewegen. */
      d.innenBetreten({ x: P.pos.x, y: P.pos.y, z: P.pos.z }, 0);
      while (d.innen.phase) d.schritt(1 / 60);
      const a1 = merk(d.cars, 10), z1 = merk(d.civilians, 10);
      const g1 = merk(d.enemies.filter((e) => !e.storyGegner), 8);
      const uhr0 = d.tagzeit ? d.tagzeit() : null;
      schritte(120);
      const drinnen = { autos: abweichung(a1, d.cars), zivilisten: abweichung(z1, d.civilians),
                        gegner: abweichung(g1, d.enemies.filter((e) => !e.storyGegner)) };
      const uhr1 = d.tagzeit ? d.tagzeit() : null;
      d.innenVerlassen();
      while (d.innen.phase) d.schritt(1 / 60);
      /* Und danach muss es weitergehen - Pause heisst nicht Abbau. */
      const a2 = merk(d.cars, 10);
      schritte(120);
      const danach = { autos: abweichung(a2, d.cars) };
      R.t3 = { drausen, drinnen, danach, uhrDrinnen: uhr0 !== null ? +(uhr1 - uhr0).toFixed(4) : null,
               autos: d.cars.length, zivilisten: d.civilians.length };
    }

    /* ---------- 4: Boden, Kollision, Grenzen ---------- */
    if (will(4)) {
      const r = d.innenRaum();
      d.innenBetreten({ x: P.pos.x, y: P.pos.y, z: P.pos.z }, 0);
      while (d.innen.phase) d.schritt(1 / 60);
      let unterBoden = 0, ausserhalb = 0, sprung = 0, maxY = -9, minY = 9;
      let letzte = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      const g = r.grenzen;
      /* Gegen jede Wand und um jedes grosse Requisit: acht Richtungen,
         abwechselnd gehen, sprinten und springen. */
      for (let runde = 0; runde < 24; runde++) {
        const w = (runde / 24) * Math.PI * 2;
        P.facing = w; d.setzeKamYaw(w + Math.PI);
        d.taste('KeyW', true);
        d.taste('ShiftLeft', runde % 3 === 0);
        for (let i = 0; i < 150; i++) {
          if (runde % 4 === 1 && i % 40 === 0) d.tippeSprung();
          d.schritt(1 / 60);
          const gy = d.groundYAt(P.pos.x, P.pos.z, P.pos.y);
          if (P.pos.y < gy - 0.6) unterBoden++;
          if (P.pos.x < g.x0 - 0.6 || P.pos.x > g.x1 + 0.6 ||
              P.pos.z < g.z0 - 0.6 || P.pos.z > g.z1 + 0.6) ausserhalb++;
          const dd = Math.hypot(P.pos.x - letzte.x, P.pos.y - letzte.y, P.pos.z - letzte.z);
          if (dd > 2.5) sprung++;
          maxY = Math.max(maxY, P.pos.y); minY = Math.min(minY, P.pos.y);
          letzte = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
        }
        d.taste('KeyW', false); d.taste('ShiftLeft', false);
        schritte(10);
      }
      /* Steht die Figur in einem massiven Requisit? */
      let imKasten = 0;
      for (const k of r.kollider) {
        if (k.y0 !== undefined && k.y0 > 1.8) continue;
        if (k.h <= 0.35) continue;
        if (P.pos.x > k.x0 && P.pos.x < k.x1 && P.pos.z > k.z0 && P.pos.z < k.z1) imKasten++;
      }
      R.t4 = { bilder: 24 * 150, unterBoden, ausserhalb, sprung, imKasten,
               maxY: +maxY.toFixed(2), minY: +minY.toFixed(2),
               endePos: [+P.pos.x.toFixed(1), +P.pos.y.toFixed(2), +P.pos.z.toFixed(1)] };
      d.innenVerlassen();
      while (d.innen.phase) d.schritt(1 / 60);
    }

    /* ---------- 5: Kamera im Innenraum ---------- */
    if (will(5)) {
      const r = d.innenRaum();
      d.innenBetreten({ x: P.pos.x, y: P.pos.y, z: P.pos.z }, 0);
      while (d.innen.phase) d.schritt(1 / 60);
      const g = r.grenzen;
      /* Mehrere Abstaende vergleichen statt einen zu setzen. Entscheidend
         ist nicht der Mittelwert, sondern wie oft die Kamera von einer
         Wand unter zwei Meter herangezogen wird - das ist der Eindruck
         "die Kamera zoomt staendig hinein". */
      const reihen = [];
      for (const dist of [3.2, 3.6, 4.0, 4.6, 5.2]) {
        d.setzeInnenKamDist(dist);
        let ausserhalb = 0, proben = 0, minAbstand = 99, maxAbstand = 0, eng = 0;
        const alle = [];
        const stellen = [];
        for (const px of [g.x0 + 1.5, (g.x0 + g.x1) / 2, g.x1 - 1.5]) {
          for (const pz of [g.z0 + 1.5, (g.z0 + g.z1) / 2, g.z1 - 1.5]) {
            for (let k = 0; k < 8; k++) {
              const yaw = (k / 8) * Math.PI * 2;
              d.setzePos(px, 0, pz);
              P.state = 'ground'; P.onGround = true; P.facing = yaw;
              d.setzeKamYaw(yaw + Math.PI);
              schritte(30);
              const c = d.camera.position;
              proben++;
              const drin = c.x > g.x0 - 0.9 && c.x < g.x1 + 0.9 &&
                           c.z > g.z0 - 0.9 && c.z < g.z1 + 0.9 &&
                           c.y > -0.5 && c.y < r.masse.hoehe + 0.5;
              if (!drin) { ausserhalb++; if (stellen.length < 5)
                stellen.push({ p: [+px.toFixed(1), +pz.toFixed(1)], yaw: +yaw.toFixed(2),
                               kam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)] }); }
              const ab = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
              alle.push(ab);
              if (ab < 2.0) eng++;
              minAbstand = Math.min(minAbstand, ab); maxAbstand = Math.max(maxAbstand, ab);
            }
          }
        }
        alle.sort((x, y) => x - y);
        reihen.push({ dist, proben, ausserhalb, eng, stellen,
                      min: +minAbstand.toFixed(2), max: +maxAbstand.toFixed(2),
                      median: +alle[Math.floor(alle.length / 2)].toFixed(2) });
      }
      d.setzeInnenKamDist(4.0);
      R.t5 = { reihen };
      d.innenVerlassen();
      while (d.innen.phase) d.schritt(1 / 60);
    }

    /* ---------- 6: 50 x hinein und hinaus ---------- */
    if (will(6)) {
      const zaehle = () => ({
        szene: d.szene.children.length,
        sichtbar: d.szeneSichtbar(),
        kollider: d.colliders.length,
        gegner: d.enemies.length,
        zivilisten: d.civilians.length,
        autos: d.cars.length,
        geiseln: d.civilians.filter((c) => c.geisel).length,
        innenGruppen: d.szene.children.filter((o) =>
          o.name === 'WEB_HERO_Interior_Hideout').length,
      });
      d.setzePos(30, 0.05, 30);
      P.state = 'ground'; P.onGround = true;
      const vor = zaehle();
      let bilderGesamt = 0;
      for (let i = 0; i < 50; i++) {
        d.innenBetreten({ x: 30, y: 0.05, z: 30 }, 0, { x: 30, y: null, z: 30 }, 0);
        while (d.innen.phase) { d.schritt(1 / 60); bilderGesamt++; }
        schritte(4);
        d.innenVerlassen();
        while (d.innen.phase) { d.schritt(1 / 60); bilderGesamt++; }
        schritte(4);
      }
      const nach = zaehle();
      R.t6 = { vor, nach, zyklen: d.innenZyklen, bilderGesamt,
               innenAktiv: d.innenAktiv, blende: d.innenBlende };
    }
    return R;
  }, TEIL);

  const p = (s) => console.log(s);
  Object.assign(aus, E);
  p('');
  if (aus.t1) {
    p('== 1: Aufbau ==');
    p('  gebaut: ' + aus.t1.gebaut + '   Masse: ' + JSON.stringify(aus.t1.masse));
    p('  ' + JSON.stringify(aus.t1.zahlen));
    p('  Kollider vorher ' + aus.t1.kolliderVorher + ' -> nachher ' + aus.t1.kolliderNachher +
      ', nach zweitem Aufruf ' + aus.t1.kolliderNachZweitem +
      '   zweiter Aufruf liefert denselben Raum: ' + aus.t1.zweiterAufrufGleich);
    p('  groundY am Spielerstart: ' + aus.t1.bodenAmOrt + '   Wasser: ' + aus.t1.wasserAmOrt);
  }
  if (aus.t2) {
    const t = aus.t2;
    p('');
    p('== 2: Ein- und Austritt ==');
    p('  hinein ' + t.rein.sekunden + ' s (' + t.rein.bilder + ' Bilder)' +
      '   hinaus ' + t.raus.sekunden + ' s (' + t.raus.bilder + ' Bilder)');
    p('  Spieler drinnen ' + JSON.stringify(t.drinPos) +
      ', Abstand zum vorgesehenen Start ' + t.amStart + ' m');
    p('  danach draussen ' + JSON.stringify(t.drausenPos) +
      '   innen noch aktiv: ' + t.innenAktivDanach);
    p('  sichtbare Szenenobjekte: aussen ' + t.sichtbarVor + ' -> innen ' + t.sichtbarDrin +
      ' -> wieder aussen ' + t.sichtbarNach);
    p('  groesster Ortssprung bei OFFENEM Bild: ' + t.maxSprungOffenesBild + ' m');
    p('  danach NICHT wieder sichtbar: ' + (t.fehlenNachher.length
      ? t.fehlenNachher.join(', ') : 'nichts'));
    p('  danach zusaetzlich sichtbar: ' + (t.neuNachher.length
      ? t.neuNachher.join(', ') : 'nichts'));
  }
  if (aus.t3) {
    const t = aus.t3;
    p('');
    p('== 3: Weltpause (je 120 Bilder, groesste Bewegung) ==');
    p('  draussen   Autos ' + t.drausen.autos + ' m, Zivilisten ' + t.drausen.zivilisten +
      ' m, Ambient-Gegner ' + t.drausen.gegner + ' m');
    p('  DRINNEN    Autos ' + t.drinnen.autos + ' m, Zivilisten ' + t.drinnen.zivilisten +
      ' m, Ambient-Gegner ' + t.drinnen.gegner + ' m');
    p('  danach     Autos ' + t.danach.autos + ' m');
    p('  Bestand unveraendert: ' + t.autos + ' Autos, ' + t.zivilisten + ' Zivilisten');
  }
  if (aus.t4) {
    const t = aus.t4;
    p('');
    p('== 4: Boden und Kollision (' + t.bilder + ' Bilder Dauerlauf drinnen) ==');
    p('  unter dem Boden ' + t.unterBoden + '   ausserhalb des Raums ' + t.ausserhalb +
      '   Ortssprung > 2,5 m ' + t.sprung + '   in einem Requisit steckend ' + t.imKasten);
    p('  Hoehe ' + t.minY + ' .. ' + t.maxY + '   Ende ' + JSON.stringify(t.endePos));
  }
  if (aus.t5) {
    p('');
    p('== 5: Kamera drinnen ==');
    p('  Abstand  Proben  ausserhalb  unter 2 m  min   Median  max');
    for (const r of aus.t5.reihen)
      p('   ' + String(r.dist).padEnd(6) + String(r.proben).padStart(6) +
        String(r.ausserhalb).padStart(12) + String(r.eng).padStart(11) +
        String(r.min).padStart(7) + String(r.median).padStart(8) + String(r.max).padStart(7));
  }
  if (aus.t6) {
    const t = aus.t6;
    p('');
    p('== 6: 50 x hinein und hinaus ==');
    p('  vor:  ' + JSON.stringify(t.vor));
    p('  nach: ' + JSON.stringify(t.nach));
    p('  Zyklen gezaehlt ' + t.zyklen + ', Uebergangsbilder gesamt ' + t.bilderGesamt +
      ', innen aktiv ' + t.innenAktiv + ', Blende ' + t.blende);
    const w = [];
    for (const k of Object.keys(t.vor)) if (t.vor[k] !== t.nach[k]) w.push(k + ' ' + t.vor[k] + ' -> ' + t.nach[k]);
    p('  Unterschiede: ' + (w.length ? w.join(', ') : 'keine'));
  }
  if (aus.lastA) {
    p('');
    p('== Renderlast (echtes Bild) ==');
    const z = (n, o) => '  ' + n.padEnd(22) + String(o.render.calls).padStart(6) + ' Zeichenaufrufe' +
      String(o.render.dreiecke).padStart(10) + ' Dreiecke' +
      '   sichtbare Szenenobjekte ' + o.sichtbar;
    p(z('A aussen davor', aus.lastA));
    p(z('B im Innenraum', aus.lastB));
    p(z('C aussen danach', aus.lastC));
  }
  await b.close();
})();
