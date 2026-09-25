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
/* start=fest: jeder Lauf beginnt mit derselben Kamera (d.kamStart) statt
   mit der geerbten Neigung und Glaettung des vorigen Laufs. */
const FEST = process.argv.indexOf('start=fest') > 0;
/* sichtAlt: ohne den Koerperpunkt-Tie-Breaker (KAM_SICHT in game.js). */
const SICHT_ALT = process.argv.indexOf('sichtAlt') > 0;
/* dachlebenAlt: die Dachleben-Kaesten ohne Hindernis (Stand 820f96e). */
const DL_ALT = process.argv.indexOf('dachlebenAlt') > 0;
/* fadeAlt: ohne den Kamera-Fade (KAM_FADE in game.js). */
const FADE_ALT = process.argv.indexOf('fadeAlt') > 0;
/* poseAlt: Blickpunkt auf fester Hoehe (Stand vor KAM_POSE in game.js). */
const POSE_ALT = process.argv.indexOf('poseAlt') > 0;
/* ruhe=9:0,9:3,...: die Ruhe an GENAU diesen Orten (Stelle:Richtung)
   messen statt an denen mit schlechten Bildern - fuer Vorher/Nachher am
   selben Ort. */
const rArg = process.argv.find((v) => v.indexOf('ruhe=') === 0);
const RUHE = rArg === undefined ? null : rArg.slice(5).split(',').map((q) => q.split(':').map(Number));
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

