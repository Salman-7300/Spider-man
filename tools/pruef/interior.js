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
        for (const px0 of [g.x0 + 1.5, (g.x0 + g.x1) / 2, g.x1 - 1.5]) {
          for (const pz0 of [g.z0 + 1.5, (g.z0 + g.z1) / 2, g.z1 - 1.5]) {
            /* ---- Erst freien Boden suchen ----
               Im groesseren Raum liegen Rastermitte und zwei Ecken MITTEN
               in einem Requisit (Deckungskiste, Regal an der Ostwand).
               Gemessene 0,12 m Kameraabstand waren dort kein
               Kamerafehler, sondern eine Figur in einer Kiste. */
            let px = px0, pz = pz0;
            const freiHier = (x, z) => {
              for (const kk of d.colliderNah(x, z)) {
                if (kk.h <= 0.35) continue;
                if (kk.y0 !== undefined && kk.y0 > 2.1) continue;
                if (x > kk.x0 - 0.5 && x < kk.x1 + 0.5 &&
                    z > kk.z0 - 0.5 && z < kk.z1 + 0.5) return false;
              }
              return true;
            };
            if (!freiHier(px, pz)) {
              for (let rad = 0.5; rad <= 3.0 && !freiHier(px, pz); rad += 0.5) {
                for (let q = 0; q < 12; q++) {
                  const w2 = (q / 12) * Math.PI * 2;
                  const nx = px0 + Math.sin(w2) * rad, nz = pz0 + Math.cos(w2) * rad;
                  if (nx > g.x0 && nx < g.x1 && nz > g.z0 && nz < g.z1 && freiHier(nx, nz)) {
                    px = nx; pz = nz; break;
                  }
                }
              }
            }
            for (let k = 0; k < 8; k++) {
              const yaw = (k / 8) * Math.PI * 2;
              d.setzePos(px, 0, pz);
              P.state = 'ground'; P.onGround = true; P.facing = yaw;
              d.setzeKamYaw(yaw + Math.PI);
              /* 120 Bilder statt 30: mit 30 lag ein fester Rest jeder
                 Messung nur daran, dass camPos nach dem Teleport noch
                 heranglitt. */
              schritte(120);
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
    /* ---------- 7: Kontrollpunkt, Tod und Abbruch im Innenraum ---------- */
    if (will(7)) {
      const vorbereiten = () => {
        if (d.story.aktiv) d.storyAufraeumen();
        d.story.fertig.length = 0;
        for (const id of ['m1', 'm2', 'm3', 'm4', 'm5']) d.story.fertig.push(id);
        d.enemies.length = 0;
        if (d.gangs) d.gangs.length = 0;
        for (const c of d.civilians) c.geisel = false;
        if (d.innenAktiv || d.innen.phase) d.innenSofortRaus();
        d.setzePos(25, 0.05, 25);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        P.dead = false; P.hp = 100;
      };
      /* Wiedereinstieg in JEDE Phase, auch die drei im Innenraum. */
      const phasen = [];
      for (let ph = 0; ph <= 8; ph++) {
        vorbereiten();
        const los = d.storyStarte('m6', ph);
        /* Ein paar Bilder, damit ein angestossener Uebergang durchlaeuft
           und der aufgeschobene Aufbau nachgeholt wird. */
        for (let i = 0; i < 90; i++) d.schritt(1 / 60);
        phasen.push({ ph, los, steht: d.story.phase, ziel: d.story.zielText,
          innen: d.innenAktiv,
          storyGegner: d.enemies.filter((e) => e.storyGegner && !e.dead).length,
          geiseln: d.civilians.filter((c) => c.geisel).length,
          gegnerImRaum: d.enemies.filter((e) => e.storyGegner && !e.dead &&
            d.imInnenraum(e.pos.x, e.pos.z)).length,
          spielerImRaum: d.imInnenraum(P.pos.x, P.pos.z) });
      }
      /* Tod im Innenraum: heraus, und die Mission steht wieder auf ihrer
         Phase - nicht in einer Sackgasse. */
      vorbereiten();
      d.storyStarte('m6', 3);
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      const vorTod = { innen: d.innenAktiv, phase: d.story.phase };
      P.hp = 1;
      if (d.damagePlayer) d.damagePlayer(50, null); else { P.hp = 0; P.dead = true; }
      for (let i = 0; i < 10; i++) d.schritt(1 / 60);
      const totDrin = { tot: P.dead, innen: d.innenAktiv };
      d.respawn();
      for (let i = 0; i < 120; i++) d.schritt(1 / 60);
      const nachTod = { innen: d.innenAktiv, phase: d.story.phase,
        aktiv: !!d.story.aktiv, ort: [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)],
        spielerImRaum: d.imInnenraum(P.pos.x, P.pos.z),
        geiseln: d.civilians.filter((c) => c.geisel).length };
      /* Abbruch im Innenraum. */
      vorbereiten();
      d.storyStarte('m6', 3);
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      const vorAbbruch = d.innenAktiv;
      d.storyAufraeumen();
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      const nachAbbruch = { innen: d.innenAktiv, phase: d.innen.phase,
        aktiv: !!d.story.aktiv,
        storyGegner: d.enemies.filter((e) => e.storyGegner).length,
        geiseln: d.civilians.filter((c) => c.geisel).length,
        sichtbar: d.szeneSichtbar() };
      vorbereiten();
      R.t7 = { phasen, vorTod, totDrin, nachTod, vorAbbruch, nachAbbruch };

      /* ---- 8: Die Geisel: Sitz, Fesseln, Befreiung ----
         Der Playtest hat "schwebt und ist nicht gefesselt" gemeldet.
         Geprueft wird am Skelett, nicht am Augenmass: Becken auf der
         Kistenoberkante, tiefster Fusspunkt auf dem Fussboden, Fesseln
         VOR der Befreiung da und DANACH weg. */
      /* Phase 4, nicht 3: in Phase 3 stehen noch die Wellen im Raum, die
         Geiselphase beginnt erst danach. Der erste Anlauf startete bei 3
         und meldete "nach der Befreiung: Geiseln 1, Phase 3" - er hatte
         gar nicht befreit, sondern nur gewartet. */
      vorbereiten();
      d.storyStarte('m6', 4);
      for (let i = 0; i < 90; i++) d.schritt(1 / 60);
      const raum = d.innen.raum;
      const findeFessel = () => {
        let f = null;
        if (raum) raum.gruppe.traverse((o) => { if (o.name === 'GeiselFessel') f = o; });
        return f;
      };
      const civ = d.civilians.find((c) => c.geisel);
      let vorher = null, nachher = null;
      if (civ && raum) {
        /* Naeher heran, damit die Nah-Behandlung greift (ab FERN wird
           nur jedes dritte Bild gerechnet). */
        d.setzePos(raum.geiselPunkt.x - 4, 0, raum.geiselPunkt.z + 2.5);
        P.state = 'ground'; P.onGround = true;
        for (let i = 0; i < 60; i++) d.schritt(1 / 60);
        const sm = civ.visual.sitzMasse ? civ.visual.sitzMasse() : null;
        const f = findeFessel();
        vorher = {
          sitzY: raum.geiselSitzY,
          pos: [+civ.pos.x.toFixed(2), +civ.pos.y.toFixed(2), +civ.pos.z.toFixed(2)],
          soll: [+raum.geiselPunkt.x.toFixed(2), +raum.geiselPunkt.z.toFixed(2)],
          huefte: sm ? +sm.huefte.toFixed(3) : null,
          fuss: sm ? +sm.fuss.toFixed(3) : null,
          fesselDa: !!(f && f.visible && f.parent),
          handAbstand: (() => {
            const a = civ.visual.handPos && civ.visual.handPos('L', new THREE.Vector3());
            const b2 = civ.visual.handPos && civ.visual.handPos('R', new THREE.Vector3());
            return a && b2 ? +a.distanceTo(b2).toFixed(3) : null;
          })(),
        };
        /* Befreien: hingehen, bis die Phase umschlaegt. */
        for (let i = 0; i < 600 && d.civilians.some((c) => c.geisel); i++) {
          const zx = raum.geiselPunkt.x, zz = raum.geiselPunkt.z;
          const w = Math.atan2(zx - P.pos.x, zz - P.pos.z);
          P.facing = w; d.setzeKamYaw(w + Math.PI);
          const dd = Math.hypot(zx - P.pos.x, zz - P.pos.z);
          if (dd > 2.0) d.taste('KeyW', true); else d.taste('KeyW', false);
          d.schritt(1 / 60);
        }
        d.taste('KeyW', false);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        const f2 = findeFessel();
        nachher = {
          nochGeisel: d.civilians.filter((c) => c.geisel).length,
          fesselDa: !!(f2 && f2.visible && f2.parent),
          y: +civ.pos.y.toFixed(2),
          phase: d.story.phase,
        };
      }
      R.t8 = { vorher, nachher };
      vorbereiten();
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
  if (aus.t7) {
    const t = aus.t7;
    p('');
    p('== 7: Kontrollpunkt, Tod und Abbruch ==');
    p('  Zu lesen: "steht auf" darf GROESSER als "Ph" sein - in den 1,5 s');
    p('  der Pruefung spielt niemand, und eine Phase kann von allein weiter-');
    p('  laufen. Phase 5 tut das immer: der Funker rennt los, und ohne');
    p('  Gegenwehr ist er in gut einer Sekunde am Hinterausgang.');
    p('  Ph gestartet stehtAuf innen Storygegner imRaum Geiseln SpielerImRaum  Ziel');
    for (const z of t.phasen)
      p('  ' + String(z.ph).padStart(2) + String(z.los).padStart(10) +
        String(z.steht).padStart(9) + String(z.innen).padStart(6) +
        String(z.storyGegner).padStart(12) + String(z.gegnerImRaum).padStart(8) +
        String(z.geiseln).padStart(8) + String(z.spielerImRaum).padStart(15) +
        '  ' + z.ziel);
    p('  Tod im Innenraum: vorher ' + JSON.stringify(t.vorTod) +
      '  im Tod ' + JSON.stringify(t.totDrin));
    p('    danach ' + JSON.stringify(t.nachTod));
    p('  Abbruch im Innenraum: vorher innen ' + t.vorAbbruch +
      '  danach ' + JSON.stringify(t.nachAbbruch));
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
  if (aus.t8) {
    p('');
    p('== 8: Geisel, Sitz und Fesseln ==');
    const v = aus.t8.vorher, n = aus.t8.nachher;
    if (!v) p('  keine Geisel gefunden - der Test prueft nichts');
    else {
      p('  Sitzflaeche ' + v.sitzY + ' m   Becken ' + v.huefte +
        '   tiefster Fusspunkt ' + v.fuss);
      p('  Standort ' + JSON.stringify(v.pos) + '   Sollpunkt ' + JSON.stringify(v.soll));
      p('  Fesseln da: ' + v.fesselDa + '   Handabstand ' + v.handAbstand + ' m');
    }
    if (n) p('  nach der Befreiung: Geiseln ' + n.nochGeisel + ', Fesseln da ' +
      n.fesselDa + ', y ' + n.y + ', Phase ' + n.phase);
  }
  await b.close();
})();
