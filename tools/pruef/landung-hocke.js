/* Teil 9: Landung und Hocke.
   Gemessen wird: aus welcher Hoehe die Figur wie landet, ob sie dabei im
   Boden versinkt, und ob die Dachhocke wirklich eine Hocke ist - Haende
   und Fuesse auf dem Dach, Blick ueber die Kante.

   Aufruf:  node landung-hocke.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player, HV = d.heroVisual;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const V = new THREE.Vector3();
    const welt = (n) => { const bn = HV.knochen[n]; if (!bn) return null;
      bn.getWorldPosition(V); return { x: V.x, y: V.y, z: V.z }; };
    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyX','KeyZ'])
                              d.taste(t, false); };

    /* ---- 1. Landung aus verschiedenen Hoehen ---- */
    const landungen = [];
    for (const h of [2, 5, 10, 20, 40, 80, 140]) {
      alleAus();
      d.setzePos(-120, 0, -25);
      const grund = d.groundYAt(-120, -25);
      d.setzePos(-120, grund + h, -25);
      P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
      let vAuf = 0, tiefste = P.pos.y, bilder = 0;
      for (let i = 0; i < 60 * 12; i++) {
        d.schritt(1 / 60); bilder++;
        vAuf = Math.min(vAuf, P.vel.y);
        if (P.onGround) break;
      }
      /* Nach der Landung ein paar Bilder mitlaufen: sackt sie durch? */
      let tiefNach = P.pos.y, clip = null, rolle = 0;
      for (let i = 0; i < 90; i++) {
        d.schritt(1 / 60);
        tiefNach = Math.min(tiefNach, P.pos.y);
        if (P.rollT > 0) rolle++;
        const s = HV.laufStand ? HV.laufStand() : null;
        const a = HV.angriffStand ? HV.angriffStand() : null;
        if (a) clip = a.clip + ' (einmal)'; else if (s && !clip) clip = s.clip;
      }
      const f = welt('lefttoebase') || welt('leftfoot');
      landungen.push({ hoehe: h, aufprall: +(-vAuf).toFixed(1),
        grund: +grund.toFixed(2), nachher: +P.pos.y.toFixed(2),
        tiefsteNachher: +tiefNach.toFixed(2),
        fussUeberGrund: f ? +(f.y - grund).toFixed(3) : null,
        rolleBilder: rolle, clip, zustand: P.state });
    }

    /* ---- 2. Dachhocke ---- */
    let haus = null;
    for (const c of d.colliders) {
      if (!c.h || c.h < 40 || c.klein) continue;
      if ((c.x1 - c.x0) < 12 || (c.z1 - c.z0) < 12) continue;
      if (!haus || c.h > haus.h) haus = c;
    }
    const hocken = [];
    for (const [name, dx] of [['Dachmitte', 0], ['nah an der Kante', -1.0]]) {
      alleAus();
      const px = dx === 0 ? (haus.x0 + haus.x1) / 2 : haus.x0 + 1.0;
      const pz = (haus.z0 + haus.z1) / 2;
      d.setzePos(px, haus.h + 6, pz);
      P.state = 'air'; P.onGround = false; P.vel.set(0, 0, 0);
      for (let i = 0; i < 60 * 8; i++) { d.schritt(1 / 60); if (P.onGround) break; }
      for (let i = 0; i < 60 * 5; i++) d.schritt(1 / 60);   // ruhig stehen -> Hocke
      const lh = welt('lefthand'), rh = welt('righthand');
      const lf = welt('lefttoebase') || welt('leftfoot');
      const rf = welt('righttoebase') || welt('rightfoot');
      const hu = welt('hips'), ko = welt('head');
      hocken.push({ ort: name, hockeT: +(P.hockeT || 0).toFixed(2),
        dach: +haus.h.toFixed(2),
        handL: lh ? +(lh.y - haus.h).toFixed(3) : null,
        handR: rh ? +(rh.y - haus.h).toFixed(3) : null,
        fussL: lf ? +(lf.y - haus.h).toFixed(3) : null,
        fussR: rf ? +(rf.y - haus.h).toFixed(3) : null,
        huefte: hu ? +(hu.y - haus.h).toFixed(3) : null,
        kopf: ko ? +(ko.y - haus.h).toFixed(3) : null,
        kante: P.dachKante ? +P.dachKante.d.toFixed(2) : null,
        /* Wo steht sie wirklich, und wie weit ist die naechste Kante des
           Kolliders? Ohne das laesst sich "keine Kante erkannt" nicht
           beurteilen. */
        ort: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
        randAbstand: +Math.min(P.pos.x - haus.x0, haus.x1 - P.pos.x,
                               P.pos.z - haus.z0, haus.z1 - P.pos.z).toFixed(2),
        hoehePasst: (P.pos.y - 0.25) > 12, amBoden: !!P.onGround,
        tempo: +Math.hypot(P.vel.x, P.vel.z).toFixed(2),
        mastHocke: !!P.mastHocke });
    }
    /* ---- 3. Hockt sie auf Ampel und Laterne noch? ----
       Die Groessengrenze fuer den schmalen Halt darf die echten Masten
       nicht mit ausschliessen. */
    const masten = [];
    for (const c of d.colliders) {
      if (!c.klein || !c.h || c.h < 3 || c.h > 8) continue;
      const br = Math.max(c.x1 - c.x0, c.z1 - c.z0);
      if (br > 1.6) continue;
      alleAus();
      const px = (c.x0 + c.x1) / 2, pz = (c.z0 + c.z1) / 2;
      d.setzePos(px, c.h + 0.001, pz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      for (let i = 0; i < 180; i++) d.schritt(1 / 60);
      masten.push({ breite: +br.toFixed(2), hoehe: +c.h.toFixed(2),
                    mastHocke: !!P.mastHocke, hockeT: +(P.hockeT || 0).toFixed(2),
                    amBoden: !!P.onGround, y: +P.pos.y.toFixed(2) });
      if (masten.length >= 4) break;
    }
    return { landungen, hocken, masten, haus: { h: +haus.h.toFixed(1) } };
  });

  console.log('Landungen auf der Strasse:');
  console.log('  Hoehe'.padEnd(9) + 'Aufprall'.padStart(11) + 'landet auf'.padStart(12) +
              'sackt bis'.padStart(11) + 'Fuss ueber Grund'.padStart(18) +
              'Rolle'.padStart(8) + '  Bewegung');
  let schlecht = 0;
  for (const l of aus.landungen) {
    const ok = Math.abs(l.nachher - l.grund) < 0.05 &&
               l.tiefsteNachher > l.grund - 0.05 &&
               l.fussUeberGrund !== null && l.fussUeberGrund > -0.08 && l.fussUeberGrund < 0.25;
    if (!ok) schlecht++;
    console.log((ok ? '  ok   ' : '  FEHL ') + (l.hoehe + ' m').padEnd(7) +
      (l.aufprall + ' m/s').padStart(11) + String(l.nachher).padStart(12) +
      String(l.tiefsteNachher).padStart(11) + String(l.fussUeberGrund).padStart(18) +
      String(l.rolleBilder).padStart(8) + '  ' + (l.clip || '-'));
  }

  console.log('\nDachhocke auf dem hoechsten Haus (' + aus.haus.h + ' m):');
  for (const h of aus.hocken) {
    console.log('  ' + h.ort + '   Hockewert ' + h.hockeT +
                (h.kante !== null ? ', Kante ' + h.kante + ' m' : ', keine Kante erkannt'));
    console.log('     Haende ueber Dach  links ' + h.handL + '   rechts ' + h.handR);
    console.log('     Fuesse ueber Dach  links ' + h.fussL + '   rechts ' + h.fussR);
    console.log('     Huefte ' + h.huefte + '   Kopf ' + h.kopf);
    console.log('     steht bei ' + JSON.stringify(h.ort) + ', naechster Kolliderrand ' +
                h.randAbstand + ' m, am Boden ' + h.amBoden + ', Tempo ' + h.tempo +
                ', Masthocke ' + h.mastHocke);
  }
  console.log('\nHocke auf schmalen Masten (Ampel, Laterne):');
  for (const m of aus.masten)
    console.log('  ' + (m.mastHocke ? 'ok   ' : 'FEHL ') + 'Mast ' + m.breite +
      ' m breit, ' + m.hoehe + ' m hoch   Masthocke ' + m.mastHocke +
      ', Hockewert ' + m.hockeT);

  console.log('\nLandungen fehlerhaft: ' + schlecht + ' von ' + aus.landungen.length);
  await b.close();
})();
