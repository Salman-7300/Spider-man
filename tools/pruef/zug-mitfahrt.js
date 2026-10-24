/* Teil 12, Rest: "ride vehicle/train" gezielt ausloesen.
   In keinem der frueheren Testfenster ist ein Zivilist in einen Zug
   eingestiegen - das passiert nur, wenn ein Zug haelt, die Tueren weit
   genug offen sind UND jemand auf dem Bahnsteig steht. Hier wird genau
   diese Lage hergestellt und dann geprueft, ob der Fahrgast wirklich auf
   einem Sitz sitzt und mit dem Wagen mitfaehrt. */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const erg = await page.evaluate(async () => {
    const d = __dbg;
    d.frier(true);
    const UB_TIEF = -9.0;
    /* Einen haltenden Zug suchen; notfalls warten, bis einer haelt. */
    let zug = null, warten = 0;
    while (!zug && warten < 240) {
      d.schritt(1 / 30, 10);
      warten++;
      zug = (d.zuegeRoh() || []).find((t) => t.haelt);
    }
    if (!zug) return { fehler: 'kein haltender Zug in 80 s' };

    /* Zivilisten auf den Bahnsteig neben diesen Zug stellen. */
    const gestellt = [];
    for (const c of d.civilians.slice(0, 8)) {
      c.pos.set(zug.x + (gestellt.length - 4) * 2.0, UB_TIEF, zug.z + 3.2);
      c.bahnsteig = 0;
      c.eingestiegen = 0;
      c.route = null; c.gehZustand = null;
      c.zugFahrt = null; c.sitzIdx = -1;
      if (c.visual && c.visual.root) c.visual.root.position.copy(c.pos);
      gestellt.push(c);
    }

    /* Laufen lassen, solange der Zug haelt, und dann noch ein Stueck. */
    let eingestiegen = 0, mitSitz = 0, t = 0;
    const spur = [];
    for (let i = 0; i < 900; i++) {
      d.schritt(1 / 30);
      t += 1 / 30;
      eingestiegen = gestellt.filter((c) => c.eingestiegen > 0).length;
      mitSitz = gestellt.filter((c) => c.zugFahrt && c.sitzIdx >= 0).length;
      if (i % 60 === 0) spur.push({ t: +t.toFixed(1), haelt: !!zug.haelt,
                                    tuer: +(zug.tuer || 0).toFixed(2),
                                    zugX: +zug.x.toFixed(1),
                                    eingestiegen, mitSitz });
      if (mitSitz >= 3) break;
    }
    const t0Sitz = t;

    /* Sitzt der Fahrgast wirklich auf dem Sitz - ueber die GANZE Fahrt,
       nicht in einem einzigen Bild. Der erste Durchlauf hat genau in dem
       Bild gemessen, in dem eingestiegen wurde, und dabei einen Fahrgast
       5 m neben seinem Sitz gesehen; zehn Sekunden spaeter sassen alle
       sieben mit 0,00 m Abstand. Ein Einzelbild taugt hier nicht. */
    const sitzAbstand = (c) => {
      if (!c.zugFahrt || c.sitzIdx < 0) return null;
      const pl = (c.zugFahrt.mesh.userData.freieSitze || [])[c.sitzIdx];
      if (!pl) return null;
      return Math.hypot(c.pos.x - (c.zugFahrt.x + pl.dx),
                        c.pos.z - (c.zugFahrt.z + pl.dz));
    };
    /* ---- Der Spieler muss dabei sein ----
       Ohne ihn sind die Fahrgaeste einfach aus der Ferne weggeblendet,
       und "32 % der Bilder unsichtbar" heisst dann nur "niemand sieht
       hin". Gemessen wird deshalb ab hier MIT dem Spieler im Wagen. */
    const P = d.player;
    const xVor = zug.x;
    let maxAbstand = 0, maxAbstandT = null, unsichtbarBilder = 0, sitzBilder = 0;
    let maxAbstandSichtbar = 0, maxSichtbarT = null, danebenBilder = 0, sichtbarBilder = 0;
    let untenDurch = 0, tiefste = 99;
    const verlauf = [];
    for (let i = 0; i < 600; i++) {
      /* Den Spieler im Wagen mitfahren lassen. */
      P.pos.set(zug.x, -7.8, zug.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      d.schritt(1 / 30);
      t += 1 / 30;
      for (const c of gestellt) {
        const ab = sitzAbstand(c);
        if (ab === null) continue;
        sitzBilder++;
        const sichtbar = !!(c.visual && c.visual.root.visible);
        if (ab > maxAbstand) { maxAbstand = ab; maxAbstandT = +t.toFixed(2); }
        /* Nur was SICHTBAR danebensitzt, ist ein Bildfehler. */
        if (sichtbar) {
          if (ab > maxAbstandSichtbar) { maxAbstandSichtbar = ab; maxSichtbarT = +t.toFixed(2); }
          if (ab > 1.0) danebenBilder++;
          sichtbarBilder++;
        }
        if (!sichtbar) unsichtbarBilder++;
        const boden = c.zugFahrt ? -9.0 : 0;
        if (c.pos.y < boden - 0.3) untenDurch++;
        if (c.pos.y < tiefste) tiefste = c.pos.y;
      }
      if (i % 120 === 0) verlauf.push({ t: +t.toFixed(1),
        sitzen: gestellt.filter((c) => c.zugFahrt && c.sitzIdx >= 0).length,
        sichtbar: gestellt.filter((c) => c.zugFahrt && c.sitzIdx >= 0 &&
                                         c.visual && c.visual.root.visible).length,
        maxAb: +(gestellt.map(sitzAbstand).filter((v) => v !== null)
                 .reduce((a, v) => Math.max(a, v), 0)).toFixed(2) });
    }
    return { gestellt: gestellt.length, eingestiegen, mitSitz,
             sekundenBisSitz: +t0Sitz.toFixed(2),
             sitzBilder, unsichtbarBilder,
             anteilUnsichtbar: sitzBilder ? +(unsichtbarBilder / sitzBilder).toFixed(3) : null,
             groessterSitzAbstand: +maxAbstand.toFixed(2), beiSekunde: maxAbstandT,
             groessterSitzAbstandSichtbar: +maxAbstandSichtbar.toFixed(2),
             beiSekundeSichtbar: maxSichtbarT,
             sichtbarBilder, bilderSichtbarDaneben: danebenBilder,
             anteilSichtbarDaneben: sichtbarBilder
               ? +(danebenBilder / sichtbarBilder).toFixed(4) : null,
             bilderUnterDemBoden: untenDurch, tiefstePosition: +tiefste.toFixed(2),
             verlauf, zugGefahren: +(zug.x - xVor).toFixed(1),
             zugGaeste: (d.zugGaeste() || []).length };
  });
  console.log(JSON.stringify(erg, null, 1));

  /* Bild: der Wagen von aussen, mit den Fahrgaesten darin. */
  const k = await page.evaluate(() => {
    const d = __dbg;
    const t = (d.zuegeRoh() || []).find((z) => z.mesh && z.mesh.visible) || d.zuegeRoh()[0];
    if (!t) return null;
    d.aufnahme(t.x - 2, -6.0, t.z + 7.5, t.x + 2, -7.6, t.z);
    d.aufnahme(t.x - 2, -6.0, t.z + 7.5, t.x + 2, -7.6, t.z);
    return { x: +t.x.toFixed(1), z: +t.z.toFixed(1) };
  });
  console.log('Bildkamera:', JSON.stringify(k));
  await page.screenshot({ path: (process.argv[2] || '/tmp') + '/zug-gaeste.png' });
  await b.close();
})();
