/* Teil 7: Eigengeschwindigkeit eines Gangclips.
   Verfahren wie in GANG_REF beschrieben: wie schnell wandert der
   TRAGENDE FUSS waehrend seines Bodenkontakts gegenueber der Huefte?
   Genau so schnell laeuft der Boden unter der Figur durch - und genau so
   schnell muss sich die Figur bewegen, damit nichts rutscht.
   Geprueft wird das Verfahren an walk (soll 1,49), run (2,21) und
   sprint (3,96); erst wenn die stimmen, gelten die neuen Zahlen. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, HV = d.heroVisual;
    if (!HV || !HV.laborClip) return { fehler: 'kein Labor' };
    d.frier(true);
    const kn = HV.knochen;
    const V = new (Object.getPrototypeOf(d.player.pos).constructor)();
    const welt = (n) => { const bb = kn[n]; if (!bb) return null;
      bb.getWorldPosition(V); return { x: V.x, y: V.y, z: V.z }; };

    const clips = ['walk', 'run', 'sprint', 'sprint_lang', 'gehen',
                   'schleichen', 'ducken', 'kriechen'];
    const N = 240;
    const ergebnis = [];
    for (const key of clips) {
      const info = HV.laborClip(key, 0);
      if (!info) { ergebnis.push({ key, fehlt: true }); continue; }
      const dauer = info.dauer;
      const bahn = [];
      for (let i = 0; i <= N; i++) {
        HV.laborClip(key, i / N);
        const h = welt('hips');
        const l = welt('lefttoebase') || welt('leftfoot');
        const r = welt('righttoebase') || welt('rightfoot');
        if (!h || !l || !r) break;
        bahn.push({ h, l, r });
      }
      if (bahn.length < 10) { ergebnis.push({ key, fehlt: true }); continue; }
      const dt = dauer / N;
      /* Tiefster Fusspunkt des ganzen Zyklus als Bezug fuer "steht auf
         dem Boden". */
      let tief = Infinity;
      for (const p of bahn) tief = Math.min(tief, p.l.y, p.r.y);
      const werte = {};
      for (const SCHWELLE of [0.01, 0.02, 0.03, 0.04, 0.06]) {
        let summe = 0, n = 0;
        for (let i = 1; i < bahn.length; i++) {
          const a = bahn[i - 1], c = bahn[i];
          for (const s of ['l', 'r']) {
            const o = s === 'l' ? 'r' : 'l';
            if (c[s].y > c[o].y) continue;                 // nur der tiefere Fuss
            if (c[s].y - tief > SCHWELLE || a[s].y - tief > SCHWELLE) continue;
            const dx = (c[s].x - c.h.x) - (a[s].x - a.h.x);
            const dz = (c[s].z - c.h.z) - (a[s].z - a.h.z);
            summe += Math.hypot(dx, dz) / dt; n++;
          }
        }
        werte[SCHWELLE] = { v: n ? +(summe / n).toFixed(3) : null, n };
      }
      ergebnis.push({ key, dauer, werte });
    }
    HV.laborAus();
    return { ergebnis };
  });
  if (aus.fehler) { console.log('FEHLER', aus.fehler); await b.close(); return; }
  const soll = { walk: 1.49, run: 2.21, sprint: 3.96, gehen: 1.55,
                 schleichen: 2.0, ducken: 1.15, kriechen: 0.85 };
  const schwellen = [0.01, 0.02, 0.03, 0.04, 0.06];
  console.log('Clip'.padEnd(14) + 'GANG_REF'.padStart(9) +
    schwellen.map((x) => (x * 100 + 'cm').padStart(9)).join(''));
  for (const r of aus.ergebnis) {
    if (r.fehlt) { console.log(r.key.padEnd(14) + '  FEHLT'); continue; }
    const s = soll[r.key];
    console.log(r.key.padEnd(14) + String(s === undefined ? '-' : s).padStart(9) +
      schwellen.map((x) => String(r.werte[x].v).padStart(9)).join(''));
  }
  console.log('\nKontaktbilder je Schwelle (walk):',
    JSON.stringify(Object.fromEntries(schwellen.map((x) =>
      [x, aus.ergebnis.find((r) => r.key === 'walk').werte[x].n]))));
  await b.close();
})();
