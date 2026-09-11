/* Teil 6: der Netzschwung.
   Der Held wird ueber die Stadt geschickt und schwingt wie ein Spieler:
   Leertaste halten. Gemessen wird ueber viele Schwuenge, ob der Anker an
   einem echten Bauwerk haengt, ob der Faden an der Faust sitzt, ob der
   Koerper einen Bogen beschreibt und wie weit man kommt.

   Aufruf:  node schwingen.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player, HV = d.heroVisual;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;

    const V = new THREE.Vector3();
    const knochen = HV.knochen;
    const handOrt = (n) => { const bn = knochen[n]; if (!bn) return null;
      bn.getWorldPosition(V); return { x: V.x, y: V.y, z: V.z }; };
    /* Das HANDENDE des sichtbaren Fadens in Weltkoordinaten.
       Nachgesehen statt geraten: der Faden hat 261 Eckpunkte, Eckpunkt 0
       liegt am ANKER (gemessen 0,01 m davon entfernt), der letzte an der
       Faust. Beim ersten Anlauf habe ich Eckpunkt 0 genommen und
       daraufhin 5925 von 5925 Proben als "Faden nicht an der Hand"
       gemeldet - das war mein Fehler, nicht der des Spiels. */
    const fadenHand = () => {
      const m = d.faden;
      if (!m || !m.visible || !m.geometry || !m.geometry.attributes.position) return null;
      m.updateMatrixWorld(true);
      const p = m.geometry.attributes.position;
      const i = p.count - 1;
      V.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m.matrixWorld);
      return { x: V.x, y: V.y, z: V.z };
    };
    /* Haengt der Anker an etwas Festem? */
    const ankerFest = (a) => {
      if (!a) return false;
      for (const c of d.colliderNah(a.x, a.z)) {
        if ((c.h || 0) < 2) continue;
        if (a.x > c.x0 - 1.2 && a.x < c.x1 + 1.2 &&
            a.z > c.z0 - 1.2 && a.z < c.z1 + 1.2 &&
            a.y < (c.h || 0) + 1.2) return true;
      }
      return false;
    };

    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
                              d.taste(t, false); };

    const starts = [[-150, 40, -150, 1, 0], [-120, 45, 40, 0, 1], [40, 50, -140, -1, 0],
                    [120, 42, 120, 0, -1], [-60, 48, 120, 1, -1], [80, 44, -60, -1, 1]];
    const flug = [];
    let fadenProben = 0, fadenFern = 0, fadenMax = 0;
    let ankerN = 0, ankerLos = 0, bodenBeruehrung = 0;
    /* Die eigentliche Frustzahl: in der Luft, Netztaste gehalten, und es
       gibt keinen Anker. */
    let ohneAnker = 0, ohneAnkerLaengste = 0;
    const bogen = [];

    for (const [sx, sy, sz, dx, dz] of starts) {
      alleAus();
      d.setzePos(sx, sy, sz);
      P.state = 'air'; P.onGround = false;
      const l = Math.hypot(dx, dz);
      P.vel.set((dx / l) * 18, 0, (dz / l) * 18);
      P.facing = Math.atan2(dx, dz);
      d.setzeKamYaw(P.facing + Math.PI);
      d.taste('KeyW', true); d.taste('Space', true);
      const a0 = { x: P.pos.x, z: P.pos.z };
      let tiefste = P.pos.y, hoechste = P.pos.y, schwingBilder = 0;
      let letzterAnker = null, yTief = null, lauf = 0;
      for (let i = 0; i < 60 * 30; i++) {
        d.schritt(1 / 60);
        tiefste = Math.min(tiefste, P.pos.y);
        hoechste = Math.max(hoechste, P.pos.y);
        if (P.pos.y - d.groundYAt(P.pos.x, P.pos.z) < 0.6) bodenBeruehrung++;
        const sw = P.swing;
        if (!sw && !P.onGround && P.state !== 'climb' && P.state !== 'zip') {
          ohneAnker++;
          ohneAnkerLaengste = Math.max(ohneAnkerLaengste, ++lauf);
        } else lauf = 0;
        if (sw) {
          schwingBilder++;
          const a = sw.anchor || sw.point || sw;
          if (a && a.x !== undefined && a !== letzterAnker) {
            letzterAnker = a; ankerN++;
            if (!ankerFest(a)) ankerLos++;
            if (yTief !== null) bogen.push(yTief);
            yTief = P.pos.y;
          }
          if (yTief !== null) yTief = Math.min(yTief, P.pos.y);
          /* Faden an der Faust? */
          const f = fadenHand();
          if (f) {
            const l1 = handOrt('lefthand'), r1 = handOrt('righthand');
            let best = 9;
            for (const h of [l1, r1]) if (h)
              best = Math.min(best, Math.hypot(f.x - h.x, f.y - h.y, f.z - h.z));
            fadenProben++;
            if (best > 0.30) fadenFern++;
            fadenMax = Math.max(fadenMax, best);
          }
        }
      }
      alleAus();
      flug.push({ von: [sx, sz], weit: +Math.hypot(P.pos.x - a0.x, P.pos.z - a0.z).toFixed(0),
        tiefste: +tiefste.toFixed(1), hoechste: +hoechste.toFixed(1),
        schwingBilder, ende: P.state, endeY: +P.pos.y.toFixed(1) });
    }
    return { flug, ankerN, ankerLos, bodenBeruehrung,
             fadenProben, fadenFern, fadenMax: +fadenMax.toFixed(3),
             bogenN: bogen.length, ohneAnker,
             ohneAnkerSek: +(ohneAnkerLaengste / 60).toFixed(1) };
  });

  console.log('Sechs Fluege ueber die Stadt, je 30 Sekunden, Leertaste gehalten:\n');
  console.log('  Start'.padEnd(16) + 'Weite'.padStart(8) + 'tiefster'.padStart(10) +
              'hoechster'.padStart(11) + 'am Netz'.padStart(10) + '  Ende');
  let schlecht = 0;
  for (const f of aus.flug) {
    /* Die Weite taugt NICHT als Massstab: ein Flug endet, sobald die
       Figur eine Wand greift oder landet, und das ist richtig so.
       Gewertet wird, ob wirklich geschwungen wurde, ob sie nicht ueber
       dem Boden schleift und ob sie sinnvoll endet. */
    const ok = f.schwingBilder > 120 && f.tiefste > 0.5 &&
               ['ground', 'climb', 'swing', 'kante', 'air'].includes(f.ende);
    if (!ok) schlecht++;
    console.log((ok ? '  ok   ' : '  FEHL ') + String(f.von).padEnd(14) +
      (f.weit + ' m').padStart(8) + (f.tiefste + ' m').padStart(10) +
      (f.hoechste + ' m').padStart(11) + String(f.schwingBilder).padStart(10) +
      '  ' + f.ende + ' auf ' + f.endeY + ' m');
  }
  console.log('\nAnker:      ' + aus.ankerN + ' geschossen, davon ' + aus.ankerLos +
              ' NICHT an einem Bauwerk');
  console.log('Faden:      ' + aus.fadenProben + ' Proben, ' + aus.fadenFern +
              ' weiter als 30 cm von der naechsten Faust, groesster Abstand ' +
              aus.fadenMax + ' m');
  console.log('Bodennaehe: ' + aus.bodenBeruehrung + ' Bilder unter 0,6 m ueber Grund');
  console.log('Ohne Anker: ' + aus.ohneAnker + ' Bilder in der Luft ohne Netz, ' +
              'laengste Strecke am Stueck ' + aus.ohneAnkerSek + ' s');
  console.log('\nFluege fehlerhaft: ' + schlecht + ' von ' + aus.flug.length);
  await b.close();
})();
