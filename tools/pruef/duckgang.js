/* Teil 7, Ursachenmessung der Duckgangarten.
   ===================================================================
   Bekannt: Duckgangarten rutschen mit rund 44,8 %. Der Versuch,
   gangKontakt einfach einzuschalten, ist verworfen (44,8 -> 60,5 %) und
   wird NICHT wiederholt.

   Hier wird zuerst die URSACHE vermessen, je Gangart und je Spieltempo:

     Kontaktphase links / rechts   wann steht welcher Fuss auf dem Boden
     Start / Ende der Stuetzphase  als Anteil der Cliplaenge
     Fussgeschwindigkeit rel. Huefte   das Tempo, das der Clip TRAEGT
     Clip-Eigengeschwindigkeit     daraus abgeleitet, ueber den Kontakt
     gewuenschte Spielgeschwindigkeit  was die Figur wirklich laeuft
     timeScale                     wie stark der Clip gedehnt wird
     Netto-Rutschen                Weg des Standfusses in der WELT

   Dazu die beiden Uebergaenge, die der Auftrag nennt:
     ducken-Stand -> ducken-Bewegung
     ducken-Bewegung -> normales Laufen
   =================================================================== */
const { starte } = require('./basis');
const fs = require('fs');

(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const versuche = process.argv[3] ? JSON.parse(process.argv[3]) : [];
  await page.evaluate((v) => { window.__versuche = v; }, versuche);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player, HV = d.heroVisual;
    if (!HV || !HV.knochen) return { fehler: 'keine Knochen' };
    d.frier(true);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;

    const kn = HV.knochen;
    const V = new (Object.getPrototypeOf(P.pos).constructor)();
    const welt = (name) => { const b2 = kn[name]; if (!b2) return null;
      b2.getWorldPosition(V); return { x: V.x, y: V.y, z: V.z }; };

    const TASTEN = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','AltLeft','KeyX','Space'];
    const frei = () => { for (const t of TASTEN) d.taste(t, false); };

    /* Bodenkontakt: der Fuss ist unten, wenn er weniger als SCHWELLE
       ueber dem tiefsten Punkt der letzten Bilder liegt. */
    const SCHWELLE = 0.05;

    function messeGangart(name, ein, dauerS) {
      d.setzePos(-170, 0, -25);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      frei();
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      for (const t of ein) d.taste(t, true);
      d.taste('KeyW', true);
      /* einlaufen lassen */
      for (let i = 0; i < 150; i++) d.schritt(1 / 60);

      const proben = [];
      const N = Math.round(dauerS * 60);
      for (let i = 0; i < N; i++) {
        d.schritt(1 / 60);
        const lf = welt('leftfoot'), rf = welt('rightfoot'), h = welt('hips');
        const st = HV.laufStand ? HV.laufStand() : null;
        if (!lf || !rf || !h) continue;
        proben.push({
          t: i / 60,
          lfy: lf.y, rfy: rf.y, hy: h.y,
          lfx: lf.x, lfz: lf.z, rfx: rf.x, rfz: rf.z,
          hx: h.x, hz: h.z,
          px: P.pos.x, pz: P.pos.z,
          v: Math.hypot(P.vel.x, P.vel.z),
          clip: st ? st.clip : null, ts: st ? st.ts : null, ct: st ? st.t : null,
        });
      }
      if (proben.length < 30) return { name, fehler: 'zu wenige Proben' };

      /* Bodenhoehe je Fuss: das Minimum ueber alle Proben. */
      const minL = Math.min(...proben.map((p) => p.lfy));
      const minR = Math.min(...proben.map((p) => p.rfy));

      /* Kontaktabschnitte je Fuss sammeln. */
      function abschnitte(seite) {
        const y = seite === 'L' ? 'lfy' : 'rfy';
        const min = seite === 'L' ? minL : minR;
        const aus = []; let start = -1;
        for (let i = 0; i < proben.length; i++) {
          const unten = proben[i][y] - min < SCHWELLE;
          if (unten && start < 0) start = i;
          else if (!unten && start >= 0) { if (i - start > 3) aus.push([start, i - 1]); start = -1; }
        }
        if (start >= 0 && proben.length - start > 3) aus.push([start, proben.length - 1]);
        return aus;
      }
      const absL = abschnitte('L'), absR = abschnitte('R');

      /* Je Kontakt: Weg des Fusses in der WELT (= Rutschen), Weg der
         Figur, und Weg des Fusses RELATIV ZUR HUEFTE (= was der Clip
         traegt). */
      function auswerten(abs, seite) {
        const fx = seite === 'L' ? 'lfx' : 'rfx', fz = seite === 'L' ? 'lfz' : 'rfz';
        const r = [];
        for (const [a, b2] of abs) {
          const dauer = (b2 - a) / 60;
          if (dauer < 0.08) continue;
          let weltWeg = 0, figurWeg = 0, relWeg = 0;
          for (let i = a + 1; i <= b2; i++) {
            const p = proben[i], q = proben[i - 1];
            weltWeg += Math.hypot(p[fx] - q[fx], p[fz] - q[fz]);
            figurWeg += Math.hypot(p.px - q.px, p.pz - q.pz);
            const rp = { x: p[fx] - p.hx, z: p[fz] - p.hz };
            const rq = { x: q[fx] - q.hx, z: q[fz] - q.hz };
            relWeg += Math.hypot(rp.x - rq.x, rp.z - rq.z);
          }
          r.push({ dauer: +dauer.toFixed(3),
                   welt: +weltWeg.toFixed(4), figur: +figurWeg.toFixed(4), rel: +relWeg.toFixed(4),
                   anteil: figurWeg > 0.001 ? weltWeg / figurWeg : 0,
                   eigen: +(relWeg / dauer).toFixed(3) });
        }
        return r;
      }
      const kL = auswerten(absL, 'L'), kR = auswerten(absR, 'R');

      /* ---- Zweites, unabhaengiges Mass ----
         Die Abschnittsmethode oben setzt voraus, dass sich die Stuetzphase
         ueberhaupt abgrenzen laesst. Bei Kriechen und Ducken tut sie das
         nicht: der Fuss hebt nie weit genug ab, ein "Kontakt" dauert dort
         gemessen 8 Sekunden und damit mehr als drei Cliplaengen. Jede
         Rutschzahl daraus ist wertlos.
         Deshalb zusaetzlich ein Mass OHNE Abschnitte: von allen Bildern
         werden die genommen, in denen der Fuss im unteren Drittel seines
         eigenen Hoehenbereichs liegt - das ist die Stuetzphase, ohne sie
         abgrenzen zu muessen. Verglichen wird Bild fuer Bild, wie weit
         sich der Fuss in der WELT bewegt, gegen den Weg der Figur. */
      function unteresDrittel(seite) {
        const y = seite === 'L' ? 'lfy' : 'rfy';
        const fx = seite === 'L' ? 'lfx' : 'rfx', fz = seite === 'L' ? 'lfz' : 'rfz';
        const hoehen = proben.map((p) => p[y]);
        const lo = Math.min(...hoehen), hi = Math.max(...hoehen);
        const grenze = lo + (hi - lo) / 3;
        const werte = [];
        for (let i = 1; i < proben.length; i++) {
          if (proben[i][y] > grenze) continue;
          const p = proben[i], q = proben[i - 1];
          const fw = Math.hypot(p[fx] - q[fx], p[fz] - q[fz]);
          const gw = Math.hypot(p.px - q.px, p.pz - q.pz);
          if (gw < 0.001) continue;
          werte.push(fw / gw);
        }
        return werte;
      }
      const d3 = unteresDrittel('L').concat(unteresDrittel('R'));
      const alle = kL.concat(kR);
      if (!alle.length) return { name, fehler: 'kein Bodenkontakt erkannt' };
      const med = (a) => { const s = a.slice().sort((x, y2) => x - y2);
        return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

      const clipDauer = (HV.clipDauer ? HV.clipDauer(name) : 0) || 0;
      const tsWerte = proben.map((p) => p.ts).filter((x) => x !== null);
      const vWerte = proben.map((p) => p.v);

      return {
        name,
        clip: proben[Math.floor(proben.length / 2)].clip,
        clipDauer: +clipDauer.toFixed(3),
        gangRef: d.gangRef()[name] !== undefined ? d.gangRef()[name] : null,
        spieltempo: +med(vWerte).toFixed(3),
        timeScale: +med(tsWerte).toFixed(3),
        kontakteL: kL.length, kontakteR: kR.length,
        stuetzDauerMedian: +med(alle.map((x) => x.dauer)).toFixed(3),
        stuetzAnteilDerCliplaenge: clipDauer > 0
          ? +(med(alle.map((x) => x.dauer)) * med(tsWerte) / clipDauer).toFixed(3) : null,
        eigentempoMedian: +med(alle.map((x) => x.eigen)).toFixed(3),
        rutschenMedianProzent: +(med(alle.map((x) => x.anteil)) * 100).toFixed(1),
        rutschD3Median: d3.length ? +(med(d3) * 100).toFixed(1) : null,
        rutschD3Max: d3.length ? +(Math.max(...d3) * 100).toFixed(1) : null,
        rutschD3Proben: d3.length,
        rutschenGroesster: +(Math.max(...alle.map((x) => x.anteil)) * 100).toFixed(1),
        weltwegMedian: +med(alle.map((x) => x.welt)).toFixed(4),
      };
    }

    /* ---- Die drei Duckgangarten und drei Vergleichsgangarten ---- */
    const gangarten = [
      ['kriechen',   ['KeyX', 'ShiftLeft']],
      ['ducken',     ['KeyX']],
      ['schleichen', ['KeyX', 'AltLeft']],
      ['gehen',      ['AltLeft']],
      ['walk',       []],
      ['run',        ['ShiftLeft']],
    ];
    /* Ein Durchgang mit den eingestellten Werten, danach je Versuchswert
       ein weiterer. Die Werte kommen von aussen, damit ein Fix erst
       GEMESSEN und dann eingebaut wird - nicht umgekehrt. */
    const ergebnis = [];
    for (const [n, ein] of gangarten) ergebnis.push(messeGangart(n, ein, 8));

    const versuche = [];
    for (const [name, werte] of (window.__versuche || [])) {
      const alt = d.gangRef()[name];
      for (const v of werte) {
        d.setzeGangRef(name, v);
        const r = messeGangart(name, gangarten.find((g) => g[0] === name)[1], 8);
        r.versuchsRef = v;
        versuche.push(r);
      }
      d.setzeGangRef(name, alt);
    }

    /* ---- Die beiden Uebergaenge ---- */
    function uebergang(name, vorTasten, nachTasten, bilder) {
      d.setzePos(-170, 0, -25);
      P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      frei();
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      for (const t of vorTasten) d.taste(t, true);
      for (let i = 0; i < 120; i++) d.schritt(1 / 60);
      const spur = [];
      for (let i = 0; i < bilder; i++) {
        if (i === 60) { frei(); for (const t of nachTasten) d.taste(t, true); }
        d.schritt(1 / 60);
        const st = HV.laufStand ? HV.laufStand() : null;
        const lf = welt('leftfoot');
        spur.push({ i, clip: st ? st.clip : null, ts: st ? st.ts : null,
                    gew: st ? st.gewicht : null,
                    v: +Math.hypot(P.vel.x, P.vel.z).toFixed(3),
                    fx: lf ? +lf.x.toFixed(3) : null });
      }
      /* Wann wechselt der Clip, und wie sprunghaft ist es? */
      let wechselBei = -1;
      for (let i = 61; i < spur.length; i++)
        if (spur[i].clip !== spur[60].clip) { wechselBei = i - 60; break; }
      let maxRuck = 0;
      for (let i = 62; i < spur.length; i++) {
        const r = Math.abs((spur[i].fx - spur[i - 1].fx) - (spur[i - 1].fx - spur[i - 2].fx));
        if (r > maxRuck) maxRuck = r;
      }
      return { name, clipVor: spur[59].clip, clipNach: spur[spur.length - 1].clip,
               wechselNachBildern: wechselBei,
               tempoVor: spur[59].v, tempoNach: spur[spur.length - 1].v,
               groessterFussRuck: +maxRuck.toFixed(4) };
    }
    const ueber = [
      uebergang('Duckstand -> Duckgang', ['KeyX'], ['KeyX', 'KeyW'], 240),
      uebergang('Duckgang -> Laufen',    ['KeyX', 'KeyW'], ['KeyW'], 240),
    ];

    return { ergebnis, ueber, versuche };
  });

  if (aus.fehler) { console.log('FEHLER:', aus.fehler); await b.close(); return; }
  console.log('');
  console.log('=== Duckgangarten: Ursachenmessung ===');
  console.log('');
  console.log('Gangart'.padEnd(12) + 'Clip'.padEnd(12) + 'Ref'.padStart(7) +
              'Tempo'.padStart(8) + 'timeSc'.padStart(8) + 'Eigen'.padStart(8) +
              'Stuetz'.padStart(8) + 'Anteil'.padStart(8) +
              'Rutsch%'.padStart(9) + 'max%'.padStart(8) +
              'D3-Med%'.padStart(9) + 'D3-Max%'.padStart(9));
  console.log('-'.repeat(96));
  for (const e of aus.ergebnis) {
    if (e.fehler) { console.log(e.name.padEnd(12) + '  ' + e.fehler); continue; }
    console.log(e.name.padEnd(12) + String(e.clip || '-').padEnd(12) +
      String(e.gangRef == null ? '-' : e.gangRef).padStart(7) +
      String(e.spieltempo).padStart(8) + String(e.timeScale).padStart(8) +
      String(e.eigentempoMedian).padStart(8) +
      String(e.stuetzDauerMedian).padStart(8) +
      String(e.stuetzAnteilDerCliplaenge == null ? '-' : e.stuetzAnteilDerCliplaenge).padStart(8) +
      String(e.rutschenMedianProzent).padStart(9) + String(e.rutschenGroesster).padStart(8) +
      String(e.rutschD3Median == null ? '-' : e.rutschD3Median).padStart(9) +
      String(e.rutschD3Max == null ? '-' : e.rutschD3Max).padStart(9));
  }
  console.log('-'.repeat(96));
  console.log('Ref = eingestellte Eigengeschwindigkeit (GANG_REF), Eigen = gemessene');
  console.log('Stuetz = Dauer eines Bodenkontakts in s, Anteil = davon an der Cliplaenge');
  console.log('D3 = zweites Mass ohne Abschnittsbildung: Fussweg/Figurweg in den Bildern,');
  console.log('     in denen der Fuss im unteren Drittel seines Hoehenbereichs liegt.');
  if (aus.versuche && aus.versuche.length) {
    console.log('');
    console.log('Versuchswerte (nur gemessen, noch nicht eingebaut):');
    console.log('Gangart'.padEnd(12) + 'Ref'.padStart(7) + 'Tempo'.padStart(8) +
                'timeSc'.padStart(8) + 'Eigen'.padStart(8) +
                'D3-Med%'.padStart(9) + 'D3-Max%'.padStart(9));
    for (const e of aus.versuche) {
      if (e.fehler) { console.log(e.name.padEnd(12) + '  ' + e.fehler); continue; }
      console.log(e.name.padEnd(12) + String(e.versuchsRef).padStart(7) +
        String(e.spieltempo).padStart(8) + String(e.timeScale).padStart(8) +
        String(e.eigentempoMedian).padStart(8) +
        String(e.rutschD3Median == null ? '-' : e.rutschD3Median).padStart(9) +
        String(e.rutschD3Max == null ? '-' : e.rutschD3Max).padStart(9));
    }
  }
  console.log('');
  console.log('Uebergaenge:');
  for (const u of aus.ueber) {
    console.log('  ' + u.name.padEnd(24) + u.clipVor + ' -> ' + u.clipNach +
                '   Wechsel nach ' + u.wechselNachBildern + ' Bildern' +
                '   Tempo ' + u.tempoVor + ' -> ' + u.tempoNach +
                '   groesster Fussruck ' + u.groessterFussRuck + ' m');
  }
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(aus, null, 2));
  await b.close();
})();
