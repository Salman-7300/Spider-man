/* problem-2, Root-Cause-Pass "Exterior Climb Shell": Klettern im INNEREN
   eines begehbaren Hauses.

   Gefunden ueber den Kamerafall hausStellen[3]: die Figur stand im Inneren
   von Building_Small_1, kletterte an der Innenseite der Wandscheibe hoch
   und kam durch die Dachplatte auf die Wandkrone. Eine Innenwand ist
   keine Kletterfassade.

   Echter Eingabeweg, nichts wird an eine Wand gesetzt:

     innen   Figur steht in der Mitte des Innenraums (KIT_INNEN) auf dem
             Fussboden, schaut auf eine der vier Innenwaende, rennt
             hinein (Shift+W) und haelt danach W.
     aussen  Kontrolle: dieselbe Wand von AUSSEN, fuenf Meter davor.
             Dort muss Klettern und Ueberziehen weiter gehen.

   Kennzahlen (alle innen gezaehlt):

     interiorClimbSurface               Bilder im Kletterzustand (climb/kante),
                                        waehrend die Figur im Innenraum steht
     playerInsideBuildingWhileClimbing  Bilder im Kletterzustand, in denen
                                        die Figur im Volumen dieses Hauses
                                        steht (Grundriss mit Waenden, unter
                                        der Decke) oder Becken bzw. Brust in
                                        einem FREMDEN Gebaeude stecken
                                        (kletterLage().insideForeign; die
                                        eigene grobe Kiste zaehlt nicht -
                                        dort liegt die Kletterhaut eines
                                        Modellhauses)
     topOutFromInterior                 Uebergaenge in 'kante', waehrend die
                                        Figur im Innenraum steht
     playerCrossesRoofFromBelow         Laeufe, in denen die Figur ueber dem
                                        Grundriss des Hauses erst unter der
                                        Decke und spaeter ueber dem Dach war

   Aufruf:  node tools/pruef/innenklettern.js [seed=4711]
   ========================================================================= */
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);

