/* problem-3, Blocker 1: klettert die Figur an der SICHTBAREN Fassade?

   Gemessen wird gegen die sichtbare Geometrie des Hauses selbst - nicht
   gegen den Kollider und nicht gegen die Tiefenkarte, die das Spiel
   benutzt. Sonst prueft das Spiel sich selbst.

   Je Haustyp (GLB-Modelle und prozedurale Tuerme) werden Haeuser mit
   einer freien Schauseite gesucht. Die Figur wird an die Wand gesetzt
   (Kletterzustand, wie zeilenuebergang.js) und klettert: hinauf,
   seitwaerts, wieder hinauf. In jedem Bild, auf Brust- und
   Beckenhoehe (echte Knochen):

     chestBehindVisibleSurface   zwischen Brust und Strasse liegt eine
                                 sichtbare Flaeche (Brust steckt in der
                                 Fassade oder im Innenraum)
     pelvisBehindVisibleSurface  dasselbe fuer das Becken
     climbingInVisualVoid        hinter Brust UND Becken ist innerhalb
                                 LEERE_M keine sichtbare Flaeche, weder
                                 mittig noch 0,2 m links oder rechts -
                                 der Rumpf haengt vor einem Loch
     climbingOnRawBoxFace        die Figur steht auf der Kolliderebene,
                                 obwohl die sichtbare Flaeche an ihrer
                                 Stelle mehr als 0,25 m dahinter liegt

   Sichtbar ist: jedes Mesh des Hausmodells; beim Turm nur Tragwerk und
   Scheiben (keine Moebel, keine Lampen).

   Aufruf:  node tools/pruef/kletterproxy.js [je=3] [bilder=ordner] [video=Typ]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const jArg = process.argv.find((v) => v.indexOf('je=') === 0);
const JE = jArg === undefined ? 3 : +jArg.slice(3);
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
const vArg = process.argv.find((v) => v.indexOf('video=') === 0);
const VIDEO = vArg === undefined ? null : vArg.slice(6);
const ALT = process.argv.indexOf('proxyAlt') > 0;
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(960, 540, 4711, ALT ? { proxyAlt: true } : {});
  const aus = await page.evaluate(async (O) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    const LEERE_M = 0.75;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyZ', 'Space', 'KeyX'];
    const frei = () => { for (const t of TASTEN) d.taste(t, false); };
    const RC = new THREE.Raycaster();
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    /* sichtbare Meshes eines Hauses */
    const sichtbar = (o) => {
      const l = [];
      o.traverse((k) => {
        if (!k.isMesh) return;
        if (o.userData.modellName && o.userData.modellName.indexOf('Turm_') === 0 &&
            k.name !== 'Structure' && k.name !== 'Glazing') return;
        l.push(k);
      });
      return l;
    };
    /* Haeuser je Typ mit einer freien Schauseite */
    const typen = new Map();
    for (const o of d.hausModelle()) {
      const K = o.userData.hausKiste, n = o.userData.modellName;
      if (!K || !n || !K.koll) continue;
      if (!typen.has(n)) typen.set(n, []);
      typen.get(n).push(o);
    }
    const frei1m = (c, nx, nz, y, t) => {
      const px = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) + nx * 0.6 : t;
      const pz = nz !== 0 ? (nz > 0 ? c.z1 : c.z0) + nz * 0.6 : t;
      for (const q of d.colliderNah(px, pz)) {
        if (q === c || q.innen || q.parkAuto) continue;
        const y0 = q.y0 === undefined ? -1e9 : q.y0;
        if (px > q.x0 - 0.5 && px < q.x1 + 0.5 && pz > q.z0 - 0.5 && pz < q.z1 + 0.5 && y > y0 && y < (q.h || 0)) return false;
      }
      return true;
    };
    const faelle = [];
    for (const [typ, liste] of typen) {
      if (O.video && typ !== O.video) continue;
      let n = 0;
      for (const o of liste) {
        if (n >= O.je) break;
        const K = o.userData.hausKiste, c = K.koll;
        let wahl = null;
        for (const [nx, nz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
          const tm = nx !== 0 ? (c.z0 + c.z1) / 2 : (c.x0 + c.x1) / 2;
          const ym = 0.25 + K.h * 0.3;
          let ok = true;
          for (const f of [0.25, 0.5, 0.75]) {
            const t = nx !== 0 ? c.z0 + (c.z1 - c.z0) * f : c.x0 + (c.x1 - c.x0) * f;
            if (!frei1m(c, nx, nz, ym, t) || !frei1m(c, nx, nz, ym + 4, t)) ok = false;
          }
          if (ok) { wahl = [nx, nz, tm]; break; }
        }
        if (!wahl) continue;
        n++;
        faelle.push({ typ, o, K, c, nx: wahl[0], nz: wahl[1] });
      }
    }
    const ergebnis = [];
    const bilder = [];
    for (const F of faelle) {
      const { o, K, c, nx, nz } = F;
      const meshes = sichtbar(o);
      o.updateMatrixWorld(true);
      const achseX = nx !== 0;
      const l0 = achseX ? c.z0 : c.x0, l1 = achseX ? c.z1 : c.x1;
      const front = achseX ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      /* Start: an drei Laengsstellen, je ein eigener Lauf */
      for (const f of [0.3, 0.5, 0.7]) {
        const t = l0 + (l1 - l0) * f, y = 0.25 + K.h * 0.25;
        frei();
        d.setzePos(achseX ? front + nx * 0.15 : t, y, achseX ? t : front + nz * 0.15);
        P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
        P.wallInfo = P.wall = { nx, nz, col: c };
        P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
        d.kamStart(Math.atan2(nx, nz), 0.1);
        const st = { typ: F.typ, koll: c.id, nx, nz, f, bilder: 0, brust: 0, becken: 0, void: 0,
                     roh: 0, losgelassen: 0, maxSprung: 0, tiefeMax: 0, beispiele: [] };
        let vor = null, nr = 0;
        const plan = [['KeyW', 70], ['KeyD', 60], ['KeyW', 50], ['KeyA', 90], ['KeyW', 50]];
        for (const [taste, n] of plan) {
          frei(); d.taste(taste, true);
          for (let i = 0; i < n; i++) {
            d.schritt(1 / 60);
            /* die ersten 20 Bilder nach dem Umsetzen stellt sich die
               Haltung erst ein - sie zaehlen nicht */
            if (++nr <= 20) continue;
            if (P.state !== 'climb' || !P.wallInfo || P.wallInfo.col !== c) { st.losgelassen++; continue; }
            /* gemessen wird an der Wand, an der sie JETZT haengt (nach
               einer Aussenecke ist das die Querflaeche); waehrend des
               Eckbogens selbst nicht */
            if (P.eckBogen || (P.eckT || 0) > 0) { st.ecke = (st.ecke || 0) + 1; continue; }
            const wnx = P.wallInfo.nx, wnz = P.wallInfo.nz;
            if (vor) st.maxSprung = Math.max(st.maxSprung, Math.hypot(P.pos.x - vor[0], P.pos.y - vor[1], P.pos.z - vor[2]));
            vor = [P.pos.x, P.pos.y, P.pos.z];
            st.bilder++;
            const kn = d.animKnochen(['spine2', 'hips']);
            let brustH = false, beckenH = false, leer = 0;
            for (const [q, k] of [['brust', kn.spine2], ['becken', kn.hips]]) {
              if (!k) continue;
              /* von aussen zum Punkt: liegt eine Flaeche davor? */
              const aussen = V(k.x + wnx * 3, k.y, k.z + wnz * 3);
              RC.set(aussen, V(-wnx, 0, -wnz)); RC.near = 0; RC.far = 3 - 0.02;
              if (RC.intersectObjects(meshes, false).length) { if (q === 'brust') brustH = true; else beckenH = true; }
              /* vom Punkt nach innen: liegt in Rumpfbreite (Mitte und
                 +-0,2 m quer) innerhalb LEERE_M eine Flaeche? Eine
                 schmale Fensterlaibung neben dem Mauerpfeiler ist kein
                 Loch. */
              let traegt = false;
              for (const q2 of [0, -0.2, 0.2]) {
                RC.set(V(k.x + wnz * q2, k.y, k.z - wnx * q2), V(-wnx, 0, -wnz)); RC.near = 0; RC.far = LEERE_M;
                if (RC.intersectObjects(meshes, false).length) { traegt = true; break; }
              }
              if (!traegt) leer++;
            }
            const wx = wnx !== 0;
            const wfront = wx ? (wnx > 0 ? c.x1 : c.x0) : (wnz > 0 ? c.z1 : c.z0);
            const ebene = wx ? (P.pos.x - wfront) * wnx : (P.pos.z - wfront) * wnz;
            const tiefe = d.fassadenProxyTiefe ? d.fassadenProxyTiefe(c.id, wnx, wnz, P.pos.y, wx ? P.pos.z : P.pos.x) : null;
            if (tiefe !== null && tiefe > st.tiefeMax && tiefe < 1e8) st.tiefeMax = tiefe;
            const roh = Math.abs(ebene - 0.15) < 0.02 && tiefe !== null && tiefe > 0.25 && tiefe < 1e8;
            if (brustH) st.brust++;
            if (beckenH) st.becken++;
            if (leer === 2) {
              st.void++;
              if (O.bilder && !st.voidBild) {
                st.voidBild = true; d.zeichne();
                bilder.push({ name: 'VOID-' + F.typ + '-k' + c.id + '-f' + f + '-b' + st.bilder, u: d.bildDaten(0.8) });
              }
            }
            if (roh) st.roh++;
            if ((brustH || beckenH || leer === 2) && st.beispiele.length < 3)
              st.beispiele.push({ y: +P.pos.y.toFixed(2), t: +(wx ? P.pos.z : P.pos.x).toFixed(2), n: [wnx, wnz], ebene: +ebene.toFixed(3),
                                  brustH, beckenH, leer, tiefe: tiefe === null ? null : +(+tiefe).toFixed(2) });
            if (O.bilder && f === 0.5 && i === n - 1 && taste !== 'KeyA') {
              d.zeichne();
              bilder.push({ name: F.typ + '-k' + c.id + '-' + taste + '-' + st.bilder, u: d.bildDaten(0.8) });
            }
          }
        }
        frei();
        ergebnis.push(st);
      }
    }
    return { ergebnis, bilder };
  }, { je: JE, bilder: !!BILDER, video: VIDEO });
  const sum = {};
  for (const e of aus.ergebnis) {
    const s = sum[e.typ] || (sum[e.typ] = { laeufe: 0, bilder: 0, brust: 0, becken: 0, void: 0, roh: 0, los: 0, sprung: 0, tiefe: 0 });
    s.laeufe++; s.bilder += e.bilder; s.brust += e.brust; s.becken += e.becken; s.void += e.void;
    s.roh += e.roh; s.los += e.losgelassen; s.sprung = Math.max(s.sprung, e.maxSprung); s.tiefe = Math.max(s.tiefe, e.tiefeMax);
  }
  console.log('Typ                          Laeufe Bilder  chestBehind pelvisBehind  inVisualVoid  onRawBoxFace  losgelassen  maxSprung  Proxytiefe max');
  const ges = { bilder: 0, brust: 0, becken: 0, void: 0, roh: 0 };
  for (const [t, s] of Object.entries(sum)) {
    console.log('  ' + t.padEnd(27) + String(s.laeufe).padStart(6) + String(s.bilder).padStart(7) + String(s.brust).padStart(13) +
                String(s.becken).padStart(13) + String(s.void).padStart(14) + String(s.roh).padStart(14) +
                String(s.los).padStart(13) + s.sprung.toFixed(3).padStart(11) + s.tiefe.toFixed(2).padStart(16));
    for (const k of Object.keys(ges)) ges[k] += s[k];
  }
  console.log('  GESAMT  Bilder ' + ges.bilder + '  chestBehindVisibleSurface ' + ges.brust + '  pelvisBehindVisibleSurface ' + ges.becken +
              '  climbingInVisualVoid ' + ges.void + '  climbingOnRawBoxFaceWhenProxyExists ' + ges.roh);
  for (const e of aus.ergebnis) if (e.beispiele.length)
    console.log('    ' + e.typ + ' koll ' + e.koll + ' f ' + e.f + ' ' + JSON.stringify(e.beispiele));
  if (BILDER) for (const x of aus.bilder)
    fs.writeFileSync(path.join(BILDER, x.name + '.jpg'), Buffer.from(x.u.split(',')[1], 'base64'));
  await b.close();
})();
