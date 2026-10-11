/* problem-2, Blocker 2 (Human-Entscheidung zu 820f96e): die Dachleben-
   Kaesten aus baueDachaufbauten bekommen ein echtes Hindernis.

   Teil 1  Inventar: je Art Anzahl, fest oder Deko, Masse
   Teil 2  Hindernis gegen Sichtbares, je festem Kasten:
             sichtbare Kiste aus der INSTANZMATRIX (nicht aus den
             Bauzahlen), gedreht?, Abweichung Hindernis - Sichtbares je
             Seite, Sitz auf der sichtbaren Dachflaeche (Strahl nach
             unten gegen die Szene), Ueberschneidung mit anderen
             Hindernissen (Nachbarhaus, Krone, anderer Aufbau)
   Teil 3  die Figur am Kasten, je festem Kasten:
             hindurchlaufen (drei Meter davor los, quer durch die Mitte)
               playerThroughDachleben   Kapsel > 0,10 m im Sichtbaren UND
                                        dahinter angekommen
               pelvisInsideDachleben    Becken (y + 0,9) im Sichtbaren
               torsoInsideDachleben     Brust (y + 1,3) im Sichtbaren
             von oben fallen lassen
               landingInsideDachleben   Becken am Ende im Sichtbaren
   Gefragt wird immer gegen die SICHTBARE Kiste - so stellen der Lauf
   mit und ohne Hindernis (alt) dieselbe Frage.

   Aufruf:  node tools/pruef/dachleben.js [alt] [max=150]
   ========================================================================= */
const { starte } = require('./basis');
const ALT = process.argv.indexOf('alt') > 0;
const mArg = process.argv.find((v) => v.indexOf('max=') === 0);
const MAX = mArg === undefined ? 150 : +mArg.slice(4);

