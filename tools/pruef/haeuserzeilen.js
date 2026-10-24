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
/* Der Weltkeim ist einstellbar, damit derselbe Pruefstand mehrere
   Staedte messen kann - Teil E verlangt fuenf feste Keime. Ohne Angabe
   bleibt es bei 4711 wie bisher. */
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
/* "bremsen=AB" schaltet einzelne Wiederholungsbremsen aus Teil E an -
   A ungleiche Lotbreiten, B Fassade, C Modellwahl. Damit laesst sich
   zuordnen, welche Beanstandung von welcher Bremse kommt. */
const bArg = process.argv.find((v) => v.indexOf('bremsen=') === 0);
const BREMSEN = bArg === undefined ? null : bArg.slice(8);

(async () => {
  const { b, page } = await starte(800, 480, SEED,
    BREMSEN === null ? {} : { bremsen: BREMSEN });
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
      /* Ein Spalt, in den der Spieler gerade noch hineinpasst und aus dem
         er nicht mehr herauskommt. Der Spielerradius ist 0,45 m. */
      spaltFalle: 0,
    };
    const SPIELER_B = 0.9;
    const spalte = [];
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
            merke('lotZuSchmal', { bi, bj, seite: l.seite, breite: l.breite,
                                   x: l.x, z: l.z, tiefe: l.tiefe,
                                   klasse: l.lot, frei: l.frei });
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
        /* Spalte zwischen zwei Haeusern desselben Blocks: entweder null
           (Zeile) oder so breit, dass man wieder herauskommt. */
        for (let i = 0; i < lots.length; i++)
          for (let j = i + 1; j < lots.length; j++) {
            const a = lots[i], b2 = lots[j];
            if (!a.frei || !b2.frei) continue;
            const dx = Math.abs(a.x - b2.x) - (a.w + b2.w) / 2;
            const dz = Math.abs(a.z - b2.z) - (a.d + b2.d) / 2;
            /* Nur wenn sie sich in der EINEN Achse ueberlappen und in der
               anderen einen Spalt lassen, ist es wirklich ein Schlitz. */
            const luecke = (dx < -0.05 && dz > 0.02) ? dz
                         : (dz < -0.05 && dx > 0.02) ? dx : null;
            if (luecke === null) continue;
            spalte.push(+luecke.toFixed(2));
            if (luecke < SPIELER_B)
              merke('spaltFalle', { bi, bj, a: a.seite + a.i, b: b2.seite + b2.i,
                                    spalt: +luecke.toFixed(2) });
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

    /* ================================================================
       BAU: der Spalt zwischen DIREKTEN Reihenhaus-Nachbarn
       ================================================================
       Die Pruefung darueber misst den PLAN - die Lotkisten. Ein Lot ist
       aber nicht das, was man sieht: ueber einem Teil der Lots steht ein
       geladenes Modell, und das fuellt seine Kiste nicht unbedingt aus.
       Deshalb wird hier beides getrennt gemessen:

         colliderGap   Luecke zwischen den Hindernissen. Daran laeuft und
                       klettert der Spieler.
         visualGap     Luecke zwischen dem, was man SIEHT - beim Modell
                       seine echte Weltbox, beim prozeduralen Haus die
                       Kiste selbst.
         fassadenVersatz  wie weit die beiden Schauseiten in der Tiefe
                       auseinanderliegen.

       Daraus die beiden Urteile:

         betretbarerSchlitz  colliderGap >= Spielerdurchmesser 0,9 m -
                       ein echter Durchgang. Zwischen zwei Reihenhaeusern
                       gehoert er nicht hin, ist aber wenigstens kein
                       Klemmfall.
         schmalerSchacht     0 < colliderGap < 0,9 m - der schlimmste
                       Fall: zu eng zum Durchgehen, aber breit genug, dass
                       Kamera und Figur hineingedrueckt werden koennen. */
    const zeilen = new Map();
    for (const h of kisten) {
      if (!h.zeile) continue;
      if (!zeilen.has(h.zeile)) zeilen.set(h.zeile, []);
      zeilen.get(h.zeile).push(h);
    }
    /* Die Weltbox jedes gesetzten Modells, ueber seine Setzposition
       eindeutig seinem Haus zugeordnet. */
    const mbox = new THREE.Box3();
    const modellAn = new Map();
    for (const o of d.hausModelle()) {
      mbox.setFromObject(o);
      modellAn.set(o.position.x.toFixed(2) + '|' + o.position.z.toFixed(2), {
        x0: mbox.min.x, x1: mbox.max.x, z0: mbox.min.z, z1: mbox.max.z,
        y0: mbox.min.y, y1: mbox.max.y });
    }
    const sicht = (h) => modellAn.get(h.x.toFixed(2) + '|' + h.z.toFixed(2)) ||
      { x0: h.x - h.w / 2, x1: h.x + h.w / 2,
        z0: h.z - h.d / 2, z1: h.z + h.d / 2, y0: 0, y1: h.h };
    /* Das Hindernis eines Hauses ist genau seine Kiste - so legt
       makeBuildingMesh es an. Trotzdem wird es aus der Kolliderliste
       gelesen und nicht angenommen: gerade das ist die Frage. */
    const hausKoll = new Map();
    for (const c of d.colliders) {
      if (c.klein || c.innen || c.parkAuto) continue;
      const mx = (c.x0 + c.x1) / 2, mz = (c.z0 + c.z1) / 2;
      hausKoll.set(mx.toFixed(2) + '|' + mz.toFixed(2), c);
    }
    const koll = (h) => hausKoll.get(h.x.toFixed(2) + '|' + h.z.toFixed(2)) || null;

    const paare = [];
    for (const [key, liste] of zeilen) {
      if (liste.length < 2) continue;
      const seite = key.split('|')[2];
      const laengsX = seite === 'N' || seite === 'S';
      liste.sort((p1, p2) => (laengsX ? p1.x - p2.x : p1.z - p2.z));
      for (let i = 1; i < liste.length; i++) {
        const A = liste[i - 1], B = liste[i];
        const sA = sicht(A), sB = sicht(B);
        const kA = koll(A), kB = koll(B);
        const l0 = (o) => laengsX ? o.x0 : o.z0;
        const l1 = (o) => laengsX ? o.x1 : o.z1;
        const q0 = (o) => laengsX ? o.z0 : o.x0;
        const q1 = (o) => laengsX ? o.z1 : o.x1;
        const lueck = (oA, oB) => Math.max(l0(oA), l0(oB)) - Math.min(l1(oA), l1(oB));
        const kisteA = { x0: A.x - A.w / 2, x1: A.x + A.w / 2,
                         z0: A.z - A.d / 2, z1: A.z + A.d / 2 };
        const kisteB = { x0: B.x - B.w / 2, x1: B.x + B.w / 2,
                         z0: B.z - B.d / 2, z1: B.z + B.d / 2 };
        const cGap = (kA && kB) ? lueck(kA, kB) : lueck(kisteA, kisteB);
        const vGap = lueck(sA, sB);
        /* Versatz der Schauseiten: die Vorderkante zeigt zur Strasse,
           also die kleinere bzw. groessere Querkoordinate - gemessen
           wird die Differenz beider Aussenkanten, der groessere Wert
           zaehlt. */
        const versatz = Math.max(Math.abs(q0(sA) - q0(sB)), Math.abs(q1(sA) - q1(sB)));
        paare.push({
          zeile: key, art: A.art || null,
          a: { x: A.x, z: A.z, w: A.w, d: A.d, h: A.h, visual: A.visual,
               modell: A.modell || null },
          b: { x: B.x, z: B.z, w: B.w, d: B.d, h: B.h, visual: B.visual,
               modell: B.modell || null },
          colliderGap: +cGap.toFixed(3),
          visualGap: +vGap.toFixed(3),
          fassadenVersatz: +versatz.toFixed(3),
          kolliderGefunden: !!(kA && kB),
          betretbarerSchlitz: cGap >= SPIELER_B,
          schmalerSchacht: cGap > 0.02 && cGap < SPIELER_B,
        });
      }
    }
    /* ================================================================
       Kletterbare Zwischenraeume zwischen BELIEBIGEN Haeusern
       ================================================================
       Die Pruefung oben sucht Spalte zwischen 0,02 und 0,9 m. Ein Spalt,
       in den die Figur HINEINPASST, ist aber definitionsgemaess BREITER
       als ihre 0,9 m - er konnte dort gar nicht gefunden werden. Genau
       so ist ein Human-Befund durchgerutscht: Spider-Man klettert in
       einen senkrechten Schacht zwischen zwei Haeusern.

       Gesucht wird deshalb der umgekehrte Bereich: breit genug fuer die
       Figur, aber zu schmal, um als Gasse durchzugehen.

         climbableDeadGap   0,9 bis 3,5 m breit, mindestens 1 m lang -
                            ein Schacht, kein Durchgang
         intentionalAlley   ueber 3,5 m - eine echte Gasse, in Ordnung
         verticalSlot       davon die, die ueber zehn Meter hoch reichen

       Gemessen bei den Keimen 4711 und 1234: fuenf und acht Faelle,
       2,27 bis 3,46 m breit, bis 41 m hoch. Quellen sind die
       freistehenden Bauten am Ufer (Mindestabstand 2,6 m) und die
       Dreierzeile in den Kernbloecken (Schritt 11,5 m bei 6,5 bis 8,5 m
       Breite). Zwischen Reihenhaeusern gibt es keinen einzigen. */
    const schachtListe = [];
    let gassen = 0;
    for (let i = 0; i < kisten.length; i++) for (let j = i + 1; j < kisten.length; j++) {
      const A = kisten[i], B = kisten[j];
      const dx = Math.abs(A.x - B.x) - (A.w + B.w) / 2;
      const dz = Math.abs(A.z - B.z) - (A.d + B.d) / 2;
      let spalt = null, laengs = 0;
      if (dx < -0.10 && dz >= -0.001) { spalt = dz; laengs = -dx; }
      else if (dz < -0.10 && dx >= -0.001) { spalt = dx; laengs = -dz; }
      if (spalt === null || laengs < 1.0) continue;
      if (spalt > 3.5) { if (spalt <= 8) gassen++; continue; }
      if (spalt < SPIELER_B) continue;
      schachtListe.push({ spalt: +spalt.toFixed(2), laenge: +laengs.toFixed(1),
                       hoch: +Math.min(A.h, B.h).toFixed(1),
                       inZeile: !!(A.zeile && B.zeile && A.zeile === B.zeile),
                       mitZeilenhaus: !!(A.zeile || B.zeile),
                       ort: [+((A.x + B.x) / 2).toFixed(1), +((A.z + B.z) / 2).toFixed(1)] });
    }
    schachtListe.sort((p, q) => p.spalt - q.spalt);
    const zwischenraeume = {
      climbableDeadGap: schachtListe.length,
      inReihenhauszeile: schachtListe.filter((q) => q.inZeile).length,
      verticalSlot: schachtListe.filter((q) => q.hoch > 10).length,
      intentionalAlley: gassen,
      engster: schachtListe.length ? schachtListe[0].spalt : 0,
      weitester: schachtListe.length ? schachtListe[schachtListe.length - 1].spalt : 0,
      liste: schachtListe.slice(0, 10),
    };

    const zahl = (f) => paare.filter(f).length;
    const spitze = (feld) => paare.slice().sort((p1, p2) => p2[feld] - p1[feld])
                                  .slice(0, 8)
                                  .map((q) => ({ zeile: q.zeile, art: q.art,
                                    colliderGap: q.colliderGap, visualGap: q.visualGap,
                                    fassadenVersatz: q.fassadenVersatz,
                                    a: q.a.visual + ' ' + (q.a.modell || 'prozedural')
                                       + ' @' + q.a.x + ',' + q.a.z,
                                    b: q.b.visual + ' ' + (q.b.modell || 'prozedural')
                                       + ' @' + q.b.x + ',' + q.b.z }));
    const nachbarn = {
      paare: paare.length,
      ohneKollider: zahl((q) => !q.kolliderGefunden),
      colliderGapMax: paare.length ? Math.max(...paare.map((q) => q.colliderGap)) : 0,
      visualGapMax: paare.length ? Math.max(...paare.map((q) => q.visualGap)) : 0,
      versatzMax: paare.length ? Math.max(...paare.map((q) => q.fassadenVersatz)) : 0,
      betretbarerSchlitz: zahl((q) => q.betretbarerSchlitz),
      schmalerSchacht: zahl((q) => q.schmalerSchacht),
      visuellUeber05: zahl((q) => q.visualGap > 0.5),
      visuellUeber02: zahl((q) => q.visualGap > 0.2),
      versatzUeber02: zahl((q) => q.fassadenVersatz > 0.2),
      /* Wie oft steht ein Modell neben einem prozeduralen Haus? Dort ist
         der Uebergang am ehesten sichtbar. */
      gemischt: zahl((q) => q.a.visual !== q.b.visual),
      schlimmsteSicht: spitze('visualGap'),
      schlimmsterKollider: spitze('colliderGap'),
      schlimmsterVersatz: spitze('fassadenVersatz'),
    };

    return { zwischenraeume, nachbarn, F, bsp, spalte: spalte.sort((a, b2) => a - b2), lotsGesamt, lotsFrei,
             jeKlasse, jeLotklasse, jeSeite, jeTeil,
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
  p('== Spalte zwischen zwei Haeusern eines Blocks ==');
  if (!aus.spalte.length) p('  keine');
  else p('  ' + aus.spalte.length + ' Stueck   engster ' + aus.spalte[0] +
         ' m   Median ' + aus.spalte[aus.spalte.length >> 1] +
         ' m   weitester ' + aus.spalte[aus.spalte.length - 1] + ' m' +
         '   unter 0,9 m: ' + aus.spalte.filter((q) => q < 0.9).length);
  p('');
  p('== Spalt zwischen DIREKTEN Reihenhaus-Nachbarn (gebaut) ==');
  const N = aus.nachbarn;
  p('  ' + N.paare + ' Nachbarpaare in Zeilen, davon ' + N.gemischt +
    ' mit Modell neben prozeduralem Haus');
  if (N.ohneKollider)
    p('  WARNUNG: ' + N.ohneKollider + ' Paare ohne gefundenes Hindernis - '
      + 'die Kolliderzahlen sind dort aus der Kiste gerechnet');
  p('  Hindernis-Luecke   groesste ' + N.colliderGapMax.toFixed(3) + ' m');
  p('    betretbarer Schlitz (>= 0,9 m)  ' + N.betretbarerSchlitz);
  p('    schmaler Schacht (0 bis 0,9 m)  ' + N.schmalerSchacht);
  p('  Sichtbare Luecke   groesste ' + N.visualGapMax.toFixed(3) + ' m'
    + '   ueber 0,2 m: ' + N.visuellUeber02 + '   ueber 0,5 m: ' + N.visuellUeber05);
  p('  Fassadenversatz    groesster ' + N.versatzMax.toFixed(3) + ' m'
    + '   ueber 0,2 m: ' + N.versatzUeber02);
  const zeig = (titel, liste) => {
    p('  ' + titel);
    if (!liste.length) { p('    keine'); return; }
    for (const q of liste)
      p('    Koll ' + String(q.colliderGap).padStart(7) +
        '  Sicht ' + String(q.visualGap).padStart(7) +
        '  Versatz ' + String(q.fassadenVersatz).padStart(7) +
        '  ' + (q.art || '?') + '   ' + q.a + '  |  ' + q.b);
  };
  zeig('groesste Hindernis-Luecken:', N.schlimmsterKollider);
  zeig('groesste sichtbare Luecken:', N.schlimmsteSicht);
  zeig('groesster Fassadenversatz:', N.schlimmsterVersatz);
  p('');
  p('== Kletterbare Zwischenraeume zwischen BELIEBIGEN Haeusern ==');
  const Z = aus.zwischenraeume;
  p('  climbableDeadGap (0,9 bis 3,5 m, mind. 1 m lang)  ' + Z.climbableDeadGap);
  p('    davon in einer Reihenhauszeile                  ' + Z.inReihenhauszeile);
  p('    davon hoeher als zehn Meter (verticalSlot)      ' + Z.verticalSlot);
  p('  intentionalAlley (3,5 bis 8 m, echte Gasse)       ' + Z.intentionalAlley);
  if (Z.climbableDeadGap)
    p('  engster ' + Z.engster + ' m, weitester ' + Z.weitester + ' m');
  for (const q of Z.liste)
    p('    ' + q.spalt + ' m breit, ' + q.laenge + ' m lang, ' + q.hoch
      + ' m hoch, bei ' + q.ort.join(' / ')
      + (q.inZeile ? '   IN EINER ZEILE' : q.mitZeilenhaus ? '   an einer Zeile' : '   freistehend'));
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
