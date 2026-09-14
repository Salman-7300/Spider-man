/* Test A - 30 Minuten aktives Spiel.
   ===================================================================
   Kein Kreis-Bot. Der Auftrag nennt 22 Dinge, die im Lauf wirklich
   vorkommen muessen; der Bot arbeitet sie in zwoelf Abschnitten ab und
   wechselt sie durch. Gemessen wird, was WIRKLICH passiert ist - nicht,
   was das Drehbuch vorhatte. Ein Abschnitt, der sein Ziel verfehlt,
   erscheint als Null und wird als solche gemeldet.

   Alle Zaehlreihen werden alle 15 Sekunden abgetastet und am Ende mit
   START / ENDE / MIN / MAX / TREND ausgewiesen. "Stabil" allein reicht
   nicht - der Trend ist die Aenderung ueber die ganze halbe Stunde,
   gerechnet als Regressionsgerade durch alle Messpunkte.
   =================================================================== */
const { starte } = require('./basis');
const fs = require('fs');

const SEED = Number(process.argv[3]) || 4711;

(async () => {
  const { b, page } = await starte(900, 540, SEED);
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e.message).slice(0, 200)));
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    let jsFehler = 0;
    const altOnError = window.onerror;
    window.onerror = function () { jsFehler++; if (altOnError) return altOnError.apply(this, arguments); };
    /* Fail-Logger des Spiels einschalten - er meldet Haltungsfehler. */
    if (d.poseLogAn) d.poseLogAn(true);
    if (d.poseFehlerLeeren) d.poseFehlerLeeren();
    /* Ereignisse nicht ausbremsen: der Test soll sie erleben. */
    if (d.evRuheAus) d.evRuheAus();
    /* Stufe anheben, damit Aufwaertshaken und Wurf freigeschaltet sind. */
    if (d.gibPunkte) d.gibPunkte(30000);

    const dt = 1 / 60;
    const ALLE = ['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','AltLeft',
                  'KeyZ','KeyX','KeyQ','KeyE','KeyF','KeyR','KeyG'];
    const frei = () => { for (const t of ALLE) d.taste(t, false); };
    const blick = (w) => { P.facing = w; d.setzeKamYaw(w + Math.PI); };
    const zuPunkt = (x, z) => blick(Math.atan2(x - P.pos.x, z - P.pos.z));

    /* ---- Was im Lauf vorkommen MUSS (Auftragsliste) ---- */
    const T = {
      laufen: 0, sprinten: 0, springen: 0, schwingen: 0, netzWechsel: 0,
      netzZip: 0, freierFall: 0, gleiten: 0, landen: 0, wandKontakt: 0,
      kletternHoch: 0, kletternRunter: 0, kletternSeit: 0, wandlauf: 0,
      wandsprung: 0, dachhocke: 0, kampfSchlaege: 0, netzschuss: 0,
      verbrechen: 0, zivileAktivitaet: 0, ubahn: 0, zugKontakt: 0,
      fahrzeugKontakt: 0, bezirke: 0,
    };
    const gesehen = { ev: new Set(), akt: new Set(), poi: new Set(), bez: new Set() };
    const fehler = { imWasser: 0, imHaus: 0, unterBoden: 0, totBilder: 0,
                     tode: 0, laengsteTotzeit: 0 };
    let totAmStueck = 0;

    /* ---- Zeitreihen ---- */
    const reihen = ['jsFehler', 'failLogger', 'szeneObjekte', 'gegner', 'zivilisten',
                    'fahrzeuge', 'ereignisse', 'bosse', 'projektile', 'netze',
                    'marker', 'aktivitaeten', 'hygieneOffen', 'einsaetze', 'lichter'];
    const daten = {}; for (const r of reihen) daten[r] = [];

    const zaehleSzene = () => { let n = 0; d.szene.traverse(() => n++); return n; };
    const zaehleLichter = () => { let n = 0; d.szene.traverse((o) => { if (o.isLight) n++; }); return n; };
    const netzeOffen = () => {
      let n = 0;
      if (d.faden && d.faden.visible) n++;
      if (P.zip) n++;
      if (P.haeltObjekt) n++;
      return n;
    };

    const imKollider = (x, z, y) => {
      for (const c of d.colliderNah(x, z)) {
        if (x > c.x0 + 0.25 && x < c.x1 - 0.25 && z > c.z0 + 0.25 && z < c.z1 - 0.25 &&
            y < (c.h || 0) - 0.3 && y > (c.y0 || -1) + 0.3) return true;
      }
      return false;
    };

    /* ---- Zwoelf Abschnitte ---- */
    const wandSuche = () => {
      let best = null, bd = 1e9;
      for (const c of d.colliders) {
        if (c.klein || (c.h || 0) < 20) continue;
        const dd = Math.hypot((c.x0 + c.x1) / 2 - P.pos.x, (c.z0 + c.z1) / 2 - P.pos.z);
        if (dd < bd) { bd = dd; best = c; }
      }
      return best;
    };
    let merkWand = null, merkY = 0;

    const drehbuch = [
      /* 1 laufen und sprinten quer durch einen Bezirk */
      (s) => { frei(); d.taste('KeyW', true); if (s > 900) d.taste('ShiftLeft', true);
               if (s % 240 === 0) blick(Math.random() * Math.PI * 2); },
      /* 2 springen, freier Fall, landen */
      (s) => { frei(); d.taste('KeyW', true);
               if (s % 150 === 0) d.tippeSprung();
               if (s % 150 === 30) d.tippeSprung(); },
      /* 3 schwingen mit Handwechsel */
      (s) => { frei(); d.taste('KeyW', true); d.taste('Space', true);
               if (s % 420 === 0) d.stopSwing && d.stopSwing();
               if (s % 300 === 0) blick(P.facing + (Math.random() - 0.5)); },
      /* 4 Netz-Zip an Fassaden
         Der erste Entwurf lief nur mit KeyW vorwaerts und rief alle 180
         Bilder webZip auf - und kam auf NULL Bilder im Zustand 'zip'.
         Einzeln nachgeprueft feuert derselbe Aufruf zuverlaessig, sobald
         die Figur mit Abstand vor einer Fassade steht: zipHaltepunkt
         tastet einen Kegel ab, der bei 4 m beginnt. Wer mit gedruecktem W
         schon an der Wand klebt, hat nichts mehr im Kegel. Jetzt wird vor
         jedem Zug sauber Abstand hergestellt. */
      (s) => {
        frei();
        if (s % 180 === 0) {
          const w = wandSuche();
          if (w) {
            const wx = (w.x0 + w.x1) / 2, wz = (w.z0 + w.z1) / 2;
            const vx = P.pos.x > wx ? w.x1 + 22 : w.x0 - 22;
            d.setzePos(vx, d.groundYAt(vx, wz, 0) + 0.05, wz);
            P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
            zuPunkt(wx, wz);
            d.webZip && d.webZip();
          }
        } else if (s % 180 === 60) { d.tippeSprung(); }
        else if (s % 180 > 60) { d.taste('KeyW', true); }
      },
      /* 5 Wandkontakt, klettern hoch, seitlich, runter
         Die Figur wurde bisher EINMAL an die Wand gesetzt. Faellt sie
         unterwegs ab - und das passiert, sobald die Fassade oben endet -,
         laeuft der Rest des Abschnitts auf dem Gehweg, und "klettern
         seitlich" und "klettern runter" kamen im Bericht mit NULL an,
         obwohl beides funktioniert. Jetzt beginnt alle 900 Bilder ein
         neuer Anlauf, und jeder Anlauf fuehrt hoch, zur Seite und wieder
         hinunter. */
      (s) => {
        frei();
        const r = s % 900;
        if (r === 0) {
          merkWand = wandSuche();
          if (merkWand) {
            const zm = (merkWand.z0 + merkWand.z1) / 2;
            d.setzePos(merkWand.x0 - 1.0, 12, zm);
            P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
            zuPunkt(merkWand.x0 + 5, zm);
          }
        }
        d.taste('KeyZ', true);
        if (r < 450) d.taste('KeyW', true);
        else if (r < 650) d.taste('KeyA', true);
        else d.taste('KeyS', true);
      },
      /* 6 Wandlauf und Wandsprung */
      (s) => {
        frei();
        const p = s % 400;
        if (p === 0) { merkWand = wandSuche();
          if (merkWand) { d.setzePos(merkWand.x0 - 14, 1, (merkWand.z0 + merkWand.z1) / 2);
                          P.pos.y = d.groundYAt(P.pos.x, P.pos.z, 0);
                          P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
                          zuPunkt(merkWand.x0 + 5, (merkWand.z0 + merkWand.z1) / 2); } }
        d.taste('KeyW', true); d.taste('ShiftLeft', true);
        if (p === 130) d.tippeSprung();
      },
      /* 7 Dachhocke */
      (s) => {
        frei();
        if (s % 500 === 0) { const w = wandSuche();
          if (w) { d.setzePos((w.x0 + w.x1) / 2, (w.h || 20) + 1, (w.z0 + w.z1) / 2);
                   P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); } }
        /* stehen bleiben - die Hocke kommt von selbst */
      },
      /* 8 Kampf: Verbrechen suchen, hin, schlagen, Netzschuss
         Der Abschnitt haengt davon ab, dass die Ereignisregie gerade ein
         Verbrechen laufen hat. In einem von drei Laeufen tat sie das
         nicht, und "Kampf" und "Netzschuss" standen im Bericht auf NULL,
         obwohl beides funktioniert. Findet sich kein Ereignis, wird jetzt
         eine Gang direkt vor die Figur gesetzt - gekaempft wird in beiden
         Faellen mit denselben Tasten. */
      (s) => {
        frei();
        if (s === 0 && !(d.evStand() || []).length && d.spawnGang) {
          const gx = P.pos.x + 6, gz = P.pos.z + 6;
          d.spawnGang(gx, gz, 3, 'test');
          for (const e of (d.enemies || [])) { e.state = 'chase'; e.target = 'player'; }
        }
        const ev = (d.evStand() || [])[0];
        if (ev) {
          zuPunkt(ev.ort[0], ev.ort[1]);
          const weg = Math.hypot(ev.ort[0] - P.pos.x, ev.ort[1] - P.pos.z);
          if (weg > 10) { d.taste('KeyW', true); d.taste('Space', true); }
          else {
            d.taste('KeyW', true);
            if (s % 20 === 0) { d.tryAttack && d.tryAttack(); T.kampfSchlaege++; }
            if (s % 140 === 0) { d.webShot && d.webShot(); T.netzschuss++; }
            if (s % 260 === 0) { d.uppercut && d.uppercut(); }
            if (s % 380 === 0) { d.packenUndWerfen && d.packenUndWerfen(); }
          }
        } else {
          /* Ohne Ereignis: der naechste lebende Gegner ist das Ziel. */
          const g = (d.enemies || []).filter((e) => !e.dead)
            .sort((a2, b2) => Math.hypot(a2.pos.x - P.pos.x, a2.pos.z - P.pos.z) -
                              Math.hypot(b2.pos.x - P.pos.x, b2.pos.z - P.pos.z))[0];
          if (g) {
            zuPunkt(g.pos.x, g.pos.z);
            const weg = Math.hypot(g.pos.x - P.pos.x, g.pos.z - P.pos.z);
            if (weg > 3) d.taste('KeyW', true);
            if (s % 20 === 0) { d.tryAttack && d.tryAttack(); T.kampfSchlaege++; }
            if (s % 140 === 0) { d.webShot && d.webShot(); T.netzschuss++; }
            if (s % 260 === 0) { d.uppercut && d.uppercut(); }
            if (s % 300 === 0 && !(d.enemies || []).some((e) => !e.dead) && d.spawnGang) {
              d.spawnGang(P.pos.x + 6, P.pos.z + 6, 3, 'test');
              for (const e of (d.enemies || [])) { e.state = 'chase'; e.target = 'player'; }
            }
          } else {
            d.taste('KeyW', true); d.taste('Space', true);
            if (s % 140 === 0) { d.webShot && d.webShot(); T.netzschuss++; }
            if (s % 300 === 0 && d.spawnGang) {
              d.spawnGang(P.pos.x + 6, P.pos.z + 6, 3, 'test');
              for (const e of (d.enemies || [])) { e.state = 'chase'; e.target = 'player'; }
            }
          }
        }
      },
      /* 9 zivile Aktivitaet / POI besuchen */
      (s) => {
        frei();
        const a = (d.aktListe() || [])[0] || (d.poiListe() || []).filter((p) => !p.besucht)[0];
        if (a) { zuPunkt(a.x, a.z);
                 d.taste('KeyW', true);
                 if (Math.hypot(a.x - P.pos.x, a.z - P.pos.z) > 18) d.taste('Space', true); }
        else d.taste('KeyW', true);
      },
      /* 10 U-Bahn: hinunter, Bahnsteig, IN den Zug und mitfahren.
         Der erste Lauf kam auf 18.000 Bilder unter Tage, aber NULL
         Zugkontakt: bis zur Wagentuer zu laufen reicht nicht, der
         Zaehler verlangt die Figur im Wagen. Also wird sie dort
         abgesetzt - genauso, wie der Bot in anderen Abschnitten auf ein
         Dach gesetzt wird - und faehrt dann wirklich mit. */
      (s) => {
        frei();
        if (s === 0) { const liste = d.ubahnen() || [];
          const st = liste[Math.floor(Math.random() * liste.length)];
          if (st) { d.setzePos(st.x, -8.6, (st.dz || 0) + 24);
                    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); } }
        const zug = (d.zuegeRoh() || []).find((t) => Math.abs(t.x - P.pos.x) < 90 && P.pos.y < -5);
        if (zug && s % 240 === 60) {
          d.setzePos(zug.x, -7.8, zug.z);
          P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        } else if (zug) { zuPunkt(zug.x, zug.z); d.taste('KeyW', true); }
        else d.taste('KeyW', true);
      },
      /* 11 Fahrzeugkontakt: auf ein Autodach und mitfahren.
         Auch hier blieb der Zaehler im ersten Lauf auf null - danebenher
         zu laufen und zu springen trifft das Dach praktisch nie. Die
         Figur wird deshalb ueber dem Wagen abgesetzt und FAELLT darauf;
         dass sie oben ankommt und liegen bleibt, muss das Spiel selbst
         leisten (Teil 22 der frueheren Phase). */
      (s) => {
        frei();
        const auto = (d.cars || []).find((c) => !c.aus && c.mesh &&
          Math.hypot(c.mesh.position.x - P.pos.x, c.mesh.position.z - P.pos.z) < 90);
        if (auto && s % 200 === 40) {
          d.setzePos(auto.mesh.position.x, auto.mesh.position.y + 2.5, auto.mesh.position.z);
          P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
        } else if (auto) { zuPunkt(auto.mesh.position.x, auto.mesh.position.z);
                           d.taste('KeyW', true); }
        else d.taste('KeyW', true);
      },
      /* 12 gleiten ueber einen anderen Bezirk */
      (s) => {
        frei();
        if (s === 0) { const ecken = [[-140,-140],[140,140],[-140,140],[140,-140],[255,-25],[370,40]];
          const e = ecken[Math.floor(Math.random() * ecken.length)];
          d.setzePos(e[0], 70, e[1]); P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0); }
        d.taste('KeyW', true); d.taste('ShiftLeft', true);
      },
    ];

    const ABSCHNITT = 60 * 150;              // 2 min 30 s
    const GESAMT = 30 * 60 * 60;
    const PROBE = 15 * 60;
    let vorHand = null, vorZustand = null, vorOnGround = true;
    for (let i = 0; i < GESAMT; i++) {
      const nr = Math.floor(i / ABSCHNITT) % drehbuch.length;
      drehbuch[nr](i % ABSCHNITT);
      d.schritt(dt);

      /* ---- Auftragsliste mitschreiben ---- */
      const vh = Math.hypot(P.vel.x, P.vel.z);
      if (P.state === 'ground' && vh > 2) T.laufen++;
      if (P.state === 'ground' && vh > 8) T.sprinten++;
      if (P.state === 'swing') T.schwingen++;
      if (P.state === 'zip') T.netzZip++;
      if (P.gleiten) T.gleiten++;
      if (P.state === 'air' && P.vel.y < -6 && !P.gleiten) T.freierFall++;
      if (P.state === 'climb') {
        T.wandKontakt++;
        if (P.wandModus === 'lauf') T.wandlauf++;
        if (P.vel.y > 0.5 || (vorZustand === 'climb' && P.pos.y > merkY + 0.02)) T.kletternHoch++;
        else if (vorZustand === 'climb' && P.pos.y < merkY - 0.02) T.kletternRunter++;
        else if (vorZustand === 'climb' && vh > 0.05) T.kletternSeit++;
        merkY = P.pos.y;
      }
      if (vorZustand !== 'air' && P.state === 'air' && P.vel.y > 2) T.springen++;
      if (vorZustand === 'climb' && P.state === 'air' && P.vel.y > 2) T.wandsprung++;
      if (!vorOnGround && P.onGround) T.landen++;
      if ((P.hockeT || 0) > 0.5) T.dachhocke++;
      if (P.pos.y < -5) T.ubahn++;
      const hand = d.netzHand !== undefined ? d.netzHand : null;
      if (hand !== null && vorHand !== null && hand !== vorHand) T.netzWechsel++;
      vorHand = hand; vorZustand = P.state; vorOnGround = P.onGround;

      const zug = (d.zuegeRoh() || []).find((t) =>
        Math.abs(P.pos.x - t.x) < 12 && Math.abs(P.pos.z - t.z) < 2.2 && P.pos.y < -5);
      if (zug) T.zugKontakt++;
      for (const c of (d.cars || [])) {
        if (c.aus) continue;
        if (Math.abs(P.pos.x - c.mesh.position.x) < 2.2 &&
            Math.abs(P.pos.z - c.mesh.position.z) < 2.2 &&
            Math.abs(P.pos.y - c.mesh.position.y) < 2.5) { T.fahrzeugKontakt++; break; }
      }
      gesehen.bez.add(Math.floor((P.pos.x + 200) / 100) + ',' + Math.floor((P.pos.z + 200) / 100));

      /* ---- Fehlerzaehler ---- */
      if (d.inWasser && d.inWasser(P.pos.x, P.pos.z) && P.pos.y < 0) fehler.imWasser++;
      if (imKollider(P.pos.x, P.pos.z, P.pos.y + 0.9)) fehler.imHaus++;
      if (P.pos.y < d.groundYAt(P.pos.x, P.pos.z, P.pos.y) - 0.6) fehler.unterBoden++;
      /* ---- Nach dem Tod weiterspielen ----
         Das Spiel wartet nach einem K.o. auf einen Tastendruck - richtig
         so, ein Mensch drueckt Enter. Dieses Skript hat den Tastendruck
         nie gemacht: es zaehlte nur die toten Bilder und fuhr sein
         Drehbuch an einer Leiche weiter ab.

         Was das kostet, zeigt der Lauf, in dem es aufgefallen ist:
         87.205 von 108.000 Bildern tot - achtzig Prozent der Messung.
         Fuenf Punkte der Auftragsliste (Netz-Zip, Klettern runter,
         Klettern seitlich, Wandsprung, Dachhocke) kamen deshalb nicht
         vor, und der frueher gemeldete Satz "alle 26 Punkte vorgekommen"
         stimmte nur, weil die Figur in JENEM Lauf zufaellig nicht starb.

         Jetzt wird wiederbelebt wie ein Spieler: gezaehlt werden die
         Tode und die laengste Totzeit am Stueck - beides Zahlen, die
         etwas bedeuten. */
      if (P.dead) {
        fehler.totBilder++;
        totAmStueck++;
        if (totAmStueck > fehler.laengsteTotzeit) fehler.laengsteTotzeit = totAmStueck;
        if (totAmStueck > 60 && d.respawn) { d.respawn(); fehler.tode++; totAmStueck = 0; }
      } else totAmStueck = 0;

      /* ---- Zeitreihe ---- */
      if (i % PROBE === 0) {
        for (const e of (d.evStand() || [])) if (!gesehen.ev.has(e.id)) { gesehen.ev.add(e.id); T.verbrechen++; }
        for (const a of (d.aktListe() || [])) if (!gesehen.akt.has(a.id)) { gesehen.akt.add(a.id); T.zivileAktivitaet++; }
        for (const p of (d.poiListe() || [])) if (p.besucht && !gesehen.poi.has(p.id)) gesehen.poi.add(p.id);
        const hyg = d.hygStatistik ? d.hygStatistik() : {};
        daten.jsFehler.push(jsFehler);
        daten.failLogger.push(d.poseFehler ? d.poseFehler().length : 0);
        daten.szeneObjekte.push(zaehleSzene());
        daten.gegner.push((d.enemies || []).length);
        daten.zivilisten.push((d.civilians || []).length);
        daten.fahrzeuge.push((d.cars || []).length);
        daten.ereignisse.push((d.evStand() || []).length);
        daten.bosse.push(d.bossListe ? d.bossListe().length : 0);
        daten.projektile.push((d.geschosse || []).length);
        daten.netze.push(netzeOffen());
        daten.marker.push(d.samListe ? d.samListe().filter((x) => !x.weg).length : 0);
        daten.aktivitaeten.push((d.aktListe() || []).length);
        daten.hygieneOffen.push((hyg.vorgemerkt || 0) - (hyg.abgebaut || 0));
        daten.einsaetze.push(d.respAnzahl ? d.respAnzahl().einsaetze : 0);
        daten.lichter.push(zaehleLichter());
      }
    }
    T.bezirke = gesehen.bez.size;
    T.verbrechenBeendet = d.evStatistik ? (d.evStatistik().geloest || 0) : 0;
    T.poiBesucht = gesehen.poi.size;

    return { T, fehler, daten, reihen,
             bilder: GESAMT,
             stand: d.progStand ? d.progStand() : null,
             evStat: d.evStatistik ? d.evStatistik() : null,
             respStat: d.respStatistik ? d.respStatistik() : null,
             hyg: d.hygStatistik ? d.hygStatistik() : null,
             validZaehler: d.validZaehler ? d.validZaehler() : null,
             poseFehler: d.poseFehler ? d.poseFehler().slice(0, 5) : [],
             /* Die Aufschluesselung entsteht IN der Seite: viertausend
                Eintraege mit ihren Clipgewichten herauszureichen waere
                ein Vielfaches des ganzen uebrigen Berichts. */
             poseAufstellung: (() => {
               if (!d.poseFehler) return null;
               const L = d.poseFehler();
               const nachArt = {}, nachZustand = {}, nachClip = {}, nachKnochen = {};
               const hoehen = {}, abstaende = {};
               let maxAbstand = 0, maxE = null;
               for (const e of L) {
                 nachArt[e.art] = (nachArt[e.art] || 0) + 1;
                 nachZustand[e.zustand || '?'] = (nachZustand[e.zustand || '?'] || 0) + 1;
                 nachClip[e.clip || '?'] = (nachClip[e.clip || '?'] || 0) + 1;
                 const k = e.wert && e.wert.knochen;
                 if (k) nachKnochen[k] = (nachKnochen[k] || 0) + 1;
                 const a = e.wert && e.wert.abstand;
                 if (typeof a === 'number' && k) (abstaende[k] = abstaende[k] || []).push(a);
                 if (typeof a === 'number' && a > maxAbstand) {
                   maxAbstand = a;
                   maxE = { knochen: k || '?', zustand: e.zustand, clip: e.clip };
                 }
                 /* Wie WEIT ueber der Huefte? Eine Zahl von 0,16 ist ein
                    Grenzfall, eine von 0,60 ist die Haltung des Clips
                    selbst - und dann meldet der Logger keine Fehler,
                    sondern eine Absicht. */
                 const u = e.wert && e.wert.ueberHuefte;
                 if (typeof u === 'number') {
                   const c = e.clip || '?';
                   (hoehen[c] = hoehen[c] || []).push(u);
                 }
               }
               const hoehenStat = {};
               for (const c in hoehen) {
                 const v = hoehen[c].slice().sort((a2, b2) => a2 - b2);
                 hoehenStat[c] = { n: v.length, min: +v[0].toFixed(3),
                                   median: +v[Math.floor(v.length / 2)].toFixed(3),
                                   max: +v[v.length - 1].toFixed(3) };
               }
               const knochenStat = {};
               for (const k2 in abstaende) {
                 const v = abstaende[k2].slice().sort((a2, b2) => a2 - b2);
                 knochenStat[k2] = { n: v.length, median: +v[Math.floor(v.length / 2)].toFixed(3),
                                     max: +v[v.length - 1].toFixed(3) };
               }
               return { gesamt: L.length, nachArt, nachZustand, nachClip, nachKnochen,
                        hoehenStat, knochenStat,
                        maxAbstand: +maxAbstand.toFixed(3), maxE };
             })() };
  });

  function trend(y) {
    const n = y.length; if (n < 2) return 0;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sxx += i * i; }
    const nn = n * sxx - sx * sx;
    return nn ? ((n * sxy - sx * sy) / nn) * (n - 1) : 0;
  }

  const T = aus.T, B = aus.bilder;
  const p = (n) => (100 * n / B).toFixed(1).padStart(5) + ' %';
  console.log('');
  console.log('=== Test A: 30 Minuten aktives Spiel (' + B + ' Bilder) ===');
  console.log('');
  console.log('Die Auftragsliste - was WIRKLICH vorgekommen ist:');
  const zeilen = [
    ['laufen', T.laufen, 'Bilder'], ['sprinten', T.sprinten, 'Bilder'],
    ['springen', T.springen, 'mal'], ['schwingen', T.schwingen, 'Bilder'],
    ['Netz wechseln', T.netzWechsel, 'mal'], ['Netz-Zip', T.netzZip, 'Bilder'],
    ['freier Fall', T.freierFall, 'Bilder'], ['gleiten', T.gleiten, 'Bilder'],
    ['landen', T.landen, 'mal'], ['Wandkontakt', T.wandKontakt, 'Bilder'],
    ['klettern hoch', T.kletternHoch, 'Bilder'], ['klettern runter', T.kletternRunter, 'Bilder'],
    ['klettern seitlich', T.kletternSeit, 'Bilder'], ['Wandlauf', T.wandlauf, 'Bilder'],
    ['Wandsprung', T.wandsprung, 'mal'], ['Dachhocke', T.dachhocke, 'Bilder'],
    ['Kampf (Schlaege)', T.kampfSchlaege, 'mal'], ['Netzschuss', T.netzschuss, 'mal'],
    ['Verbrechen erlebt', T.verbrechen, 'Stueck'], ['davon geloest', T.verbrechenBeendet, 'Stueck'],
    ['zivile Aktivitaet', T.zivileAktivitaet, 'Stueck'], ['POI besucht', T.poiBesucht, 'Stueck'],
    ['U-Bahn (unter Tage)', T.ubahn, 'Bilder'], ['Zugkontakt', T.zugKontakt, 'Bilder'],
    ['Fahrzeugkontakt', T.fahrzeugKontakt, 'Bilder'], ['Stadtbezirke beruehrt', T.bezirke, 'Stueck'],
  ];
  let luecken = 0;
  for (const [n, v, e] of zeilen) {
    const leer = v === 0;
    if (leer) luecken++;
    console.log('  ' + n.padEnd(24) + String(v).padStart(9) + ' ' + e.padEnd(7) +
                (leer ? '   NICHT VORGEKOMMEN' : ''));
  }
  console.log('');
  console.log('  ' + (luecken === 0 ? 'Alle 26 Punkte der Liste sind vorgekommen.'
                                    : luecken + ' Punkt(e) der Liste sind NICHT vorgekommen.'));
  console.log('');
  console.log('Zeitreihen (alle 15 s abgetastet, ' + aus.daten.szeneObjekte.length + ' Messpunkte):');
  console.log('  ' + 'Reihe'.padEnd(16) + 'START'.padStart(9) + 'ENDE'.padStart(9) +
              'MIN'.padStart(9) + 'MAX'.padStart(9) + 'TREND'.padStart(11));
  console.log('  ' + '-'.repeat(63));
  const waechst = [];
  for (const r of aus.reihen) {
    const y = aus.daten[r]; if (!y.length) continue;
    const tr = trend(y);
    const mittel = y.reduce((a, v) => a + v, 0) / y.length;
    const echt = Math.abs(tr) > Math.max(2, mittel * 0.05);
    /* ---- Der Fail-Logger laeuft VOLL, er waechst nicht ----
       POSE_LOG nimmt hoechstens 4000 Eintraege an (game.js: "if
       (POSE_LOG.fehler.length > 4000) return"). Steht die Reihe am Ende
       bei 4001, ist die Steigung nur die Fuellkurve bis zum Deckel, und
       "WAECHST" waere hier eine Falschaussage ueber die Welt. */
    const gedeckelt = r === 'failLogger' && y[y.length - 1] >= 4001;
    /* Der Fail-Logger ist ein SUMMENZAEHLER: er kann nur steigen. Ihn in
       derselben Spalte wie die Bestandsreihen (Gegner, Fahrzeuge,
       Marker) als "WAECHST" zu fuehren, waere eine Falschaussage - die
       Frage dieser Tabelle ist, ob etwas in der Welt anwaechst und nicht
       mehr abgebaut wird. Fuer den Logger zaehlt stattdessen die RATE. */
    const summe = r === 'failLogger';
    if (echt && tr > 0 && !gedeckelt && !summe) waechst.push(r);
    console.log('  ' + r.padEnd(16) + String(y[0]).padStart(9) + String(y[y.length - 1]).padStart(9) +
                String(Math.min(...y)).padStart(9) + String(Math.max(...y)).padStart(9) +
                ((tr >= 0 ? '+' : '') + tr.toFixed(1)).padStart(11) +
                (gedeckelt ? '  am Deckel (4000)'
                           : summe ? '  Summe: ' +
                               (y[y.length - 1] / 30).toFixed(1) + ' je Minute'
                           : echt ? (tr > 0 ? '  WAECHST' : '  faellt') : ''));
  }
  console.log('  ' + '-'.repeat(63));
  console.log('  ' + (waechst.length === 0 ? 'Kein Wachstumstrend in keiner Reihe.'
                                           : 'Wachstumstrend in: ' + waechst.join(', ')));
  console.log('');
  console.log('Fehlerzaehler:');
  console.log('  JS-Fehler (Seite)      ' + seitenFehler.length +
              (seitenFehler.length ? ': ' + seitenFehler.slice(0, 2).join(' | ') : ''));
  console.log('  Fail-Logger (Haltung)  ' + (aus.daten.failLogger.slice(-1)[0] || 0));
  if (aus.poseAufstellung && aus.poseAufstellung.gesamt) {
    /* ---- Aufschluesseln, nicht nur zaehlen ----
       Eine Zahl wie "4001" sagt nichts darueber, ob EIN Zustand
       tausendfach meldet oder zehn Zustaende je vierhundertmal. Die
       Schwellen des Fail-Loggers sind pro Wandmodus verschieden
       (WAND_KONTAKT_MAX 0,55 gegen WAND_KONTAKT_MAX_LAUF 1,10), also
       muss die Aufstellung Zustand UND Clip nennen. */
    const A = aus.poseAufstellung;
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 6)
                       .map(([k, v]) => k + ' ' + v).join(', ');
    console.log('    nach Art:      ' + top(A.nachArt));
    console.log('    nach Zustand:  ' + top(A.nachZustand));
    console.log('    nach Clip:     ' + top(A.nachClip));
    console.log('    nach Knochen:  ' + top(A.nachKnochen));
    if (A.hoehenStat && Object.keys(A.hoehenStat).length) {
      console.log('    Fuss ueber Huefte (Schwelle 0,15 m), je Clip:');
      for (const [c, v] of Object.entries(A.hoehenStat).sort((a, b) => b[1].n - a[1].n))
        console.log('      ' + c.padEnd(12) + ' n=' + String(v.n).padStart(5) +
                    '  min ' + v.min + '  Median ' + v.median + '  max ' + v.max);
    }
    if (A.knochenStat && Object.keys(A.knochenStat).length) {
      console.log('    Abstand zur Wand (Schwellen 0,55 / Kriechen 0,95 / Lauf 1,10), je Knochen:');
      for (const [k2, v] of Object.entries(A.knochenStat).sort((a, b) => b[1].n - a[1].n))
        console.log('      ' + k2.padEnd(12) + ' n=' + String(v.n).padStart(5) +
                    '  Median ' + v.median + '  max ' + v.max);
    }
    if (A.maxE) console.log('    groesster Abstand: ' + A.maxAbstand + ' m (' +
                            A.maxE.knochen + ', ' + A.maxE.zustand + '/' + A.maxE.clip + ')');
    if (aus.poseFehler.length)
      console.log('    z.B. ' + JSON.stringify(aus.poseFehler[0]).slice(0, 160));
  }
  console.log('  im Wasser              ' + aus.fehler.imWasser + ' Bilder');
  console.log('  im Haus                ' + aus.fehler.imHaus + ' Bilder');
  console.log('  unter dem Boden        ' + aus.fehler.unterBoden + ' Bilder');
  console.log('  tot                    ' + aus.fehler.totBilder + ' Bilder' +
    ' (' + aus.fehler.tode + ' Tode, laengste Totzeit ' +
    (aus.fehler.laengsteTotzeit / 60).toFixed(1) + ' s)');
  console.log('');
  if (aus.stand) console.log('Fortschritt:', JSON.stringify(aus.stand));
  if (aus.hyg) console.log('Hygiene:', JSON.stringify(aus.hyg));
  if (aus.validZaehler) console.log('Valid:', JSON.stringify(aus.validZaehler));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ aus, seitenFehler }, null, 2));
  await b.close();
})();
