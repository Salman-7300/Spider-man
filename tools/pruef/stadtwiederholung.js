/* CITY V2, Stufe 5: wie oft wiederholt sich die Stadt?

   Der Generator-Look entsteht nicht daraus, DASS sich etwas wiederholt -
   eine Strasse aus lauter verschiedenen Haeusern sieht auch falsch aus -,
   sondern daraus, dass sich Dinge UNMITTELBAR NEBENEINANDER wiederholen.
   Drei gleiche Modelle in Folge fallen auf, dieselben drei ueber die
   Stadt verteilt nicht.

   Gemessen wird deshalb entlang der ZEILE: die Haeuser einer Blockkante
   in der Reihenfolge, in der man an ihnen vorbeilaeuft.

     gleiches Modell nebeneinander     Paare in einer Zeile
     drei gleiche Modelle in Folge     Laeufe der Laenge >= 3
     gleiche Fassade nebeneinander     dito fuer die Fassadentextur
     drei gleiche Fassaden in Folge
     gleiche Hoehe nebeneinander       Unterschied < 1,0 m
     drei fast gleiche Hoehen          dito, Laeufe >= 3
     gleiche Dachlinie                 laengster Lauf ueberhaupt
     gleiche Lotbreitenfolge           benachbarte Bloecke mit derselben
                                       Folge gerundeter Lotbreiten
     gleiche Folge gegenueber          dieselbe Hoehenfolge auf beiden
                                       Seiten derselben Strasse

   Aufruf:  node tools/pruef/stadtwiederholung.js [ausgabe.json] [seed] [alt]
            "alt" schaltet die Wiederholungsbremsen aus Teil E ab, damit
            sich Vorher und Nachher mit DEMSELBEN Messgeraet vergleichen
            lassen.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const zielJson = process.argv[2] || null;
const seed = +(process.argv[3] || 4711);
const alt = process.argv[4] === 'alt';

(async () => {
  const { b, page } = await starte(1024, 576, seed, alt ? { wdhAlt: true } : {});
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    const R = d.raster();
    const kisten = d.hausKisten();
    /* Die Modellwahl ist ortsabhaengig und laesst sich damit
       nachrechnen, ohne die Szene zu durchsuchen. */
    /* Modell und Fassadentextur haengen an der Kiste selbst. */
    const ROAD_HALF = 6, halb = (R.pitch - ROAD_HALF * 2) / 2;

    /* ---- Die Haeuser je Blockkante, in Laufrichtung sortiert ---- */
    const zeilen = [];
    for (let bi = 0; bi < R.blocksX; bi++) {
      for (let bj = 0; bj < R.blocksZ; bj++) {
        const cx = R.x0 + bi * R.pitch + R.pitch / 2;
        const cz = R.z0 + bj * R.pitch + R.pitch / 2;
        const drin = kisten.filter((h) => Math.abs(h.x - cx) <= halb + 1 &&
                                          Math.abs(h.z - cz) <= halb + 1);
        /* Jedes Haus der Kante zuordnen, an der seine Schauseite liegt:
           die Seite, zu der es am naechsten steht. */
        const seiten = { N: [], S: [], O: [], W: [] };
        for (const h of drin) {
          const dN = Math.abs((cz + halb) - (h.z + h.d / 2));
          const dS = Math.abs((cz - halb) - (h.z - h.d / 2));
          const dO = Math.abs((cx + halb) - (h.x + h.w / 2));
          const dW = Math.abs((cx - halb) - (h.x - h.w / 2));
          const m = Math.min(dN, dS, dO, dW);
          const s = m === dN ? 'N' : m === dS ? 'S' : m === dO ? 'O' : 'W';
          seiten[s].push(h);
        }
        for (const [s, liste] of Object.entries(seiten)) {
          if (liste.length < 2) continue;
          /* Laengs der Kante sortieren. */
          liste.sort((a, b2) => (s === 'N' || s === 'S') ? a.x - b2.x : a.z - b2.z);
          zeilen.push({ bi, bj, seite: s, cx, cz, haeuser: liste });
        }
      }
    }
    return { R, zeilen, kisten: kisten.length };
  });
  await b.close();

  /* ---- Auswertung in Node ---- */
  const Z = aus.zeilen;
  /* Ein "Lauf" ist eine ununterbrochene Folge gleicher Nachbarn. */
  const laeufe = (liste, gleich) => {
    const L = [];
    let n = 1;
    for (let i = 1; i < liste.length; i++) {
      if (gleich(liste[i - 1], liste[i])) n++;
      else { if (n > 1) L.push(n); n = 1; }
    }
    if (n > 1) L.push(n);
    return L;
  };
  const zaehle = (gleich, zaehlbar) => {
    let paare = 0, drei = 0, laengster = 0, moeglich = 0;
    for (const z of Z) {
      if (zaehlbar) {
        for (let i = 1; i < z.haeuser.length; i++)
          if (zaehlbar(z.haeuser[i - 1]) && zaehlbar(z.haeuser[i])) moeglich++;
      } else moeglich += z.haeuser.length - 1;
      for (const n of laeufe(z.haeuser, gleich)) {
        paare += n - 1;
        if (n >= 3) drei += n - 2;
        if (n > laengster) laengster = n;
      }
    }
    return { paare, drei, laengster, moeglich,
             anteil: +(paare / Math.max(1, moeglich) * 100).toFixed(1) };
  };

  /* ---- null ist KEIN gemeinsames Modell ----
     MERGED-Haeuser haben kein Modell, also modell === null. Ein Vergleich
     "a.modell === b.modell" ist fuer zwei solche Nachbarn wahr - und mit
     209 MERGED-Haeusern zaehlte der Pruefstand so hunderte Paare als
     "gleiches Modell", die gar keines haben. Gemessen wird deshalb nur
     zwischen Haeusern, die wirklich ein Modell tragen. */
  const gleichModell = (a, b2) => !!a.modell && a.modell === b2.modell;
  const gleichTextur = (a, b2) => a.textur !== undefined && a.textur === b2.textur;
  const gleichHoehe = (a, b2) => Math.abs(a.h - b2.h) < 1.0;
  const gleichVisual = (a, b2) => a.visual === b2.visual;

  const M = {
    modell: zaehle(gleichModell, (h) => !!h.modell),
    textur: zaehle(gleichTextur),
    hoehe: zaehle(gleichHoehe),
    visual: zaehle(gleichVisual),
  };

  /* Lotbreitenfolge je Zeile, auf halbe Meter gerundet. */
  const folge = (z) => z.haeuser.map((h) =>
    Math.round(((z.seite === 'N' || z.seite === 'S') ? h.w : h.d) * 2) / 2).join(',');
  const folgen = {};
  for (const z of Z) {
    const f = folge(z);
    if (f.split(',').length < 2) continue;
    (folgen[f] = folgen[f] || []).push(z.bi + ',' + z.bj + z.seite);
  }
  const mehrfach = Object.entries(folgen).filter(([, v]) => v.length > 1)
                         .sort((a, b2) => b2[1].length - a[1].length);

  /* Hoehenfolge gegenueber: zwei Zeilen an derselben Strasse. */
  const hFolge = (z) => z.haeuser.map((h) => Math.round(h.h / 2) * 2).join(',');
  let gegenueberGleich = 0, gegenueberPaare = 0;
  for (const z of Z) {
    for (const q of Z) {
      if (z === q) continue;
      const gegen = (z.seite === 'N' && q.seite === 'S' && q.cz === z.cz + aus.R.pitch &&
                     q.cx === z.cx) ||
                    (z.seite === 'O' && q.seite === 'W' && q.cx === z.cx + aus.R.pitch &&
                     q.cz === z.cz);
      if (!gegen) continue;
      gegenueberPaare++;
      if (hFolge(z) === hFolge(q)) gegenueberGleich++;
    }
  }

  const p = (s) => console.log(s);
  p('');
  p('== Wiederholung in der Haeuserzeile (Keim ' + seed +
    (alt ? ', OHNE die Bremsen aus Teil E' : '') + ') ==');
  p('  ' + Z.length + ' Zeilen mit mindestens zwei Haeusern, ' +
    Z.reduce((a, z) => a + z.haeuser.length, 0) + ' Haeuser darin, ' +
    aus.kisten + ' Haeuser insgesamt');
  p('');
  p('  Merkmal        Nachbarpaare gleich   Anteil   3 in Folge   laengster Lauf');
  const zeile = (name, m) =>
    p('  ' + name.padEnd(14) + String(m.paare).padStart(14) + '/' + m.moeglich +
      (m.anteil + ' %').padStart(10) + String(m.drei).padStart(13) +
      String(m.laengster).padStart(17));
  zeile('Modellwahl', M.modell);
  zeile('Fassade', M.textur);
  zeile('Hoehe < 1 m', M.hoehe);
  zeile('MODEL/MERGED', M.visual);
  p('');
  p('  Lotbreitenfolgen, die auf mehreren Kanten vorkommen: ' + mehrfach.length);
  for (const [f, v] of mehrfach.slice(0, 6))
    p('     [' + f + ']  auf ' + v.length + ' Kanten');
  p('');
  p('  Gegenueberliegende Zeilen mit gleicher Hoehenfolge: ' +
    gegenueberGleich + ' von ' + gegenueberPaare);
  p('');
  if (zielJson) {
    fs.writeFileSync(zielJson, JSON.stringify({
      seed, kisten: aus.kisten, zeilen: Z.length, mass: M,
      lotfolgenMehrfach: mehrfach.length,
      gegenueberGleich, gegenueberPaare,
    }, null, 1));
    p('  geschrieben: ' + zielJson);
    p('');
  }
})();
