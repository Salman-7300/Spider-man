/* CITY V2, Stufe 4: stehen die parkenden Autos, wo sie duerfen?

   Ein parkendes Auto ist ABSICHTLICH auf der Fahrbahn - deshalb kann
   freigang.js es nicht mitpruefen, der meldet genau das als Fehler.
   Geprueft wird hier stattdessen:

     - der ganze Wagen liegt auf dem Asphalt, keine Ecke auf dem Gehweg
     - er steht in KEINER Fahrspur seiner Strasse
     - nicht auf einem Zebrastreifen
     - nicht in einer Kreuzung
     - nicht vor einem U-Bahn-Abgang, Aufzug oder einer Haustuer
     - nicht an einem POI-Anker
     - nicht auf der Bruecke und nicht im Wasser
     - zwei parkende Wagen stehen nicht ineinander
     - nur Klassen, auf denen ueberhaupt Platz ist (LOCAL, STREET)

   Aufruf:  node tools/pruef/parkautos.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 540, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true);
    const R = d.raster(), str = d.strassen();
    const autos = d.parkAutos();
    const zebras = d.zebraFlaechen();
    const schaechte = d.ubSchaechte ? d.ubSchaechte() : [];
    const aufz = d.aufzuege();
    const tueren = d.tuerStellen();
    const pois = d.poiListe();
    const befunde = [];
    let busEng = 99;
    const melde = (a, was, wert) => befunde.push({ x: a.x, z: a.z, klasse: a.klasse,
                                                   art: a.art, was, wert });
    const kasten = (a) => {
      const hx = a.achse === 'x' ? a.halbB : a.halbL;
      const hz = a.achse === 'x' ? a.halbL : a.halbB;
      return { x0: a.x - hx, x1: a.x + hx, z0: a.z - hz, z1: a.z + hz };
    };
    const proKlasse = {}, proArt = {}, proLinie = {};
    for (const a of autos) {
      proKlasse[a.klasse] = (proKlasse[a.klasse] || 0) + 1;
      proArt[a.art] = (proArt[a.art] || 0) + 1;
      const k = kasten(a);
      /* 1. Alle vier Ecken auf der Fahrbahn (Gehweg waere 0,25). */
      for (const x of [k.x0, k.x1]) for (const z of [k.z0, k.z1]) {
        const y = d.groundYAt(x, z, 2);
        if (Math.abs(y) > 0.05) melde(a, 'Ecke nicht auf der Fahrbahn', +y.toFixed(2));
      }
      /* 2. Auf welcher Linie steht er, und liegt er in einer Fahrspur? */
      const qa = a.achse;
      const o = qa === 'x' ? R.x0 : R.z0, n = qa === 'x' ? R.blocksX : R.blocksZ;
      const wert = qa === 'x' ? a.x : a.z;
      const linie = o + Math.max(0, Math.min(n, Math.round((wert - o) / R.pitch))) * R.pitch;
      const s = str.find((t) => t.achse === qa && Math.abs(t.linie - linie) < 0.5);
      if (!s) { melde(a, 'keiner Strasse zugeordnet', linie); continue; }
      proLinie[qa + linie] = (proLinie[qa + linie] || 0) + 1;
      if (s.klasse !== a.klasse) melde(a, 'Klasse passt nicht zur Linie', s.klasse);
      /* ---- Was heisst "in der Fahrspur"? ----
         Gegen die GEMALTE Spurbreite gemessen ragt jeder parkende Wagen
         auf einer STREET 0,7 m hinein - das tut er in jeder echten Stadt
         auch, die Spur ist 3,6 m breit und ein Auto 1,9 m. Die Frage ist,
         ob ein FAHRENDER Wagen noch vorbeikommt. Geprueft wird deshalb
         gegen die halbe Fahrzeugbreite:
           Pkw/Taxi 1,9 m -> 0,95   (Befund, wenn es nicht reicht)
           Bus      2,4 m -> 1,20   (nur gemeldet, siehe Bericht) */
      const halbQuer = a.halbB;
      for (const m of s.spurMitten) {
        const abstand = Math.abs(m - wert);
        const luecke = abstand - (halbQuer + 0.95);
        if (luecke < 0) melde(a, 'ein Pkw kaeme nicht vorbei', +luecke.toFixed(2));
        const luBus = abstand - (halbQuer + 1.20);
        if (luBus < busEng) busEng = luBus;
      }
      /* 3. Kreuzung */
      const laengs = qa === 'x' ? 'z' : 'x';
      const o2 = laengs === 'x' ? R.x0 : R.z0, n2 = laengs === 'x' ? R.blocksX : R.blocksZ;
      const w2 = laengs === 'x' ? a.x : a.z;
      const l2 = o2 + Math.max(0, Math.min(n2, Math.round((w2 - o2) / R.pitch))) * R.pitch;
      if (Math.abs(w2 - l2) < 10) melde(a, 'zu nah an der Kreuzung', +Math.abs(w2 - l2).toFixed(1));
      /* 4. Zebrastreifen */
      for (const r of zebras)
        if (k.x1 > r.x0 && k.x0 < r.x1 && k.z1 > r.z0 && k.z0 < r.z1)
          melde(a, 'auf einem Zebrastreifen', JSON.stringify(r));
      /* 5. Feste Orte - Abstand von der Wagenmitte */
      const nah = (px, pz, r, was) => {
        if (Math.hypot(px - a.x, pz - a.z) < r) melde(a, was, +Math.hypot(px - a.x, pz - a.z).toFixed(1));
      };
      for (const sch of schaechte) nah(sch.x !== undefined ? sch.x : 0,
                                      (sch.z0 + sch.z1) / 2, 12, 'vor einem U-Bahn-Abgang');
      for (const e of aufz) nah(e.x, e.z, 6, 'vor einem Aufzug');
      for (const t of tueren) nah(t.x, t.z, 4, 'vor einer Haustuer');
      for (const q of pois) if ((q.y || 0) < 3) nah(q.x, q.z, 5, 'auf einem POI-Anker');
      /* 6. Bruecke und Wasser */
      if (a.x > 181 && a.x < 334 && Math.abs(a.z + 25) < 12) melde(a, 'auf der Bruecke', a.x);
      if (a.x > 192 && a.x < 330) melde(a, 'im Wasser', a.x);
    }
    /* 7. Zwei Parkende ineinander */
    for (let i = 0; i < autos.length; i++)
      for (let j = i + 1; j < autos.length; j++) {
        const A = kasten(autos[i]), B = kasten(autos[j]);
        if (A.x1 > B.x0 && A.x0 < B.x1 && A.z1 > B.z0 && A.z0 < B.z1)
          melde(autos[i], 'steckt in einem anderen Parkwagen', j);
      }
    /* Dichte je Strasse, damit sich "LOCAL viele, STREET mittel" pruefen laesst. */
    const linienJeKlasse = {};
    for (const t of str) linienJeKlasse[t.klasse] = (linienJeKlasse[t.klasse] || 0) + 1;
    const dichte = {};
    for (const kl of Object.keys(proKlasse))
      dichte[kl] = +(proKlasse[kl] / linienJeKlasse[kl]).toFixed(2);
    return { anzahl: autos.length, proKlasse, proArt, dichte, linienJeKlasse,
             busEng: +busEng.toFixed(2),
             sichtbar: autos.filter((a) => a.sichtbar).length,
             befunde: befunde.slice(0, 12), befundeN: befunde.length };
  });
  await b.close();

  const p = (s) => console.log(s);
  p('');
  p('== Parkende Autos ==');
  p('  gesetzt ' + aus.anzahl + '   davon gerade gezeichnet ' + aus.sichtbar);
  p('  je Klasse   ' + JSON.stringify(aus.proKlasse));
  p('  je Bauart   ' + JSON.stringify(aus.proArt));
  p('  Linien      ' + JSON.stringify(aus.linienJeKlasse));
  p('  je Strasse  ' + JSON.stringify(aus.dichte) + '   (Wagen je Linie)');
  p('  engste Stelle fuer einen Bus (2,4 m): ' + aus.busEng + ' m' +
    (aus.busEng < 0 ? '   - er streift dort einen parkenden Wagen' : ''));
  p('');
  p('== Ausschlusszonen ==');
  if (!aus.befundeN) p('  keine Befunde');
  else {
    p('  ' + aus.befundeN + ' BEFUNDE');
    for (const b2 of aus.befunde) p('    ' + JSON.stringify(b2));
  }
  p('');
  process.exit(aus.befundeN ? 1 : 0);
})();
