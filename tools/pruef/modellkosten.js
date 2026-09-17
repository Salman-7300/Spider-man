/* CITY V2, Stufe 5 Teil E: was kostet jedes Hausmodell, und wie oft
   wird es gewaehlt?

   Befund: die drei Wiederholungsbremsen zusammen kosten 35
   Zeichenaufrufe und 423.000 Dreiecke - bei GLEICHER Modellvielfalt
   (16 Modelle in beiden Fassungen). Mehr Vielfalt ist also nicht die
   Ursache. Der Verdacht ist, dass die Modell-Nachbarbremse die
   HAEUFIGKEIT verschiebt und bei einem Duplikat ein deutlich teureres
   Modell erwischt.

   Dieses Werkzeug misst beides getrennt:

     KOSTEN     je Modell einmal: Meshes, Materialien, Dreiecke,
                Bounding Box, Dachanteil. Die Zahl der Meshes mit
                eigenem Material ist die Zahl der Zeichenaufrufe je
                Kopie - verschmolzen wird hier nichts.
     HAEUFIGKEIT wie oft jedes Modell in der fertigen Stadt steht,
                einmal mit und einmal ohne die Modellbremse.

   Aufruf:  node tools/pruef/modellkosten.js [ausgabe.json] [seed]
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const zielJson = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : null;
const seed = +(process.argv[3] || 4711);

/* Die Haeufigkeit wird in zwei Laeufen gezaehlt: einmal ohne die
   Modellbremse (nur A und B), einmal mit allen dreien. So unterscheiden
   sich die beiden Staedte NUR in der Modellwahl. */
const LAEUFE = [['ohne Modellbremse', 'AB'], ['mit Modellbremse', 'ABC']];

