/* Qualitaets-Pass, Paket 1: die Fahrbahnmarkierung nachmessen.

   Jeder Strich (Deko-Kloetzchen 0,04 m hoch in Weiss oder Gelb, laenger
   als 2,5 m) wird seiner Strasse zugeordnet und geprueft:
     ohneSpur          Trenner, der nicht zwischen zwei Spuren DERSELBEN
                       Richtung liegt
     mitteFalsch       Mittellinie auf einer Strasse mit Mittelstreifen
                       oder ohne Gegenverkehr
     imZebra           Strich auf einem Zebrastreifen (Flaechen aus
                       d.zebraFlaechen() und die Zebra-Kloetzchen)
     inKreuzung        Strich in der Kreuzungsflaeche (ROAD_HALF um die Mitte)
     ausserhalb        neben dem Asphalt oder hinter der aeussersten Kreuzung
     fehlendeMitte     Abschnitt zwischen zwei Kreuzungen ohne Mittellinie
                       und ohne Mittelstreifen
     fehlenderTrenner  Abschnitt einer vierspurigen Strasse ohne Trenner
                       zwischen den beiden Spuren einer Richtung
     mittelstreifenImZebra
   Alle Sollwert 0. Dazu je Strasse Klasse, Spurmitten und die gezeichneten
   Versaetze, das andere Ufer gegen sein eigenes Raster und die Bruecke.
   dekoIm rundet Lagen auf 0,1 m - daher 0,11 m Spiel beim Versatz.

   Aufruf:  node tools/pruef/strassen-markierung.js [farben=alt] [seed=4711]
            farben=alt zaehlt die Farben vor dem Qualitaets-Pass
            (#e8e8e0/#d9c979) - fuer einen Lauf auf dem alten Stand.
   ========================================================================= */
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const ALT = arg('farben', '') === 'alt', SEED = +arg('seed', 4711);
(async () => {
  const { b, page } = await starte(640, 360, SEED, { frierSofort: true });
  const r = await page.evaluate((ALT) => {
    const d = __dbg, R = d.raster(), P = R.pitch, RH = 6;
    const SHORE_X0 = 330, SHORE_OX = 336, SHORE_OZ = -192, SHORE_PITCH = 32, SHORE_ROAD = 5, SHORE_NX = 2, SHORE_NZ = 12;
    /* Lagen aus game.js (dort nicht ueber __dbg erreichbar) */
    const BRIDGE_Z = -25, BRIDGE_HW = 10, BR_X0 = 181, BR_X1 = 334;
    const FARBEN = ALT ? ['#e8e8e0', '#d9c979'] : ['#7a7b77', '#7d682c'];
    const str = d.strassen();
    const info = (achse, linie) => str.find((t) => t.achse === achse && Math.abs(t.linie - linie) < 0.5);
    const zf = d.zebraFlaechen();
    const box = ([w, h, dd, x, y, z, f]) => ({ w, h, d: dd, x, y, z, f, x0: x - w / 2, x1: x + w / 2, z0: z - dd / 2, z1: z + dd / 2 });
    const alle = d.dekoIm(-500, 600, -0.01, 0.4, -500, 500).map(box);
    const istStrich = (t) => Math.abs(t.h - 0.04) < 1e-6 && FARBEN.includes(t.f) && Math.max(t.w, t.d) >= 2.5;
    const stadt = alle.filter((t) => istStrich(t) && t.y < 0.1 && t.x < R.x1 + 30);
    const ufer = alle.filter((t) => istStrich(t) && t.y < 0.1 && t.x >= SHORE_X0 - 10);
    const bruecke = alle.filter((t) => istStrich(t) && t.y > 0.2);
    const sonst = alle.filter((t) => istStrich(t) && !stadt.includes(t) && !ufer.includes(t) && !bruecke.includes(t));
    const mst = alle.filter((t) => Math.abs(t.h - 0.05) < 1e-6 && t.f === (ALT ? '#bfc4c9' : '#5c5e60'));
    const zebraKiste = alle.filter((t) => Math.abs(t.h - 0.03) < 1e-6 && t.y < 0.1 && (t.f === '#e8e8e0' || t.f === '#d6d6cf'));
    const ueber = (a, q) => a.x1 > q.x0 + 1e-3 && a.x0 < q.x1 - 1e-3 && a.z1 > q.z0 + 1e-3 && a.z0 < q.z1 - 1e-3;
    const imZebra = (t) => zf.some((q) => ueber(t, q)) || zebraKiste.some((q) => ueber(t, q));
    const linien = { x: [], z: [] };
    for (const t of str) linien[t.achse].push(t.linie);
    const naechste = (L, v) => L.reduce((p, q) => Math.abs(q - v) < Math.abs(p - v) ? q : p);
    const o = { x: R.x0, z: R.z0 }, e = { x: R.x1, z: R.z1 };
    const fehler = { ohneSpur: [], mitteFalsch: [], imZebra: [], inKreuzung: [], ausserhalb: [], fehlendeMitte: [], fehlenderTrenner: [], mittelstreifenImZebra: [] };
    const proStrasse = {};
    const lage = (t) => {
      const langZ = t.d > t.w;
      return { langZ, achse: langZ ? 'x' : 'z', laengs: langZ ? 'z' : 'x', quer: langZ ? t.x : t.z, s: langZ ? t.z : t.x,
               breit: langZ ? t.w : t.d, lang: langZ ? t.d : t.w };
    };
    for (const t of stadt) {
      const { achse, laengs, quer, s, breit, lang } = lage(t);
      const linie = naechste(linien[achse], quer), v = +(quer - linie).toFixed(3), I = info(achse, linie);
      const key = achse + linie;
      proStrasse[key] = proStrasse[key] || { achse, linie, klasse: I.klasse, mitten: I.spurMitten.map((m) => +(m - linie).toFixed(2)), versaetze: {}, mittelstreifen: I.mittelstreifen, n: 0 };
      const vk = v + ' ' + t.f + ' b' + breit + (lang > 3.5 ? ' durch' : ' l' + lang);
      proStrasse[key].versaetze[vk] = (proStrasse[key].versaetze[vk] || 0) + 1; proStrasse[key].n++;
      const m = I.spurMitten.map((q) => q - linie);
      const beidseits = m.some((q) => q < 0) && m.some((q) => q > 0);
      if (Math.abs(v) < 0.2) { if (I.mittelstreifen || !beidseits) fehler.mitteFalsch.push([achse, linie, v, s]); }
      else {
        let ok = false;
        for (let i = 0; i + 1 < m.length; i++) if ((m[i] > 0) === (m[i + 1] > 0) && Math.abs((m[i] + m[i + 1]) / 2 - v) < 0.11) ok = true;
        if (!ok) fehler.ohneSpur.push([achse, linie, v, s]);
      }
      if (imZebra(t)) fehler.imZebra.push([achse, linie, +s.toFixed(1)]);
      const k = naechste(linien[laengs], s);
      if (Math.abs(s - k) - lang / 2 < RH) fehler.inKreuzung.push([achse, linie, +s.toFixed(1)]);
      if (Math.abs(v) + breit / 2 > RH || s - lang / 2 < o[laengs] + RH || s + lang / 2 > e[laengs] - RH) fehler.ausserhalb.push([achse, linie, +s.toFixed(1)]);
    }
    for (const t of mst) if (imZebra(t)) fehler.mittelstreifenImZebra.push([t.x, t.z]);
    /* Jeder Abschnitt zwischen zwei Kreuzungen: Mitteltrennung und je Richtung ein Trenner pro Spurpaar */
    let abschnitte = 0;
    const naheAn = (L, achse, linie, v, a, bb) => L.some((q) => { const g = lage(q); return g.achse === achse && Math.abs(g.quer - linie - v) < 0.2 && g.s > a && g.s < bb; });
    for (const t of str) {
      const laengs = t.achse === 'x' ? 'z' : 'x';
      const m = t.spurMitten.map((q) => q - t.linie);
      for (const k of linien[laengs]) {
        if (k >= e[laengs] - 0.5) continue;
        abschnitte++;
        const a = k + RH, bb = k + P - RH;
        if (!naheAn(stadt, t.achse, t.linie, 0, a, bb) && !naheAn(mst, t.achse, t.linie, 0, a, bb)) fehler.fehlendeMitte.push([t.achse, t.linie, k]);
        for (let i = 0; i + 1 < m.length; i++) {
          if ((m[i] > 0) !== (m[i + 1] > 0)) continue;
          const v = (m[i] + m[i + 1]) / 2;
          if (!stadt.some((q) => { const g = lage(q); return g.achse === t.achse && Math.abs(g.quer - t.linie - v) < 0.11 && g.s > a && g.s < bb; }))
            fehler.fehlenderTrenner.push([t.achse, t.linie, v, k]);
        }
      }
    }
    /* Anderes Ufer: eigenes Raster */
    const uferL = { x: [], z: [] };
    for (let i = 0; i <= SHORE_NX; i++) uferL.x.push(SHORE_OX + i * SHORE_PITCH);
    for (let j = 0; j <= SHORE_NZ; j++) uferL.z.push(SHORE_OZ + j * SHORE_PITCH);
    const uf = { n: ufer.length, inKreuzung: 0, neben: 0, aufBrueckeneinfahrt: 0 };
    for (const t of ufer) {
      const { achse, laengs, quer, s, lang } = lage(t);
      const linie = naechste(uferL[achse], quer);
      if (Math.abs(quer - linie) > 0.2) uf.neben++;
      const k = naechste(uferL[laengs], s);
      if (Math.abs(s - k) - lang / 2 < SHORE_ROAD) uf.inKreuzung++;
      if (achse === 'x' && Math.abs(s - BRIDGE_Z) - lang / 2 < BRIDGE_HW) uf.aufBrueckeneinfahrt++;
    }
    const br = { n: bruecke.length, xmin: Math.min(...bruecke.map((t) => t.x0)), xmax: Math.max(...bruecke.map((t) => t.x1)), BR_X0, BR_X1,
                 y: [...new Set(bruecke.map((t) => t.y))], z: [...new Set(bruecke.map((t) => t.z))] };
    const zahl = {}; for (const k in fehler) zahl[k] = fehler[k].length;
    return { striche: stadt.length, sonst: sonst.length, zebraFlaechen: zf.length, zebraKisten: zebraKiste.length, mittelstreifen: mst.length, abschnitte, zahl,
             beispiele: Object.fromEntries(Object.entries(fehler).map(([k, v]) => [k, v.slice(0, 6)])), proStrasse: Object.values(proStrasse), uf, br };
  }, ALT);
  console.log(JSON.stringify({ striche: r.striche, sonst: r.sonst, zebraFlaechen: r.zebraFlaechen, zebraKisten: r.zebraKisten, mittelstreifen: r.mittelstreifen, abschnitte: r.abschnitte, fehler: r.zahl }));
  console.log('beispiele', JSON.stringify(r.beispiele));
  console.log('ufer', JSON.stringify(r.uf));
  console.log('bruecke', JSON.stringify(r.br));
  const summe = Object.values(r.zahl).reduce((a, b) => a + b, 0) + r.uf.inKreuzung + r.uf.neben + r.uf.aufBrueckeneinfahrt;
  console.log(summe === 0 ? 'alle harten Fehler 0' : 'HARTE FEHLER: ' + summe);
  for (const s of r.proStrasse) console.log(s.achse, s.linie, s.klasse, 'mitten', JSON.stringify(s.mitten), 'mst', s.mittelstreifen, 'striche', s.n, JSON.stringify(s.versaetze));
  await b.close();
})();
