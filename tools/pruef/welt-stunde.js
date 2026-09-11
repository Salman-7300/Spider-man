/* Test B - 60 Minuten Weltbelastung.
   Gezaehlt wird alle 30 Sekunden Spielzeit, was es in der Welt gibt:
   Szenenobjekte, Gegner, Bosse, Zivilisten, Autos, Ereignisse,
   Einsatzkraefte, Lichter und die temporaeren Verweise, die das Spiel
   selbst als Leck melden kann. Bedingung des Auftrags: KEIN
   WACHSTUMSTREND.

   Der Spieler wandert dabei ueber die Karte, damit nicht eine Stunde
   lang dieselbe Ecke simuliert wird - stehenbleiben laesst die halbe
   Welt einschlafen und beweist gar nichts.

   Auswertung: fuer jede Reihe wird eine Regressionsgerade durch die
   120 Messpunkte gelegt. Die Steigung sagt, ob die Zahl ueber die
   Stunde waechst. Dazu Anfang, Ende, Mittel und Hoechstwert. */
const { starte } = require('./basis');
const fs = require('fs');

(async () => {
  const { b, page } = await starte(800, 480, Number(process.argv[3]) || 4711);
  page.on('pageerror', () => {});
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    let fehler = 0;
    const alterFehler = window.onerror;
    window.onerror = function () { fehler++; if (alterFehler) return alterFehler.apply(this, arguments); };

    const zaehleSzene = () => { let n = 0; d.szene.traverse(() => n++); return n; };
    const zaehleLichter = () => {
      let n = 0; d.szene.traverse((o) => { if (o.isLight) n++; }); return n;
    };

    const reihen = ['szene', 'lichter', 'gegner', 'bosse', 'zivilisten', 'autos',
                    'ereignisse', 'einsaetze', 'einsatzwagen', 'aktivitaeten',
                    'schwaerme', 'kollider', 'lecks', 'fehler'];
    const daten = {};
    for (const r of reihen) daten[r] = [];

    const wanderung = [[0, 0], [-140, -140], [140, 140], [-140, 140], [140, -140],
                       [255, -25], [60, -160], [-60, 160], [370, 40], [-160, 60]];
    const dt = 1 / 60;
    const SEK = 3600;
    const PROBE = 30 * 60;                       // alle 30 s (in Bildern)
    for (let i = 0; i < 60 * SEK; i++) {
      if (i % (60 * 360) === 0) {
        const w = wanderung[Math.floor(i / (60 * 360)) % wanderung.length];
        d.setzePos(w[0], 40, w[1]);
      }
      d.schritt(dt);
      if (i % PROBE) continue;
      const resp = d.respAnzahl ? d.respAnzahl() : { einsaetze: 0, wagen: 0 };
      let lecks = 0;
      try { lecks += (d.evLeck ? d.evLeck() : 0) || 0; } catch (e) {}
      try { lecks += (d.aktLeck ? d.aktLeck() : 0) || 0; } catch (e) {}
      try { lecks += (d.respLeck ? d.respLeck() : 0) || 0; } catch (e) {}
      daten.szene.push(zaehleSzene());
      daten.lichter.push(zaehleLichter());
      daten.gegner.push((d.enemies || []).length);
      daten.bosse.push(d.bossListe ? d.bossListe().length : (d.boss ? 1 : 0));
      daten.zivilisten.push((d.civilians || []).length);
      daten.autos.push((d.cars || []).length);
      daten.ereignisse.push(d.evStand ? d.evStand().length : 0);
      daten.einsaetze.push(resp.einsaetze || 0);
      daten.einsatzwagen.push(resp.wagen || 0);
      daten.aktivitaeten.push(d.aktListe ? d.aktListe().length : 0);
      daten.schwaerme.push(d.umgSchwaerme ? d.umgSchwaerme().length : 0);
      daten.kollider.push((d.colliders || []).length);
      daten.lecks.push(lecks);
      daten.fehler.push(fehler);
    }
    return { daten, reihen,
             hyg: d.hygStatistik ? d.hygStatistik() : null,
             evStat: d.evStatistik ? d.evStatistik() : null,
             gehSuche: d.gehSuche ? d.gehSuche() : null };
  });

  function gerade(y) {
    const n = y.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sxx += i * i; }
    const nenner = n * sxx - sx * sx;
    return nenner ? (n * sxy - sx * sy) / nenner : 0;
  }

  console.log('');
  console.log('60 Minuten Spielzeit, ' + aus.daten.szene.length + ' Messpunkte im Abstand von 30 s.');
  console.log('');
  console.log('Reihe'.padEnd(14), 'Anfang'.padStart(8), 'Ende'.padStart(8),
              'Mittel'.padStart(9), 'Hoechst'.padStart(8),
              'je Stunde'.padStart(11), 'Urteil');
  console.log('-'.repeat(78));
  let waechst = 0;
  for (const r of aus.reihen) {
    const y = aus.daten[r];
    if (!y.length) continue;
    const st = gerade(y) * (y.length - 1);          // Aenderung ueber die ganze Stunde
    const mittel = y.reduce((a, v) => a + v, 0) / y.length;
    /* Ein Trend zaehlt erst, wenn er ueber die Stunde mehr als 5 % des
       Mittelwerts ausmacht UND mindestens 2 Stueck betraegt - sonst ist
       es Rauschen einer schwankenden Welt. */
    const echt = Math.abs(st) > Math.max(2, mittel * 0.05);
    const urteil = !echt ? 'stabil' : (st > 0 ? 'WAECHST' : 'faellt');
    if (echt && st > 0) waechst++;
    console.log(r.padEnd(14), String(y[0]).padStart(8), String(y[y.length - 1]).padStart(8),
                mittel.toFixed(1).padStart(9), String(Math.max(...y)).padStart(8),
                (st >= 0 ? '+' : '') + st.toFixed(1).padStart(10), ' ' + urteil);
  }
  console.log('-'.repeat(78));
  console.log(waechst === 0 ? 'Kein Wachstumstrend.' : waechst + ' Reihe(n) mit Wachstumstrend.');
  if (aus.hyg) console.log('Hygiene:', JSON.stringify(aus.hyg));
  if (aus.gehSuche) console.log('Wegsuche:', JSON.stringify(aus.gehSuche));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(aus, null, 2));
  await b.close();
})();