(async () => {
  const { b, page } = await starte(1280, 720, SEED,
    Object.assign({ kollQuelle: true }, ALT ? { kamAusAlt: true } : {},
      SICHT_ALT ? { kamSichtAlt: true } : {}, DL_ALT ? { dachlebenAlt: true } : {},
      FADE_ALT ? { fadeAlt: true } : {}, POSE_ALT ? { kamPoseAlt: true } : {}));
  const aus = await page.evaluate(async (O) => {
    const FEST = O.fest, BILD = O.bild, RUHE = O.ruhe;
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
    /* ---- Geometrie je Fall (2A) ---- */
    const boxAbst = (p, c) => {
      const y0 = c.y0 === undefined ? -1e9 : c.y0;
      const dx = Math.max(c.x0 - p[0], 0, p[0] - c.x1);
      const dy = Math.max(y0 - p[1], 0, p[1] - (c.h || 0));
      const dz = Math.max(c.z0 - p[2], 0, p[2] - c.z1);
      return +Math.hypot(dx, dy, dz).toFixed(3);
    };
    const kollNah = (p, id) => {
      let best = null, bd = 1e9;
      for (const c of d.colliderNah(p[0], p[2])) {
        if (c.innen || c.parkAuto) continue;
        if (id !== undefined) { if (c.id === id) return c; continue; }
        const dd = boxAbst(p, c);
        if (dd < bd) { bd = dd; best = c; }
      }
      return best;
    };
    const klasse = (c) => !c ? '-' : c.dachProp ? 'dachProp' : c.krone ? 'Krone'
      : c.klein ? 'klein' : 'Hauskoerper';
    /* Sichtbare Koerperpunkte: Kopf, Brust, Becken, linke und rechte
       Schulter. Sichtbar = weder ein Modell noch ein Hindernis zwischen
       Kamera und Punkt (ausgeblendete Dachprops zaehlen nicht). */
    const PUNKTE = ['head', 'spine2', 'hips', 'leftarm', 'rightarm'];
    const segFrei = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const n2 = Math.max(2, Math.ceil(len / 0.1));
      for (let st = 1; st < n2; st++) {
        const t = st / n2; if (t * len > len - 0.25) break;
        const x = a[0] + dx * t, y = a[1] + dy * t, z = a[2] + dz * t;
        for (const c of d.colliderNah(x, z)) {
          if (c.innen || c.parkAuto || c.kamIgnor) continue;
          const y0 = c.y0 === undefined ? -1e9 : c.y0;
          if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > y0 && y < (c.h || 0)) return false;
        }
      }
      RO.set(a[0], a[1], a[2]); RD.set(dx, dy, dz).normalize();
      RC.set(RO, RD); RC.near = 0; RC.far = Math.max(0, len - 0.25);
      return RC.intersectObjects(ziele, true).length === 0;
    };
    const koerperSicht = (kp) => {
      const kn = d.animKnochen(PUNKTE);
      const aus = {};
      let n = 0;
      for (const q of PUNKTE) {
        const k = kn[q];
        const f = !!k && segFrei(kp, [k.x, k.y, k.z]);
        aus[q] = f; if (f) n++;
      }
      return { n, punkte: aus };
    };
    /* playerReadable wie in Teil 2: Kopf und Brust im Bild und frei -
       roh, und "durch den Fade" (erster Treffer ist ein gerade
       ausgeduenntes Objekt, siehe kamera-fade.js). */
    const lesbar = (ks) => {
      const fz = d.fadeZustand ? d.fadeZustand() : { aktiv: [], min: 0 };
      const gefadet = new Map(fz.aktiv.map((a) => [a.id, a.wert]));
      const durch = (q) => {
        if (!q || !q.imBild) return false;
        if (q.frei) return true;
        const id = q.wer && (q.wer.dachProp ? q.wer.dachProp.koll : q.wer.dachleben ? q.wer.dachleben.koll : null);
        return id !== null && id !== undefined && gefadet.has(id) && gefadet.get(id) <= fz.min + 0.05;
      };
      const roh = (q) => !!(q && q.imBild && q.frei);
      return { roh: roh(ks.punkte.head) && roh(ks.punkte.spine2),
               fade: durch(ks.punkte.head) && durch(ks.punkte.spine2) };
    };
    /* Je Probe (alle 3 Bilder) im Lauf: playerFramed und playerReadable,
       dazu der groesste Kamerasprung je Bild. */
    const lauf1 = { proben: 0, nichtGerahmt: [], nichtLesbar: 0, nichtLesbarFade: 0, maxSprung: 0, sprungInfo: null };
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
      /* Start am naechsten freien Punkt zur Dachmitte (d.freierDachpunkt) */
      const st = d.freierDachpunkt(K.x, K.z, SLAB_H + K.h, koll.x0, koll.x1, koll.z0, koll.z1);
      stellen.push({ koll: koll.id, modell: o.userData.modellName || o.name,
                     x: st[0], z: st[1], h: K.h, mitteVerschoben: +Math.hypot(st[0] - K.x, st[1] - K.z).toFixed(2),
                     dach: [koll.x0, koll.x1, koll.z0, koll.z1] });
    }
    const alle = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space','KeyZ'];
    const los = () => { for (const t of alle) d.taste(t, false); };
    const faelle = [];
    /* dachkamera.js bricht einen Lauf ab, sobald die Figur 3 m unter der
       Dachflaeche ist (heruntergefallen) - und zaehlt das Bild, an dem
       es auffaellt, noch mit. Hier wird weitergezaehlt; jedes Bild traegt
       deshalb die Marke, ob dachkamera.js es auch gesehen haette. */
    let si = -1;
    for (const S of stellen) {
      si++;
      for (let r = 0; r < 4; r++) {
        const gier = r * Math.PI / 2;
        los();
        d.setzePos(S.x, SLAB_H + S.h + 0.1, S.z);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null; P.facing = gier;
        if (FEST) d.kamStart(gier); else d.setzeKamYaw(gier);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        d.taste('KeyW', true);
        let abbruch = false;
        let vorK = null;
        for (let k = 0; k < 110; k++) {
          d.schritt(1 / 60);
          {
            const kk = d.kamera();
            if (vorK) {
              const sp = Math.hypot(kk.pos[0] - vorK[0], kk.pos[1] - vorK[1], kk.pos[2] - vorK[2]);
              if (sp > lauf1.maxSprung) { lauf1.maxSprung = sp; lauf1.sprungInfo = { stelle: si, richtung: r, bild: k, zustand: P.state }; }
            }
            vorK = kk.pos;
          }
          if (k % 3) continue;
          const imDachLauf = !abbruch;
          if (P.pos.y < SLAB_H + S.h - 3) abbruch = true;
          const kam = d.kamera();
          {
            const fr = d.figurRahmen();
            const ks1 = d.koerperSicht(['head', 'spine2']);
            const le = ks1 ? lesbar(ks1) : { roh: true, fade: true };
            lauf1.proben++;
            if (!le.roh) lauf1.nichtLesbar++;
            if (!le.fade) lauf1.nichtLesbarFade++;
            if (fr && !fr.gerahmt)
              lauf1.nichtGerahmt.push({ stelle: si, richtung: r, bild: k, imDachLauf, grund: fr.grund,
                                        y: +P.pos.y.toFixed(2), zustand: P.state, abstand: kam.abstand });
          }
          const R = raster(kam);
          if (R.anteil <= 0.5) continue;
          const blk = d.kamBlock();
          const kn = d.animKnochen(['head', 'spine2', 'hips']);
          faelle.push({
            ort: [S.x, S.z], modell: S.modell, richtung: r, bild: k,
            blickTief: +d.kamZiel().tief.toFixed(4),
            stelle: si, imDachLauf, dachY: +(SLAB_H + S.h).toFixed(2), dachKiste: S.dach,
            pos: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)],
            zustand: P.state, gier: +gier.toFixed(2),
            kam: kam.pos, kamAbstand: kam.abstand, kamSteckt: kam.steckt,
            nahAnteil: R.anteil, nahWeg: R.weg, nahName: R.name,
            block: blk,
            kopf: !!kn.head, brust: !!kn.spine2,
            bild64: BILD ? d.bildDaten(0.75) : null,
            geo: (() => {
              const soll = blk.nach, ist = kam.pos;
              const spieler = [P.pos.x, P.pos.y + 1.0, P.pos.z];
              const c = blk.blocker ? kollNah(ist, blk.blocker.id) || kollNah(spieler, blk.blocker.id)
                                    : kollNah(ist);
              return {
                soll, ist, spieler: spieler.map((v) => +v.toFixed(2)),
                koll: c ? c.id : null, klasse: klasse(c), quelle: c ? c.quelle || null : null,
                kiste: c ? { x: [+c.x0.toFixed(2), +c.x1.toFixed(2)], z: [+c.z0.toFixed(2), +c.z1.toFixed(2)],
                             y: [c.y0 === undefined ? null : +c.y0.toFixed(2), +(c.h || 0).toFixed(2)] } : null,
                zuSpieler: c ? boxAbst(spieler, c) : null,
                zuSoll: c ? boxAbst(soll, c) : null,
                zuIst: c ? boxAbst(ist, c) : null,
                bildAnteil: R.anteil,
                sicht: koerperSicht(ist),
                sichtBild: d.koerperSicht(PUNKTE),
              };
            })(),
          });
        }
        los();
      }
    }
    /* ---- Teil 2: Ruhe an denselben Orten ---- */
    const ruhe = [];
    const ruheBilder = [];
    const zustand290 = [];
    const gesehen = new Set();
    const ruheListe = RUHE ? RUHE.map(([si, r]) => {
      const S = stellen[si];
      return { ort: [S.x, S.z], modell: S.modell, richtung: r, gier: +(r * Math.PI / 2).toFixed(2),
               stelle: si, dachY: +(SLAB_H + S.h).toFixed(2), dachKiste: S.dach };
    }) : faelle;
    for (const F of ruheListe) {
      const schl = F.ort[0] + ',' + F.ort[1] + ',' + F.richtung;
      if (gesehen.has(schl)) continue;
      gesehen.add(schl);
      los();
      d.setzePos(F.ort[0], F.dachY + 0.1, F.ort[1]);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null; P.facing = F.gier;
      if (FEST) d.kamStart(F.gier); else d.setzeKamYaw(F.gier);
      for (let i = 0; i < 30; i++) d.schritt(1 / 60);
      d.taste('KeyW', true);
      /* Die Figur laeuft, bis sie 1,5 m vor der Dachkante ist, und bleibt
         dort stehen - sonst misst die Ruhe den Absturz vom Dach mit
         (gemessen: Spruenge bis 5,6 m, alle im Fall am Hauskoerper). */
      const DK = F.dachKiste;
      let laeuft = true;
      let vorKam = null, vorBlick = null, vorWahl = null;
      let maxOrt = 0, maxDreh = 0, wechsel = 0, minAb = 99, maxAb = 0, tunnel = 0;
      let sprungInfo = null, vorAb = null, vorBlk = null;
      let imKoll = 0, sichtMin = 5, sichtSumme = 0, sichtProben = 0, lesbarNicht = 0, lesbarNichtFade = 0;
      let rahmenNicht = 0, tiefMin = 0;
      const rahmenGruende = {};
      const fadeVor = d.fadeZustand ? d.fadeZustand().ausgeloest : 0;
      for (let i = 0; i < 300; i++) {
        if (laeuft && Math.min(P.pos.x - DK[0], DK[1] - P.pos.x, P.pos.z - DK[2], DK[3] - P.pos.z) < 1.5) {
          d.taste('KeyW', false); laeuft = false;
        }
        d.schritt(1 / 60);
        const kam = d.kamera(), blk = d.kamBlock();
        if (vorKam) {
          const dd = Math.hypot(kam.pos[0] - vorKam[0], kam.pos[1] - vorKam[1],
                                kam.pos[2] - vorKam[2]);
          if (dd > maxOrt) {
            maxOrt = dd;
            sprungInfo = { bild: i, abstandVor: vorAb, abstandNach: kam.abstand,
                           wahlVor: vorBlk ? vorBlk.ausweichWahl : null, wahlNach: blk.ausweichWahl,
                           blocker: blk.blocker ? blk.blocker.id + (blk.blocker.dachProp ? ' dachProp' : blk.blocker.klein ? ' klein' : '') : null,
                           zustand: P.state, figurY: +P.pos.y.toFixed(2) };
          }
          const dr = Math.hypot(kam.blick[0] - vorBlick[0], kam.blick[1] - vorBlick[1],
                                kam.blick[2] - vorBlick[2]);
          if (dr > maxDreh) maxDreh = dr;
        }
        if (vorWahl !== null && blk.ausweichWahl !== vorWahl) wechsel++;
        vorKam = kam.pos; vorBlick = kam.blick; vorWahl = blk.ausweichWahl;
        vorAb = kam.abstand; vorBlk = blk;
        if (kam.abstand < minAb) minAb = kam.abstand;
        if (kam.abstand > maxAb) maxAb = kam.abstand;
        if (i % 6 === 0 && raster(kam).anteil > 0.5) tunnel++;
        if (kam.steckt) imKoll++;
        if (i === 290) {
          const w = d.kamWinkel(), ks = d.koerperSicht(PUNKTE);
          zustand290.push({ stelle: F.stelle, richtung: F.richtung,
            pos: [P.pos.x, P.pos.y, P.pos.z], facing: P.facing, gier: w.gier, neig: w.neig,
            kam: kam.pos, abstand: kam.abstand, sicht: ks ? ks.n : null,
            wer: ks ? Object.values(ks.punkte).map((q) => q && q.wer ? (q.wer.dachleben || q.wer.name) : null) : null });
        }
        if (BILD && (i === 60 || i === 150 || i === 290))
          ruheBilder.push({ name: 'ruhe-st' + F.stelle + '-ri' + F.richtung + '-bild' + String(i).padStart(3, '0'),
                            u: d.bildDaten(0.75) });
        if (i % 6 === 0) {
          const fr = d.figurRahmen();
          if (fr && !fr.gerahmt) { rahmenNicht++; rahmenGruende[fr.grund] = (rahmenGruende[fr.grund] || 0) + 1; }
          const kz = d.kamZiel();
          if (kz.tief < tiefMin) tiefMin = kz.tief;
          const ks = d.koerperSicht(PUNKTE);
          if (ks) {
            sichtProben++; sichtSumme += ks.n; if (ks.n < sichtMin) sichtMin = ks.n;
            const kf = ks.punkte.head && ks.punkte.head.imBild && ks.punkte.head.frei;
            const bf = ks.punkte.spine2 && ks.punkte.spine2.imBild && ks.punkte.spine2.frei;
            if (!(kf && bf)) lesbarNicht++;
            /* Durch den Fade: erster Treffer ist ein gerade ausgeduenntes
               Objekt (siehe tools/pruef/kamera-fade.js). */
            const fz = d.fadeZustand ? d.fadeZustand() : { aktiv: [], min: 0 };
            const gefadet = new Map(fz.aktiv.map((a) => [a.id, a.wert]));
            const durch = (q) => {
              if (!q || !q.imBild) return false;
              if (q.frei) return true;
              const id = q.wer && (q.wer.dachProp ? q.wer.dachProp.koll : q.wer.dachleben ? q.wer.dachleben.koll : null);
              return id !== null && id !== undefined && gefadet.has(id) && gefadet.get(id) <= fz.min + 0.05;
            };
            if (!(durch(ks.punkte.head) && durch(ks.punkte.spine2))) lesbarNichtFade++;
          }
        }
      }
      los();
      ruhe.push({ ort: F.ort, modell: F.modell, richtung: F.richtung,
                  wechselJeSekunde: +(wechsel / 5).toFixed(2),
                  maxOrtsprung: +maxOrt.toFixed(3), maxDrehsprung: +maxDreh.toFixed(4),
                  minAbstand: +minAb.toFixed(2), maxAbstand: +maxAb.toFixed(2),
                  tunnelProben: tunnel, proben: 50,
                  kameraImKollider: imKoll,
                  sichtMin, sichtMittel: sichtProben ? +(sichtSumme / sichtProben).toFixed(2) : null,
                  nichtLesbar: lesbarNicht, nichtLesbarMitFade: lesbarNichtFade,
                  nichtGerahmt: rahmenNicht, rahmenGruende, tiefMin: +tiefMin.toFixed(3),
                  fadeAusgeloest: (d.fadeZustand ? d.fadeZustand().ausgeloest : 0) - fadeVor,
                  sprungInfo, stelle: F.stelle });
    }
    return { faelle, ruhe, ruheBilder, zustand290, stellen: stellen.length, lauf1,
             starts: stellen.map((q, i) => i + ' ' + q.modell + ' Start ' + q.x.toFixed(2) + ',' + q.z.toFixed(2) +
                                             ' (' + q.mitteVerschoben + ' m neben der Dachmitte)') };
  }, { fest: FEST, bild: !!BILDER, ruhe: RUHE });

  /* ---- badFrames und uniqueBadCameraEvents ----
     Ein Ereignis ist eine ununterbrochene Folge schlechter Proben (alle
     3 Bilder) in DEMSELBEN Lauf - gleiche Dachstelle, gleiche Richtung.
     Dieselbe Definition steht in dachkamera.js. */
  const ereignisse = (liste) => {
    let n = 0, vor = null;
    for (const f of liste) {
      if (!vor || vor.stelle !== f.stelle || vor.richtung !== f.richtung ||
          f.bild - vor.bild > 3) n++;
      vor = f;
    }
    return n;
  };
  const dach = aus.faelle.filter((f) => f.imDachLauf);
  const fall = aus.faelle.filter((f) => !f.imDachLauf);
  console.log('\n== Startpunkte ==');
  for (const z of aus.starts) console.log('  ' + z);
  console.log('\n== Zaehlung ==');
  console.log('  alle Proben          badFrames ' + aus.faelle.length +
              '   uniqueBadCameraEvents ' + ereignisse(aus.faelle));
  console.log('  wie dachkamera.js    badFrames ' + dach.length +
              '   uniqueBadCameraEvents ' + ereignisse(dach));
  console.log('  nach dem Absturz     badFrames ' + fall.length +
              '   uniqueBadCameraEvents ' + ereignisse(fall) +
              '   (Figur mehr als 3 m unter der Dachflaeche)');
  {
    const L1 = aus.lauf1;
    const dachNG = L1.nichtGerahmt.filter((f) => f.imDachLauf);
    console.log('  playerFramed         nicht gerahmt ' + L1.nichtGerahmt.length + ' von ' + L1.proben + ' Proben' +
                '   Ereignisse ' + ereignisse(L1.nichtGerahmt) +
                '   (wie dachkamera.js: ' + dachNG.length + ' / ' + ereignisse(dachNG) + ')');
    console.log('  playerReadable       nicht lesbar ' + L1.nichtLesbar + ' von ' + L1.proben +
                '   durch den Fade nicht lesbar ' + L1.nichtLesbarFade);
    console.log('  maxCameraJump        ' + L1.maxSprung.toFixed(3) + ' m je Bild  ' + JSON.stringify(L1.sprungInfo));
    for (const f of L1.nichtGerahmt)
      console.log('    nicht gerahmt: ' + (f.imDachLauf ? 'Dach ' : 'Fall ') + 'Stelle ' + f.stelle + ' Ri ' + f.richtung +
                  ' Bild ' + String(f.bild).padStart(3) + '  Figur y ' + f.y + '  ' + f.zustand + '  ' + f.grund + '  Abstand ' + f.abstand);
  }
  for (const f of aus.faelle)
    console.log('    ' + (f.imDachLauf ? 'Dach ' : 'Fall ') + 'Stelle ' + f.stelle +
                ' Ri ' + f.richtung + ' Bild ' + String(f.bild).padStart(3) +
                '  Figur y ' + f.pos[1] + ' (Dach ' + f.dachY + ')  ' + f.zustand +
                '  Anteil ' + f.nahAnteil + '  Blickpunkt gesenkt ' + f.blickTief);

  console.log('\n== Geometrie je Fall (2A) ==');
  console.log('  St Ri Bild  Klasse       Koll   Figur->Koll Soll->Koll Ist->Koll  Anteil  Koerperpunkte  Soll / Ist / Figur');
  for (const f of aus.faelle) {
    const g = f.geo;
    console.log('  ' + String(f.stelle).padStart(2) + String(f.richtung).padStart(3) + String(f.bild).padStart(5) +
                '  ' + g.klasse.padEnd(11) + String(g.koll).padStart(6) +
                String(g.zuSpieler).padStart(12) + String(g.zuSoll).padStart(11) + String(g.zuIst).padStart(10) +
                String(g.bildAnteil).padStart(8) + ('   ' + g.sicht.n + '/5 ' + (g.sichtBild ? g.sichtBild.n : '?') + '/5').padEnd(15) +
                'wahl ' + f.block.ausweichWahl + ' sicht ' + f.block.sichtJetzt + '  ' +
                JSON.stringify(g.soll) + ' ' + JSON.stringify(g.ist) + ' ' + JSON.stringify(g.spieler));
  }
  const quellen = {};
  for (const f of aus.faelle) if (f.geo.koll) quellen[f.geo.koll] = { klasse: f.geo.klasse, quelle: f.geo.quelle, kiste: f.geo.kiste };
  console.log('  Kollider im Einzelnen:');
  for (const [k, q] of Object.entries(quellen)) console.log('    ' + k + '  ' + JSON.stringify(q));

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
  for (const f of aus.faelle)
    console.log('    ' + JSON.stringify(Object.assign({}, f, { bild64: undefined })));

  console.log('\n== Zustand nach 290 Bildern Ruhe (zum Nachstellen) ==');
  for (const z of aus.zustand290 || []) console.log('  ' + JSON.stringify(z));
  console.log('\n== Kameraruhe, fuenf Sekunden je Ort ==');
  console.log('  ' + 'Modell'.padEnd(26) + 'Ri  Wechsel/s  maxOrt  maxDreh  minAbst  maxAbst  Tunnelproben  imKoll  Sicht min/mittel  nicht lesbar');
  for (const r of aus.ruhe)
    console.log('  ' + (r.modell || '?').padEnd(26) + String(r.richtung).padStart(2) +
                String(r.wechselJeSekunde).padStart(11) +
                String(r.maxOrtsprung).padStart(8) + String(r.maxDrehsprung).padStart(9) +
                String(r.minAbstand).padStart(9) + String(r.maxAbstand).padStart(9) +
                String(r.tunnelProben + '/' + r.proben).padStart(14) +
                String(r.kameraImKollider).padStart(8) +
                String(r.sichtMin + ' / ' + r.sichtMittel).padStart(18) +
                String(r.nichtLesbar + '/' + 50).padStart(14) +
                ('  mit Fade ' + r.nichtLesbarMitFade + '/50, Fades ' + r.fadeAusgeloest) +
                ('  nicht gerahmt ' + r.nichtGerahmt + '/50' + (r.nichtGerahmt ? ' ' + JSON.stringify(r.rahmenGruende) : '') +
                 '  tief ' + r.tiefMin) +
                '   St ' + r.stelle + '  groesster Sprung: ' + JSON.stringify(r.sprungInfo));
  if (BILDER) {
    for (const rb of aus.ruheBilder || [])
      fs.writeFileSync(path.join(BILDER, rb.name + '.jpg'), Buffer.from(rb.u.split(',')[1], 'base64'));
    aus.ruheBilder = null;
    for (const f of aus.faelle) {
      if (!f.bild64) continue;
      fs.writeFileSync(path.join(BILDER, 'st' + f.stelle + '-ri' + f.richtung + '-bild' +
        String(f.bild).padStart(3, '0') + '.jpg'), Buffer.from(f.bild64.split(',')[1], 'base64'));
      f.bild64 = null;
    }
    fs.writeFileSync(path.join(BILDER, 'restfaelle.json'), JSON.stringify(aus, null, 1));
  }
  await b.close();
})();
