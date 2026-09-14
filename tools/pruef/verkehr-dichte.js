/* CITY V2, Stufe 4: wie voll ist die Stadt wirklich?

   "Sieht voller aus" ist keine Groesse. Dieser Pruefstand misst je
   Kandidat dieselben Zahlen, an denselben Orten, zur selben Tageszeit:

     - wieviele Fahrzeuge fahren ueberhaupt (verkehrsAnteil haengt an der
       Tageszeit, deshalb wird sie fest gesetzt)
     - wieviele davon sind in 50, 100 und 150 m um den Spieler
     - wie verteilen sie sich auf die vier Strassenklassen
     - was macht die Bruecke: auf der Brueckenstrasse, Richtung Bruecke,
       auf dem Deck, und vollstaendige Durchfahrten je Minute
     - Zeichenaufrufe und sichtbare Dreiecke an festen Kamerastellen
     - was ein Simulationsschritt kostet

   Die harten Fehlerzaehler laufen mit: neben der Fahrbahn, im Wasser,
   Ortssprung, Geisterfahrer. Sie muessen null bleiben.

   Der Pruefstand streut - deshalb mehrere Laeufe je Kandidat und
   Mediane. Ein einzelner Lauf entscheidet hier nichts.

   Aufruf:  node tools/pruef/verkehr-dichte.js [autos] [sekunden] [laeufe]
   ========================================================================= */
const { starte } = require('./basis');
const AUTOS = Number(process.argv[2]) || 0;         // 0 = Vorgabe aus CFG
const SEK = Number(process.argv[3]) || 300;
const LAEUFE = Number(process.argv[4]) || 3;

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2);
};

