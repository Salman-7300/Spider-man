/* Kann man die Haeuser wirklich betreten - und taugt der Innenraum als
   Versteck?

   Die Baukasten-Haeuser sind mit einer Tuerluecke gebaut (kitHindernis:
   vier Wandscheiben, Sturz, Dachplatte). Ob eine Figur da auch WIRKLICH
   hineinkommt, ob die Gegner drinnen laufen koennen und ob eine Wand den
   Blick bricht, steht damit noch nicht fest. Genau das misst dieser
   Pruefstand - er ist die Grundlage fuer den Umbau von Mission 6.

   Aufruf:  node pruef/innenraum.js [Bilderordner]
*/
const fs = require('fs');
const path = require('path');
const { starte } = require('./basis');

const BILDER = process.argv[2] || null;

(async () => {
  const { b, page } = await starte(1000, 640, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    if (d.setzeMissionCd) d.setzeMissionCd(1e9);

    /* ---- Innenraeume mit ihrer Tuer zusammenbringen ----
       Beide Listen stehen einzeln im Testfenster; verbunden sind sie
       nicht. Die Tuer eines Raums ist die, die in seiner Wand liegt. */
    const raeume = d.kitInnen().map((r, i) => ({
      i, x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1,
      boden: r.boden, decke: r.decke,
      mx: (r.x0 + r.x1) / 2, mz: (r.z0 + r.z1) / 2,
      flaeche: (r.x1 - r.x0) * (r.z1 - r.z0),
    }));
    /* Die Tuer muss IN DER WAND DIESES Raums liegen, nicht bloss in
       seiner Naehe: bei den grossen Haeusern (19 x 15 m) ist die Tuer
       eines Nachbarhauses der Raummitte manchmal naeher als die eigene.
       Genau daran ist der erste Anlauf gescheitert - er schickte die
       Figur gegen eine fremde Fassade, wo sie zu klettern anfing. */
    const WANDD = 1.6;   // Wandstaerke 0,8 m, grosszuegig gerechnet
    for (const r of raeume) {
      let best = null, bd = 1e9;
      for (const t of d.tuerStellen()) {
        const tx = (t.durchgang.x0 + t.durchgang.x1) / 2;
        const tz = (t.durchgang.z0 + t.durchgang.z1) / 2;
        /* In der Wand heisst: innerhalb des um die Wandstaerke
           aufgeweiteten Rechtecks, aber nicht tief im Raum drin. */
        const drinWeit = tx > r.x0 - WANDD && tx < r.x1 + WANDD &&
                         tz > r.z0 - WANDD && tz < r.z1 + WANDD;
        if (!drinWeit) continue;
        const randAbstand = Math.min(Math.abs(tx - r.x0), Math.abs(tx - r.x1),
                                     Math.abs(tz - r.z0), Math.abs(tz - r.z1));
        if (randAbstand > WANDD) continue;      // mitten im Raum: nicht seine Tuer
        const dd = Math.hypot(tx - r.mx, tz - r.mz);
        if (dd < bd) { bd = dd; best = { t, tx, tz, dd }; }
      }
      r.tuer = best;
    }
    const mitTuer = raeume.filter((r) => r.tuer);
    const ohneTuer = raeume.filter((r) => !r.tuer).map((r) => ({
      i: r.i, flaeche: +r.flaeche.toFixed(0), mitte: [+r.mx.toFixed(0), +r.mz.toFixed(0)] }));

    const imRaum = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;

    /* ================= 1. Hineingehen ================= */
    const rein = [];
    for (const r of mitTuer) {
      const t = r.tuer.t;
      /* Vor der Tuer aufstellen: von der Tuer aus in Normalenrichtung
         nach draussen. nx/nz zeigen aus dem Haus heraus. */
      const sx = r.tuer.tx + t.nx * 3.2, sz = r.tuer.tz + t.nz * 3.2;
      const gy = d.groundYAt(sx, sz, 2);
      d.setzePos(sx, gy + 0.05, sz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.duckt = false;
      /* ---- Erst auf die TUER zielen, dann auf die Raummitte ----
         Der erste Anlauf zielte sofort auf die Raummitte. Bei den grossen
         Haeusern (19 m breit) liegt die 1,45 m schmale Tuer aber seitlich
         der Mitte: die Figur lief schraeg auf die Fassade zu, verfehlte
         den Durchgang und fing an zu klettern. Ein Mensch zielt auf die
         Tuer - also tut es der Pruefstand jetzt auch. */
      let w = Math.atan2(r.tuer.tx - sx, r.tuer.tz - sz);
      P.facing = w; d.setzeKamYaw(w + Math.PI);
      d.taste('KeyW', true);
      let drin = null, bild = 0, durch = false;
      for (let i = 0; i < 240; i++) {
        d.schritt(1 / 30); bild++;
        if (!durch) {
          const rel = (P.pos.x - r.tuer.tx) * t.nx + (P.pos.z - r.tuer.tz) * t.nz;
          if (rel < 0) {
            durch = true;
            w = Math.atan2(r.mx - P.pos.x, r.mz - P.pos.z);
            P.facing = w; d.setzeKamYaw(w + Math.PI);
          }
        }
        if (imRaum(r, P.pos.x, P.pos.z)) { drin = bild; break; }
      }
      d.taste('KeyW', false);
      rein.push({ raum: r.i, haus: t.haus, flaeche: +r.flaeche.toFixed(0),
                  drin, bild,
                  endOrt: [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)],
                  endY: +P.pos.y.toFixed(2), boden: +r.boden.toFixed(2),
                  zustand: P.state,
                  tuerWeit: +(t.durchgang.x1 - t.durchgang.x0 > t.durchgang.z1 - t.durchgang.z0
                              ? t.durchgang.x1 - t.durchgang.x0
                              : t.durchgang.z1 - t.durchgang.z0).toFixed(2) });
    }

    /* ================= 2. Sichtschutz ================= */
    /* Der Gegner wird FESTGEHALTEN: er soll nicht auf den Spieler
       zulaufen und dabei die Geometrie veraendern. Gefragt ist allein,
       ob die Wand den Blick bricht - nicht, wie schnell er herankommt.
       Gemessen wird zusaetzlich an mehreren Stellen rund um das Haus. */
    const sicht = [];
    for (const r of mitTuer) {
      const t = r.tuer.t;
      d.enemies.length = 0;
      if (d.gangs) d.gangs.length = 0;
      /* Spieler in die von der Tuer abgewandte Haelfte des Raums. */
      const px = r.mx - t.nx * ((r.x1 - r.x0) / 2 - 1.6);
      const pz = r.mz - t.nz * ((r.z1 - r.z0) / 2 - 1.6);
      d.setzePos(px, r.boden + 0.05, pz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.dead = false; P.hp = 100;
      d.schritt(1 / 30);
      const drin = imRaum(r, P.pos.x, P.pos.z);
      /* Acht Stellen im Kreis um die Hausmitte, 12 m Radius. Ohne die
         Tuerseite waere die Messung geschoent - durch eine offene Tuer
         SOLL man gesehen werden. Deshalb wird sie getrennt ausgewiesen. */
      const proben = [];
      for (let k = 0; k < 8; k++) {
        const w2 = (k / 8) * Math.PI * 2;
        const ex = r.mx + Math.sin(w2) * 12, ez = r.mz + Math.cos(w2) * 12;
        /* ---- "Durch die Tuer" GEOMETRISCH bestimmen, nicht ueber einen
           Winkelschwellwert ----
           Der erste Anlauf nahm den Winkel zur Tuernormale (> 0,72). Bei
           acht Blickpunkten liegt einer davon genau auf 45 Grad, und
           cos(45) = 0,707 - er wurde also als "Wand" gezaehlt, obwohl der
           Strahl schraeg durch die offene Tuer laeuft. Jetzt wird der
           Schnittpunkt des Strahls mit der Tuerebene gerechnet und
           geprueft, ob er im Durchgang liegt. */
        const durchTuer = (() => {
          const dg = t.durchgang;
          const ax = ex, az = ez, ay = d.groundYAt(ex, ez, 0) + 1.5;
          const bx = P.pos.x, bz = P.pos.z, by = P.pos.y + 1.0;
          /* Tuerebene: die Achse, in der der Durchgang duenn ist. */
          const dickX = dg.x1 - dg.x0, dickZ = dg.z1 - dg.z0;
          const querX = dickX > dickZ;              // Tuer liegt laengs x
          const ebene = querX ? (dg.z0 + dg.z1) / 2 : (dg.x0 + dg.x1) / 2;
          const von = querX ? az : ax, nach = querX ? bz : bx;
          if ((von - ebene) * (nach - ebene) > 0) return false;   // kreuzt nicht
          const tt = (ebene - von) / ((nach - von) || 1e-9);
          const sx2 = ax + (bx - ax) * tt, sz2 = az + (bz - az) * tt;
          const sy2 = ay + (by - ay) * tt;
          const inDurchgang = querX
            ? (sx2 > dg.x0 - 0.2 && sx2 < dg.x1 + 0.2)
            : (sz2 > dg.z0 - 0.2 && sz2 < dg.z1 + 0.2);
          return inDurchgang && sy2 < r.boden + 2.6;   // unter dem Sturz
        })();
        const frei = d.freieSicht
          ? d.freieSicht(ex, d.groundYAt(ex, ez, 0) + 1.5, ez,
                         P.pos.x, P.pos.y + 1.0, P.pos.z)
          : null;
        proben.push({ durchTuer, frei });
      }
      const durchWand = proben.filter((q) => !q.durchTuer && q.frei).length;
      const durchTuerFrei = proben.filter((q) => q.durchTuer && q.frei).length;
      sicht.push({ raum: r.i, haus: t.haus, spielerDrin: drin,
                   durchWandSichtbar: durchWand,
                   ohneTuer: proben.filter((q) => !q.durchTuer).length,
                   durchTuerFrei,
                   mitTuer: proben.filter((q) => q.durchTuer).length });
    }

    /* ================= 3. Gegner IM Raum ================= */
    const drinnen = [];
    for (const r of mitTuer.slice(0, 6)) {
      const t = r.tuer.t;
      d.enemies.length = 0;
      if (d.gangs) d.gangs.length = 0;
      d.setzePos(r.mx, r.boden + 0.05, r.mz);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.dead = false; P.hp = 100;
      d.spawnGang(r.mx, r.mz, 3, 'test');
      d.schritt(1 / 30, 2);
      /* Sauber im Raum verteilen statt der zufaelligen vier Meter. */
      const g = d.enemies.slice(0, 3);
      g.forEach((e, k) => {
        const ax = r.x0 + 1.6 + (k + 0.5) * ((r.x1 - r.x0 - 3.2) / 3);
        const az = r.mz + (k % 2 ? 2 : -2);
        e.pos.set(ax, r.boden, az);
        if (e.visual && e.visual.root) e.visual.root.position.copy(e.pos);
        e.state = 'chase'; e.target = 'player';
      });
      let ausRaum = 0, imKollider = 0, unterBoden = 0, erreicht = 0;
      let stillMax = 0;
      const still = g.map(() => 0);
      const vor = g.map((e) => ({ x: e.pos.x, z: e.pos.z }));
      for (let i = 0; i < 900; i++) {
        if (P.hp < 100) P.hp = 100;
        if (P.dead) P.dead = false;
        d.schritt(1 / 30);
        g.forEach((e, k) => {
          if (e.dead) return;
          const s = Math.hypot(e.pos.x - vor[k].x, e.pos.z - vor[k].z);
          if (s < 0.005) { still[k] += 1 / 30; if (still[k] > stillMax) stillMax = still[k]; }
          else still[k] = 0;
          vor[k].x = e.pos.x; vor[k].z = e.pos.z;
          const drinJetzt = imRaum(r, e.pos.x, e.pos.z);
          if (!drinJetzt) ausRaum++;
          /* Unter dem Boden zaehlt NUR im Raum. Wer hinausgelaufen ist,
             steht auf der Strasse - bei einem Hochparterre liegt die
             einen Meter tiefer, und das ist kein Fehler. Der erste
             Anlauf hat genau das als "unter Boden" gezaehlt. */
          if (drinJetzt && e.pos.y < r.boden - 0.5) unterBoden++;
          for (const c of d.colliderNah(e.pos.x, e.pos.z)) {
            if (e.pos.x > c.x0 + 0.2 && e.pos.x < c.x1 - 0.2 &&
                e.pos.z > c.z0 + 0.2 && e.pos.z < c.z1 - 0.2 &&
                e.pos.y + 0.9 < (c.h || 0) && e.pos.y + 0.9 > (c.y0 || -1)) { imKollider++; break; }
          }
          if (Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 2.6) erreicht++;
        });
      }
      drinnen.push({ raum: r.i, haus: t.haus,
                     ausRaumBilder: ausRaum, imKolliderBilder: imKollider,
                     unterBodenBilder: unterBoden, beimSpielerBilder: erreicht,
                     stillMax: +stillMax.toFixed(1),
                     lebend: g.filter((e) => !e.dead).length });
    }

    return { raeume: raeume.length, mitTuer: mitTuer.length, ohneTuer, rein, sicht, drinnen,
             bestesHaus: mitTuer.slice().sort((a, b2) => b2.flaeche - a.flaeche)[0] };
  });

  const p = (s) => console.log(s);
  p('');
  p('Innenraeume: ' + aus.raeume + ', davon mit eigener Tuer in der Wand: ' + aus.mitTuer);
  if (aus.ohneTuer.length)
    p('   ohne eigene Tuer: ' + JSON.stringify(aus.ohneTuer));
  p('');
  p('== 1. Hineingehen (vor der Tuer starten, W halten) ==');
  const ok = aus.rein.filter((r) => r.drin !== null);
  p('   drin: ' + ok.length + ' von ' + aus.rein.length +
    (ok.length ? '   Median ' + ok.map((r) => r.drin).sort((a, b2) => a - b2)[Math.floor(ok.length / 2)] + ' Bilder' : ''));
  for (const r of aus.rein.filter((x) => x.drin === null).slice(0, 8))
    p('   NICHT DRIN  Raum ' + r.raum + ' (' + r.haus + ', ' + r.flaeche + ' m2)  ' +
      'Ende ' + JSON.stringify(r.endOrt) + ' y=' + r.endY + ' Boden=' + r.boden +
      ' Zustand=' + r.zustand + ' Tuerbreite=' + r.tuerWeit);
  p('');
  p('== 2. Sichtschutz (Spieler im Raum, 8 Blickpunkte im Kreis um das Haus) ==');
  const durchWand = aus.sicht.reduce((a, s) => a + s.durchWandSichtbar, 0);
  const ohneTuer = aus.sicht.reduce((a, s) => a + s.ohneTuer, 0);
  p('   durch eine WAND sichtbar: ' + durchWand + ' von ' + ohneTuer +
    ' Blickpunkten' + (durchWand === 0 ? '   ok' : '   BEFUND'));
  p('   durch die offene TUER sichtbar: ' +
    aus.sicht.reduce((a, s) => a + s.durchTuerFrei, 0) + ' von ' +
    aus.sicht.reduce((a, s) => a + s.mitTuer, 0) + '   (soll so sein)');
  for (const s of aus.sicht.filter((x) => x.durchWandSichtbar > 0).slice(0, 8))
    p('   BEFUND  Raum ' + s.raum + ' (' + s.haus + '): ' + s.durchWandSichtbar +
      ' von ' + s.ohneTuer + ' Wandrichtungen frei' +
      (s.spielerDrin ? '' : '   (Spieler NICHT im Raum!)'));
  p('');
  p('== 3. Gegner IM Raum (3 Stueck, 30 s) ==');
  for (const g of aus.drinnen)
    p('   Raum ' + String(g.raum).padStart(2) + '  ' + (g.haus || '?').padEnd(20) +
      '  aus dem Raum ' + String(g.ausRaumBilder).padStart(5) +
      '  im Kollider ' + String(g.imKolliderBilder).padStart(4) +
      '  unter Boden ' + String(g.unterBodenBilder).padStart(4) +
      '  beim Spieler ' + String(g.beimSpielerBilder).padStart(5) +
      '  laengster Stillstand ' + g.stillMax + ' s');
  p('');
  p('Groesster Raum mit Tuer: ' + JSON.stringify(aus.bestesHaus && {
    raum: aus.bestesHaus.i, flaeche: Math.round(aus.bestesHaus.flaeche),
    mitte: [Math.round(aus.bestesHaus.mx), Math.round(aus.bestesHaus.mz)] }));
  await b.close();
})();