(async () => {
  const { b, page } = await starte(640, 360, SEED, {});
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'KeyZ'];
    const los = () => { for (const t of TASTEN) d.taste(t, false); };
    const WAND = 0.8;
    const SEITEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const imKollider = (x, y, z) => {
      for (const n of d.colliderNah(x, z)) {
        if (!fest(n)) continue;
        const y0 = n.y0 === undefined ? -1e9 : n.y0;
        if (x > n.x0 && x < n.x1 && z > n.z0 && z < n.z1 && y > y0 && y < (n.h || 0)) return n;
      }
      return null;
    };
    const summe = { innen: { laeufe: 0, angeklebt: 0, interiorClimbSurface: 0, playerInsideBuildingWhileClimbing: 0,
                             topOutFromInterior: 0, playerCrossesRoofFromBelow: 0 },
                    aussen: { laeufe: 0, angeklebt: 0, aufsDach: 0, playerInsideBuildingWhileClimbing: 0 } };
    const faelle = [];
    const raeume = d.kitInnen();
    raeume.forEach((r, ri) => {
      /* 2,5 m neben der Mitte: die Haustuer liegt mittig in einer Front
         (+-0,75 m). Mittig gestartet lief die Figur durch die Tuer statt
         gegen die Wand. */
      const mx = (r.x0 + r.x1) / 2 + Math.min(2.5, (r.x1 - r.x0) / 2 - 1),
            mz = (r.z0 + r.z1) / 2 + Math.min(2.5, (r.z1 - r.z0) / 2 - 1);
      /* Grundriss mit Waenden: der Innenraum plus Wandstaerke */
      const gx0 = r.x0 - WAND - 0.05, gx1 = r.x1 + WAND + 0.05, gz0 = r.z0 - WAND - 0.05, gz1 = r.z1 + WAND + 0.05;
      const imRaum = (p) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && p.y < r.decke;
      const ueberGrund = (p) => p.x > gx0 - 1 && p.x < gx1 + 1 && p.z > gz0 - 1 && p.z < gz1 + 1;
      for (const [nx, nz] of SEITEN) {
        for (const art of ['innen', 'aussen']) {
          los();
          /* Wand in Richtung (nx, nz) von der Raummitte aus */
          let sx, sz, fx, fz;
          if (art === 'innen') {
            const ab = Math.min(4, (nx !== 0 ? (r.x1 - r.x0) : (r.z1 - r.z0)) / 2 - 0.6);
            fx = nx !== 0 ? (nx > 0 ? r.x1 : r.x0) : mx;
            fz = nz !== 0 ? (nz > 0 ? r.z1 : r.z0) : mz;
            sx = fx - nx * ab; sz = fz - nz * ab;
          } else {
            fx = nx !== 0 ? (nx > 0 ? gx1 : gx0) : mx;
            fz = nz !== 0 ? (nz > 0 ? gz1 : gz0) : mz;
            sx = fx + nx * 5; sz = fz + nz * 5;
            if (imKollider(sx, 1.2, sz) || imKollider((sx + fx) / 2, 1.2, (sz + fz) / 2)) continue;
            /* Der Start darf nicht im Innenraum eines ANDEREN Hauses liegen
               (gemessen: Raum 6 Ost startete in Building_Large_2 - das war
               dann Innenklettern, keine Kontrolle). */
            if (raeume.some((q) => [[sx, sz], [(sx + fx) / 2, (sz + fz) / 2]].some(([x, z]) =>
                  x > q.x0 - WAND && x < q.x1 + WAND && z > q.z0 - WAND && z < q.z1 + WAND))) continue;
          }
          const y0 = art === 'innen' ? r.boden + 0.05 : 0.35;
          d.setzePos(sx, y0, sz);
          P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
          P.wallInfo = null; P.wall = null; P.hautTiefe = 0; P.eckBogen = null; P.kante = null;
          /* Blick auf die Wand: innen nach (nx,nz), aussen nach -(nx,nz) */
          const bx = art === 'innen' ? nx : -nx, bz = art === 'innen' ? nz : -nz;
          P.facing = Math.atan2(bx, bz);
          d.setzeKamYaw(Math.atan2(-bx, -bz));
          for (let i = 0; i < 20; i++) d.schritt(1 / 60);
          const S = summe[art];
          S.laeufe++;
          const F = { raum: ri, art, n: [nx, nz], angeklebt: false, klettern: 0, imRaum: 0, imHaus: 0,
                      kanteInnen: 0, unterDecke: false, ueberDach: false, aufsDach: false, maxY: 0 };
          d.taste('ShiftLeft', true); d.taste('KeyW', true);
          let vorZustand = P.state;
          for (let i = 0; i < 600; i++) {
            d.schritt(1 / 60);
            if (i === 150) d.taste('ShiftLeft', false);
            const p = P.pos;
            const kl = P.state === 'climb' || P.state === 'kante';
            /* angeklebt zaehlt nur im Grundriss dieses Hauses - wer durch die
               Tuer hinauslaeuft und draussen ein anderes Haus erklettert,
               klettert nicht innen */
            if (kl && !F.angeklebt && ueberGrund(p)) F.angeklebt = true;
            if (kl) {
              if (!F.erst) { const w = P.wallInfo; F.erst = { i, pos: [p.x, p.y, p.z].map((v) => +v.toFixed(2)),
                wand: w ? w.col.id + ':' + w.nx + ',' + w.nz : P.state }; }
              F.klettern++;
              if (art === 'innen' && imRaum(p)) F.imRaum++;
              const lage = d.kletterLage();
              /* nur FREMDE Gebaeude: an einem Modellhaus haengt die Figur mit
                 Absicht an der sichtbaren Haut hinter der eigenen Kiste */
              const imVolumen = p.x > gx0 && p.x < gx1 && p.z > gz0 && p.z < gz1 && p.y < r.decke;
              const fremd = lage.insideForeign > 0 || (art === 'innen' && imVolumen);
              if (fremd) { F.imHaus++; if (!F.drin) F.drin = { i, pos: [p.x, p.y, p.z].map((v) => +v.toFixed(2)), wer: lage.fremdWer || 'Hausvolumen',
                wand: P.wallInfo ? P.wallInfo.col.id + ':' + P.wallInfo.nx + ',' + P.wallInfo.nz : P.state }; }
            }
            if (P.state === 'kante' && vorZustand !== 'kante' && art === 'innen' && imRaum(p)) F.kanteInnen++;
            if (ueberGrund(p) && p.y < r.decke - 1.8) F.unterDecke = true;
            if (F.unterDecke && ueberGrund(p) && p.y > r.decke + 1.0) F.ueberDach = true;
            if (art === 'aussen' && P.state === 'ground' && ueberGrund(p) && p.y > r.decke) F.aufsDach = true;
            F.maxY = Math.max(F.maxY, +p.y.toFixed(2));
            vorZustand = P.state;
            /* aussen: oben angekommen - fertig */
            if (F.aufsDach) break;
          }
          los();
          if (F.angeklebt) S.angeklebt++;
          if (art === 'innen') {
            S.interiorClimbSurface += F.imRaum;
            S.playerInsideBuildingWhileClimbing += F.imHaus;
            S.topOutFromInterior += F.kanteInnen;
            if (F.ueberDach && F.unterDecke) S.playerCrossesRoofFromBelow++;
          } else {
            S.playerInsideBuildingWhileClimbing += F.imHaus;
            if (F.aufsDach) S.aufsDach++;
          }
          faelle.push(F);
        }
      }
    });
    return { summe, faelle, raeume: raeume.length };
  });
  console.log('\n== Klettern im Innenraum der begehbaren Haeuser (Keim ' + SEED + ') ==');
  console.log('  Innenraeume ' + aus.raeume);
  const I = aus.summe.innen, A = aus.summe.aussen;
  console.log('  innen:  Laeufe ' + I.laeufe + '  angeklebt ' + I.angeklebt);
  console.log('    interiorClimbSurface               ' + I.interiorClimbSurface);
  console.log('    playerInsideBuildingWhileClimbing  ' + I.playerInsideBuildingWhileClimbing);
  console.log('    topOutFromInterior                 ' + I.topOutFromInterior);
  console.log('    playerCrossesRoofFromBelow         ' + I.playerCrossesRoofFromBelow);
  console.log('  aussen (Kontrolle): Laeufe ' + A.laeufe + '  angeklebt ' + A.angeklebt + '  aufs Dach ' + A.aufsDach +
              '  im Haus beim Klettern ' + A.playerInsideBuildingWhileClimbing);
  for (const F of aus.faelle) {
    if (F.art === 'innen' && (F.angeklebt || F.ueberDach))
      console.log('    innen Raum ' + F.raum + ' n ' + F.n + '  klettern ' + F.klettern + '  imRaum ' + F.imRaum +
                  '  imHaus ' + F.imHaus + '  kante ' + F.kanteInnen + '  durchs Dach ' + (F.ueberDach ? 'JA' : 'nein') + '  maxY ' + F.maxY +
                  '  erst ' + JSON.stringify(F.erst) + (F.drin ? '  drin ' + JSON.stringify(F.drin) : ''));
    if (F.art === 'aussen' && (!F.aufsDach || F.imHaus))
      console.log('    aussen Raum ' + F.raum + ' n ' + F.n + '  angeklebt ' + F.angeklebt + '  aufs Dach ' + F.aufsDach +
                  '  imHaus ' + F.imHaus + '  maxY ' + F.maxY);
  }
  const hart = I.interiorClimbSurface + I.playerInsideBuildingWhileClimbing + I.topOutFromInterior + I.playerCrossesRoofFromBelow;
  console.log(hart === 0 ? 'INNENKLETTERN: bestanden (0)' : 'INNENKLETTERN: NICHT bestanden (' + hart + ')');
  await b.close();
})();
