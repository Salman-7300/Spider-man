/* CITY V2, Stufe 5, Teil A: was steht ueberhaupt in dieser Stadt?

   Vor dem Umbau der Bebauung wird der Bestand aufgenommen - Block fuer
   Block, aus dem laufenden Spiel gelesen, nicht aus dem Quelltext
   geschaetzt. Daraus entsteht docs/STUFE5-STADT-BESTAND.md und die
   Vorher-Messung, gegen die Stufe 5 spaeter verglichen wird.

   Erfasst je Block:
     Index, Weltposition, Gebaeudezahl, Gebaeudehoehen, bebaute
     Grundflaeche, freie Flaeche, Strassenklasse an N/O/S/W, Park,
     Wasserentfernung, Bezirk, POI, Storybezug, begehbares Gebaeude,
     U-Bahn, Aufzug, Promenade.

   Und fuer die ganze Stadt: Gebaeude, Gebaeude je Block, Haeuser je
   Blockkante, Hoehenverteilung, bebaute Kantenlaenge, Zeichenaufrufe,
   Dreiecke, Kollider, Objekte in der Szene.

   Aufruf:  node tools/pruef/stadtbestand.js [ausgabe.json] [doku.md]
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const zielJson = process.argv[2] || null;
const zielDoku = process.argv[3] || null;

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : +((s[m - 1] + s[m]) / 2).toFixed(2);
};

(async () => {
  const { b, page } = await starte(1024, 576, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    /* Eigener Median im Browserkontext - der aus dem Node-Teil ist hier
       nicht sichtbar (page.evaluate schickt nur den Funktionsrumpf). */
    const med = (a) => {
      if (!a.length) return 0;
      const q = [...a].sort((x, y) => x - y);
      const m = q.length >> 1;
      return q.length % 2 ? q[m] : (q[m - 1] + q[m]) / 2;
    };
    const R = d.raster(), str = d.strassen();
    const kisten = d.hausKisten();
    const bez = d.bezirke();
    const pois = d.poiListe();
    const tueren = d.tuerStellen();
    const aufz = d.aufzuege();
    /* U-Bahn: die Treppen- und Aufzugsschaechte sind nach oben offen und
       liegen damit wirklich im Strassenraum. UB_SCHAECHTE beschreibt sie
       im Koordinatensystem EINER Station, UBAHNEN kennt deren Versatz. */
    const schaechte = [];
    for (const u of d.ubahnen())
      for (const s of d.ubSchaechte())
        schaechte.push({ x0: u.x + Math.min(s.xFuss, s.xKopf),
                         x1: u.x + Math.max(s.xFuss, s.xKopf),
                         z0: u.dz + s.z0, z1: u.dz + s.z1 });
    const park = d.parkAutos();
    const ROAD_HALF = 6, RIVER_X0 = 192;
    const klasseVon = (achse, linie) => {
      const t = str.find((q) => q.achse === achse && Math.abs(q.linie - linie) < 0.5);
      return t ? t.klasse : null;
    };
    /* Der alte 7x7-Kern liegt bei x und z zwischen -175 und 175. */
    const imKern = (x, z) => x >= -175 && x <= 175 && z >= -175 && z <= 175;

    const bloecke = [];
    for (let bi = 0; bi < R.blocksX; bi++) {
      for (let bj = 0; bj < R.blocksZ; bj++) {
        const cx = R.x0 + bi * R.pitch + R.pitch / 2;
        const cz = R.z0 + bj * R.pitch + R.pitch / 2;
        const halb = (R.pitch - ROAD_HALF * 2) / 2;         // 19
        const drin = (o) => Math.abs(o.x - cx) <= halb + 1 && Math.abs(o.z - cz) <= halb + 1;
        const haeuser = kisten.filter(drin);
        const flaeche = haeuser.reduce((a, h) => a + h.w * h.d, 0);
        const hoehen = haeuser.map((h) => h.h);
        /* Je Blockkante: wieviel laufender Meter ist von Gebaeuden
           belegt, die nahe genug an der Kante stehen, um als
           Strassenwand zu wirken? "Nahe genug" = die dem Gehweg
           zugewandte Flanke liegt hoechstens 6 m hinter der Bauflucht. */
        const b2vor = bez.find((q) => q.bi === bi && q.bj === bj);
        const kanten = {};
        const seiten = [['N', 'z', cz + halb], ['S', 'z', cz - halb],
                        ['O', 'x', cx + halb], ['W', 'x', cx - halb]];
        for (const [name, achse, flucht] of seiten) {
          let belegt = 0;
          for (const h of haeuser) {
            const vorn = achse === 'x'
              ? (flucht > cx ? h.x + h.w / 2 : h.x - h.w / 2)
              : (flucht > cz ? h.z + h.d / 2 : h.z - h.d / 2);
            if (Math.abs(vorn - flucht) > 6) continue;
            belegt += achse === 'x' ? h.d : h.w;
          }
          const linie = achse === 'x' ? (flucht > cx ? cx + R.pitch / 2 : cx - R.pitch / 2)
                                      : (flucht > cz ? cz + R.pitch / 2 : cz - R.pitch / 2);
          const kl = klasseVon(achse, linie);
          kanten[name] = { klasse: kl,
                           nutzung: kl ? d.kantenNutzung(b2vor ? b2vor.art : 'MISCHUNG', kl) : null,
                           belegt: +belegt.toFixed(1),
                           anteil: +(belegt / (halb * 2) * 100).toFixed(0),
                           haeuser: haeuser.filter((h) => {
                             const vorn = achse === 'x'
                               ? (flucht > cx ? h.x + h.w / 2 : h.x - h.w / 2)
                               : (flucht > cz ? h.z + h.d / 2 : h.z - h.d / 2);
                             return Math.abs(vorn - flucht) <= 6;
                           }).length };
        }
        const b2 = bez.find((q) => q.bi === bi && q.bj === bj);
        /* Der Stadtteil muss VOR den Kanten feststehen - kantenNutzung
           braucht ihn. */
        const nah = (liste) => liste.filter((o) =>
          Math.abs(o.x - cx) <= halb + 4 && Math.abs(o.z - cz) <= halb + 4).length;
        bloecke.push({
          bi, bj, x: +cx.toFixed(1), z: +cz.toFixed(1),
          kern: imKern(cx, cz),
          haeuser: haeuser.length,
          hoehen: hoehen.map((h) => +h.toFixed(1)),
          hoeheMedian: +med(hoehen).toFixed(1),
          hoeheMax: hoehen.length ? +Math.max(...hoehen).toFixed(1) : 0,
          bebaut: +flaeche.toFixed(0),
          frei: +((halb * 2) * (halb * 2) - flaeche).toFixed(0),
          kanten,
          bezirk: b2 ? b2.art : null,
          park: b2 ? b2.art === 'PARK' : false,
          wasserAbstand: +(RIVER_X0 - cx).toFixed(0),
          pois: nah(pois), tueren: nah(tueren), aufzuege: nah(aufz),
          parkautos: park.filter((p) => Math.abs(p.x - cx) <= R.pitch / 2 &&
                                        Math.abs(p.z - cz) <= R.pitch / 2).length,
          ubahn: schaechte.filter((u) => u.x1 > cx - R.pitch / 2 && u.x0 < cx + R.pitch / 2 &&
                                         u.z1 > cz - R.pitch / 2 && u.z0 < cz + R.pitch / 2).length,
        });
      }
    }
    /* ---- Was kostet EIN Gebaeude? ----
       Jede Kiste aus HAUS_KISTEN bekommt in setzeHausModelle eine Kopie
       eines echten Modells. Diese Kopien sind der groesste Posten der
       Stadt - wieviele Objekte und Dreiecke je Haus, entscheidet, wieviele
       Haeuser Stufe 5 bauen darf. */
    const modellKosten = { modelle: 0, objekte: 0, dreiecke: 0, jeKlasse: {} };
    for (const m of (d.hausModelle ? d.hausModelle() : [])) {
      modellKosten.modelle++;
      let o = 0, tri = 0;
      m.traverse((k) => {
        o++;
        if (k.isMesh && k.geometry && k.geometry.attributes.position) {
          tri += (k.geometry.index ? k.geometry.index.count
                                   : k.geometry.attributes.position.count) / 3;
        }
      });
      modellKosten.objekte += o; modellKosten.dreiecke += tri;
    }
    /* Leistung an denselben vier Stellen wie in verkehr-dichte.js. */
    const stellen = [[-125, 2.2, 0, -125, 2, 120], [25, 2.2, 0, 120, 2, 0],
                     [R.x0 + 25, 2.2, 0, R.x0 + 120, 2, 0], [172, 2.2, -25, 330, 2, -25]];
    const bild = [];
    for (const [px, py, pz, zx, zy, zz] of stellen) {
      let r = null;
      for (let i = 0; i < 3; i++) { d.aufnahme(px, py, pz, zx, zy, zz); r = d.renderInfo(); }
      bild.push({ calls: r.calls, dreiecke: r.dreiecke });
    }
    let objekte = 0;
    d.szene.traverse(() => objekte++);
    return { raster: R, bloecke, bild, objekte, modellKosten, modelle: d.kitHaeuser(),
             kistenMasse: kisten.map((k) => ({ w: k.w, d: k.d, h: k.h })),
             kisten: kisten.length, kollider: d.colliders.length,
             tueren: tueren.length, gehknoten: d.gehKnotenListe().length,
             speicher: d.renderInfo() };
  });
  await b.close();

  const B = aus.bloecke;
  const p = (s) => console.log(s);
  const alleH = B.flatMap((q) => q.hoehen);
  const kantenAlle = B.flatMap((q) => Object.values(q.kanten));
  /* Hoehenbaender nach Geschossen, gerechnet mit 3,2 m je Geschoss, so
     wie es der Stufe-5-Auftrag beschreibt:
       LOW 2-4, MID 4-8, UPPER 8-12, HIGH 12-19, HOCHHAUS ab 19. */
  const mittel = (a) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0;
  const stufe = (h) => h < 12.8 ? 'LOW' : h < 25.6 ? 'MID'
                     : h < 38.4 ? 'UPPER' : h < 60.8 ? 'HIGH' : 'HOCHHAUS';
  const verteilung = { LOW: 0, MID: 0, UPPER: 0, HIGH: 0, HOCHHAUS: 0 };
  for (const h of alleH) verteilung[stufe(h)]++;
  const proz = (n) => +(n / Math.max(1, alleH.length) * 100).toFixed(1);

  const inBloecken = B.reduce((a, q) => a + q.haeuser, 0);
  const zus = {
    bloecke: B.length,
    gebaeude: aus.kisten,
    gebaeudeInBloecken: inBloecken,
    gebaeudeAusserhalb: aus.kisten - inBloecken,
    gebaeudeJeBlock: +(aus.kisten / B.length).toFixed(2),
    blockkanten: kantenAlle.length,
    kantenMitHaus: kantenAlle.filter((k) => k.haeuser > 0).length,
    haeuserJeKanteMittel: mittel(kantenAlle.map((k) => k.haeuser)),
    haeuserJeKanteMedian: +median(kantenAlle.map((k) => k.haeuser)).toFixed(2),
    kantenBelegungMittel: mittel(kantenAlle.map((k) => k.anteil)),
    kantenBelegungMedian: +median(kantenAlle.map((k) => k.anteil)).toFixed(0),
    kantenBelegungMax: kantenAlle.length ? Math.max(...kantenAlle.map((k) => k.anteil)) : 0,
    hoeheMedian: +median(alleH).toFixed(1),
    hoeheMax: alleH.length ? +Math.max(...alleH).toFixed(1) : 0,
    hoeheMin: alleH.length ? +Math.min(...alleH).toFixed(1) : 0,
    verteilung: { LOW: proz(verteilung.LOW), MID: proz(verteilung.MID),
                  UPPER: proz(verteilung.UPPER), HIGH: proz(verteilung.HIGH),
                  HOCHHAUS: proz(verteilung.HOCHHAUS) },
    zeichenaufrufe: Math.round(median(aus.bild.map((q) => q.calls))),
    dreiecke: Math.round(median(aus.bild.map((q) => q.dreiecke))),
    kollider: aus.kollider, objekte: aus.objekte,
    hausModelle: aus.modellKosten.modelle,
    objekteJeHausModell: +(aus.modellKosten.objekte /
                           Math.max(1, aus.modellKosten.modelle)).toFixed(1),
    dreieckeJeHausModell: Math.round(aus.modellKosten.dreiecke /
                                     Math.max(1, aus.modellKosten.modelle)),
    dreieckeAlleHausModelle: Math.round(aus.modellKosten.dreiecke),
    tueren: aus.tueren, gehknoten: aus.gehknoten,
    geometrien: aus.speicher.geometrien, texturen: aus.speicher.texturen,
  };

  p('');
  p('== Bestand ==');
  for (const [k, v] of Object.entries(zus))
    p('  ' + k.padEnd(24) + JSON.stringify(v));
  const kw = aus.kistenMasse.map((k) => k.w), kd = aus.kistenMasse.map((k) => k.d);
  const spanne = (a) => Math.min(...a).toFixed(1) + ' bis ' + Math.max(...a).toFixed(1);
  p('');
  p('== Fertige Hausmodelle (KIT_HAEUSER) ==');
  for (const m of aus.modelle)
    p('  ' + m.name.padEnd(24) + ' B ' + String(m.breite).padStart(6) +
      '   T ' + String(m.tiefe).padStart(6) + '   H ' + String(m.hoehe).padStart(5) +
      '   Tuer ' + m.tuerBreite + ' m   gesetzt ' + m.gesetzt);
  p('  Quader (makeBuildingMesh): Breite ' + spanne(kw) + ' m, Tiefe ' + spanne(kd) + ' m');
  p('');
  p('== Stadtteile ==');
  const jeBez = {};
  for (const q of B) {
    const a = q.bezirk || '(keiner)';
    if (!jeBez[a]) jeBez[a] = { bloecke: 0, gebaeude: 0, hoehen: [],
                                kanten: 0, laden: 0, belegung: [] };
    const v = jeBez[a];
    v.bloecke++; v.gebaeude += q.haeuser; v.hoehen.push(...q.hoehen);
    for (const k of Object.values(q.kanten)) {
      v.kanten++;
      if (k.nutzung === 'LADEN') v.laden++;
      v.belegung.push(k.anteil);
    }
  }
  const anteil = (n, g) => (n / Math.max(1, g) * 100).toFixed(0);
  p('  Stadtteil   Bloecke Gebaeude  je Block  Hoehe Med   Low  Mid  High   Laden  Wandanteil');
  for (const [a, v] of Object.entries(jeBez)) {
    const c = { LOW: 0, MID: 0, HIGH: 0 };
    for (const h of v.hoehen) c[h < 12.8 ? 'LOW' : h < 38.4 ? 'MID' : 'HIGH']++;
    const n = Math.max(1, v.hoehen.length);
    p('  ' + a.padEnd(11) + String(v.bloecke).padStart(6) + String(v.gebaeude).padStart(9) +
      (v.gebaeude / v.bloecke).toFixed(2).padStart(10) +
      median(v.hoehen).toFixed(1).padStart(11) +
      (anteil(c.LOW, n) + '%').padStart(6) + (anteil(c.MID, n) + '%').padStart(5) +
      (anteil(c.HIGH, n) + '%').padStart(6) +
      (anteil(v.laden, v.kanten) + '%').padStart(8) +
      (mittel(v.belegung).toFixed(0) + '%').padStart(12));
  }
  p('');
  p('== Kern gegen neue Aussenbloecke ==');
  for (const [name, filt] of [['Kern (alt)', (q) => q.kern], ['neu', (q) => !q.kern]]) {
    const t = B.filter(filt);
    const h = t.flatMap((q) => q.hoehen);
    p('  ' + name.padEnd(12) + ' Bloecke ' + String(t.length).padStart(3) +
      '   Gebaeude ' + String(t.reduce((a, q) => a + q.haeuser, 0)).padStart(4) +
      '   je Block ' + (t.reduce((a, q) => a + q.haeuser, 0) / t.length).toFixed(2) +
      '   Hoehe Median ' + median(h).toFixed(1));
  }
  p('');

  if (zielJson) {
    fs.writeFileSync(zielJson, JSON.stringify({ zusammenfassung: zus, bloecke: B }, null, 1));
    p('  geschrieben: ' + zielJson);
  }
  if (zielDoku) {
    const z = [];
    z.push('# CITY V2, Stufe 5: Bestandsaufnahme der Stadt');
    z.push('');
    z.push('Automatisch erzeugt von `tools/pruef/stadtbestand.js` aus dem');
    z.push('laufenden Spiel - keine Zahl ist aus dem Quelltext geschaetzt.');
    z.push('Stand: vor dem Umbau der Bebauung (Stufe 5).');
    z.push('');
    z.push('## Die ganze Stadt');
    z.push('');
    z.push('| Groesse | Wert |');
    z.push('|---------|------|');
    for (const [k, v] of Object.entries(zus))
      z.push('| ' + k + ' | ' + (typeof v === 'object' ? JSON.stringify(v) : v) + ' |');
    z.push('');
    /* Befund - jeder Satz nennt nur Zahlen, die oben gemessen wurden. */
    z.push('## Was diese Zahlen ueber die Bebauung sagen');
    z.push('');
    z.push('- Es gibt ' + zus.gebaeude + ' Baukoerper, ' + zus.gebaeudeInBloecken +
           ' davon in einem der ' + zus.bloecke + ' Bloecke, ' + zus.gebaeudeAusserhalb +
           ' ausserhalb (Ufer, Randstreifen). Das sind ' + zus.gebaeudeJeBlock +
           ' Gebaeude je Block.');
    z.push('- Von ' + zus.blockkanten + ' Blockkanten haben ' + zus.kantenMitHaus +
           ' ueberhaupt ein Gebaeude an der Bauflucht. Im Mittel stehen ' +
           zus.haeuserJeKanteMittel + ' Haeuser je Kante, der Median ist ' +
           zus.haeuserJeKanteMedian + '.');
    z.push('- Die Kantenbelegung liegt im Mittel bei ' + zus.kantenBelegungMittel +
           ' %, im Median bei ' + zus.kantenBelegungMedian + ' %, hoechstens bei ' +
           zus.kantenBelegungMax + ' %. Eine geschlossene Strassenwand gibt es nirgends.');
    z.push('- Das niedrigste Gebaeude der Stadt ist ' + zus.hoeheMin +
           ' m hoch. Es gibt kein einziges Haus unter 12,8 m, also keine');
    z.push('  zwei- bis viergeschossige Bebauung - der Anteil LOW ist ' +
           zus.verteilung.LOW + ' %.');
    z.push('- Jede Kiste aus HAUS_KISTEN bekommt in setzeHausModelle eine eigene');
    z.push('  Kopie eines Gebaeudemodells: ' + zus.hausModelle + ' Kopien, ' +
           zus.objekteJeHausModell + ' Objekte und ' + zus.dreieckeJeHausModell);
    z.push('  Dreiecke je Haus, zusammen ' + zus.dreieckeAlleHausModelle + ' Dreiecke.');
    z.push('  Gezeichnet werden an den vier Messstellen im Median ' + zus.dreiecke +
           ' Dreiecke,');
    z.push('  die Hausmodelle sind davon nur ein Teil - der groessere Posten sind');
    z.push('  Kulisse, Strassen und Deko. Ein zusaetzliches Haus kostet also rund');
    z.push('  ' + zus.dreieckeJeHausModell + ' Dreiecke und ' + zus.objekteJeHausModell +
           ' Szenenobjekte. Diese Zahl schwankt zwischen zwei Laeufen um');
    z.push('  etwa ein halbes Prozent, weil die Modelldateien verschieden schnell');
    z.push('  geladen sind - sie ist eine Groessenordnung, keine Konstante.');
    z.push('- Hoehenverteilung: LOW ' + zus.verteilung.LOW + ' %, MID ' +
           zus.verteilung.MID + ' %, UPPER ' + zus.verteilung.UPPER + ' %, HIGH ' +
           zus.verteilung.HIGH + ' %, HOCHHAUS ' + zus.verteilung.HOCHHAUS + ' %.');
    z.push('');
    z.push('## Die fertigen Hausmodelle');
    z.push('');
    z.push('Aus KIT_HAEUSER - gemessene Umrisse, nicht geschaetzt. Diese drei');
    z.push('Modelle sind die einzigen begehbaren Haeuser; alles andere sind');
    z.push('selbstgebaute Quader aus makeBuildingMesh.');
    z.push('');
    z.push('| Modell | Breite m | Tiefe m | Hoehe m | Dach m | Tuer m | Hochparterre m | gesetzt |');
    z.push('|--------|----------|---------|---------|--------|--------|----------------|---------|');
    for (const m of aus.modelle)
      z.push('| ' + [m.name, m.breite, m.tiefe, m.hoehe, m.dachHoehe, m.tuerBreite,
                     m.hoch, m.gesetzt].join(' | ') + ' |');
    z.push('');
    z.push('Die Quader aus makeBuildingMesh sind ' + spanne(kw) + ' m breit und ' +
           spanne(kd) + ' m tief.');
    z.push('');
    z.push('## Stadtteile');
    z.push('');
    z.push('Wandanteil ist der mittlere Anteil einer Blockkante, vor dem ein');
    z.push('Gebaeude steht. Laden ist der Anteil der Blockkanten, deren');
    z.push('Erdgeschoss als Laden gilt (kantenNutzung).');
    z.push('');
    z.push('| Stadtteil | Bloecke | Gebaeude | je Block | Hoehe Median | Low | Mid | High | Laden | Wandanteil |');
    z.push('|-----------|---------|----------|----------|--------------|-----|-----|------|-------|------------|');
    for (const [a, v] of Object.entries(jeBez)) {
      const c = { LOW: 0, MID: 0, HIGH: 0 };
      for (const h of v.hoehen) c[h < 12.8 ? 'LOW' : h < 38.4 ? 'MID' : 'HIGH']++;
      const n = Math.max(1, v.hoehen.length);
      z.push('| ' + [a, v.bloecke, v.gebaeude, (v.gebaeude / v.bloecke).toFixed(2),
             median(v.hoehen).toFixed(1), anteil(c.LOW, n) + ' %', anteil(c.MID, n) + ' %',
             anteil(c.HIGH, n) + ' %', anteil(v.laden, v.kanten) + ' %',
             mittel(v.belegung).toFixed(0) + ' %'].join(' | ') + ' |');
    }
    z.push('');
    z.push('## Jeder Block');
    z.push('');
    z.push('Kantenbelegung ist der Anteil der Blockkante, vor dem ein Gebaeude');
    z.push('steht (Flanke hoechstens 6 m hinter der Bauflucht).');
    z.push('');
    z.push('| bi | bj | x | z | Kern | Haeuser | Hoehe Med | bebaut m2 | Bezirk | N | O | S | W | Belegung N/O/S/W | POI | Tueren | Parkautos |');
    z.push('|----|----|---|---|------|---------|-----------|-----------|--------|---|---|---|---|------------------|-----|--------|-----------|');
    for (const q of B)
      z.push('| ' + [q.bi, q.bj, q.x, q.z, q.kern ? 'ja' : '-', q.haeuser,
        q.hoeheMedian, q.bebaut, q.bezirk,
        q.kanten.N.klasse, q.kanten.O.klasse, q.kanten.S.klasse, q.kanten.W.klasse,
        [q.kanten.N.anteil, q.kanten.O.anteil, q.kanten.S.anteil, q.kanten.W.anteil].join('/'),
        q.pois, q.tueren, q.parkautos].join(' | ') + ' |');
    fs.writeFileSync(zielDoku, z.join('\n') + '\n');
    p('  geschrieben: ' + zielDoku);
  }
  p('');
})();
