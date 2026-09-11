/* Teil 10: wie der Kampf AUSSIEHT.
   Der Held bekommt Gegner vor die Nase und schlaegt, tritt, hakt auf,
   rollt und wirft. Gemessen wird mit dem eingebauten Fail-Logger, was im
   Bild auffaellt - haengende Kampfhaltungen in der Luft, Beine ueber der
   Huefte - dazu, ob Faust und Gegner sich beim Treffer wirklich
   begegnen und ob jemand im anderen steckt.

   Aufruf:  node kampf-optik.js
   ========================================================================= */
const { starte } = require('./basis');

(async () => {
  const { b, page } = await starte(900, 560, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg, P = d.player, HV = d.heroVisual;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0;
    const V = new THREE.Vector3();
    const welt = (n) => { const bn = HV.knochen[n]; if (!bn) return null;
      bn.getWorldPosition(V); return { x: V.x, y: V.y, z: V.z }; };
    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyX','KeyZ'])
                              d.taste(t, false); };

    /* Eine ruhige, ebene Stelle und ein paar Gegner drumherum. */
    alleAus();
    d.setzePos(-120, 0, -25);
    P.pos.y = d.groundYAt(-120, -25);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
    const gegner = d.enemies.filter((e) => !e.dead).slice(0, 4);
    gegner.forEach((e, i) => {
      const a = i * Math.PI / 2;
      e.pos.set(-120 + Math.sin(a) * 2.4, P.pos.y, -25 + Math.cos(a) * 2.4);
      e.hp = 9999; e.dead = false;
    });
    for (let i = 0; i < 60; i++) d.schritt(1 / 60);

    d.poseLogAn(true, 60);
    const takte = [];
    let faustNah = 0, faustProben = 0, faustMax = 0;
    /* Je Schlag der KLEINSTE Abstand - nur der sagt, ob die Faust den
       Gegner ueberhaupt erreicht. Der Mittelwert ueber alle Bilder eines
       Schlags ist wertlos: die Faust ist die meiste Zeit ausgeholt oder
       im Nachschwung. */
    const jeSchlag = [];
    let dieserSchlag = 9, imSchlag = false;
    let steckt = 0, steckProben = 0, maxTiefe = 0;

    const beobachte = (bilder, was) => {
      for (let i = 0; i < bilder; i++) {
        d.schritt(1 / 60);
        /* Abstand Faust zum naechsten Gegner waehrend eines Schlags. */
        const a = HV.angriffStand ? HV.angriffStand() : null;
        if (a && /punch|hook|uppercut|knie/.test(a.clip)) {
          const lh = welt('lefthand'), rh = welt('righthand');
          let best = 9;
          for (const e of gegner) {
            if (e.dead) continue;
            for (const h of [lh, rh]) if (h)
              best = Math.min(best, Math.hypot(h.x - e.pos.x, h.y - (e.pos.y + 1.2), h.z - e.pos.z));
          }
          if (best < 9) { faustProben++; if (best < 0.6) faustNah++;
                          faustMax = Math.max(faustMax, best);
                          dieserSchlag = Math.min(dieserSchlag, best); }
          imSchlag = true;
        } else if (imSchlag) {
          if (dieserSchlag < 9) jeSchlag.push(+dieserSchlag.toFixed(2));
          dieserSchlag = 9; imSchlag = false;
        }
        /* Steckt jemand im Helden? */
        for (const e of gegner) {
          if (e.dead) continue;
          steckProben++;
          const dd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
          if (dd < 0.55) { steckt++; maxTiefe = Math.max(maxTiefe, 0.55 - dd); }
        }
      }
      takte.push(was);
    };

    for (let k = 0; k < 12; k++) { d.tryAttack(); beobachte(26, 'Schlag ' + k); }
    for (let k = 0; k < 4; k++) { d.uppercut(); beobachte(70, 'Haken ' + k); }
    for (let k = 0; k < 4; k++) { d.dodge(); beobachte(60, 'Rolle ' + k); }
    for (let k = 0; k < 3; k++) { d.webShot(); beobachte(50, 'Netzschuss ' + k); }
    /* Packen und werfen. */
    for (let k = 0; k < 3; k++) {
      const z = gegner.find((e) => !e.dead);
      if (z) { z.pos.set(P.pos.x + 1.2, P.pos.y, P.pos.z + 0.6); d.packenUndWerfen(); }
      beobachte(90, 'Wurf ' + k);
    }

    const fehler = d.poseFehler();
    const nachArt = {};
    for (const f of fehler) {
      if (!nachArt[f.art]) nachArt[f.art] = { n: 0, clips: {} };
      nachArt[f.art].n++;
      const c = f.clip || f.einmalArt || '-';
      nachArt[f.art].clips[c] = (nachArt[f.art].clips[c] || 0) + 1;
    }
    d.poseLogAn(false);
    alleAus();
    if (imSchlag && dieserSchlag < 9) jeSchlag.push(+dieserSchlag.toFixed(2));
    return { fehler: nachArt, fehlerGesamt: fehler.length, jeSchlag,
             faustProben, faustNah, faustMax: +faustMax.toFixed(2),
             steckProben, steckt, maxTiefe: +maxTiefe.toFixed(2),
             gegnerZahl: gegner.length };
  });

  console.log('Kampf gegen ' + aus.gegnerZahl + ' Gegner: 12 Schlaege, 4 Haken, ' +
              '4 Rollen, 3 Netzschuesse, 3 Wuerfe\n');
  const js = aus.jeSchlag;
  const treffer = js.filter((v) => v <= 0.6).length;
  console.log('Faust am Ziel:  ' + js.length + ' Schlaege ausgewertet, je Schlag der' +
              ' kleinste Abstand zur naechsten Brust:');
  console.log('   ' + JSON.stringify(js));
  console.log('   davon ' + treffer + ' unter 0,6 m' +
              (js.length ? '   (kleinster ' + Math.min(...js) +
               ', groesster ' + Math.max(...js) + ')' : ''));
  console.log('Ineinander:     ' + aus.steckt + ' von ' + aus.steckProben +
              ' Proben naeher als 0,55 m, groesste Ueberschneidung ' + aus.maxTiefe + ' m');
  console.log('\nMeldungen des Fail-Loggers: ' + aus.fehlerGesamt);
  for (const k in aus.fehler) {
    console.log('  ' + k.padEnd(22) + String(aus.fehler[k].n).padStart(6));
    const c = Object.entries(aus.fehler[k].clips).sort((a, b2) => b2[1] - a[1]).slice(0, 5);
    for (const [n, z] of c) console.log('      ' + String(z).padStart(5) + '  ' + n);
  }
  await b.close();
})();