(async () => {
  const { b, page } = await starte(800, 480, 4711, ALT ? { dachlebenAlt: true } : {});
  const aus = await page.evaluate(async (MAX) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const teile = d.dachleben();
    /* ---- Teil 1 ---- */
    const jeArt = {};
    for (const t of teile) {
      const a = jeArt[t.art] || (jeArt[t.art] = { art: t.art, n: 0, fest: 0, imHaus: 0, mitHindernis: 0,
        w: [1e9, 0], h: [1e9, 0], dd: [1e9, 0] });
      a.n++; if (t.fest) a.fest++; if (t.koll) a.mitHindernis++;
      if (t.fest && t.imHaus === 'Gebaeude') a.imHaus++;
      if (t.fest && t.imHaus === 'Ueberhang') a.ueberhang = (a.ueberhang || 0) + 1;
      if (t.fest && t.angehoben > 0.01) {
        a.angehoben = (a.angehoben || 0) + 1;
        a.hubMax = Math.max(a.hubMax || 0, t.angehoben);
      }
      if (t.vis && t.vis.x1 - t.vis.x0 > 1e-6) {
        const w = t.vis.x1 - t.vis.x0, h = t.vis.y1 - t.vis.y0, dd = t.vis.z1 - t.vis.z0;
        a.w = [Math.min(a.w[0], w), Math.max(a.w[1], w)];
        a.h = [Math.min(a.h[0], h), Math.max(a.h[1], h)];
        a.dd = [Math.min(a.dd[0], dd), Math.max(a.dd[1], dd)];
      }
    }
    /* ---- Teil 2 ---- */
    let szene = null;
    for (const o of d.hausModelle()) { szene = o; while (szene.parent) szene = szene.parent; break; }
    const ziele = [];
    const eigene = new Set();
    for (const t of teile) if (t.mesh) eigene.add(t.mesh);
    szene.traverseVisible((o) => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      ziele.push(o);
    });
    const RC = new THREE.Raycaster();
    const abw = { max: 0, ueber: 0, fehlt: 0, gedreht: 0, ohne: 0 };
    let schwebt = 0, steckt = 0, maxLuft = 0, maxStecken = 0;
    let ueberHaus = 0, ueberKrone = 0, ueberProp = 0;
    const steckWer = {}, ueberArt = {}, betroffen = new Set();
    const bsp = [];
    /* Im Gebaeude stehende Kaesten (imHaus) sind nicht mehr zu sehen und
       haben kein Hindernis - sie zaehlen nicht zu den festen. Im Lauf
       "alt" (Stand 820f96e) gab es die Einstufung nicht: dort zaehlen
       sie mit. */
    const fest = teile.filter((t) => t.fest && !(t.imHaus && t.koll === null && t.vis && t.vis.x1 - t.vis.x0 < 1e-6));
    for (const t of fest) {
      const v = t.vis, k = t.koll;
      if (t.gedreht) abw.gedreht++;
      if (!k) abw.ohne++;
      else {
        const seiten = [k.x0 - v.x0, v.x1 - k.x1, k.z0 - v.z0, v.z1 - k.z1, k.y0 - v.y0, v.y1 - k.y1];
        /* negativ = Hindernis groesser als sichtbar, positiv = kleiner */
        for (const s of seiten) {
          if (Math.abs(s) > abw.max) abw.max = Math.abs(s);
          if (s < -0.02) abw.ueber++;
          if (s > 0.02) abw.fehlt++;
        }
      }
      /* Sitz und Ueberschneidung gegen die SICHTBARE Kiste - im Lauf
         ohne Hindernis dieselbe Frage. */
      const kk = { x0: v.x0, x1: v.x1, z0: v.z0, z1: v.z1, y0: v.y0, y1: v.y1, id: k ? k.id : -1 };
      /* Sitz: Strahl von einem Meter ueber der Unterkante nach unten,
         an vier Punkten der Grundflaeche (0,2 m nach innen). */
      let dachY = -1e9, dachWer = null;
      for (const [fx, fz] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
        const x = v.x0 + (v.x1 - v.x0) * fx, z = v.z0 + (v.z1 - v.z0) * fz;
        RC.set(new THREE.Vector3(x, v.y0 + 1.0, z), new THREE.Vector3(0, -1, 0));
        RC.near = 0; RC.far = 6;
        const tr = RC.intersectObjects(ziele, false).filter((h) => !eigene.has(h.object));
        if (tr.length && tr[0].point.y > dachY) {
          dachY = tr[0].point.y;
          const o = tr[0].object;
          dachWer = o.userData && o.userData.hausKiste ? 'Hausmodell'
            : o.parent && o.parent.userData && o.parent.userData.hausKiste ? 'Hausmodell'
            : (o.geometry && o.geometry.attributes.position.count > 100000) ? 'Deko-Mesh'
            : (o.name || o.type) + '/' + (o.parent ? (o.parent.name || o.parent.type) : '-');
        }
      }
      const luft = v.y0 - dachY;
      if (dachY > -1e8) {
        if (luft > 0.15) { schwebt++; maxLuft = Math.max(maxLuft, luft);
          if (bsp.length < 10) bsp.push({ was: 'schwebt', art: t.art, luft: +luft.toFixed(2), x: +t.x.toFixed(1), z: +t.z.toFixed(1) }); }
        if (luft < -0.15) { steckt++; maxStecken = Math.max(maxStecken, -luft);
          steckWer[dachWer] = (steckWer[dachWer] || 0) + 1;
          if (bsp.length < 10) bsp.push({ was: 'steckt', art: t.art, tief: +(-luft).toFixed(2), x: +t.x.toFixed(1), z: +t.z.toFixed(1) }); }
      }
      /* Ueberschneidung mit anderen Hindernissen oberhalb der Dachflaeche */
      for (const c of d.colliderNah(t.x, t.z)) {
        if (c.id === kk.id || c.innen || c.parkAuto) continue;
        const y0 = c.y0 === undefined ? -1e9 : c.y0;
        const ox = Math.min(kk.x1, c.x1) - Math.max(kk.x0, c.x0);
        const oz = Math.min(kk.z1, c.z1) - Math.max(kk.z0, c.z0);
        const oy = Math.min(kk.y1, c.h) - Math.max(kk.y0, y0);
        if (ox <= 0.05 || oz <= 0.05 || oy <= 0.05) continue;
        /* Das eigene Dach: Oberkante = Unterkante des Kastens. */
        const wirt = !c.dachProp && !c.klein && Math.abs((c.h || 0) - t.dach) < 0.05;
        if (wirt) continue;
        let art;
        if (c.dachleben) art = 'anderer Dachleben-Kasten';
        else if (c.dachProp) art = 'anderer Dachaufbau';
        else if (c.klein || c.krone) art = c.krone ? 'Krone (prozedural)' : 'Dachaufbau des Modells (klein)';
        else {
          /* Steht das Haus auf demselben Dach (Staffelturm) oder daneben? */
          let aufDach = false;
          for (const q of d.colliderNah(t.x, t.z))
            if (!q.dachProp && !q.klein && Math.abs((q.h || 0) - t.dach) < 0.05 &&
                c.x0 >= q.x0 - 0.05 && c.x1 <= q.x1 + 0.05 && c.z0 >= q.z0 - 0.05 && c.z1 <= q.z1 + 0.05) aufDach = true;
          art = aufDach ? 'Hauskoerper auf demselben Dach (Staffel)' : 'Hauskoerper daneben (Nachbar)';
        }
        ueberArt[art] = (ueberArt[art] || 0) + 1;
        betroffen.add(t);
        if (c.dachleben || c.dachProp) ueberProp++;
        else if (c.klein || c.krone) ueberKrone++;
        else ueberHaus++;
        if (bsp.length < 10) bsp.push({ was: 'ueberschneidet', art: t.art, mit: c.id,
          klasse: c.dachProp ? 'dachProp' : (c.klein || c.krone) ? 'Krone/klein' : 'Haus',
          tief: +Math.min(ox, oz, oy).toFixed(2) });
      }
    }
    /* ---- Teil 3 ---- */
    const R = P.radius === undefined ? 0.45 : P.radius;
    const drin = (x, y, z, v) => x > v.x0 + 0.02 && x < v.x1 - 0.02 && z > v.z0 + 0.02 &&
                                 z < v.z1 - 0.02 && y > v.y0 + 0.02 && y < v.y1 - 0.02;
    const kapsel = (x, y, z, v) => {
      if (y + 1.8 <= v.y0 + 0.02 || y >= v.y1 - 0.02) return 0;
      const dx = Math.max(v.x0 - x, 0, x - v.x1), dz = Math.max(v.z0 - z, 0, z - v.z1);
      return Math.max(0, R - Math.hypot(dx, dz));
    };
    const schritt = Math.max(1, Math.floor(fest.length / MAX));
    const proben = [];
    for (let i = 0; i < fest.length && proben.length < MAX; i += schritt) proben.push(fest[i]);
    const los = () => { for (const k of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space']) d.taste(k, false); };
    const z3 = { durch: 0, becken: 0, brust: 0, kapsel: 0, landen: 0, oben: 0, daneben: 0, tiefste: 0 };
    const jeArt3 = {};
    const bsp3 = [];
    for (const t of proben) {
      const v = t.vis;
      const a = jeArt3[t.art] || (jeArt3[t.art] = { n: 0, durch: 0, becken: 0, brust: 0, landen: 0 });
      a.n++;
      los();
      d.setzePos(v.x0 - 3, v.y0 + 0.1, (v.z0 + v.z1) / 2);
      P.vel.set(0, 0, 0); P.state = 'idle'; P.onGround = true; P.facing = Math.PI / 2;
      d.setzeKamYaw(-Math.PI / 2);
      d.taste('KeyW', true);
      let tief = 0, hb = false, hr = false;
      const start = P.pos.x;
      for (let i = 0; i < 220; i++) {
        d.schritt(1 / 60);
        const x = P.pos.x, y = P.pos.y, z = P.pos.z;
        tief = Math.max(tief, kapsel(x, y, z, v));
        if (drin(x, y + 0.9, z, v)) hb = true;
        if (drin(x, y + 1.3, z, v)) hr = true;
      }
      los();
      const durch = tief > 0.10 && P.pos.x > v.x1 + 0.1 && start < v.x0;
      if (durch) { z3.durch++; a.durch++; }
      if (hb) { z3.becken++; a.becken++; }
      if (hr) { z3.brust++; a.brust++; }
      if (tief > 0.10) z3.kapsel++;
      z3.tiefste = Math.max(z3.tiefste, tief);
      if ((durch || hb || hr) && bsp3.length < 8)
        bsp3.push({ art: t.art, x: +t.x.toFixed(1), z: +t.z.toFixed(1), tief: +tief.toFixed(2),
                    durch, becken: hb, brust: hr, endeX: +P.pos.x.toFixed(2), endeY: +P.pos.y.toFixed(2) });
      /* von oben */
      d.setzePos((v.x0 + v.x1) / 2, v.y1 + 4, (v.z0 + v.z1) / 2);
      P.vel.set(0, 0, 0); P.state = 'air'; P.onGround = false;
      for (let i = 0; i < 180; i++) d.schritt(1 / 60);
      if (drin(P.pos.x, P.pos.y + 0.9, P.pos.z, v)) { z3.landen++; a.landen++; }
      else if (Math.abs(P.pos.y - v.y1) < 0.25) z3.oben++;
      else z3.daneben++;
    }
    return { gesamt: teile.length, fest: fest.length, jeArt: Object.values(jeArt),
             abw, schwebt, steckt, maxLuft, maxStecken, ueberHaus, ueberKrone, ueberProp, bsp,
             steckWer, ueberArt, betroffen: betroffen.size,
             proben: proben.length, z3, jeArt3, bsp3 };
  }, MAX);
  await b.close();
  const f = (x) => (+x).toFixed(2);
  console.log('\n== Dachleben' + (ALT ? '  (OHNE Hindernis, Stand 820f96e)' : '') + ' ==');
  console.log('\n  Teil 1: Inventar (' + aus.gesamt + ' Teile)');
  console.log('  Art                 Anzahl  fest  im Gebaeude  unter Ueberhang  auf Dach gehoben (max)  mit Hindernis   Breite x     Hoehe        Tiefe z');
  for (const a of aus.jeArt)
    console.log('  ' + a.art.padEnd(20) + String(a.n).padStart(6) + String(a.fest).padStart(6) +
                String(a.imHaus).padStart(13) + String(a.ueberhang || 0).padStart(17) +
                (String(a.angehoben || 0) + ' (' + (a.hubMax || 0).toFixed(2) + ' m)').padStart(24) +
                String(a.mitHindernis).padStart(15) + '   ' + (f(a.w[0]) + '-' + f(a.w[1])).padEnd(12) +
                (f(a.h[0]) + '-' + f(a.h[1])).padEnd(13) + f(a.dd[0]) + '-' + f(a.dd[1]));
  console.log('\n  Teil 2: Hindernis gegen Sichtbares (' + aus.fest + ' feste Kaesten)');
  console.log('    ohne Hindernis                 ' + aus.abw.ohne);
  console.log('    gedrehte Instanzmatrix         ' + aus.abw.gedreht);
  console.log('    groesste Abweichung je Seite   ' + f(aus.abw.max) + ' m');
  console.log('    Seiten groesser als sichtbar   ' + aus.abw.ueber + '   kleiner: ' + aus.abw.fehlt);
  console.log('    schwebt ueber der Dachflaeche  ' + aus.schwebt + '   (max ' + f(aus.maxLuft) + ' m)');
  console.log('    steckt in der Dachflaeche      ' + aus.steckt + '   (max ' + f(aus.maxStecken) + ' m)');
  console.log('    ueberschneidet Hauskoerper     ' + aus.ueberHaus);
  console.log('    ueberschneidet Krone/klein     ' + aus.ueberKrone);
  console.log('    ueberschneidet anderen Aufbau  ' + aus.ueberProp);
  console.log('    steckt - was liegt darueber: ' + JSON.stringify(aus.steckWer));
  console.log('    Ueberschneidungen nach Art (Paare): ' + JSON.stringify(aus.ueberArt));
  console.log('    betroffene Kaesten: ' + aus.betroffen + ' von ' + aus.fest);
  for (const e of aus.bsp) console.log('      ' + JSON.stringify(e));
  const z = aus.z3;
  console.log('\n  Teil 3: die Figur am Kasten (' + aus.proben + ' Kaesten)');
  console.log('    playerThroughDachleben   ' + z.durch);
  console.log('    pelvisInsideDachleben    ' + z.becken);
  console.log('    torsoInsideDachleben     ' + z.brust);
  console.log('    landingInsideDachleben   ' + z.landen + '   (oben gelandet ' + z.oben + ', daneben ' + z.daneben + ')');
  console.log('    Kapsel > 0,10 m          ' + z.kapsel + '   tiefste ' + f(z.tiefste) + ' m');
  console.log('    je Art ' + JSON.stringify(aus.jeArt3));
  for (const e of aus.bsp3) console.log('      ' + JSON.stringify(e));
})();
