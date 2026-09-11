/* Teil 7: Wie weit wandert der TRAGENDE FUSS in der Welt, waehrend er auf
   dem Boden steht? Ein sauber aufgesetzter Fuss bleibt stehen; jeder
   Zentimeter, den er waehrend des Kontakts zuruecklegt, ist Rutschen.
   Gemessen je Gangart ueber viele Bodenkontakte. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const schwelle = Number(process.argv[2] || 0.12);
  await page.evaluate((v) => { window.__schwelle = v; }, schwelle);
  console.log('Bodenfenster', (schwelle * 100).toFixed(0) + ' cm');
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player, HV = d.heroVisual;
    if (!HV || !HV.knochen) return { fehler: 'keine Knochen' };
    d.frier(true);
    /* Kein Verkehr, keine Passanten: auf der Fahrbahn wurde der Held beim
       ersten Anlauf ueberfahren (Clip 'sit', Tempo 0). Gemessen wird die
       Bewegung, nicht das Ausweichen. */
    d.cars.length = 0;
    d.civilians.length = 0;
    d.enemies.length = 0;
    const kn = HV.knochen;
    const V = new (Object.getPrototypeOf(P.pos).constructor)();
    const holen = (name) => { const b2 = kn[name]; if (!b2) return null;
      b2.getWorldPosition(V); return { x: V.x, y: V.y, z: V.z }; };

    /* Die echten Tasten: KeyX = ducken, AltLeft = gehen, Shift = sprinten. */
    const gangarten = [
      ['kriechen',  ['KeyX', 'ShiftLeft']],
      ['ducken',    ['KeyX']],
      ['schleichen',['KeyX', 'AltLeft']],
      ['gehen',     ['AltLeft']],
      ['laufen',    []],
      ['sprinten',  ['ShiftLeft']],
    ];
    const SCHWELLE = +(window.__schwelle || 0.12);
    const ergebnis = [];
    for (const [name, ein] of gangarten) {
      /* Die Strasse z = -25 quer durch die Stadt: 350 m gerade und eben.
         Der Verkehr ist oben geleert, auf der Fahrbahn steht nichts.
         (Auf der Promenade ging es nicht: dort steht alle 24 m ein Baum.) */
      d.setzePos(-170, 0, -25);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','AltLeft','KeyX','Space'])
        d.taste(t, false);
      for (const t of ein) d.taste(t, true);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      d.taste('KeyW', true);
      for (let i = 0; i < 180; i++) d.schritt(1 / 60);   // einschwingen

      let kontaktFuss = null, fussStart = null, fussWeg = 0, hueftStart = null;
      let letzterFuss = null;
      const proben = [];
      let tempoSumme = 0, tempoN = 0, clip = null, ts = 0;
      for (let i = 0; i < 60 * 25; i++) {
        d.schritt(1 / 60);
        const boden = d.groundYAt(P.pos.x, P.pos.z);
        const L = holen('lefttoebase') || holen('leftfoot');
        const R = holen('righttoebase') || holen('rightfoot');
        if (!L || !R) break;
        const s = HV.laufStand();
        if (s) { clip = s.clip; ts = s.ts; }
        tempoSumme += Math.hypot(P.vel.x, P.vel.z); tempoN++;
        /* Tragender Fuss: der tiefere, und er muss nahe am Boden sein. */
        const tief = L.y <= R.y ? 'L' : 'R';
        const p = tief === 'L' ? L : R;
        const amBoden = p.y - boden < SCHWELLE;
        if (amBoden && tief === letzterFuss && fussStart) {
          fussWeg += Math.hypot(p.x - kontaktFuss.x, p.z - kontaktFuss.z);
          kontaktFuss = p;
        } else if (amBoden) {
          /* Kontakt vorbei -> auswerten, neuer beginnt. */
          if (fussStart && hueftStart) {
            const weg = Math.hypot(P.pos.x - hueftStart.x, P.pos.z - hueftStart.z);
            if (weg > 0.15) proben.push({ rutsch: fussWeg, weg });
          }
          letzterFuss = tief; fussStart = p; kontaktFuss = p; fussWeg = 0;
          hueftStart = { x: P.pos.x, z: P.pos.z };
        } else {
          letzterFuss = null;
        }
        if (P.pos.x > 165) { const y = P.pos.y; d.setzePos(-170, y, -25);
          P.state = 'ground'; P.onGround = true; }
      }
      for (const t of ['KeyW','ShiftLeft','AltLeft','KeyX']) d.taste(t, false);
      const summe = proben.reduce((a, p) => a + p.rutsch, 0);
      const wegSumme = proben.reduce((a, p) => a + p.weg, 0);
      ergebnis.push({ gangart: name, clip, zeitfaktor: +ts.toFixed(2),
        tempo: +(tempoSumme / Math.max(1, tempoN)).toFixed(2),
        kontakte: proben.length,
        rutschJeKontakt: proben.length ? +(summe / proben.length).toFixed(3) : null,
        anteil: wegSumme > 0 ? +(summe / wegSumme).toFixed(3) : null });
    }
    return { ergebnis };
  });
  if (aus.fehler) { console.log('FEHLER', aus.fehler); await b.close(); return; }
  console.log('Gangart'.padEnd(12) + 'Clip'.padEnd(14) + 'Tempo'.padStart(7) +
              'Faktor'.padStart(8) + 'Kontakte'.padStart(10) +
              'Rutsch/Kontakt'.padStart(16) + 'Anteil'.padStart(9));
  for (const r of aus.ergebnis)
    console.log(r.gangart.padEnd(12) + String(r.clip).padEnd(14) +
      String(r.tempo).padStart(7) + String(r.zeitfaktor).padStart(8) +
      String(r.kontakte).padStart(10) + String(r.rutschJeKontakt).padStart(16) +
      (r.anteil === null ? '-' : (r.anteil * 100).toFixed(1) + '%').padStart(9));
  await b.close();
})();
