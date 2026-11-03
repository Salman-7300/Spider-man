/* Teil 22: Spielstand und Fortschritt.
   Geprueft wird ueber den ECHTEN Weg - progSchreib() legt Text in den
   Speicher, progLaden() liest ihn, progStand() sagt, was ankam. Kein
   Nachbau der Pruefroutine.

   Aufruf:  node spielstand.js
   ========================================================================= */
const { starte } = require('./basis');

function pruefe(name, bedingung, zusatz) {
  const ok = !!bedingung;
  console.log((ok ? 'ok   ' : 'FEHL ') + name + (zusatz ? '   ' + zusatz : ''));
  return ok;
}

(async () => {
  const { b, page } = await starte(700, 420, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg;
    const berichte = {};
    /* progStand() zeigt den LAUFENDEN Spielstand (player.score). Was auf
       der Platte steht, liegt in d.prog - und genau das prueft diese
       Datei. Der Punktestand wandert nur beim Programmstart einmal von
       PROG.punkte nach player.score (game.js: player.score = PROG.punkte),
       nicht bei jedem progLaden(). */
    const schreibUndLade = (obj) => {
      d.progSchreib(typeof obj === 'string' ? obj : JSON.stringify(obj));
      d.progLaden();
      const P = d.prog;
      return { punkte: P.punkte, bestPunkte: P.bestPunkte, ruf: P.ruf,
               weltKeim: P.weltKeim, poi: P.poi.length, marken: P.marken.length,
               meilensteine: P.meilensteine, bestzeiten: P.bestzeiten,
               bezirke: P.bezirke, statistik: P.statistik,
               story: JSON.parse(JSON.stringify(P.story)),
               skills: Object.assign({}, P.skills) };
    };

    /* ---- 1. Hin und zurueck: nichts geht verloren ---- */
    d.progZuruecksetzen();
    const voll = {
      version: 3, weltKeim: 4711, punkte: 12345, bestPunkte: 20000,
      ruf: 73.5, fertigkeitspunkte: 4,
      poi: ['p1', 'p2', 'p7'], marken: ['m3', 'm9'],
      meilensteine: ['erste_marke'], einmalig: ['bezirk:nw'],
      kosmetik: ['anzug_klassisch'],
      story: { akt: 1, fertig: [], gescheitert: [], flags: { hatGeholfen: true },
               checkpointId: null, checkpointPhase: 0 },
      skills: {}, bestzeiten: { rennen_a: 42.7 },
      bezirke: { nw: { poi: 3, marken: 2, her: 1, crime: 5 } },
      statistik: { spielzeit: 1234.5 },
    };
    const s1 = schreibUndLade(voll);
    berichte.rundlauf = {
      punkte: s1.punkte, bestPunkte: s1.bestPunkte, poi: s1.poi,
      marken: s1.marken, meilensteine: s1.meilensteine.length,
      bestzeit: s1.bestzeiten.rennen_a,
      bezirkPoi: s1.bezirke.nw ? s1.bezirke.nw.poi : null,
      spielzeit: Math.round(s1.statistik.spielzeit),
      weltKeim: s1.weltKeim,
    };

    /* ---- 2. Kaputtes JSON darf das Spiel nicht anhalten ---- */
    let s2 = null, fehler2 = null;
    try { s2 = schreibUndLade('{das ist kein json'); }
    catch (e) { fehler2 = String(e && e.message || e); }
    berichte.kaputt = { fehler: fehler2, punkte: s2 ? s2.punkte : null,
                        poi: s2 ? s2.poi : null };

    /* ---- 3. Boesartige Werte ---- */
    const boese = {
      version: 3, weltKeim: -5, punkte: -999999, bestPunkte: 1e30,
      ruf: 5000, fertigkeitspunkte: 9999,
      poi: new Array(5000).fill('p1'),
      marken: [{ }, null, 'm1', 12, 'm2'],
      meilensteine: 'kein Array',
      einmalig: [], kosmetik: [],
      story: { akt: 99, fertig: ['gibt_es_nicht'], gescheitert: [],
               flags: { ['x'.repeat(80)]: true }, checkpointId: 'erfunden',
               checkpointPhase: 999 },
      skills: { gibt_es_nicht: 99 },
      bestzeiten: { a: -3, b: 99999, c: 'text' },
      bezirke: { nw: { poi: -4, marken: 1e9, her: 'x', crime: 3 } },
      statistik: { spielzeit: -50 },
    };
    let s3 = null, fehler3 = null;
    try { s3 = schreibUndLade(boese); } catch (e) { fehler3 = String(e && e.message || e); }
    berichte.boese = s3 ? {
      fehler: fehler3, punkte: s3.punkte, bestPunkte: s3.bestPunkte,
      ruf: s3.ruf, poi: s3.poi, marken: s3.marken,
      storyAkt: s3.story ? s3.story.akt : null,
      storyFertig: s3.story ? s3.story.fertig.length : null,
      weltKeim: s3.weltKeim,
      bezirkPoi: s3.bezirke.nw ? s3.bezirke.nw.poi : null,
      spielzeit: s3.statistik.spielzeit,
    } : { fehler: fehler3 };

    /* ---- 4. Alte Fassung wird gehoben, ohne etwas zu verlieren ---- */
    d.progZuruecksetzen();
    const alt = { version: 1, weltKeim: 4711, punkte: 700, best: 900,
                  poi: ['p4'], marken: [], meilensteine: [], einmalig: [],
                  kosmetik: [], skills: {}, bestzeiten: {}, bezirke: {},
                  statistik: {} };
    const s4 = schreibUndLade(alt);
    berichte.migration = { punkte: s4.punkte, bestPunkte: s4.bestPunkte,
                           poi: s4.poi, storyAkt: s4.story ? s4.story.akt : null };

    /* ---- 5. Zuruecksetzen laesst nichts stehen ---- */
    d.progZuruecksetzen();
    const P5 = d.prog;
    berichte.zurueck = { punkte: P5.punkte, poi: P5.poi.length,
                         marken: P5.marken.length, roh: d.progRoh() };

    /* ---- 6. Schreiben und Wiederlesen in derselben Sitzung ---- */
    d.punkteGeben(3);
    d.progSpeichern(true);
    const roh = d.progRoh();
    d.progLaden();
    berichte.schreiben = { rohDa: !!roh, laenge: roh ? roh.length : 0,
                           punkteNachher: d.prog.fertigkeitspunkte };
    return berichte;
  });

  let schlecht = 0;
  const P = (n, c, z) => { if (!pruefe(n, c, z)) schlecht++; };
  const r = aus.rundlauf;
  P('Hin und zurueck: Punkte', r.punkte === 12345, 'gelesen ' + r.punkte);
  P('Hin und zurueck: Bestpunkte', r.bestPunkte === 20000, 'gelesen ' + r.bestPunkte);
  P('Hin und zurueck: POI und Marken', r.poi === 3 && r.marken === 2,
    'POI ' + r.poi + ', Marken ' + r.marken);
  P('Hin und zurueck: Bestzeit', r.bestzeit === 42.7, 'gelesen ' + r.bestzeit);
  P('Hin und zurueck: Bezirk', r.bezirkPoi === 3, 'gelesen ' + r.bezirkPoi);
  P('Hin und zurueck: Spielzeit', r.spielzeit === 1235 || r.spielzeit === 1234,
    'gelesen ' + r.spielzeit);

  const k = aus.kaputt;
  P('Kaputtes JSON: kein Absturz', k.fehler === null, k.fehler || '');
  P('Kaputtes JSON: frischer Stand', k.punkte === 0 && k.poi === 0,
    'Punkte ' + k.punkte + ', POI ' + k.poi);

  const bo = aus.boese;
  P('Boese Werte: kein Absturz', !bo.fehler, bo.fehler || '');
  P('Boese Werte: Punkte nicht negativ', bo.punkte >= 0, 'gelesen ' + bo.punkte);
  P('Boese Werte: Bestpunkte gedeckelt', bo.bestPunkte <= 1e9, 'gelesen ' + bo.bestPunkte);
  P('Boese Werte: Ruf im Bereich', bo.ruf >= 0 && bo.ruf <= 100, 'gelesen ' + bo.ruf);
  P('Boese Werte: POI-Liste gedeckelt', bo.poi <= 200, 'gelesen ' + bo.poi);
  P('Boese Werte: nur Texte in Marken', bo.marken === 2, 'gelesen ' + bo.marken);
  P('Boese Werte: erfundene Mission faellt weg', bo.storyFertig === 0,
    'gelesen ' + bo.storyFertig);
  /* Ein unbrauchbarer Keim muss auf den Keim der GEBAUTEN Stadt
     zurueckfallen (hier der Testkeim 4711), nicht auf irgendeine 1 -
     sonst zeigen alle gespeicherten Orte ins Leere. */
  P('Boese Werte: Weltkeim faellt auf die gebaute Stadt zurueck',
    bo.weltKeim === 4711, 'gelesen ' + bo.weltKeim);
  P('Boese Werte: Spielzeit nicht negativ', bo.spielzeit >= 0, 'gelesen ' + bo.spielzeit);

  const m = aus.migration;
  P('Alte Fassung: Punkte bleiben', m.punkte === 700, 'gelesen ' + m.punkte);
  P('Alte Fassung: "best" wird "bestPunkte"', m.bestPunkte === 900, 'gelesen ' + m.bestPunkte);
  P('Alte Fassung: POI bleiben', m.poi === 1, 'gelesen ' + m.poi);
  P('Alte Fassung: Geschichte faengt bei Akt 1 an', m.storyAkt === 1, 'gelesen ' + m.storyAkt);

  const z = aus.zurueck;
  P('Zuruecksetzen: nichts bleibt stehen',
    z.punkte === 0 && z.poi === 0 && z.marken === 0 && !z.roh,
    'Punkte ' + z.punkte + ', Rohtext ' + (z.roh ? 'da' : 'weg'));

  const sc = aus.schreiben;
  P('Schreiben und Wiederlesen', sc.rohDa && sc.laenge > 20, 'Laenge ' + sc.laenge);

  console.log('\nPruefungen fehlerhaft: ' + schlecht);
  await b.close();
  process.exit(schlecht ? 1 : 0);
})();
