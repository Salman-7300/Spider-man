/* Nachmessung zu #79 (Stadtmoebel nach Entfernung zeichnen).
   Die urspruengliche Kurve wurde auf einer Stadt gemessen, in der die
   Hausmodelle noch nicht standen - der Pruefstand hatte zu frueh
   losgelegt. Hier dieselbe Kurve auf der VOLLSTAENDIGEN Stadt.

   Aufruf:  node moebel-sicht.js
   ========================================================================= */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    /* Alles Bewegliche weg: Wagen, Passanten und Gegner aendern die
       Dreieckszahl von Bild zu Bild und ueberdecken den Unterschied, den
       diese Messung sucht. Beim ersten Anlauf kam dadurch fuer 235 m
       MEHR heraus als fuer unbegrenzt - unmoeglich, wenn sich nur die
       Moebel aendern. */
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    let tuerme = 0;
    d.szene.traverse((o) => { if (o.userData && o.userData.visualKind === 'tower') tuerme++; });
    /* Ein fester Standpunkt mitten in der Stadt, Blick die Strasse hinunter. */
    const P = d.player;
    d.setzePos(0, 2, 0); P.state = 'ground'; P.onGround = true;
    const messe = () => {
      let r = null;
      for (let i = 0; i < 3; i++) { d.aufnahme(-20, 6, -20, 120, 20, 120); r = d.renderZahlen(); }
      return r;
    };
    const reihe = [];
    for (const s of [99999, 360, 300, 235, 190, 150, 120, 90]) {
      d.setzeMoebelSicht(s);
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);   // Takt laeuft alle 0,25 s
      const r = messe();
      const r2 = messe();                       // zur Probe ein zweites Mal
      reihe.push({ sicht: s, calls: r.calls, tris: r.tris,
                   calls2: r2.calls, tris2: r2.tris });
    }
    d.setzeMoebelSicht(235);
    return { tuerme, reihe };
  });
  console.log('Hochhaeuser in der Szene: ' + aus.tuerme + '  (0 hiesse: zu frueh gemessen)');
  console.log('\nSichtweite'.padEnd(14) + 'Zeichenaufrufe'.padStart(16) +
              'Dreiecke'.padStart(12) + 'gegen unbegrenzt'.padStart(19));
  const erst = aus.reihe[0];
  for (const r of aus.reihe) {
    const ab = ((r.tris / erst.tris - 1) * 100).toFixed(1) + '%';
    const stabil = (r.tris === r.tris2 && r.calls === r.calls2) ? '' : '  (schwankt!)';
    console.log((r.sicht > 9999 ? 'unbegrenzt' : r.sicht + ' m').padEnd(14) +
      String(r.calls).padStart(16) + String(r.tris).padStart(12) + ab.padStart(19) + stabil);
  }
  await b.close();
})();
