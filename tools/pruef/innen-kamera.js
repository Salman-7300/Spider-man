/* Die Kamera an den Innenwaenden.

   Human-Playtest: "An der linken Wand ist die Kamera viel zu nah dran."
   Gemessen wird, was der Auftrag nennt:

     - kleinster Abstand Kamera zu Figur
     - Median des Abstands
     - groesster Drehsprung je Bild (Blickrichtung)
     - groesster Ortssprung je Bild (Kameraposition)
     - wie oft die Kamera IN einer Wand steht

   Abgetastet wird jede Wand, jede Ecke und die Raummitte, jeweils in
   acht Blickrichtungen.

   Aufruf:  node tools/pruef/innen-kamera.js  */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    d.setzeMissionCd(1e9);
    const r = d.innenRaum();
    d.innenBetreten({ x: P.pos.x, y: P.pos.y, z: P.pos.z }, 0);
    while (d.innen.phase) d.schritt(1 / 60);
    const g = r.grenzen;

    /* Die Messstellen: 1,2 m vor jeder Wand (dort steht man wirklich,
       wenn man in die Ecke gedraengt wird), dazu die Ecken, die Mitte
       und zwei Innenwaende.

       WICHTIG - erster Durchlauf war falsch: "Mitte" und "Ecke SO"
       lagen im neuen Raum MITTEN IN einem Requisit (Deckungskiste bzw.
       Regal an der Ostwand). Gemessen wurden dann 0,12 m Kameraabstand,
       und das war kein Kamerafehler, sondern eine Figur in einer Kiste.
       Jede Stelle wird deshalb vorher auf freien Boden geprueft und
       notfalls ein Stueck versetzt. */
    const freiHier = (x, z) => {
      for (const kk of d.colliderNah(x, z)) {
        if (kk.h <= 0.35) continue;
        if (kk.y0 !== undefined && kk.y0 > 2.1) continue;
        if (x > kk.x0 - 0.5 && x < kk.x1 + 0.5 && z > kk.z0 - 0.5 && z < kk.z1 + 0.5) return false;
      }
      return true;
    };
    /* Sucht in wachsenden Ringen den naechsten freien Platz. Verschiebt
       hoechstens 3 m - sonst waere es nicht mehr dieselbe Stelle. */
    const freiNah = (x, z) => {
      if (freiHier(x, z)) return [x, z, 0];
      for (let rad = 0.5; rad <= 3.0; rad += 0.5) {
        for (let k = 0; k < 12; k++) {
          const w = (k / 12) * Math.PI * 2;
          const nx = x + Math.sin(w) * rad, nz = z + Math.cos(w) * rad;
          if (nx > g.x0 && nx < g.x1 && nz > g.z0 && nz < g.z1 && freiHier(nx, nz))
            return [nx, nz, rad];
        }
      }
      return [x, z, -1];
    };
    const roh = [];
    const nah = 1.2;
    const mx = (g.x0 + g.x1) / 2, mz = (g.z0 + g.z1) / 2;
    roh.push(['Mitte', mx, mz]);
    roh.push(['Westwand', g.x0 + nah, mz]);
    roh.push(['Ostwand', g.x1 - nah, mz]);
    roh.push(['Suedwand', mx, g.z0 + nah]);
    roh.push(['Nordwand', mx, g.z1 - nah]);
    roh.push(['Ecke SW', g.x0 + nah, g.z0 + nah]);
    roh.push(['Ecke NW', g.x0 + nah, g.z1 - nah]);
    roh.push(['Ecke SO', g.x1 - nah, g.z0 + nah]);
    roh.push(['Ecke NO', g.x1 - nah, g.z1 - nah]);
    roh.push(['Hallentor', r.zonen.lager.x0 + 0.8, mz]);
    roh.push(['Geiselwand', r.geiselPunkt.x - 3.0, r.zonen.geisel.z0 + 1.0]);
    const stellen = [];
    const versetzt = [];
    for (const [name, x, z] of roh) {
      const [nx, nz, rad] = freiNah(x, z);
      stellen.push([name, nx, nz]);
      if (rad > 0) versetzt.push(name + ' um ' + rad.toFixed(1) + ' m');
    }

    const laeufe = {};
    let schlimmster = null;
    for (const ausweichen of [false, true]) {
    d.setzeInnenKamAusweichen(ausweichen);
    const reihen = [];
    for (const [name, px, pz] of stellen) {
      const abst = [];
      let inWand = 0, maxDreh = 0, maxOrt = 0, unter23 = 0;
      let maxGier = 0, maxNeig = 0;
      for (let k = 0; k < 8; k++) {
        const yaw = (k / 8) * Math.PI * 2;
        d.setzePos(px, 0, pz);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        P.facing = yaw;
        d.setzeKamYaw(yaw + Math.PI);
        /* Einschwingen lassen, dann erst messen: der erste Sprung nach
           einem Teleport ist kein Kamerafehler.
           120 Bilder (2 s) statt 40: mit 40 lagen an JEDER Stelle genau
           49 von 320 Bildern unter 2,3 m - also rund sechs je Richtung,
           und das waren die Bilder, in denen camPos noch vom vorigen Ort
           herangeglitten ist. Das ist Messrauschen, kein Kameraverhalten. */
        for (let i = 0; i < 120; i++) d.schritt(1 / 60);
        let vorP = d.camera.position.clone();
        let vorR = d.camera.getWorldDirection(new THREE.Vector3()).clone();
        for (let i = 0; i < 40; i++) {
          d.schritt(1 / 60);
          const c = d.camera.position;
          const ab = Math.hypot(c.x - P.pos.x, c.z - P.pos.z);
          abst.push(ab);
          if (ab < 2.3) unter23++;
          /* In einer Wand? Derselbe Kastentest wie im Spiel, nur ohne
             Radius - es geht um "steckt drin", nicht um "streift". */
          for (const kk of d.colliderNah(c.x, c.z)) {
            if (kk.y0 !== undefined && c.y + 0.2 < kk.y0) continue;
            if (c.x > kk.x0 && c.x < kk.x1 && c.z > kk.z0 && c.z < kk.z1 && c.y < kk.h) {
              inWand++;
              if (!schlimmster) schlimmster = { name, yaw: +yaw.toFixed(2),
                kam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)] };
              break;
            }
          }
          const dOrt = c.distanceTo(vorP);
          if (dOrt > maxOrt) maxOrt = dOrt;
          vorP = c.clone();
          const ri = d.camera.getWorldDirection(new THREE.Vector3());
          const dDreh = Math.acos(Math.min(1, Math.max(-1, ri.dot(vorR))));
          if (dDreh > maxDreh) maxDreh = dDreh;
          vorR = ri.clone();
          const ab2 = d.innenKamAbweichung();
          maxGier = Math.max(maxGier, Math.abs(ab2.gier));
          maxNeig = Math.max(maxNeig, Math.abs(ab2.neig));
        }
      }
      abst.sort((a, b2) => a - b2);
      reihen.push({ name, proben: abst.length,
        min: +abst[0].toFixed(2),
        median: +abst[Math.floor(abst.length / 2)].toFixed(2),
        max: +abst[abst.length - 1].toFixed(2),
        unter23, inWand,
        maxDreh: +(maxDreh * 180 / Math.PI).toFixed(2),
        maxOrt: +maxOrt.toFixed(3),
        maxGier: +(maxGier * 180 / Math.PI).toFixed(1),
        maxNeig: +(maxNeig * 180 / Math.PI).toFixed(1) });
    }
    laeufe[ausweichen ? 'mit' : 'ohne'] = reihen;
    }
    d.setzeInnenKamAusweichen(true);
    d.innenVerlassen();
    while (d.innen.phase) d.schritt(1 / 60);
    return { laeufe, schlimmster, grenzen: g, versetzt,
             schwelle: d.innenKamAbweichung().min };
  });

  const p = (s) => console.log(s);
  p('');
  p('Kamera im Innenraum, je Stelle 8 Blickrichtungen x 40 Bilder');
  p('  Schwelle, ab der ausgewichen wird: ' + aus.schwelle + ' m');
  p('');
  if (aus.versetzt.length) p('  Messstellen auf freien Boden versetzt: ' + aus.versetzt.join(', '));
  p('');
  p('                 OHNE Ausweichen                 MIT Ausweichen');
  p('  Stelle          min Median  <2,3  Wand      min Median  <2,3  Wand   Gier  Neig  Dreh/Bild  Ort/Bild');
  for (let i = 0; i < aus.laeufe.mit.length; i++) {
    const o = aus.laeufe.ohne[i], m = aus.laeufe.mit[i];
    p('  ' + String(m.name).padEnd(13) +
      String(o.min).padStart(6) + String(o.median).padStart(7) +
      String(o.unter23).padStart(6) + String(o.inWand).padStart(6) + '   ' +
      String(m.min).padStart(6) + String(m.median).padStart(7) +
      String(m.unter23).padStart(6) + String(m.inWand).padStart(6) +
      String(m.maxGier).padStart(7) + String(m.maxNeig).padStart(6) +
      String(m.maxDreh).padStart(11) + String(m.maxOrt).padStart(10));
  }
  const summe = (rs, f) => rs.reduce((a, r) => a + r[f], 0);
  p('');
  p('  Bilder unter 2,3 m gesamt:  ohne ' + summe(aus.laeufe.ohne, 'unter23') +
    '   mit ' + summe(aus.laeufe.mit, 'unter23') +
    '   von je ' + summe(aus.laeufe.mit, 'proben'));
  p('  Bilder mit der Kamera IN einer Wand:  ohne ' + summe(aus.laeufe.ohne, 'inWand') +
    '   mit ' + summe(aus.laeufe.mit, 'inWand'));
  if (aus.schlimmster) p('  erste Kamera IN einer Wand: ' + JSON.stringify(aus.schlimmster));
  await b.close();
})();
