/* problem-2, Human Rejection Pass 2, Blocker 2: der Dach-Tunnel.

   Der neue Human-Screenshot zeigt kein verdecktes Figurchen, sondern
   ein Bild, das zu grossen Teilen aus Dachgeometrie besteht - wie ein
   Tunnel vor der Kamera.

   Der Kletterpfad zeigt das nicht (kletterkamera-sicht.js: hoechster
   Anteil 0,33). Gesucht wird deshalb dort, wo Dachgeometrie ueber der
   Kamera haengt: auf dem Dach, an der Dachkante, unter der Dachkrone
   und unter dem Gesims eines hoeheren Nachbarn.

   Gemessen wird je Bild ein Tastraster ueber das BILD - gegen die
   sichtbaren Hausmodelle, nicht gegen die Kollider. Das Gesims eines
   Modellhauses hat gar kein Hindernis; genau deshalb faehrt die Kamera
   hinein.

     nahAnteil                   Anteil der Tastpunkte mit Geometrie
                                 naeher als die Kamera selbst steht
     nearGeometryDominatesView   Anteil ueber der Schwelle
     playerReadable              Kopf UND Brust frei und Anteil klein
     playerFramed                Kopf, Brust, Becken im Bild und nicht im
                                 aeussersten Zwanzigstel am Rand
     maxCameraJump               groesster Kamerasprung je Bild

   Aufruf:  node tools/pruef/dachkamera.js [seed=4711] [start=fest] [poseAlt] [bilder=ordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
/* start=fest: jeder Lauf beginnt mit derselben Kamera (d.kamStart) statt
   mit der geerbten Neigung und Glaettung des vorigen Laufs. */