async function einLauf(nr) {
  const { b, page } = await starte(960, 540, 4711, { autos: AUTOS || undefined });
  const aus = await page.evaluate(async ([SEK, nr]) => {
    const d = __dbg;
    d.frier(true);
    if (d.zufallKeim) d.zufallKeim(4711 + nr * 101);
    /* Feste Tageszeit: verkehrsAnteil() macht sonst aus derselben
       Fahrzeugzahl mal 28, mal 100 Prozent. 0,33 ist Berufsverkehr. */
    if (window.__setzeZeit) window.__setzeZeit(0.33);
    const R = d.raster();
    const str = d.strassen();
    const klasseVon = (car) => {
      const qa = car.axis === 'x' ? 'z' : 'x';
      const o = qa === 'x' ? R.x0 : R.z0, n = qa === 'x' ? R.blocksX : R.blocksZ;
      const linie = o + Math.max(0, Math.min(n, Math.round((car.lane - o) / R.pitch))) * R.pitch;
      const s = str.find((t) => t.achse === qa && Math.abs(t.linie - linie) < 0.5);
      return s ? s.klasse : null;
    };
    /* Bruecke: dieselben Masse wie im Spiel. */
    const BZ = -25, BR_X0 = 181, BR_X1 = 334, RIVER_X0 = 192;
    const aufDeck = (x, z) => x > BR_X0 && x < BR_X1 && Math.abs(z - BZ) < 10;

    const Z = { proben: 0, aktiv: [], nah50: [], nah100: [], nah150: [],
                klassen: { LOCAL: 0, STREET: 0, AVENUE: 0, BOULEVARD: 0 },
                brStrasse: 0, brRichtung: 0, brDeck: 0, durchfahrten: 0,
                nebenFahrbahn: 0, imWasser: 0, ortsSprung: 0, geisterfahrer: 0,
                ineinander: 0, inGleicheSpur: 0, inNachbarSpur: 0, inKreuzend: 0,
                langStand: 0, maxStand: 0, parkend: 0 };
    const seite = new Map(), stand = new Map(), vorher = new Map();
    const wanderung = [[0, 0], [-140, -140], [140, 140], [-250, 40], [120, -200],
                       [160, -25], [-60, 160], [-300, 200]];
    const dt = 1 / 60;
    const t0 = performance.now();
    let schritte = 0;
    for (let i = 0; i < 60 * SEK; i++) {
      if (i % (60 * 60) === 0) {
        const w = wanderung[(i / (60 * 60)) % wanderung.length];
        d.setzePos(w[0], 40, w[1]);
      }
      /* Die Uhr laeuft weiter, und verkehrsAnteil() macht aus derselben
         Fahrzeugzahl je nach Tageszeit 28 bis 100 Prozent. Beim ersten
         Versuch war die Zeit nur EINMAL gesetzt - nach zwei Minuten waren
         von 26 Wagen nur noch 20 unterwegs, und der Vergleich zweier
         Kandidaten haette die Uhr gemessen statt die Dichte. */
      if (i % 60 === 0 && window.__setzeZeit) window.__setzeZeit(0.33);
      d.schritt(dt); schritte++;
      /* ---- Die erste Sekunde zaehlt nicht ----
         Beim Start steht das Modell eines Wagens noch nicht auf seiner
         Fahrspur; die weiche Nachfuehrung holt das in den ersten Bildern
         auf. Nachgemessen Bild fuer Bild: der letzte Aufholschritt war
         3,49 m in EINEM Bild, und nach Bild 13 kam ueber vier Minuten
         kein einziger mehr. Ueber ein Messfenster von 0,25 s summiert
         sich das auf mehr als 12 m und stand als "Ortssprung" im
         Bericht - ein Startbild, kein Fahrfehler. */
      if (i < 60) continue;
      if (i % 15) continue;
      Z.proben++;
      const P = d.player.pos;
      let aktiv = 0, n50 = 0, n100 = 0, n150 = 0;
      const wach = [];
      for (const c of d.cars) {
        if (c.aus) { stand.set(c, 0); vorher.set(c, null); continue; }
        aktiv++; wach.push(c);
        const p = c.mesh.position, x = p.x, z = p.z;
        const dd = Math.hypot(x - P.x, z - P.z);
        if (dd <= 50) n50++;
        if (dd <= 100) n100++;
        if (dd <= 150) n150++;
        const k = klasseVon(c);
        if (k) Z.klassen[k]++;
        /* Bruecke */
        const aufBrStrasse = c.axis === 'x' && Math.abs(c.lane - BZ) < 6;
        if (aufBrStrasse) {
          Z.brStrasse++;
          if (c.dir > 0 && c.s < RIVER_X0) Z.brRichtung++;
          const s2 = x < BR_X0 ? -1 : x > BR_X1 ? 1 : 0;
          const alt = seite.get(c);
          if (s2 !== 0 && alt !== undefined && alt !== 0 && alt !== s2) Z.durchfahrten++;
          if (s2 !== 0) seite.set(c, s2); else if (alt === undefined) seite.set(c, 0);
        }
        if (aufDeck(x, z)) Z.brDeck++;
        /* Harte Fehlerzaehler */
        const u = ((x - R.x0) % R.pitch + R.pitch) % R.pitch;
        const v = ((z - R.z0) % R.pitch + R.pitch) % R.pitch;
        const aufStrasse = aufDeck(x, z) || x > R.x1 + 6
          || u <= 7 || u >= R.pitch - 7 || v <= 7 || v >= R.pitch - 7;
        if (!aufStrasse) Z.nebenFahrbahn++;
        if (x > RIVER_X0 && x < 330 && !aufDeck(x, z)) Z.imWasser++;
        const t = (c.tempoJetzt || 0) < 0.05 ? (stand.get(c) || 0) + 0.25 : 0;
        stand.set(c, t);
        if (t > 12) Z.langStand++;
        if (t > Z.maxStand) Z.maxStand = t;
        const vo = vorher.get(c);
        if (vo && Math.hypot(x - vo[0], z - vo[1]) > 12) Z.ortsSprung++;
        vorher.set(c, [x, z]);
        const qa = c.axis === 'x' ? 'z' : 'x';
        const o = qa === 'x' ? R.x0 : R.z0, nn = qa === 'x' ? R.blocksX : R.blocksZ;
        const kl = o + Math.max(0, Math.min(nn, Math.round((c.lane - o) / R.pitch))) * R.pitch;
        const soll = c.lane > kl ? 1 : -1;
        if (!c.flucht && !c.notfall && !aufDeck(x, z) && c.kurve <= 0 && c.dir !== soll)
          Z.geisterfahrer++;
      }
      for (let a = 0; a < wach.length; a++)
        for (let c = a + 1; c < wach.length; c++) {
          const A = wach[a], B = wach[c];
          const pa = A.mesh.position, pb = B.mesh.position;
          if (Math.hypot(pa.x - pb.x, pa.z - pb.z) >= 2.5) continue;
          Z.ineinander++;
          if (A.axis !== B.axis) Z.inKreuzend++;
          else if (Math.abs(A.lane - B.lane) < 0.6) Z.inGleicheSpur++;
          else Z.inNachbarSpur++;
        }
      Z.aktiv.push(aktiv); Z.nah50.push(n50); Z.nah100.push(n100); Z.nah150.push(n150);
    }
    const msJeSchritt = (performance.now() - t0) / schritte;
    Z.parkend = d.parkAutos ? d.parkAutos().length : 0;
    return { Z, msJeSchritt: +msJeSchritt.toFixed(3), autos: d.cars.length, SEK };
  }, [SEK, nr]);

  /* Bild und Zaehler an festen Kamerastellen - Strassenhoehe. */
  const bild = await page.evaluate(() => {
    const d = __dbg, R = d.raster();
    const stellen = [[-125, 2.2, 0, -125, 2, 120], [25, 2.2, 0, 120, 2, 0],
                     [R.x0 + 25, 2.2, 0, R.x0 + 120, 2, 0], [172, 2.2, -25, 330, 2, -25]];
    const aus = [];
    for (const [px, py, pz, zx, zy, zz] of stellen) {
      let r = null;
      for (let i = 0; i < 3; i++) { d.aufnahme(px, py, pz, zx, zy, zz); r = d.renderInfo(); }
      aus.push({ calls: r.calls, dreiecke: r.dreiecke });
    }
    return aus;
  });
  await page.context().browser().close();
  return { ...aus, bild };
}

