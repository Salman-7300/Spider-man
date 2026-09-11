/* Teil 16: Detailstufen.
   Das Spiel benutzt THREE.LOD an drei Stellen - U-Bahn-Schilder (65 m),
   Liniennummern (55 m) und die Bueroeinrichtung in den Hochhaeusern
   (150 m). Gemessen wird, was die Umschaltung wirklich spart und ob man
   sie sieht.

   Bildraten sind hier wertlos (Software-Renderer). Gemessen werden
   Zeichenaufrufe und Dreiecke aus renderer.info.render.

   Aufruf:  node lod-stufen.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);

    /* Alle LOD-Knoten der Szene einsammeln. */
    const lods = [];
    d.szene.traverse((o) => {
      if (o.isLOD) lods.push({ name: o.name || '(ohne Namen)',
        stufen: o.levels.map((l) => +l.distance.toFixed(0)),
        pos: [+o.position.x.toFixed(0), +o.position.y.toFixed(0), +o.position.z.toFixed(0)] });
    });
    const nachName = {};
    for (const l of lods) {
      const k = l.name + ' [' + l.stufen.join(', ') + ']';
      nachName[k] = (nachName[k] || 0) + 1;
    }

    /* Ein Hochhaus suchen und aus wachsender Entfernung ansehen. */
    /* Die Hausliste kennt keine Hoehe - die steckt im Kollider an
       derselben Stelle. Gesucht wird der hoechste Baukoerper der Stadt. */
    let haus = null;
    for (const c of d.colliders) {
      if (!c.h || c.h < 20) continue;
      const br = (c.x1 - c.x0), ti = (c.z1 - c.z0);
      if (br < 8 || ti < 8) continue;                 // keine Pylonen
      if (!haus || c.h > haus.h)
        haus = { x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2, h: c.h };
    }
    const messe = (px, py, pz, zx, zy, zz) => {
      /* Der ERSTE Durchgang nach einem Kamerawechsel ist nicht
         vergleichbar (gemessen 425 gegen 605 Zeichenaufrufe bei
         identischer Szene). Deshalb dreimal zeichnen und den letzten
         nehmen. */
      let r = null;
      for (let i = 0; i < 3; i++) {
        d.aufnahme(px, py, pz, zx, zy, zz);
        r = d.renderZahlen ? d.renderZahlen() : null;
      }
      return r;
    };
    const reihe = [];
    if (haus) {
      const hoehe = haus.h;
      for (const dist of [40, 80, 120, 140, 148, 152, 160, 200, 260, 320]) {
        const r = messe(haus.x, hoehe * 0.6, haus.z + dist,
                        haus.x, hoehe * 0.5, haus.z);
        reihe.push({ dist, calls: r ? r.calls : null, tris: r ? r.tris : null });
      }
    }

    /* ---- Was die Umschaltung WIRKLICH spart ----
       Aus der Entfernungsreihe laesst sich das nicht ablesen: mit dem
       Abstand kommt mehr Stadt ins Bild, und das ueberdeckt alles.
       Deshalb von EINEM festen Standpunkt aus: einmal alle
       Bueroeinrichtungen erzwungen an, einmal erzwungen aus. */
    const buero = [];
    d.szene.traverse((o) => { if (o.isLOD && o.name === 'OfficeDetails') buero.push(o); });
    const stelle = (weit) => { for (const o of buero) o.levels[1].distance = weit; };
    const standpunkte = haus ? [
      ['dicht vor dem Haus', [haus.x, haus.h * 0.5, haus.z + 45], [haus.x, haus.h * 0.45, haus.z]],
      ['Strassenhoehe Mitte', [0, 2, 0], [40, 12, 40]],
      ['ueber der Stadt',     [0, 120, 0], [90, 40, 90]],
    ] : [];
    const vergleich = [];
    for (const [nm, p, z] of standpunkte) {
      stelle(1e9);                                   // nie umschalten = immer an
      const an = messe(p[0], p[1], p[2], z[0], z[1], z[2]);
      stelle(0.001);                                 // sofort umschalten = immer aus
      const ausW = messe(p[0], p[1], p[2], z[0], z[1], z[2]);
      vergleich.push({ ort: nm, anCalls: an.calls, anTris: an.tris,
                       ausCalls: ausW.calls, ausTris: ausW.tris });
    }
    stelle(150);                                     // wieder wie im Spiel

    return { lodArten: nachName, lodGesamt: lods.length, bueroZahl: buero.length,
             haus: haus ? { x: +haus.x.toFixed(0), z: +haus.z.toFixed(0),
                            h: +haus.h.toFixed(1) } : null,
             reihe, vergleich };
  });

  console.log('LOD-Knoten in der Szene: ' + aus.lodGesamt);
  for (const k in aus.lodArten) console.log('   ' + String(aus.lodArten[k]).padStart(5) + ' x  ' + k);
  if (!aus.haus) { console.log('\nKein Hochhaus gefunden.'); await b.close(); return; }
  console.log('\nBlick auf das hoechste Haus (' + aus.haus.h + ' m) aus wachsender Entfernung:');
  console.log('  Abstand'.padEnd(10) + 'Zeichenaufrufe'.padStart(16) + 'Dreiecke'.padStart(12) +
              'gegen 40 m'.padStart(13));
  const erst = aus.reihe[0];
  for (const r of aus.reihe) {
    const ab = erst && erst.tris ? ((r.tris / erst.tris - 1) * 100).toFixed(1) + '%' : '-';
    console.log(('  ' + r.dist + ' m').padEnd(10) + String(r.calls).padStart(16) +
                String(r.tris).padStart(12) + ab.padStart(13));
  }

  console.log('\nWas die Bueroeinrichtung (' + aus.bueroZahl + ' Stueck, Umschaltung bei 150 m)');
  console.log('vom selben Standpunkt aus kostet:');
  console.log('  Standpunkt'.padEnd(24) + 'mit Einrichtung'.padStart(18) +
              'ohne'.padStart(14) + 'Ersparnis'.padStart(12));
  for (const v of aus.vergleich) {
    const spar = v.anTris ? ((1 - v.ausTris / v.anTris) * 100).toFixed(1) + '%' : '-';
    console.log(('  ' + v.ort).padEnd(24) +
      (v.anCalls + ' / ' + v.anTris).padStart(18) +
      (v.ausCalls + ' / ' + v.ausTris).padStart(14) + spar.padStart(12));
  }
  console.log('  (Zeichenaufrufe / Dreiecke)');
  await b.close();
})();
