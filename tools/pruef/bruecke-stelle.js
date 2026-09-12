/* Die eine Stelle, an der der Brueckentest stehenbleibt.

   Der Vergleich gegen den Stand vor dem Mission-6-Umbau (fuenf Laeufe je
   Seite, 50 Spuren) hat dreimal denselben Fehlschlag gezeigt:

     Gehweg Nord innen, Richtung Ost, FEST bei x=180,55

   Zweimal sogar mit identischen Zahlen bis auf die Stufenhoehe - das ist
   kein Rauschen, sondern ein wiederkehrender Weltzustand. Nur ausgeloest
   wird er selten (1 bis 2 von 50 Spuren), und mit sechs Laeufen darauf zu
   warten ist Gluecksspiel.

   Deshalb wird die Stelle hier direkt vermessen statt abgewartet: was
   steht da, wie hoch ist der Boden, und passt eine Figur hindurch. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    const BZ = -25, Z = BZ - 6.4;
    const reihe = [];
    for (let x = 176; x <= 188; x += 0.5) {
      const gy = d.groundYAt(x, Z, 2);
      const treffer = [];
      for (const c of d.colliders || []) {
        if (!c.box) continue;
        const bx = Math.max(c.box.min.x - x, 0, x - c.box.max.x);
        const bz = Math.max(c.box.min.z - Z, 0, Z - c.box.max.z);
        const dd = Math.hypot(bx, bz);
        /* Nur was auf Figurhoehe im Weg steht: ein Kollider, dessen
           Oberkante unter den Knien liegt, ist eine Stufe, kein Hindernis. */
        if (dd < 1.2 && c.box.max.y > (gy === null ? 0 : gy) + 0.35) {
          treffer.push({ d: +dd.toFixed(2), klein: !!c.klein,
                         y: +c.box.min.y.toFixed(2) + '..' + +c.box.max.y.toFixed(2),
                         xs: +c.box.min.x.toFixed(1) + '..' + +c.box.max.x.toFixed(1),
                         zs: +c.box.min.z.toFixed(1) + '..' + +c.box.max.z.toFixed(1) });
        }
      }
      reihe.push({ x, gy: gy === null ? null : +gy.toFixed(2), treffer });
    }
    /* Und wie breit ist die Luecke ueberhaupt? Quer zur Laufrichtung. */
    const quer = [];
    for (let z = Z - 4; z <= Z + 4; z += 0.5) {
      const gy = d.groundYAt(180.55, z, 2);
      let frei = true;
      for (const c of d.colliders || []) {
        if (!c.box) continue;
        if (180.55 > c.box.min.x - 0.45 && 180.55 < c.box.max.x + 0.45 &&
            z > c.box.min.z - 0.45 && z < c.box.max.z + 0.45 &&
            c.box.max.y > (gy === null ? 0 : gy) + 0.35) { frei = false; break; }
      }
      quer.push({ z: +z.toFixed(1), gy: gy === null ? null : +gy.toFixed(2), frei });
    }
    return { reihe, quer };
  });
  console.log('');
  console.log('Laengs (z = -31,4, die Spur "Gehweg Nord innen"):');
  for (const r of aus.reihe) {
    console.log('  x=' + String(r.x).padStart(6) + '  Boden ' + String(r.gy).padStart(6) +
      (r.treffer.length ? '  ' + JSON.stringify(r.treffer) : ''));
  }
  console.log('');
  console.log('Quer bei x = 180,55:');
  for (const q of aus.quer)
    console.log('  z=' + String(q.z).padStart(7) + '  Boden ' + String(q.gy).padStart(6) +
                (q.frei ? '  frei' : '  VERSTELLT'));
  await b.close();
})();
