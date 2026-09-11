/* Punkt 10: technische Regression der Kernsysteme.
   ===================================================================
   Die Bewegungs- und Stadtsysteme haben eigene Pruefstaende (Wandlauf,
   Schwingen, Bruecke, Freigaengigkeit, ...). Was dort fehlte, sind die
   SYSTEME, die im Hintergrund laufen: Story Akt 1, Ereignisregie,
   Boss-Lebenszyklus, Polizei und Rettung, Welthygiene.

   Hier wird jedes davon technisch durchgefahren - nicht auf Spielgefuehl
   geprueft, sondern darauf, dass es startet, laeuft, sauber endet und
   nichts liegen laesst. Gemessen ueber die Statistikzaehler, die das
   Spiel ohnehin fuehrt.
   =================================================================== */
const { starte } = require('./basis');
const fs = require('fs');

(async () => {
  const { b, page } = await starte(800, 480, Number(process.argv[3]) || 4711);
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e.message).slice(0, 160)));
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const lauf = (n) => { for (let i = 0; i < n; i++) d.schritt(1 / 60); };
    const E = {};

    /* ---- 1. Story Akt 1: alle Missionen technisch ---- */
    const defs = d.storyDefs();
    E.story = { missionen: defs.length, gestartet: 0, phasenDurch: 0,
                beendet: 0, haengen: [], fehler: [] };
    if (d.gibPunkte) d.gibPunkte(200000);       // Stufenschranken oeffnen
    for (const m of defs) {
      try {
        d.storyAufraeumen && d.storyAufraeumen();
        if (d.storyEnde && d.storyStand().aktiv) d.storyEnde('abbruch');
        lauf(30);
        const ok = d.storyStarte(m.id, 0);
        if (!ok) { E.story.fehler.push({ id: m.id, grund: 'startet nicht' }); continue; }
        E.story.gestartet++;
        /* Durch alle Phasen zwingen - geprueft wird, ob jede Phase
           annimmt und der Auftrag am Ende wirklich schliesst. */
        let phasen = 0;
        for (let p = 0; p < m.phasen + 2; p++) {
          if (!d.storyStand().aktiv) break;
          d.storyPhaseErzwingen();
          lauf(20);
          phasen++;
        }
        E.story.phasenDurch += phasen;
        if (d.storyStand().aktiv) {
          E.story.haengen.push({ id: m.id, titel: m.titel, nachPhasen: phasen });
          d.storyEnde('abbruch'); lauf(20);
        } else E.story.beendet++;
      } catch (e) { E.story.fehler.push({ id: m.id, grund: String(e.message).slice(0, 90) }); }
    }
    d.storyAufraeumen && d.storyAufraeumen();
    lauf(60);

    /* ---- 2. Ereignisregie ---- */
    const evVor = d.evStatistik();
    if (d.evRuheAus) d.evRuheAus();
    for (let i = 0; i < 5; i++) { try { d.evStarte(); } catch (e) {} lauf(60); }
    lauf(60 * 40);
    const evNach = d.evStatistik();
    E.ereignisse = { gestartet: evNach.gestartet - evVor.gestartet,
                     geloest: evNach.geloest - evVor.geloest,
                     gescheitert: evNach.gescheitert - evVor.gescheitert,
                     aufraeumFehler: evNach.aufraeumFehler,
                     offen: (d.evStand() || []).length,
                     leck: d.evLeck ? d.evLeck() : null };
    if (d.evAlleBeenden) d.evAlleBeenden();
    lauf(120);
    E.ereignisse.offenNachAufraeumen = (d.evStand() || []).length;

    /* ---- 3. Boss-Lebenszyklus ---- */
    const bVor = d.bossStatistik();
    let bossDa = false;
    try { bossDa = !!d.spawnBoss('ENFORCER'); } catch (e) {}
    lauf(60 * 5);
    E.boss = { erzeugt: bossDa, imSpiel: d.bossListe().length,
               statistikVor: bVor };
    if (d.bossListe().length) {
      const bo = d.bossListe()[0];
      E.boss.phase = bo.phase !== undefined ? bo.phase : null;
      if (d.bossEntfernen) { d.bossEntfernen(); lauf(120); }
    }
    E.boss.nachEntfernen = d.bossListe().length;
    E.boss.statistikNach = d.bossStatistik();

    /* ---- 4. Polizei und Rettung ---- */
    const rVor = d.respStatistik();
    try { d.respTest && d.respTest('polizei', P.pos.x + 30, P.pos.z); } catch (e) {}
    try { d.respTest && d.respTest('ems', P.pos.x - 30, P.pos.z); } catch (e) {}
    lauf(60 * 60);
    const rNach = d.respStatistik();
    E.einsatz = { angefordert: rNach.angefordert - rVor.angefordert,
                  ausgerueckt: rNach.ausgerueckt - rVor.ausgerueckt,
                  angekommen: rNach.angekommen - rVor.angekommen,
                  erledigt: rNach.erledigt - rVor.erledigt,
                  aufraeumFehler: rNach.aufraeumFehler,
                  ohneHaltepunkt: rNach.ohneHaltepunkt,
                  offen: d.respAnzahl().einsaetze,
                  leck: d.respLeck ? d.respLeck() : null };

    /* ---- 5. Welthygiene ---- */
    E.hygiene = d.hygStatistik();
    E.valid = d.validZaehler ? d.validZaehler() : null;

    /* ---- 6. Fortschritt und Spielstand ---- */
    E.fortschritt = d.progStand ? { punkte: d.progStand().punkte, stufe: d.progStand().stufe } : null;
    E.aktivitaetenLeck = d.aktLeck ? d.aktLeck() : null;

    /* ---- 7. Stadtmoebel: stehen sie noch? ---- */
    E.stadtmoebel = { felder: (d.moebelFelder() || []).length,
                      gesamt: (d.moebelFelder() || []).reduce((a, f) => a + f.gesamt, 0) };

    return E;
  });

  const ok = (b2) => b2 ? 'ok' : 'BEFUND';
  console.log('');
  console.log('=== Kernsysteme: technische Regression ===');
  console.log('');
  const S = aus.story;
  console.log('1. Story Akt 1');
  console.log('   Missionen: ' + S.missionen + '   gestartet: ' + S.gestartet +
              '   sauber beendet: ' + S.beendet + '   Phasen durchlaufen: ' + S.phasenDurch);
  console.log('   haengengeblieben: ' + S.haengen.length + '   Startfehler: ' + S.fehler.length +
              '   ' + ok(S.gestartet === S.missionen && S.haengen.length === 0 && S.fehler.length === 0));
  for (const h of S.haengen.slice(0, 4)) console.log('     haengt: ' + JSON.stringify(h));
  for (const f of S.fehler.slice(0, 4)) console.log('     Fehler: ' + JSON.stringify(f));

  const EV = aus.ereignisse;
  console.log('');
  console.log('2. Ereignisregie');
  console.log('   gestartet ' + EV.gestartet + ', geloest ' + EV.geloest +
              ', gescheitert ' + EV.gescheitert);
  console.log('   Aufraeumfehler ' + EV.aufraeumFehler + ', Leck ' + EV.leck +
              ', offen nach Aufraeumen ' + EV.offenNachAufraeumen +
              '   ' + ok(EV.aufraeumFehler === 0 && !EV.leck && EV.offenNachAufraeumen === 0));

  console.log('');
  console.log('3. Boss-Lebenszyklus');
  console.log('   erzeugt ' + aus.boss.erzeugt + ', im Spiel ' + aus.boss.imSpiel +
              ', nach Entfernen ' + aus.boss.nachEntfernen +
              '   ' + ok(aus.boss.nachEntfernen === 0));

  const R = aus.einsatz;
  console.log('');
  console.log('4. Polizei und Rettung');
  console.log('   angefordert ' + R.angefordert + ', ausgerueckt ' + R.ausgerueckt +
              ', angekommen ' + R.angekommen + ', erledigt ' + R.erledigt);
  console.log('   Aufraeumfehler ' + R.aufraeumFehler + ', ohne Haltepunkt ' + R.ohneHaltepunkt +
              ', Leck ' + R.leck + '   ' + ok(R.aufraeumFehler === 0 && !R.leck));

  console.log('');
  console.log('5. Welthygiene: ' + JSON.stringify(aus.hygiene));
  console.log('   Valid-Zaehler: ' + JSON.stringify(aus.valid));
  console.log('');
  console.log('6. Fortschritt: ' + JSON.stringify(aus.fortschritt) +
              '   Aktivitaetenleck: ' + aus.aktivitaetenLeck);
  console.log('7. Stadtmoebel: ' + JSON.stringify(aus.stadtmoebel));
  console.log('');
  console.log('Seitenfehler: ' + seitenFehler.length +
              (seitenFehler.length ? '  ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ aus, seitenFehler }, null, 2));
  await b.close();
})();