(async () => {
  const alle = [];
  for (let i = 0; i < LAEUFE; i++) alle.push(await einLauf(i));
  const p = (s) => console.log(s);
  const med = (f) => median(alle.map(f));
  const z = (f) => alle.map(f);
  p('');
  p('== Kandidat: ' + (AUTOS || 'Vorgabe') + ' Fahrzeuge im Umlauf, ' +
    LAEUFE + ' Laeufe je ' + SEK + ' s ==');
  p('  im Umlauf gebaut: ' + alle[0].autos);
  p('');
  p('  Groesse                 Median      Einzelwerte');
  const zeile = (name, f) => p('  ' + name.padEnd(22) + String(med(f)).padStart(9) +
                               '      ' + z(f).join('  '));
  zeile('gleichzeitig aktiv', (a) => median(a.Z.aktiv));
  zeile('sichtbar in 50 m', (a) => median(a.Z.nah50));
  zeile('sichtbar in 100 m', (a) => median(a.Z.nah100));
  zeile('sichtbar in 150 m', (a) => median(a.Z.nah150));
  p('');
  p('  Verteilung auf die Strassenklassen (Anteil aller Wagenproben)');
  for (const k of ['BOULEVARD', 'AVENUE', 'STREET', 'LOCAL']) {
    const anteil = (a) => {
      const g = Object.values(a.Z.klassen).reduce((x, y) => x + y, 0) || 1;
      return +(a.Z.klassen[k] / g * 100).toFixed(1);
    };
    zeile('  ' + k, anteil);
  }
  p('');
  p('  Bruecke');
  zeile('  auf Brueckenstrasse', (a) => a.Z.brStrasse);
  zeile('  Richtung Bruecke', (a) => a.Z.brRichtung);
  zeile('  auf dem Deck', (a) => a.Z.brDeck);
  zeile('  Durchfahrten/min', (a) => +(a.Z.durchfahrten / (a.SEK / 60)).toFixed(2));
  p('');
  p('  Kosten');
  zeile('  ms je Schritt', (a) => a.msJeSchritt);
  zeile('  Zeichenaufrufe', (a) => median(a.bild.map((b) => b.calls)));
  zeile('  Dreiecke', (a) => median(a.bild.map((b) => b.dreiecke)));
  p('');
  p('  Harte Fehlerzaehler (muessen null sein)');
  for (const k of ['nebenFahrbahn', 'imWasser', 'ortsSprung', 'geisterfahrer'])
    zeile('  ' + k, (a) => a.Z[k]);
  p('');
  p('  Verrauschte Zusatzwerte');
  for (const k of ['ineinander', 'inGleicheSpur', 'inNachbarSpur', 'inKreuzend',
                   'langStand', 'maxStand', 'parkend'])
    zeile('  ' + k, (a) => +(a.Z[k]).toFixed(1));
  p('');
})();
