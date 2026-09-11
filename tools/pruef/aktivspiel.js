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
    const fehler = { imWasser: 0, imHaus: 0, unterBoden: 0, totBilder: 0 };

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
      /* 4 Netz-Zip an Fassaden */
      (s) => { frei(); d.taste('KeyW', true);
               const w = wandSuche();
               if (w && s % 6 === 0) zuPunkt((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2);
               if (s % 180 === 0) d.webZip && d.webZip();
               if (s % 180 === 45) d.tippeSprung(); },
      /* 5 Wandkontakt, klettern hoch, seitlich, runter */
      (s) => {
        frei();
        if (s === 0) { merkWand = wandSuche();
          if (merkWand) { d.setzePos(merkWand.x0 - 1.0, 12, (merkWand.z0 + merkWand.z1) / 2);
                          P.state = 'air'; P.onGround = false; zuPunkt(merkWand.x0 + 5, (merkWand.z0 + merkWand.z1) / 2); } }
        d.taste('KeyZ', true);
        if (s < 600) d.taste('KeyW', true);
        else if (s < 900) d.taste('KeyA', true);
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
      /* 8 Kampf: Verbrechen suchen, hin, schlagen, Netzschuss */
      (s) => {
        frei();
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
        } else { d.taste('KeyW', true); d.taste('Space', true);
                 if (s % 140 === 0) { d.webShot && d.webShot(); T.netzschuss++; } }
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
      /* 10 U-Bahn: hinunter, Bahnsteig, Zug */
      (s) => {
        frei();
        if (s === 0) { const liste = d.ubahnen() || [];
          const st = liste[Math.floor(Math.random() * liste.length)];
          if (st) { d.setzePos(st.x, -8.6, (st.dz || 0) + 24);
                    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); } }
        /* auf einen haltenden Zug zugehen */
        const zug = (d.zuegeRoh() || []).find((t) => Math.abs(t.x - P.pos.x) < 60 && P.pos.y < -5);
        if (zug) { zuPunkt(zug.x, zug.z); d.taste('KeyW', true); }
        else d.taste('KeyW', true);
      },
      /* 11 Fahrzeugkontakt: auf ein Autodach */
      (s) => {
        frei();
        const auto = (d.cars || []).find((c) => !c.aus &&
          Math.hypot(c.mesh.position.x - P.pos.x, c.mesh.position.z - P.pos.z) < 60);
        if (auto) { zuPunkt(auto.mesh.position.x, auto.mesh.position.z);
                    d.taste('KeyW', true);
                    if (Math.hypot(auto.mesh.position.x - P.pos.x,
                                   auto.mesh.position.z - P.pos.z) < 12 && s % 60 === 0) d.tippeSprung(); }
        else { d.taste('KeyW', true); }
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
      if (P.dead) fehler.totBilder++;

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
             poseFehler: d.poseFehler ? d.poseFehler().slice(0, 5) : [] };
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
    if (echt && tr > 0) waechst.push(r);
    console.log('  ' + r.padEnd(16) + String(y[0]).padStart(9) + String(y[y.length - 1]).padStart(9) +
                String(Math.min(...y)).padStart(9) + String(Math.max(...y)).padStart(9) +
                ((tr >= 0 ? '+' : '') + tr.toFixed(1)).padStart(11) +
                (echt ? (tr > 0 ? '  WAECHST' : '  faellt') : ''));
  }
  console.log('  ' + '-'.repeat(63));
  console.log('  ' + (waechst.length === 0 ? 'Kein Wachstumstrend in keiner Reihe.'
                                           : 'Wachstumstrend in: ' + waechst.join(', ')));
  console.log('');
  console.log('Fehlerzaehler:');
  console.log('  JS-Fehler (Seite)      ' + seitenFehler.length +
              (seitenFehler.length ? ': ' + seitenFehler.slice(0, 2).join(' | ') : ''));
  console.log('  Fail-Logger (Haltung)  ' + (aus.daten.failLogger.slice(-1)[0] || 0));
  if (aus.poseFehler.length) console.log('    z.B. ' + JSON.stringify(aus.poseFehler[0]).slice(0, 160));
  console.log('  im Wasser              ' + aus.fehler.imWasser + ' Bilder');
  console.log('  im Haus                ' + aus.fehler.imHaus + ' Bilder');
  console.log('  unter dem Boden        ' + aus.fehler.unterBoden + ' Bilder');
  console.log('  tot                    ' + aus.fehler.totBilder + ' Bilder');
  console.log('');
  if (aus.stand) console.log('Fortschritt:', JSON.stringify(aus.stand));
  if (aus.hyg) console.log('Hygiene:', JSON.stringify(aus.hyg));
  if (aus.validZaehler) console.log('Valid:', JSON.stringify(aus.validZaehler));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ aus, seitenFehler }, null, 2));
  await b.close();
})();