const FEST = process.argv.indexOf('start=fest') > 0;
/* sichtAlt: ohne den Koerperpunkt-Tie-Breaker (KAM_SICHT in game.js). */
const SICHT_ALT = process.argv.indexOf('sichtAlt') > 0;
/* dachlebenAlt: die Dachleben-Kaesten ohne Hindernis (Stand 820f96e). */
const DL_ALT = process.argv.indexOf('dachlebenAlt') > 0;
/* poseAlt: Blickpunkt auf fester Hoehe (Stand vor KAM_POSE in game.js). */
const POSE_ALT = process.argv.indexOf('poseAlt') > 0;
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, SEED,
    Object.assign({}, ALT ? { kamAusAlt: true } : {},
      SICHT_ALT ? { kamSichtAlt: true } : {}, DL_ALT ? { dachlebenAlt: true } : {},
      POSE_ALT ? { kamPoseAlt: true } : {}));
  const stellen = await page.evaluate(() => {
    const d = __dbg; d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const aus = [];
    /* Daecher mit einer Krone oder einem hoeheren Nachbarn - dort haengt
       etwas ueber der Kamera. */
    for (const o of d.hausModelle()) {
      const K = o.userData && o.userData.hausKiste;
      if (!K || K.h < 12 || aus.length >= 12) continue;
      let koll = null;
      for (const c of d.colliderNah(K.x, K.z))
        if (fest(c) && Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 &&
            Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05) { koll = c; break; }
      if (!koll) continue;
      /* Krone? */
      let krone = null, hoeherNachbar = null;
      for (const c of d.colliderNah(K.x, K.z)) {
        if (c === koll) continue;
        if (c.klein && c.y0 !== undefined && c.y0 > SLAB_H + K.h - 1) krone = c.id;
        if (fest(c) && (c.h || 0) > (koll.h || 0) + 4) hoeherNachbar = c.id;
      }
      if (!krone && !hoeherNachbar) continue;
      /* Start am naechsten freien Punkt zur Dachmitte (d.freierDachpunkt) */
      const st = d.freierDachpunkt(K.x, K.z, SLAB_H + K.h, koll.x0, koll.x1, koll.z0, koll.z1);
      aus.push({ koll: koll.id, modell: o.userData.modellName || o.name,
                 x: K.x, z: K.z, w: K.w, d: K.d, h: K.h, sx: st[0], sz: st[1],
                 krone, hoeherNachbar });
    }
    return aus;
  });
  console.log('  Dachstellen: ' + stellen.length);

  const alle = [];
  for (let n = 0; n < stellen.length; n++) {
    const reihe = await page.evaluate(async (S) => {
      const d = __dbg, P = d.player;
      const SLAB_H = 0.25, NAH = 7.0;
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'])
        d.taste(t, false);
      const RC = new THREE.Raycaster();
      const RO = new THREE.Vector3(), RD = new THREE.Vector3();
      const ziele = d.hausModelle().concat(d.hausFassaden ? d.hausFassaden() : []);
      const raster = (kam) => {
        const tanY = Math.tan(kam.fov * Math.PI / 360), tanX = tanY * kam.seiten;
        let nah = 0, ges = 0, summe = 0;
        for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 5; ix++) {
          const sx = (ix / 4 * 2 - 1) * tanX, sy = (iy / 2 * 2 - 1) * tanY;
          RD.set(kam.blick[0] + kam.rechts[0] * sx + kam.oben[0] * sy,
                 kam.blick[1] + kam.rechts[1] * sx + kam.oben[1] * sy,
                 kam.blick[2] + kam.rechts[2] * sx + kam.oben[2] * sy).normalize();
          RO.set(kam.pos[0], kam.pos[1], kam.pos[2]);
          RC.set(RO, RD); RC.near = 0; RC.far = NAH;
          const tr = RC.intersectObjects(ziele, true);
          const weg = tr.length ? tr[0].distance : NAH;
          ges++; summe += weg; if (weg < NAH) nah++;
        }
        return { anteil: +(nah / ges).toFixed(3), mittel: +(summe / ges).toFixed(2) };
      };
      const frei = (ax, ay, az, bx, by, bz) => {
        const dx = bx - ax, dy = by - ay, dz = bz - az;
        const len = Math.hypot(dx, dy, dz);
        const n2 = Math.max(2, Math.ceil(len / 0.12));
        const bis = len > 0.7 ? (len - 0.35) / len : 0.5;
        for (let s = 1; s < n2; s++) {
          const t = s / n2; if (t > bis) break;
          const x = ax + dx * t, y = ay + dy * t, z = az + dz * t;
          for (const c of d.colliderNah(x, z)) {
            if (c.innen || c.parkAuto) continue;
            const y0 = c.y0 === undefined ? -1e9 : c.y0;
            if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > y0 && y < (c.h || 0))
              return false;
          }
        }
        return true;
      };
      /* Die Figur auf das Dach stellen, in die Mitte, und dann in acht
         Richtungen bis an die Kante laufen lassen. Das Bild entsteht
         beim Blick NACH AUSSEN, ueber die Kante. */
      const reihe = [];
      for (let r = 0; r < 4; r++) {
        const gier = r * Math.PI / 2;
        d.setzePos(S.sx, SLAB_H + S.h + 0.1, S.sz);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null; P.facing = gier;
        if (S.fest) d.kamStart(gier); else d.setzeKamYaw(gier);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        d.taste('KeyW', true);
        let vorK = null, sprung = 0;
        for (let k = 0; k < 110; k++) {
          d.schritt(1 / 60);
          {
            const kk = d.kamera();
            if (vorK) sprung = Math.max(sprung, Math.hypot(kk.pos[0] - vorK[0], kk.pos[1] - vorK[1], kk.pos[2] - vorK[2]));
            vorK = kk.pos;
          }
          if (k % 3) continue;
          const kam = d.kamera();
          /* playerFramed (d.figurRahmen): Kopf, Brust, Becken im Bild,
             nicht am aeussersten Rand. */
          const fr = d.figurRahmen();
          const kn = d.animKnochen(['head', 'spine2']);
          const R = raster(kam);
          const kopfFrei = !kn.head || frei(kam.pos[0], kam.pos[1], kam.pos[2],
                                            kn.head.x, kn.head.y, kn.head.z);
          const brustFrei = !kn.spine2 || frei(kam.pos[0], kam.pos[1], kam.pos[2],
                                               kn.spine2.x, kn.spine2.y, kn.spine2.z);
          /* ---- Welches Mesh beherrscht das Bild? ----
             Fuer die Einzelanalyse der Restbilder: der naechste
             Treffer und sein Name, dazu die Kameralage. */
          let nahName = null, nahWeg = 9;
          if (R.anteil > 0.4) {
            RD.set(kam.blick[0], kam.blick[1], kam.blick[2]).normalize();
            RO.set(kam.pos[0], kam.pos[1], kam.pos[2]);
            RC.set(RO, RD); RC.near = 0; RC.far = NAH;
            for (const iy of [-1, 0, 1]) for (const ix of [-1, 0, 1]) {
              const tanY = Math.tan(kam.fov * Math.PI / 360), tanX = tanY * kam.seiten;
              RD.set(kam.blick[0] + kam.rechts[0] * ix * tanX + kam.oben[0] * iy * tanY,
                     kam.blick[1] + kam.rechts[1] * ix * tanX + kam.oben[1] * iy * tanY,
                     kam.blick[2] + kam.rechts[2] * ix * tanX + kam.oben[2] * iy * tanY).normalize();
              RC.set(RO, RD); RC.near = 0; RC.far = NAH;
              const tr = RC.intersectObjects(ziele, true);
              if (tr.length && tr[0].distance < nahWeg) {
                nahWeg = tr[0].distance;
                nahName = tr[0].object.name || '(ohne Namen)';
              }
            }
          }
          reihe.push({ r, k, nahAnteil: R.anteil, nahMittel: R.mittel,
                       nahName, nahWeg: +nahWeg.toFixed(2),
                       block: d.kamBlock(),
                       kopfFrei, brustFrei, zustand: P.state,
                       abst: kam.abstand, steckt: kam.steckt,
                       kamY: +kam.pos[1].toFixed(2),
                       pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
                       kam: kam.pos, gier: +gier.toFixed(2),
                       gerahmt: fr ? fr.gerahmt : null, rahmenGrund: fr ? fr.grund : null, sprung: +sprung.toFixed(3) });
          if (P.pos.y < SLAB_H + S.h - 3) break;      // heruntergefallen
        }
        d.taste('KeyW', false);
      }
      return reihe;
    }, Object.assign({ fest: FEST }, stellen[n]));
    const max = reihe.reduce((a, r) => r.nahAnteil > a.nahAnteil ? r : a,
                             { nahAnteil: -1 });
    const tunnel = reihe.filter((r) => r.nahAnteil > 0.5).length;
    const schlecht = reihe.filter((r) => r.nahAnteil > 0.5)
      .map((r) => ({ stelle: n, richtung: r.r, bild: r.k, y: r.pos[1], zustand: r.zustand,
                     anteil: r.nahAnteil }));
    alle.push({ n, ...stellen[n], bilder: reihe.length, tunnel, max, schlecht, reihe });
    console.log('  ' + String(n + 1).padStart(2) + '  ' +
                (stellen[n].modell || '?').padEnd(26) +
                ' Bilder ' + String(reihe.length).padStart(4) +
                '  Tunnel ' + String(tunnel).padStart(4) +
                '  nahMax ' + max.nahAnteil +
                '  Krone ' + (stellen[n].krone || '-') +
                '  hoeherer Nachbar ' + (stellen[n].hoeherNachbar || '-'));
  }
  const ges = alle.reduce((a, e) => a + e.bilder, 0);
  const tun = alle.reduce((a, e) => a + e.tunnel, 0);
  console.log('\n== Zusammen ==');
  console.log('  Bilder ' + ges + '   nearGeometryDominatesView ' + tun);
  /* Ein Ereignis ist eine ununterbrochene Folge schlechter Proben (alle
     3 Bilder) in demselben Lauf - dieselbe Definition wie in
     kamera-restfaelle.js. */
  const sl = [].concat(...alle.map((e) => e.schlecht));
  let ev = 0, vor = null;
  for (const f of sl) {
    if (!vor || vor.stelle !== f.stelle || vor.richtung !== f.richtung ||
        f.bild - vor.bild > 3) ev++;
    vor = f;
  }
  console.log('  badFrames ' + sl.length + '   uniqueBadCameraEvents ' + ev);
  /* playerReadable: Kopf UND Brust frei und Anteil klein (siehe oben);
     playerFramed: Kopf, Brust, Becken im Bild. Ereignisse wie oben. */
  const alleProben = [].concat(...alle.map((e) => e.reihe.map((r) => Object.assign({ stelle: e.n }, r))));
  const lesbar = alleProben.filter((r) => r.kopfFrei && r.brustFrei && r.nahAnteil <= 0.5).length;
  const ng = alleProben.filter((r) => r.gerahmt === false)
    .map((r) => ({ stelle: r.stelle, richtung: r.r, bild: r.k, grund: r.rahmenGrund, y: r.pos[1], zustand: r.zustand, abst: r.abst }));
  let evR = 0, vorR = null;
  for (const f of ng) {
    if (!vorR || vorR.stelle !== f.stelle || vorR.richtung !== f.richtung || f.bild - vorR.bild > 3) evR++;
    vorR = f;
  }
  const maxSprung = alleProben.reduce((m, r) => Math.max(m, r.sprung || 0), 0);
  console.log('  playerReadable ' + lesbar + '/' + alleProben.length +
              '   playerFramed ' + (alleProben.length - ng.length) + '/' + alleProben.length +
              ' (nicht gerahmt ' + ng.length + ', Ereignisse ' + evR + ')   maxCameraJump ' + maxSprung.toFixed(3) + ' m je Bild');
  for (const f of ng)
    console.log('    nicht gerahmt: Stelle ' + f.stelle + ' Ri ' + f.richtung + ' Bild ' + String(f.bild).padStart(3) +
                '  Figur y ' + f.y + '  ' + f.zustand + '  ' + f.grund + '  Abstand ' + f.abst);
  for (const f of sl)
    console.log('    Stelle ' + f.stelle + ' Ri ' + f.richtung + ' Bild ' + String(f.bild).padStart(3) +
                '  Figur y ' + f.y + '  ' + f.zustand + '  Anteil ' + f.anteil);
  const schlimm = alle.slice().sort((a, c) => c.max.nahAnteil - a.max.nahAnteil).slice(0, 5);
  console.log('  schlimmste Stellen:');
  for (const e of schlimm)
    console.log('    ' + (e.modell || '?').padEnd(26) + ' nahMax ' + e.max.nahAnteil +
                '  ' + JSON.stringify(e.max));
  if (BILDER) {
    for (let i = 0; i < Math.min(4, schlimm.length); i++) {
      const e = schlimm[i];
      /* ---- Die Stelle WIRKLICH nachfahren ----
         Die Figur einfach an die notierte Stelle zu setzen und 40
         Bilder rechnen zu lassen ergibt ein anderes Bild: die Kamera
         zieht neu nach, und die Figur laeuft weiter. Gefahren wird
         deshalb derselbe Lauf noch einmal - gleicher Ort, gleiche
         Richtung - und bei genau dem notierten Bild angehalten. */
      await page.evaluate(async (M) => {
        const d = __dbg, P = d.player;
        const SLAB_H = 0.25;
        for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft']) d.taste(t, false);
        d.setzePos(M.sx, SLAB_H + M.h + 0.1, M.sz);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null;
        P.facing = M.gier; if (M.fest) d.kamStart(M.gier); else d.setzeKamYaw(M.gier);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        d.taste('KeyW', true);
        for (let k = 0; k <= M.k; k++) d.schritt(1 / 60);
        d.taste('KeyW', false);
        d.zeichne();
      }, { sx: e.sx, sz: e.sz, h: e.h, gier: e.max.gier, k: e.max.k, fest: FEST });
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      await page.evaluate(() => __dbg.zeichne());
      await page.screenshot({ path: path.join(BILDER,
        String(i + 1).padStart(2, '0') + '-' + (e.modell || 'x') + '.png') });
    }
    fs.writeFileSync(path.join(BILDER, 'messwerte.json'), JSON.stringify(alle.map((e) => Object.assign({}, e, { reihe: undefined })), null, 1));
  }
  await b.close();
})();