(async () => {
  const ergebnis = { seed, kosten: null, laeufe: {} };
  for (const [name, bremsen] of LAEUFE) {
    const { b, page } = await starte(900, 540, seed, { bremsen });
    const r = await page.evaluate(() => {
      const d = __dbg; d.frier(true);
      const K = d.hausKisten();
      const haeufig = {};
      for (const h of K) if (h.modell) haeufig[h.modell] = (haeufig[h.modell] || 0) + 1;
      /* Die Kosten je Modell aus den WIRKLICH gesetzten Kopien lesen -
         eine Kopie je Modellname reicht, sie sind alle gleich gebaut. */
      const kosten = {};
      const box = new THREE.Box3();
      const K2 = new Map();
      for (const h of K) if (h.modell && !K2.has(h.modell))
        K2.set(h.modell, h.x.toFixed(2) + '|' + h.z.toFixed(2));
      for (const o of d.hausModelle()) {
        const s = o.position.x.toFixed(2) + '|' + o.position.z.toFixed(2);
        let name = null;
        for (const [m, k] of K2) if (k === s) { name = m; break; }
        if (!name || kosten[name]) continue;
        let meshes = 0, dreiecke = 0;
        const mats = new Set();
        o.traverse((k) => {
          if (!k.isMesh || !k.geometry) return;
          meshes++;
          if (k.material) {
            if (Array.isArray(k.material)) k.material.forEach((m) => mats.add(m.uuid));
            else mats.add(k.material.uuid);
          }
          const g = k.geometry;
          const n = g.index ? g.index.count : (g.attributes.position
                                               ? g.attributes.position.count : 0);
          dreiecke += n / 3;
        });
        box.setFromObject(o);
        kosten[name] = {
          meshes, materialien: mats.size,
          /* Jedes Mesh ist ein eigener Zeichenaufruf - die Hausmodelle
             werden nicht verschmolzen. */
          aufrufeJeKopie: meshes,
          dreiecke: Math.round(dreiecke),
          box: [+(box.max.x - box.min.x).toFixed(2),
                +(box.max.y - box.min.y).toFixed(2),
                +(box.max.z - box.min.z).toFixed(2)],
          dachAnteil: o.userData && o.userData.dachAnteil
                      ? +o.userData.dachAnteil.toFixed(3) : null,
        };
      }
      return { haeufig, kosten, haeuser: K.length,
               mitModell: K.filter((h) => h.modell).length,
               info: d.hausInfo() };
    });
    await b.close();
    ergebnis.laeufe[name] = { haeufig: r.haeufig, haeuser: r.haeuser,
                              mitModell: r.mitModell,
                              model: r.info.model, merged: r.info.merged };
    /* Die Kosten sind in beiden Laeufen dieselben - den vollstaendigeren
       Satz behalten. */
    if (!ergebnis.kosten ||
        Object.keys(r.kosten).length > Object.keys(ergebnis.kosten).length)
      ergebnis.kosten = r.kosten;
    console.log('  ' + name + ': ' + r.mitModell + ' Modellhaeuser, '
                + Object.keys(r.haeufig).length + ' verschiedene Modelle');
  }

  const p = (s) => console.log(s);
  const K = ergebnis.kosten;
  const A = ergebnis.laeufe['ohne Modellbremse'].haeufig;
  const B = ergebnis.laeufe['mit Modellbremse'].haeufig;
  const namen = [...new Set([...Object.keys(K), ...Object.keys(A), ...Object.keys(B)])];
  /* Nach Dreiecken sortieren - dann steht oben, was teuer ist. */
  namen.sort((a, b2) => ((K[b2] && K[b2].dreiecke) || 0) - ((K[a] && K[a].dreiecke) || 0));
  p('');
  p('== Kosten und Haeufigkeit je Hausmodell (Keim ' + seed + ') ==');
  p('');
  p('  Modell                          Meshes  Mat  Dreiecke   ALT   NEU  Delta'
    + '   Dreiecke-Delta');
  let dAufrufe = 0, dDreiecke = 0;
  for (const n of namen) {
    const k = K[n] || { meshes: 0, materialien: 0, dreiecke: 0 };
    const a = A[n] || 0, b2 = B[n] || 0, delta = b2 - a;
    dAufrufe += delta * k.meshes;
    dDreiecke += delta * k.dreiecke;
    p('  ' + n.padEnd(32) + String(k.meshes).padStart(5)
      + String(k.materialien).padStart(5) + String(k.dreiecke).padStart(10)
      + String(a).padStart(6) + String(b2).padStart(6)
      + (delta > 0 ? '+' + delta : String(delta)).padStart(7)
      + (delta * k.dreiecke > 0 ? '+' + delta * k.dreiecke
         : String(delta * k.dreiecke)).padStart(17));
  }
  p('');
  p('  Summe der Verschiebung:  ' + (dAufrufe >= 0 ? '+' : '') + dAufrufe
    + ' Meshes (= Zeichenaufrufe, wenn alle sichtbar sind),  '
    + (dDreiecke >= 0 ? '+' : '') + dDreiecke + ' Dreiecke');
  p('');
  const streu = (h) => {
    const w = Object.values(h); const n = w.reduce((x, y) => x + y, 0);
    if (!n) return { entropie: 0, groesster: 0 };
    let e = 0;
    for (const v of w) { const q = v / n; if (q > 0) e -= q * Math.log2(q); }
    return { entropie: +e.toFixed(3), groesster: +(Math.max(...w) / n * 100).toFixed(1) };
  };
  const sa = streu(A), sb = streu(B);
  p('  Streuung der Modellwahl:');
  p('    ohne Bremse   Entropie ' + sa.entropie + ' bit   haeufigstes Modell '
    + sa.groesster + ' %');
  p('    mit Bremse    Entropie ' + sb.entropie + ' bit   haeufigstes Modell '
    + sb.groesster + ' %');
  p('');
  if (zielJson) {
    fs.writeFileSync(zielJson, JSON.stringify(ergebnis, null, 1));
    p('  geschrieben: ' + zielJson);
  }
})();
