/* CITY V2, Stufe 5: sind die Haeuserzeilen dort, wo sie hingehoeren?

   Geprueft wird ZWEIERLEI, und zwar getrennt:

     Der PLAN  - die Parzellierung, die lotsFuerBlock ausrechnet, noch
                 bevor ein Haus steht. Ein Fehler hier ist ein Fehler im
                 Datenmodell.
     Der BAU   - die Haeuser, die wirklich stehen (HAUS_KISTEN). Ein
                 Fehler hier ist ein Haus an der falschen Stelle.

   Solange Stufe 5 nur den Plan gebaut hat, ist der zweite Teil leer -
   das ist kein Durchfallen, sondern ein "noch nichts zu pruefen", und
   der Bericht sagt es auch so.

   Aufruf:  node tools/pruef/haeuserzeilen.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const R = d.raster();
    const regeln = d.lotRegeln();
    const kisten = d.hausKisten();
    const aufz = d.aufzuege();
    const tueren = d.tuerStellen();
    const knoten = d.gehKnotenListe();
    const ROAD_HALF = 6;
    /* Freizuhalten vor einer Kreuzung: die Fahrbahnhalbbreite plus zwei
       Meter Gehweg. Weniger, und ein Haus stuende im Sichtfeld des
       Zebrastreifens. */
    const KREUZ_FREI = ROAD_HALF + 2;
    const halb = (R.pitch - ROAD_HALF * 2) / 2;             // 19
    const schaechte = [];
    for (const u of d.ubahnen())
      for (const sc of d.ubSchaechte())
        schaechte.push({ x0: u.x + Math.min(sc.xFuss, sc.xKopf),
                         x1: u.x + Math.max(sc.xFuss, sc.xKopf),
                         z0: u.dz + sc.z0, z1: u.dz + sc.z1 });

    const F = {                       // harte Fehler
      lotAufStrasse: 0, lotZuBreit: 0, lotZuSchmal: 0, lotImSchacht: 0,
      lotAmAufzug: 0, lotUeberLot: 0, lotFalscheFront: 0, lotAufGehknoten: 0,
      kanteUeberfuellt: 0,
      hausAufStrasse: 0, hausImWasser: 0, hausImSchacht: 0, hausAufHaus: 0,
      hausAnTuer: 0, hausZuNahKreuzung: 0,
    };
    const bsp = [];
    const merke = (was, o) => { F[was]++; if (bsp.length < 24) bsp.push(Object.assign({ was }, o)); };
    const uebl = (a, b2, luft) =>
      a.x + a.w / 2 > b2.x - b2.w / 2 - luft && a.x - a.w / 2 < b2.x + b2.w / 2 + luft &&
      a.z + a.d / 2 > b2.z - b2.d / 2 - luft && a.z - a.d / 2 < b2.z + b2.d / 2 + luft;

    /* ---------------- Teil 1: der Plan ---------------- */
    let lotsGesamt = 0, lotsFrei = 0;
    const jeKlasse = {}, jeLotklasse = {}, jeSeite = {};
    const kantenBelegung = [];
    const jeTeil = {};                 // Lotbreiten je Stadtteil
    const teilVon = {};
    for (const t of d.stadtteile()) teilVon[t.bi + ',' + t.bj] = t.art;
    for (let bi = 0; bi < R.blocksX; bi++) {
      for (let bj = 0; bj < R.blocksZ; bj++) {
        const cx = R.x0 + bi * R.pitch + R.pitch / 2;
        const cz = R.z0 + bj * R.pitch + R.pitch / 2;
        const lots = d.lots(bi, bj);
        const art = teilVon[bi + ',' + bj] || '?';
        if (!jeTeil[art]) jeTeil[art] = { bloecke: 0, lots: 0, breiten: [], tiefen: [] };
        jeTeil[art].bloecke++; jeTeil[art].lots += lots.filter((l) => l.frei).length;
        for (const l of lots) { jeTeil[art].breiten.push(l.breite); jeTeil[art].tiefen.push(l.tiefe); }
        lotsGesamt += lots.length;
        const proSeite = {};
        for (const l of lots) {
          if (l.frei) lotsFrei++;
          jeKlasse[l.klasse] = (jeKlasse[l.klasse] || 0) + 1;
          jeLotklasse[l.lot] = (jeLotklasse[l.lot] || 0) + 1;
          jeSeite[l.seite] = (jeSeite[l.seite] || 0) + 1;
          proSeite[l.seite] = (proSeite[l.seite] || 0) + l.breite;
          /* Kein Lot darf ueber den Gehwegsockel hinausragen. */
          if (Math.abs(l.x - cx) + l.w / 2 > halb + 0.01 ||
              Math.abs(l.z - cz) + l.d / 2 > halb + 0.01)
            merke('lotAufStrasse', { bi, bj, seite: l.seite, x: l.x, z: l.z,
                                     ueber: +(Math.max(Math.abs(l.x - cx) + l.w / 2,
                                                       Math.abs(l.z - cz) + l.d / 2) - halb).toFixed(2) });
          if (l.breite > regeln.klassen[regeln.klassen.length - 1].max + 0.01)
            merke('lotZuBreit', { bi, bj, seite: l.seite, breite: l.breite });
          if (l.breite < regeln.klassen[0].min - 0.01)
            merke('lotZuSchmal', { bi, bj, seite: l.seite, breite: l.breite });
          /* Die Schauseite muss zur Strasse zeigen: die Bauflucht liegt
             genau eine halbe Tiefe vor der Hausmitte, nach aussen. */
          const vorn = l.nx ? l.x + l.nx * l.w / 2 : l.z + l.nz * l.d / 2;
          const soll = (l.nx ? cx : cz) + (l.nx || l.nz) * l.flucht;
          if (Math.abs(vorn - soll) > 0.05)
            merke('lotFalscheFront', { bi, bj, seite: l.seite,
                                       ist: +vorn.toFixed(2), soll: +soll.toFixed(2) });
          /* Ein Lot im Treppenschacht muss als belegt gelten. */
          for (const sc of schaechte) {
            if (l.x + l.w / 2 > sc.x0 && l.x - l.w / 2 < sc.x1 &&
                l.z + l.d / 2 > sc.z0 && l.z - l.d / 2 < sc.z1 && l.frei)
              merke('lotImSchacht', { bi, bj, seite: l.seite, x: l.x, z: l.z });
          }
          for (const a of aufz) {
            if (!l.frei) continue;
            if (Math.abs(a.x - l.x) < l.w / 2 + 2 && Math.abs(a.z - l.z) < l.d / 2 + 2)
              merke('lotAmAufzug', { bi, bj, seite: l.seite, x: l.x, z: l.z });
          }
          /* Kein Gehnetz-Knoten darf im Baufeld liegen. */
          for (const k of knoten) {
            if (!l.frei) continue;
            if (Math.abs(k.x - l.x) < l.w / 2 && Math.abs(k.z - l.z) < l.d / 2)
              merke('lotAufGehknoten', { bi, bj, seite: l.seite,
                                         kx: +k.x.toFixed(1), kz: +k.z.toFixed(1) });
          }
        }
        /* Lots duerfen sich untereinander nicht ueberlappen. */
        for (let i = 0; i < lots.length; i++)
          for (let j = i + 1; j < lots.length; j++) {
            if (!lots[i].frei || !lots[j].frei) continue;
            if (uebl(lots[i], lots[j], -0.02))
              merke('lotUeberLot', { bi, bj, a: lots[i].seite + lots[i].i,
                                     b: lots[j].seite + lots[j].i });
          }
        for (const [seite, breite] of Object.entries(proSeite)) {
          const front = (seite === 'N' || seite === 'S') ? halb * 2 : breite;
          if (breite > front + 0.05)
            merke('kanteUeberfuellt', { bi, bj, seite, breite: +breite.toFixed(1) });
          kantenBelegung.push({ seite, breite: +breite.toFixed(1) });
        }
      }
    }

    /* ---------------- Teil 2: der Bau ---------------- */
    for (const h of kisten) {
      const bi = Math.floor((h.x - R.x0) / R.pitch), bj = Math.floor((h.z - R.z0) / R.pitch);
      if (bi < 0 || bj < 0 || bi >= R.blocksX || bj >= R.blocksZ) continue;
      const cx = R.x0 + bi * R.pitch + R.pitch / 2, cz = R.z0 + bj * R.pitch + R.pitch / 2;
      if (Math.abs(h.x - cx) + h.w / 2 > halb + 0.01 ||
          Math.abs(h.z - cz) + h.d / 2 > halb + 0.01)
        merke('hausAufStrasse', { x: h.x, z: h.z, w: h.w, d: h.d });
      if (h.x > R.flussX0) merke('hausImWasser', { x: h.x, z: h.z });
      for (const sc of schaechte)
        if (h.x + h.w / 2 > sc.x0 && h.x - h.w / 2 < sc.x1 &&
            h.z + h.d / 2 > sc.z0 && h.z - h.d / 2 < sc.z1)
          merke('hausImSchacht', { x: h.x, z: h.z });
      for (const t of tueren)
        if (Math.abs(t.x - h.x) < h.w / 2 && Math.abs(t.z - h.z) < h.d / 2)
          merke('hausAnTuer', { x: h.x, z: h.z, tuer: t.haus });
      /* Die Kreuzung liegt auf dem Schnittpunkt zweier Rasterlinien, also
         genau auf der Blockecke plus ROAD_HALF. Vor ihr muss Platz
         bleiben, sonst sieht man weder Zebrastreifen noch Gegenverkehr. */
      for (const kx of [cx - R.pitch / 2, cx + R.pitch / 2])
        for (const kz of [cz - R.pitch / 2, cz + R.pitch / 2]) {
          const dx = Math.max(0, Math.abs(h.x - kx) - h.w / 2);
          const dz = Math.max(0, Math.abs(h.z - kz) - h.d / 2);
          if (Math.hypot(dx, dz) < KREUZ_FREI)
            merke('hausZuNahKreuzung', { x: h.x, z: h.z,
                                         abstand: +Math.hypot(dx, dz).toFixed(2) });
        }
    }
    for (let i = 0; i < kisten.length; i++)
      for (let j = i + 1; j < kisten.length; j++)
        if (uebl(kisten[i], kisten[j], -0.3))
          merke('hausAufHaus', { a: [kisten[i].x, kisten[i].z], b: [kisten[j].x, kisten[j].z] });

    return { F, bsp, lotsGesamt, lotsFrei, jeKlasse, jeLotklasse, jeSeite, jeTeil,
             regeln, haeuser: kisten.length,
             stadtteile: d.stadtteile().reduce((a, t) => {
               a[t.art] = (a[t.art] || 0) + 1; return a; }, {}),
             kanten: kantenBelegung.length };
  });
  await b.close();

  const p = (s) => console.log(s);
  p('');
  p('== Stadtteile (Plan) ==');
  for (const [a, n] of Object.entries(aus.stadtteile))
    p('  ' + a.padEnd(11) + String(n).padStart(3) + ' Bloecke   ' +
      (n / 110 * 100).toFixed(0) + ' %');
  const med = (a) => { if (!a.length) return 0;
    const q = [...a].sort((x, y) => x - y); return +q[q.length >> 1].toFixed(1); };
  p('');
  p('== Parzellen je Stadtteil ==');
  p('  Stadtteil    Bloecke   Lots   je Block   Breite Median   Tiefe Median');
  for (const [a, v] of Object.entries(aus.jeTeil))
    p('  ' + a.padEnd(12) + String(v.bloecke).padStart(5) + String(v.lots).padStart(7) +
      (v.lots / v.bloecke).toFixed(2).padStart(11) +
      String(med(v.breiten)).padStart(15) + ' m' + String(med(v.tiefen)).padStart(14) + ' m');
  p('');
  p('== Parzellen ==');
  p('  Lots gesamt        ' + aus.lotsGesamt + '   davon bebaubar ' + aus.lotsFrei);
  p('  je Strassenklasse  ' + JSON.stringify(aus.jeKlasse));
  p('  je Lotklasse       ' + JSON.stringify(aus.jeLotklasse));
  p('  je Blockseite      ' + JSON.stringify(aus.jeSeite));
  p('  Bauflucht          ' + JSON.stringify(aus.regeln.bauflucht));
  p('');
  p('== Fehler ==');
  let summe = 0;
  for (const [k, v] of Object.entries(aus.F)) { summe += v; p('  ' + k.padEnd(20) + v); }
  if (aus.bsp.length) {
    p('');
    p('  Beispiele:');
    for (const b2 of aus.bsp) p('    ' + JSON.stringify(b2));
  }
  p('');
  p(summe === 0 ? '  keine Beanstandung' : '  ' + summe + ' Beanstandungen');
  p('');
  process.exit(summe === 0 ? 0 : 1);
})();
