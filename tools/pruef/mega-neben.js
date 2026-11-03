/* Mega-Update 1.0, M5: Nebenreihe "Die Schatten der Stadt" und Mini-Boss.
   =========================================================================
   Alles mit echten Eingaben - dieselben Funktionen, die Tasten und Maus
   ausloesen (W/Shift ueber d.taste, Linksklick = tryAttack('punch'),
   Q = webShot, C = interagieren, J = storyTaste, Enter = respawn).
   Abgekuerzt wird nur die ANREISE zu einem Einsatzort: der Held startet
   35 m davor (der Weg durch die Stadt ist nicht Teil des Tests). Der
   Empfang im Kai 7 wird dagegen echt benutzt: vor der Tuer C, drinnen
   zum Empfang laufen, C, zum Ausgang laufen, C.
   Wie in tools/pruef/mega-bot.js wird der Held zwischen den Schritten
   geheilt, sobald er unter 60 % faellt - getestet wird der Ablauf, nicht
   wie lange ein Bot einen Kampf uebersteht. Ausnahme: der Teil 'scheitern'
   laesst ihn absichtlich K.o. gehen.

   Teile (teil=alle oder Liste):
     orte       die drei festen Einsatzorte: gueltig, Stadtteil, Abstand
     reihe      I -> II -> III am Stueck: Phasen, Ziele, Leuchtturm,
                Spuren, Verfolgung, Koffer, SCHATTEN (Rauchsprung, Netz-
                Schwaeche, Phasen), Belohnung, Aufraeumen
     scheitern  I: Beobachter entkommt -> gescheitert, Kontrollpunkt
                bleibt, Wiedereinstieg am Empfang ab genau der Phase;
                II: K.o. und Wegrennen
     abbruch    zweimal J: abgebrochen, nichts bleibt stehen
     konflikt   Akt 1 laeuft -> Empfang lehnt ab; Nebenauftrag laeuft ->
                keine Storymission, J bietet Abbruch; PROG.story und
                STORY.statistik bleiben unberuehrt; Akt 1 danach startbar
     speichern  Neuladen mitten im Auftrag (Kontrollpunkt) und nach dem
                Abschluss; alter Stand (Version 3) wird gehoben ohne
                Verlust; kaputte Eintraege werden bereinigt

   Aufruf:  node tools/pruef/mega-neben.js [teil=alle] [keim=4711] [aus=datei.json]
   Exit 1, wenn eine Pruefung fehlschlaegt.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const { botCode } = require('./mega-neben-bot');

const arg = (k, std) => {
  const a = process.argv.find((x) => x.startsWith(k + '='));
  return a ? a.slice(k.length + 1) : std;
};
const TEILE = arg('teil', 'alle');
const KEIM = Number(arg('keim', 4711));
const AUS = arg('aus', null);
const will = (t) => TEILE === 'alle' || TEILE.split(',').includes(t);

const pruef = [];
const ok = (name, bed, wert) => {
  pruef.push({ name, ok: !!bed, wert });
  console.log('PRUEF ' + (bed ? 'ok    ' : 'FEHLER') + '  ' + name + (wert === undefined ? '' : '  ' + JSON.stringify(wert)));
};

(async () => {
  const { b, page } = await starte(800, 480, KEIM, { frierSofort: true });
  const seitenFehler = [];
  page.on('pageerror', (e) => seitenFehler.push(String(e)));
  const neu = async () => {
    await page.evaluate(botCode);
    await page.evaluate(() => { __dbg.frier(true); const o = document.getElementById('overlay'); if (o) o.style.display = 'none'; });
  };
  await neu();
  const E = (fn, a) => page.evaluate(fn, a);
  const ergebnis = { keim: KEIM };

  /* ================= orte ================= */
  if (will('orte') || will('reihe')) {
    const o = await E(() => {
      const N = __dbg.neben, T = __dbg.mega.orteTueren().buero;
      const raus = {};
      for (const id of ['s1', 's2', 's3']) {
        const p = N.ort(id);
        raus[id] = { x: +p.x.toFixed(2), z: +p.z.toFixed(2), art: p.art, gueltig: N.punktOk(p.x, p.z),
                     abstandKai: +Math.hypot(p.x - T.qx, p.z - T.qz).toFixed(1) };
      }
      return raus;
    });
    ergebnis.orte = o;
    console.log('ORTE', JSON.stringify(o));
    ok('orte: alle drei gueltig (Strassenebene, kein Haus, kein Wasser)', o.s1.gueltig && o.s2.gueltig && o.s3.gueltig, o);
    ok('orte: mindestens 80 m vom Kai 7', ['s1', 's2', 's3'].every((k) => o[k].abstandKai >= 80));
    ok('orte: I im Geschaefts-/Zentrumsviertel', ['GESCHAEFT', 'ZENTRUM', 'MISCHUNG'].includes(o.s1.art), o.s1.art);
  }

  /* ================= reihe ================= */
  if (will('reihe')) {
    const vor = await E(() => ({ story: __dbg.neben.storyAblage(), storyStat: Object.assign({}, __dbg.story.statistik),
                                  punkte: __dbg.player.score, bosse: __dbg.prog.statistik.bosse,
                                  zustand: ['s1', 's2', 's3'].map((id) => __dbg.neben.zustand(id)) }));
    ok('reihe: am Anfang I offen, II und III gesperrt', vor.zustand.join() === 'VERFUEGBAR,GESPERRT,GESPERRT', vor.zustand);
    for (const id of ['s1', 's2', 's3']) {
      const em = await E(() => window.__nb.empfang());
      console.log('EMPFANG ' + id, JSON.stringify(em));
      ok(id + ': Tuer, Empfang, Ausgang mit echten Eingaben', em.drinnen && em.draussen &&
         /betreten/.test(em.hinweisTuer || '') && /Hinausgehen/.test(em.hinweisAusgang || ''), em);
      ok(id + ': am Empfang angenommen ("Auftrag annehmen")', em.nachher === id && /Auftrag annehmen/.test(em.hinweisEmpfang || ''),
         { hinweis: em.hinweisEmpfang, aktiv: em.nachher });
      const punkteVor = await E(() => __dbg.player.score);
      const r = await E(() => window.__nb.spiele({ max: 300 }));
      const nach = await E(() => ({ ablage: __dbg.neben.ablage(), punkte: __dbg.player.score, stand: __dbg.storyStand() }));
      const rest = await E(() => ({ storyGegner: __dbg.enemies.filter((e) => e.storyGegner && !e.dead).length,
                                    missionArt: __dbg.storyStand().missionArt, marken: __dbg.neben.marken(),
                                    beacon: (() => { let v = null; __dbg.szene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters && o.geometry.parameters.height >= 50) v = o.visible; }); return v; })() }));
      ergebnis[id] = { empfang: em, lauf: r, nach, rest };
      console.log(id.toUpperCase() + ' Phasen ' + r.phasen.map((p) => p[0] + ':' + p[1] + '@' + p[2]).join(' > '));
      console.log(id.toUpperCase() + ' Ausgang ' + r.ausgang + '  Bilder ' + r.bilder + '  hpMin ' + Math.round(r.hpMin) +
                  '  Rauch ' + JSON.stringify(r.rauch));
      ok(id + ': Auftrag abgeschlossen', r.ausgang === 'beendet' && nach.ablage.fertig.includes(id), nach.ablage);
      ok(id + ': alle Phasen durchlaufen', r.phasen.length === (id === 's1' ? 4 : id === 's2' ? 5 : 3), r.phasen.map((p) => p[0]));
      ok(id + ': Belohnung gutgeschrieben', nach.punkte > punkteVor, nach.punkte - punkteVor);
      ok(id + ': Kontrollpunkt danach geloescht', nach.ablage.checkpointId === null);
      ok(id + ': aufgeraeumt (keine Auftragsgegner, kein Auftrag, keine Marken)',
         rest.storyGegner === 0 && rest.missionArt === null && rest.marken === 0, rest);
      if (id === 's1') {
        ok('s1: drei Spuren mit C untersucht, Marken sichtbar', r.spurenGesehen.length === 3 && r.maxMarken === 3,
           { spuren: r.spurenGesehen.length, marken: r.maxMarken });
        ok('s1: Beobachter gefunden und geflohen (Verfolgung)', r.beobachterFlucht);
      }
      if (id === 's2') ok('s2: Koffer gezeigt und mit C gesichert', r.kofferGesehen && r.statistik.koffer >= 1);
      if (id === 's3') {
        const R = r.rauch;
        ok('s3: SCHATTEN springt in den Rauch (mindestens 2x)', R.spruenge >= 2, R.spruenge);
        ok('s3: im Rauch unsichtbar und nicht zu treffen', R.sichtbarImRauch === 0 && R.trefferImRauch === 0,
           { sichtbar: R.sichtbarImRauch, treffer: R.trefferImRauch });
        ok('s3: taucht 2,4 m neben dem Helden auf, nie in einem Haus', R.abstand.length > 0 &&
           R.abstand.every((a) => a > 1.4 && a < 3.6) && R.ungueltig === 0, R.abstand);
        ok('s3: Netz beim Auftauchen reisst ihn aus dem Rauch (Schwaeche)', R.gerissen >= 1, { gerissen: R.gerissen, netz: R.netzImFenster });
        ok('s3: alle drei Bossphasen erreicht', [0, 1, 2].every((p) => R.phasenBoss.includes(p)), R.phasenBoss);
        ok('s3: Bossleiste gezeigt', r.bossLeiste);
        ok('s3: Sieg zaehlt nicht als ENFORCER', (await E(() => __dbg.prog.statistik.bosse)) === vor.bosse);
      }
    }
    const nachAlles = await E(() => ({ story: __dbg.neben.storyAblage(), storyStat: Object.assign({}, __dbg.story.statistik),
                                        neben: __dbg.prog.statistik.nebenAuftraege,
                                        zustand: ['s1', 's2', 's3'].map((id) => __dbg.neben.zustand(id)),
                                        empfangText: __dbg.neben.empfangText() }));
    ok('reihe: PROG.story unveraendert (keine Storyflags, kein Kontrollpunkt)', JSON.stringify(nachAlles.story) === JSON.stringify(vor.story));
    ok('reihe: Story-Statistik unveraendert', JSON.stringify(nachAlles.storyStat) === JSON.stringify(vor.storyStat));
    ok('reihe: drei Nebenauftraege gezaehlt', nachAlles.neben === 3, nachAlles.neben);
    ok('reihe: alle erledigt, Empfang bietet nichts mehr an', nachAlles.zustand.join() === 'ERLEDIGT,ERLEDIGT,ERLEDIGT' &&
       nachAlles.empfangText === null, nachAlles);
  }

  /* Testaufbau fuer die folgenden Teile: die Nebenreihe von vorn bzw. ab
     einem bestimmten Stand. Das ist ein Ausgangszustand wie setzePos -
     gespielt wird danach wieder mit echten Eingaben. */
  const nebenStand = (fertig) => E((fertig) => {
    const n = __dbg.prog.neben;
    n.fertig.length = 0; for (const id of fertig) n.fertig.push(id);
    n.checkpointId = null; n.checkpointPhase = 0;
    return __dbg.neben.ablage();
  }, fertig);
  const nachDemEnde = () => E(() => ({
    aktiv: __dbg.storyStand().aktiv, missionArt: __dbg.storyStand().missionArt,
    storyGegner: __dbg.enemies.filter((e) => e.storyGegner && !e.dead).length,
    marken: __dbg.neben.marken(), ablage: __dbg.neben.ablage(), stat: __dbg.neben.statistik(),
    objective: (document.getElementById('objective') || {}).style ? document.getElementById('objective').style.display : null }));
  const taste = (code) => E((code) => { document.dispatchEvent(new KeyboardEvent('keydown', { code, key: code }));
                                         document.dispatchEvent(new KeyboardEvent('keyup', { code, key: code })); }, code);

  /* ================= scheitern ================= */
  if (will('scheitern')) {
    await nebenStand([]);
    const em = await E(() => window.__nb.empfang());
    ok('scheitern: I am Empfang gestartet', em.nachher === 's1', em.nachher);
    /* bis der Beobachter flieht - dann bleibt der Bot stehen */
    const r1 = await E(() => window.__nb.spiele({ max: 300, stopBei: (info) => info.phase === 2 && info.beobachter && info.beobachter.flucht }));
    const r2 = await E(() => { const d = __dbg, B = window.__nb; B.stopp(); let n = 0;
      for (; n < 60 * 100 && d.storyStand().aktiv === 's1'; n++) B.schritt(1); return { sekunden: +(n / 60).toFixed(1) }; });
    const s1 = await nachDemEnde();
    console.log('SCHEITERN entkommen', JSON.stringify({ r1: r1.ausgang, r2, s1 }));
    ok('scheitern: Beobachter entkommt -> gescheitert (nicht abgeschlossen)', s1.aktiv === null && s1.stat.entkommen >= 1 &&
       s1.stat.gescheitert >= 1 && !s1.ablage.fertig.includes('s1'), { stat: s1.stat, sekunden: r2.sekunden });
    ok('scheitern: Kontrollpunkt bleibt auf der Phase "Beobachter"', s1.ablage.checkpointId === 's1' && s1.ablage.checkpointPhase === 2, s1.ablage);
    ok('scheitern: aufgeraeumt (keine Auftragsgegner, keine Marken, kein Auftrag)',
       s1.storyGegner === 0 && s1.marken === 0 && s1.missionArt === null, s1);
    const em2 = await E(() => window.__nb.empfang());
    ok('scheitern: Empfang bietet "Weitermachen" an und steigt genau dort wieder ein',
       /Weitermachen/.test(em2.hinweisEmpfang || '') && em2.nachher === 's1' && em2.phase === 2, em2);
    const r3 = await E(() => window.__nb.spiele({ max: 300 }));
    const s1b = await nachDemEnde();
    ok('scheitern: nach dem Wiedereinstieg abgeschlossen', r3.ausgang === 'beendet' && s1b.ablage.fertig.includes('s1'),
       { phasen: r3.phasen.map((p) => p[0]), ablage: s1b.ablage });

    /* K.o. in Schatten II, waehrend die Bande im Hof steht */
    await E(() => window.__nb.empfang());
    await E(() => window.__nb.spiele({ max: 300, stopBei: (info) => info.phase === 3 && info.aufgebaut && info.gegner >= 4 }));
    const ko = await E(() => { const d = __dbg, B = window.__nb, P = d.player; B.heilen = false; B.stopp();
      P.hp = Math.min(P.hp, 4); let n = 0;
      for (; n < 60 * 40 && !P.dead; n++) B.schritt(1);
      const tot = P.dead;
      return { tot, sekunden: +(n / 60).toFixed(1), aktivImKo: d.storyStand().aktiv }; });
    await taste('Enter');
    const nachKo = await E(() => { const d = __dbg, B = window.__nb; for (let i = 0; i < 30; i++) B.schritt(1); B.heilen = true;
      return { lebt: !d.player.dead, aktiv: d.storyStand().aktiv }; });
    const s2 = await nachDemEnde();
    console.log('SCHEITERN K.o.', JSON.stringify({ ko, nachKo, s2 }));
    ok('scheitern: K.o. (echte Treffer der Bande) -> gescheitert nach dem Aufstehen', ko.tot && nachKo.lebt && s2.aktiv === null, { ko, nachKo });
    ok('scheitern: K.o. behaelt den Kontrollpunkt (II, Phase 3)', s2.ablage.checkpointId === 's2' && s2.ablage.checkpointPhase === 3, s2.ablage);
    ok('scheitern: nach K.o. aufgeraeumt', s2.storyGegner === 0 && s2.missionArt === null, s2);
    const em3 = await E(() => window.__nb.empfang());
    ok('scheitern: II steigt in Phase 3 wieder ein, die Bande steht erst bei Ankunft', em3.nachher === 's2' && em3.phase === 3,
       { phase: em3.phase, gegnerVorAnkunft: await E(() => __dbg.neben.daten().gegner) });
    const r4 = await E(() => window.__nb.spiele({ max: 300 }));
    ok('scheitern: II danach abgeschlossen', r4.ausgang === 'beendet' && (await E(() => __dbg.neben.ablage())).fertig.includes('s2'),
       r4.phasen.map((p) => p[0]));

    /* Wegrennen in Schatten III */
    await E(() => window.__nb.empfang());
    await E(() => window.__nb.spiele({ max: 200, stopBei: (info) => info.phase === 1 && info.aufgebaut }));
    const weg = await E(() => { const d = __dbg, B = window.__nb; const o = d.neben.daten().ort;
      let ziel = null;
      for (let r = 200; r < 400 && !ziel; r += 25) for (let k = 0; k < 16 && !ziel; k++) {
        const a = k / 16 * Math.PI * 2, x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
        if (d.neben.punktOk(x, z)) ziel = { x, z };
      }
      if (ziel) B.setze(ziel.x, ziel.z);
      for (let i = 0; i < 30; i++) B.schritt(1);
      return { versetzt: !!ziel, aktiv: d.storyStand().aktiv }; });
    const s3 = await nachDemEnde();
    ok('scheitern: zu weit vom Treffpunkt -> gescheitert, Kontrollpunkt III Phase 1', weg.versetzt && s3.aktiv === null &&
       s3.ablage.checkpointId === 's3' && s3.ablage.checkpointPhase === 1, { weg, ablage: s3.ablage });
  }

  /* ================= abbruch ================= */
  if (will('abbruch')) {
    await nebenStand(['s1']);
    await E(() => window.__nb.empfang());
    await E(() => window.__nb.spiele({ max: 200, stopBei: (info) => info.phase === 1 && info.aufgebaut }));
    const vorher = await E(() => ({ story: Object.assign({}, __dbg.story.statistik), gegner: __dbg.neben.daten().gegner }));
    await taste('KeyJ');
    const nachEinem = await E(() => { const B = window.__nb; B.schritt(2); return __dbg.storyStand().aktiv; });
    await taste('KeyJ');
    const ab = await E(() => { const B = window.__nb; B.schritt(10); return true; });
    const s = await nachDemEnde();
    const nachher = await E(() => Object.assign({}, __dbg.story.statistik));
    console.log('ABBRUCH', JSON.stringify({ vorher, nachEinem, s }));
    ok('abbruch: einmal J fragt nur nach (Auftrag laeuft weiter)', nachEinem === 's2', nachEinem);
    ok('abbruch: zweimal J bricht ab, Kontrollpunkt geloescht, II bleibt offen',
       s.aktiv === null && s.ablage.checkpointId === null && !s.ablage.fertig.includes('s2') && s.stat.abgebrochen >= 1, s.ablage);
    ok('abbruch: nichts bleibt stehen (Gegner, Marken, Auftrag)', s.storyGegner === 0 && s.marken === 0 && s.missionArt === null, s);
    ok('abbruch: Story-Statistik unberuehrt', JSON.stringify(nachher) === JSON.stringify(vorher.story));
  }

  /* ================= konflikt ================= */
  if (will('konflikt')) {
    await nebenStand([]);
    const vorStory = await E(() => __dbg.neben.storyAblage());
    /* Akt 1 laeuft -> die Tuer des Kai 7 nimmt niemanden auf */
    const k1 = await E(() => {
      const d = __dbg, B = window.__nb, P = d.player;
      const gestartet = d.storyStarte('m1');
      const T = d.mega.orteTueren().buero;
      B.setze(T.ex + T.nx * 0.6, T.ez + T.nz * 0.6); P.facing = Math.atan2(-T.nx, -T.nz);
      B.schritt(8);
      const hinweis = d.mega.prompt();
      d.mega.interagieren(); B.schritt(30);
      const drin = !!d.innen.active;
      const empfangText = d.neben.empfangText();
      return { gestartet, aktiv: d.storyStand().aktiv, hinweis, drin, empfangText };
    });
    ok('konflikt: waehrend Akt 1 laeuft, kein Betreten des Kai 7 und kein Nebenangebot',
       k1.gestartet && k1.aktiv === 'm1' && !k1.drin && !/betreten/.test(k1.hinweis || '') && k1.empfangText === null, k1);
    await taste('KeyJ'); await E(() => window.__nb.schritt(2)); await taste('KeyJ'); await E(() => window.__nb.schritt(5));
    /* Nebenauftrag laeuft -> J startet keine Storymission, das Angebot ruht */
    const k2 = await E(() => {
      const d = __dbg, B = window.__nb;
      return { nachAbbruch: d.storyStand().aktiv };
    });
    const em = await E(() => window.__nb.empfang());
    const k3 = await E(() => {
      const d = __dbg, B = window.__nb;
      for (let i = 0; i < 60 * 8; i++) B.schritt(1);           // Angebotstakt laufen lassen
      return { aktiv: d.storyStand().aktiv, angebot: d.storyStand().angebot, missionArt: d.storyStand().missionArt };
    });
    await taste('KeyJ');
    const k4 = await E(() => { window.__nb.schritt(2); return __dbg.storyStand().aktiv; });
    ok('konflikt: Akt-1-Auftrag sauber abgebrochen, dann Nebenauftrag am Empfang', k2.nachAbbruch === null && em.nachher === 's1', { k2, em: em.nachher });
    ok('konflikt: waehrend des Nebenauftrags kein Storyangebot und J startet nichts', k3.aktiv === 's1' && k3.angebot === null && k4 === 's1', { k3, k4 });
    await taste('KeyJ'); await E(() => window.__nb.schritt(5));          // zweites J: Abbruch
    const r = await E(() => window.__nb.empfang());
    const lauf = await E(() => window.__nb.spiele({ max: 300 }));
    const nach = await E(() => ({ story: __dbg.neben.storyAblage(), offen: __dbg.storyStand().angebot,
                                  m1: __dbg.storyStarte('m1'), aktiv: __dbg.storyStand().aktiv }));
    ok('konflikt: PROG.story nach Abbruch und Nebenauftrag unveraendert', JSON.stringify(nach.story.fertig) === JSON.stringify(vorStory.fertig) &&
       JSON.stringify(nach.story.flags) === JSON.stringify(vorStory.flags), { vor: vorStory, nach: nach.story });
    ok('konflikt: Akt 1 danach normal startbar', lauf.ausgang === 'beendet' && nach.m1 && nach.aktiv === 'm1',
       { lauf: lauf.ausgang, phasen: lauf.phasen, m1: nach.m1, empfang: r.nachher, daten: await E(() => __dbg.neben.daten()),
         rest: await E(() => __dbg.enemies.filter((e) => e.storyGegner && !e.dead).map((e) => ({
           art: e.typ.art, pos: [+e.pos.x.toFixed(1), +e.pos.y.toFixed(1), +e.pos.z.toFixed(1)], state: e.state,
           custody: !!e.policeCustody, flieht: !!e.flieht, webT: +(e.webT || 0).toFixed(1),
           dHeld: +Math.hypot(e.pos.x - __dbg.player.pos.x, e.pos.z - __dbg.player.pos.z).toFixed(1),
           held: [+__dbg.player.pos.x.toFixed(1), +__dbg.player.pos.y.toFixed(1), +__dbg.player.pos.z.toFixed(1), __dbg.player.state] }))) });
    await taste('KeyJ'); await E(() => window.__nb.schritt(2)); await taste('KeyJ'); await E(() => window.__nb.schritt(5));
  }

  /* ================= speichern ================= */
  if (will('speichern')) {
    /* 1. Speicherpruefung ohne Neuladen: alter Stand, kaputte Eintraege */
    const mig = await E(() => {
      const N = __dbg.neben;
      const alt = { version: 3, weltKeim: 4711, punkte: 12345, bestPunkte: 15000, ruf: 77, fertigkeitspunkte: 2,
                    skills: {}, poi: ['a'], marken: [], bestzeiten: {}, meilensteine: [], bezirke: {}, einmalig: [], kosmetik: [],
                    story: { akt: 1, fertig: ['m1', 'm2'], gescheitert: [], flags: { mehrere: true }, checkpointId: 'm3', checkpointPhase: 1 },
                    statistik: { spielzeit: 999, crimes: 7, gerettet: 3, bosse: 1, flowKetten: 4, besterFlow: 110 } };
      const a = N.pruefe(alt);
      const kaputt = N.pruefe(Object.assign({}, alt, { version: 4,
        neben: { fertig: ['s1', 's1', 'x9', 42], checkpointId: 's9', checkpointPhase: 99, flags: { gut: 1 } } }));
      const fertigCk = N.pruefe(Object.assign({}, alt, { version: 4, neben: { fertig: ['s1'], checkpointId: 's1', checkpointPhase: 2 } }));
      const phaseZuGross = N.pruefe(Object.assign({}, alt, { version: 4, neben: { fertig: [], checkpointId: 's3', checkpointPhase: 7 } }));
      return { a, kaputt: kaputt.neben, fertigCk: fertigCk.neben, phaseZuGross: phaseZuGross.neben, version: N.saveVersion() };
    });
    console.log('MIGRATION', JSON.stringify(mig));
    ok('speichern: Version 4', mig.version === 4 && mig.a.version === 4);
    ok('speichern: alter Stand (3) behaelt Punkte, Ruf, Geschichte, Kontrollpunkt, Statistik',
       mig.a.punkte === 12345 && mig.a.bestPunkte === 15000 && mig.a.ruf === 77 && mig.a.fertigkeitspunkte === 2 &&
       mig.a.story.fertig.join() === 'm1,m2' && mig.a.story.flags.mehrere === true && mig.a.story.checkpointId === 'm3' &&
       mig.a.statistik.crimes === 7 && mig.a.statistik.flowKetten === 4 && mig.a.statistik.besterFlow === 110, mig.a.story);
    ok('speichern: alter Stand bekommt die Nebenreihe offen, Zaehler 0', JSON.stringify(mig.a.neben) ===
       JSON.stringify({ fertig: [], checkpointId: null, checkpointPhase: 0, flags: {} }) && mig.a.statistik.nebenAuftraege === 0, mig.a.neben);
    ok('speichern: kaputte Eintraege bereinigt (Dubletten, unbekannte Kennungen, Phase)',
       mig.kaputt.fertig.join() === 's1' && mig.kaputt.checkpointId === null && mig.kaputt.checkpointPhase === 0 && mig.kaputt.flags.gut === true, mig.kaputt);
    ok('speichern: Kontrollpunkt eines erledigten Auftrags faellt weg', mig.fertigCk.checkpointId === null, mig.fertigCk);
    ok('speichern: zu grosse Phase wird auf die letzte Phase begrenzt', mig.phaseZuGross.checkpointId === 's3' && mig.phaseZuGross.checkpointPhase === 2, mig.phaseZuGross);

    /* 2. Echter Neustart mitten im Auftrag: Kontrollpunkt ueberlebt */
    await nebenStand(['s1']);
    await E(() => { __dbg.progSpeichern(true); });
    await E(() => window.__nb.empfang());
    await E(() => window.__nb.spiele({ max: 200, stopBei: (info) => info.phase === 2 }));
    /* der Spielstand wird im normalen Takt geschrieben (hoechstens alle 30 s) */
    await E(() => { const B = window.__nb; B.stopp(); for (let i = 0; i < 60 * 32; i++) B.schritt(1); });
    const vorNeu = await E(() => ({ ablage: __dbg.neben.ablage(), roh: JSON.parse(__dbg.progRoh() || '{}').neben, punkte: __dbg.player.score,
                                    ort: __dbg.neben.ort('s2') }));
    await page.reload();
    await page.waitForFunction(() => window.__dbg && window.__dbg.actorsReady, { timeout: 150000 });
    await page.waitForTimeout(2500);
    await neu();
    const nachNeu = await E(() => ({ ablage: __dbg.neben.ablage(), aktiv: __dbg.storyStand().aktiv, version: __dbg.prog.version,
                                     zustand: ['s1', 's2', 's3'].map((id) => __dbg.neben.zustand(id)), orte: __dbg.neben.ort('s2'),
                                     punkte: __dbg.player.score }));
    console.log('NEULADEN', JSON.stringify({ vorNeu, nachNeu }));
    ok('speichern: nach dem Neuladen I erledigt, II unterbrochen in Phase 2, nichts laeuft',
       nachNeu.ablage.fertig.join() === 's1' && nachNeu.ablage.checkpointId === 's2' && nachNeu.ablage.checkpointPhase === 2 &&
       nachNeu.aktiv === null && nachNeu.version === 4, nachNeu);
    ok('speichern: Punkte ueberleben den Neustart', nachNeu.punkte >= vorNeu.punkte - 1, { vor: vorNeu.punkte, nach: nachNeu.punkte });
    ok('speichern: derselbe Einsatzort nach dem Neuladen', Math.abs(nachNeu.orte.x - vorNeu.ort.x) < 0.01 &&
       Math.abs(nachNeu.orte.z - vorNeu.ort.z) < 0.01, { vor: vorNeu.ort, nach: nachNeu.orte });
    const em = await E(() => window.__nb.empfang());
    ok('speichern: Empfang setzt II in Phase 2 fort', em.nachher === 's2' && em.phase === 2 && /Weitermachen/.test(em.hinweisEmpfang || ''), em);
    const r = await E(() => window.__nb.spiele({ max: 300 }));
    const fertig = await E(() => ({ ablage: __dbg.neben.ablage(), roh: JSON.parse(__dbg.progRoh() || '{}').neben }));
    ok('speichern: Abschluss wird sofort geschrieben', r.ausgang === 'beendet' && fertig.roh && fertig.roh.fertig.includes('s2') &&
       fertig.roh.checkpointId === null, fertig.roh);
  }

  console.log('\nSeitenfehler: ' + seitenFehler.length + (seitenFehler.length ? ' ' + seitenFehler.slice(0, 3).join(' | ') : ''));
  ok('keine Seitenfehler', seitenFehler.length === 0, seitenFehler.slice(0, 3));
  ergebnis.pruef = pruef;
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));
  await b.close();
  const fehler = pruef.filter((p) => !p.ok).length;
  console.log('\nERGEBNIS ' + (pruef.length - fehler) + '/' + pruef.length);
  process.exit(fehler ? 1 : 0);
})();
