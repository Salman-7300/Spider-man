/* problem-2, Blocker 2: die Restfaelle vollstaendig klassifizieren.

   dachkamera.js zaehlt, WIE OFT das Bild von naher Geometrie beherrscht
   wird. Dieser Stand fragt je Fall, WAS es ist: welches Objekt, welcher
   Typ, welche Kiste, welche Abstaende, welche Ausweichlage gefunden
   wurde - und ob die Kamera dort ruhig steht.

   Teil 1  dieselbe Fahrt wie dachkamera.js, aber je auffaelligem Bild
           der vollstaendige Satz Kennzahlen
   Teil 2  je gefundenem Ort fuenf Sekunden Bewegung, dazu
             Kamerawechsel je Sekunde
             groesster Positionssprung je Bild
             groesster Drehsprung je Bild
             kleinster und groesster Abstand

   Aufruf:  node tools/pruef/kamera-restfaelle.js [seed=4711] [alt] [bilder=ordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const SEED = sArg === undefined ? 4711 : +sArg.slice(5);
const ALT = process.argv.indexOf('alt') > 0;
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, SEED, ALT ? { kamAusAlt: true } : {});
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25, NAH = 7.0;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const RC = new THREE.Raycaster();
    const RO = new THREE.Vector3(), RD = new THREE.Vector3();
    const ziele = d.hausModelle().concat(d.hausFassaden ? d.hausFassaden() : []);
    const raster = (kam) => {
      const tanY = Math.tan(kam.fov * Math.PI / 360), tanX = tanY * kam.seiten;
      let nah = 0, ges = 0, nahWeg = NAH, nahName = null;
      for (let iy = 0; iy < 3; iy++) for (let ix = 0; ix < 5; ix++) {
        const sx = (ix / 4 * 2 - 1) * tanX, sy = (iy / 2 * 2 - 1) * tanY;
        RD.set(kam.blick[0] + kam.rechts[0] * sx + kam.oben[0] * sy,
               kam.blick[1] + kam.rechts[1] * sx + kam.oben[1] * sy,
               kam.blick[2] + kam.rechts[2] * sx + kam.oben[2] * sy).normalize();
        RO.set(kam.pos[0], kam.pos[1], kam.pos[2]);
        RC.set(RO, RD); RC.near = 0; RC.far = NAH;
        const tr = RC.intersectObjects(ziele, true);
        ges++;
        if (tr.length) {
          nah++;
          if (tr[0].distance < nahWeg) {
            nahWeg = tr[0].distance; nahName = tr[0].object.name || '(ohne Namen)';
          }
        }
      }
      return { anteil: +(nah / ges).toFixed(3), weg: +nahWeg.toFixed(2), name: nahName };
    };
    /* dieselben Dachstellen wie in dachkamera.js */
    const stellen = [];
    for (const o of d.hausModelle()) {
      const K = o.userData && o.userData.hausKiste;
      if (!K || K.h < 12 || stellen.length >= 12) continue;
      let koll = null;
      for (const c of d.colliderNah(K.x, K.z))
        if (fest(c) && Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 &&
            Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05) { koll = c; break; }
      if (!koll) continue;
      let krone = null, hoeher = null;
      for (const c of d.colliderNah(K.x, K.z)) {
        if (c === koll) continue;
        if (c.klein && c.y0 !== undefined && c.y0 > SLAB_H + K.h - 1) krone = c.id;
        if (fest(c) && (c.h || 0) > (koll.h || 0) + 4) hoeher = c.id;
      }
      if (!krone && !hoeher) continue;
      stellen.push({ koll: koll.id, modell: o.userData.modellName || o.name,
                     x: K.x, z: K.z, h: K.h });
    }
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    const faelle = [];
    for (const S of stellen) {
      for (let r = 0; r < 4; r++) {
        const gier = r * Math.PI / 2;
        los();
        d.setzePos(S.x, SLAB_H + S.h + 0.1, S.z);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null; P.facing = gier;
        d.setzeKamYaw(gier);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        d.taste('KeyW', true);
        for (let k = 0; k < 110; k++) {
          d.schritt(1 / 60);
          if (k % 3) continue;
          const kam = d.kamera();
          const R = raster(kam);
          if (R.anteil <= 0.5) continue;
          const blk = d.kamBlock();
          const kn = d.animKnochen(['head', 'spine2', 'hips']);
          faelle.push({
            ort: [S.x, S.z], modell: S.modell, richtung: r, bild: k,
            pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
            zustand: P.state, gier: +gier.toFixed(2),
            kam: kam.pos, kamAbstand: kam.abstand, kamSteckt: kam.steckt,
            nahAnteil: R.anteil, nahWeg: R.weg, nahName: R.name,
            block: blk,
            kopf: !!kn.head, brust: !!kn.spine2,
          });
          if (faelle.length >= 40) break;
        }
        los();
        if (faelle.length >= 40) break;
      }
      if (faelle.length >= 40) break;
    }
    /* ---- Teil 2: Ruhe an denselben Orten ---- */
    const ruhe = [];
    const gesehen = new Set();
    for (const F of faelle) {
      const schl = F.ort[0] + ',' + F.ort[1] + ',' + F.richtung;
      if (gesehen.has(schl)) continue;
      gesehen.add(schl);
      los();
      d.setzePos(F.ort[0], SLAB_H + 0.1 + (F.pos[1] - SLAB_H), F.ort[1]);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null; P.facing = F.gier;
      d.setzeKamYaw(F.gier);
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      d.taste('KeyW', true);
      let vorKam = null, vorBlick = null, vorWahl = null;
      let maxOrt = 0, maxDreh = 0, wechsel = 0, minAb = 99, maxAb = 0, tunnel = 0;
      for (let i = 0; i < 300; i++) {
        d.schritt(1 / 60);
        const kam = d.kamera(), blk = d.kamBlock();
        if (vorKam) {
          const dd = Math.hypot(kam.pos[0] - vorKam[0], kam.pos[1] - vorKam[1],
                                kam.pos[2] - vorKam[2]);
          if (dd > maxOrt) maxOrt = dd;
          const dr = Math.hypot(kam.blick[0] - vorBlick[0], kam.blick[1] - vorBlick[1],
                                kam.blick[2] - vorBlick[2]);
          if (dr > maxDreh) maxDreh = dr;
        }
        if (vorWahl !== null && blk.ausweichWahl !== vorWahl) wechsel++;
        vorKam = kam.pos; vorBlick = kam.blick; vorWahl = blk.ausweichWahl;
        if (kam.abstand < minAb) minAb = kam.abstand;
        if (kam.abstand > maxAb) maxAb = kam.abstand;
        if (i % 6 === 0 && raster(kam).anteil > 0.5) tunnel++;
      }
      los();
      ruhe.push({ ort: F.ort, modell: F.modell, richtung: F.richtung,
                  wechselJeSekunde: +(wechsel / 5).toFixed(2),
                  maxOrtsprung: +maxOrt.toFixed(3), maxDrehsprung: +maxDreh.toFixed(4),
                  minAbstand: +minAb.toFixed(2), maxAbstand: +maxAb.toFixed(2),
                  tunnelProben: tunnel, proben: 50 });
    }
    return { faelle, ruhe, stellen: stellen.length };
  });

  console.log('\n== Restfaelle einzeln (' + aus.faelle.length + ') ==');
  console.log('  ' + 'Modell'.padEnd(26) + 'Ri Bild  Weltposition            Zustand  Blocker  Typ        Abst  best  Anteil  nahWeg  nahName');
  for (const f of aus.faelle) {
    const bl = f.block.blocker;
    const typ = !bl ? '-' : bl.dachProp ? 'dachProp' : bl.krone ? 'krone'
              : bl.klein ? 'klein' : 'Hauskoerper';
    console.log('  ' + (f.modell || '?').padEnd(26) + String(f.richtung).padStart(2) +
                String(f.bild).padStart(5) + '  ' + JSON.stringify(f.pos).padEnd(24) +
                f.zustand.padEnd(9) + String(bl ? bl.id : '-').padStart(7) + '  ' +
                typ.padEnd(11) + String(f.kamAbstand).padStart(5) +
                String(f.block.ausweichBest).padStart(6) +
                String(f.nahAnteil).padStart(8) + String(f.nahWeg).padStart(8) +
                '  ' + f.nahName);
  }
  const typZahl = {};
  for (const f of aus.faelle) {
    const bl = f.block.blocker;
    const typ = !bl ? 'kein Blockierer (Hauptstrahl frei)' : bl.dachProp ? 'dachProp'
              : bl.krone ? 'krone' : bl.klein ? 'klein (Gesims/Krone)' : 'Hauskoerper';
    typZahl[typ] = (typZahl[typ] || 0) + 1;
  }
  console.log('\n  nach Objekttyp:');
  for (const [t, n] of Object.entries(typZahl).sort((a, c) => c[1] - a[1]))
    console.log('    ' + String(n).padStart(4) + '  ' + t);
  console.log('\n  vollstaendig:');
  for (const f of aus.faelle) console.log('    ' + JSON.stringify(f));

  console.log('\n== Kameraruhe, fuenf Sekunden je Ort ==');
  console.log('  ' + 'Modell'.padEnd(26) + 'Ri  Wechsel/s  maxOrt  maxDreh  minAbst  maxAbst  Tunnelproben');
  for (const r of aus.ruhe)
    console.log('  ' + (r.modell || '?').padEnd(26) + String(r.richtung).padStart(2) +
                String(r.wechselJeSekunde).padStart(11) +
                String(r.maxOrtsprung).padStart(8) + String(r.maxDrehsprung).padStart(9) +
                String(r.minAbstand).padStart(9) + String(r.maxAbstand).padStart(9) +
                String(r.tunnelProben + '/' + r.proben).padStart(14));
  if (BILDER) fs.writeFileSync(path.join(BILDER, 'restfaelle.json'), JSON.stringify(aus, null, 1));
  await b.close();
})();
