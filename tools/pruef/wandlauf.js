/* Teil 5: Wandlauf.
   Aus vollem Anlauf gegen eine Fassade. Gemessen wird ueber viele
   Anlaeufe an verschiedenen Haeusern: greift der Wandlauf, wie hoch
   traegt er, und was sagt der eingebaute Wandlauf-Logger (wlLog) ueber
   die Anlaeufe, die NICHT greifen.

   Aufruf:  node wandlauf.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;

    /* Fassaden sammeln, die von Sueden frei anlaufbar sind. */
    const waende = [];
    for (const c of d.colliders) {
      if (!c.h || c.h < 20 || c.klein || c.keinKlettern) continue;
      if ((c.x1 - c.x0) < 10 || (c.z1 - c.z0) < 10) continue;
      const mx = (c.x0 + c.x1) / 2;
      /* Anlaufstrecke frei? 12 m vor der Wand darf nichts stehen. */
      let frei = true;
      for (let s = 2; s <= 12; s += 2) {
        for (const k of d.colliderNah(mx, c.z0 - s)) {
          if (k === c || (k.h || 0) < 1) continue;
          if (mx > k.x0 - 1 && mx < k.x1 + 1 &&
              (c.z0 - s) > k.z0 - 1 && (c.z0 - s) < k.z1 + 1) { frei = false; break; }
        }
        if (!frei) break;
      }
      if (frei) waende.push({ x: mx, z: c.z0, h: c.h });
      if (waende.length >= 14) break;
    }

    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','KeyZ','Space'])
                              d.taste(t, false); };
    d.wlLogAn(true);
    d.poseLogAn(true, 60);
    const laeufe = [];
    /* Waehrend des Wandlaufs die Glieder mitmessen - die alte Beschwerde
       war "die Fusssohlen stehen nicht auf der Wand". */
    const fuss = { n: 0, s: 0, max: -9, min: 9 };
    const hand = { n: 0, s: 0, max: -9, min: 9 };
    const nimm = (t, v) => { t.n++; t.s += v; t.max = Math.max(t.max, v);
                             t.min = Math.min(t.min, v); };
    for (const w of waende) {
      alleAus();
      d.setzePos(w.x, 0, w.z - 12);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = 0; d.setzeKamYaw(Math.PI);
      d.taste('KeyW', true); d.taste('ShiftLeft', true);
      let hoch = P.pos.y, wandlauf = 0, climbT = 0, tempoVorWand = 0;
      for (let i = 0; i < 60 * 7; i++) {
        d.schritt(1 / 60);
        if (!tempoVorWand && P.pos.z > w.z - 2.2)
          tempoVorWand = Math.hypot(P.vel.x, P.vel.z);
        if (P.wandlauf) {
          wandlauf++;
          const r = d.poseLog();
          const e = r[r.length - 1];
          if (e && e.wandAbstand) {
            for (const n of ['leftfoot', 'rightfoot'])
              if (e.wandAbstand[n] !== undefined) nimm(fuss, e.wandAbstand[n]);
            for (const n of ['lefthand', 'righthand'])
              if (e.wandAbstand[n] !== undefined) nimm(hand, e.wandAbstand[n]);
          }
        }
        if (P.state === 'climb') climbT++;
        hoch = Math.max(hoch, P.pos.y);
      }
      alleAus();
      laeufe.push({ x: +w.x.toFixed(0), z: +w.z.toFixed(0), hausHoch: +w.h.toFixed(0),
        tempo: +tempoVorWand.toFixed(1),
        hoehe: +(hoch - 0.25).toFixed(1),
        wandlaufBilder: wandlauf, klebtBilder: climbT, ende: P.state });
    }
    const log = d.wlLog();
    d.wlLogAn(false);
    /* Warum ein Anlauf NICHT greift - der Logger schreibt die Bedingungen mit. */
    const gruende = { keinTreffer: 0, zuNiedrig: 0, zuLangsam: 0, klein: 0, ok: 0 };
    for (const e of log) {
      if (e.ok) { gruende.ok++; continue; }
      if (!e.rein) gruende.keinTreffer++;
      else if (!e.hochGenug) gruende.zuNiedrig++;
      else if (e.tempoRein <= 3.8) gruende.zuLangsam++;
      if (e.klein) gruende.klein++;
    }
    d.poseLogAn(false);
    const mittel = (t) => t.n ? { n: t.n, mittel: +(t.s / t.n).toFixed(3),
      min: +t.min.toFixed(3), max: +t.max.toFixed(3) } : null;
    return { laeufe, logZahl: log.length, gruende,
             fuss: mittel(fuss), hand: mittel(hand) };
  });

  console.log('Anlaeufe gegen ' + aus.laeufe.length + ' Fassaden, je 12 m Anlauf mit Sprint:\n');
  console.log('  Ort'.padEnd(18) + 'Haus'.padStart(7) + 'Tempo'.padStart(8) +
              'Hoehe'.padStart(8) + 'Wandlauf'.padStart(10) + 'klebt'.padStart(8) + '  Ende');
  let schlecht = 0;
  for (const l of aus.laeufe) {
    const ok = l.wandlaufBilder > 10 && l.hoehe > 4;
    if (!ok) schlecht++;
    console.log((ok ? '  ok   ' : '  FEHL ') + (l.x + ' / ' + l.z).padEnd(11) +
      String(l.hausHoch).padStart(7) + String(l.tempo).padStart(8) +
      String(l.hoehe).padStart(8) + String(l.wandlaufBilder).padStart(10) +
      String(l.klebtBilder).padStart(8) + '  ' + l.ende);
  }
  console.log('\nWandlauf-Logger: ' + aus.logZahl + ' Anlaeufe mitgeschrieben');
  console.log('  gegriffen           ' + aus.gruende.ok);
  console.log('  Wand nicht getroffen ' + aus.gruende.keinTreffer);
  console.log('  Wand zu niedrig      ' + aus.gruende.zuNiedrig);
  console.log('  zu langsam           ' + aus.gruende.zuLangsam);
  console.log('  Kleinteil            ' + aus.gruende.klein);
  console.log('\nGlieder waehrend des Wandlaufs (Abstand zur Fassadenebene):');
  for (const [n, t] of [['Fuesse', aus.fuss], ['Haende', aus.hand]]) {
    if (!t) { console.log('  ' + n + ': keine Messwerte'); continue; }
    console.log('  ' + n.padEnd(8) + t.n + ' Proben   kleinster ' + t.min +
                '   Mittel ' + t.mittel + '   groesster ' + t.max);
  }
  console.log('\nAnlaeufe fehlerhaft: ' + schlecht + ' von ' + aus.laeufe.length);
  await b.close();
})();
