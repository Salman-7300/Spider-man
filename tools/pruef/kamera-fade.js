/* problem-2, Human-Entscheidung zu a7e1e20: der Kamera-Fade als letzte
   Stufe (KAM_FADE in game.js).

   Faelle - je die Lage, die kamera-restfaelle.js nach 290 Bildern Ruhe
   gemessen hat (Figur, Blickrichtung, Kamerawinkel), nachgestellt und
   drei Sekunden gehalten:
     St9 Ri0 (Pflichtfall), St9 Ri1, Ri2, Ri3, St7 Ri0, St11 Ri0, Ri1
   Dazu je Ort ein Lauf wie in der Ruhe: bis 1,5 m vor die Dachkante,
   dann stehen.

   Je Fall:
     fadeTriggered      neu ausgeloeste Fades
     wrongObjectFaded   Bilder, in denen ein ausgeduenntes Objekt von
                        KEINEM Strahl Kamera -> Koerperpunkt getroffen
                        wird (gegen die Szene, nicht gegen Hindernisse)
     playerReadable     Kopf und Brust im Bild und frei - roh, und
                        "durch den Fade" (erster Treffer ist ein gerade
                        ausgeduenntes Objekt)
     occluderSwitches   Fade ein/aus je Sekunde
     maxCameraJump      groesster Kamerasprung je Bild
     playerFramed       Kopf, Brust und Becken im Bild, nicht am aeussersten
                        Rand (d.figurRahmen)
   Dazu Zeichenaufrufe, Materialien, Szenenobjekte mit und ohne Fade.

   Aufruf:  node tools/pruef/kamera-fade.js [fadeAlt] [poseAlt] [fadeMin=0.35] [bilder=ordner] [video]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ALT = process.argv.indexOf('fadeAlt') > 0;
/* poseAlt: Blickpunkt auf fester Hoehe (Stand vor KAM_POSE in game.js). */
const POSE_ALT = process.argv.indexOf('poseAlt') > 0;
const mArg = process.argv.find((v) => v.indexOf('fadeMin=') === 0);
const MIN = mArg === undefined ? undefined : +mArg.slice(8);
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
const VIDEO = process.argv.some((v) => v === 'video' || v.indexOf('video=') === 0);
/* video=St9-Ri3: der Fall fuer das Video (Standard: der Pflichtfall) */
const vArg = process.argv.find((v) => v.indexOf('video=') === 0);
const VIDEO_LAGE = vArg === undefined ? 'St9-Ri0' : vArg.slice(6);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

/* Gemessen mit kamera-restfaelle.js ruhe=... (Stand a7e1e20 + Messhaken). */
const LAGEN = [
  { name: 'St9-Ri0', stelle: 9, ri: 0, pos: [-308.324, 33.16, -13.3456], facing: 3.14035, gier: 0, neig: -0.179395 },
  { name: 'St9-Ri1', stelle: 9, ri: 1, pos: [-308.5365, 33.16, -10.7215], facing: -1.57159, gier: 1.57, neig: -0.179395 },
  { name: 'St9-Ri2', stelle: 9, ri: 2, pos: [-308.3769, 33.16, -10.1103], facing: -0.00159, gier: 3.14, neig: -0.179395 },
  { name: 'St9-Ri3', stelle: 9, ri: 3, pos: [-307.5165, 33.16, -10.6158], facing: 1.56841, gier: 4.71, neig: -0.179395 },
  { name: 'St7-Ri0', stelle: 7, ri: 0, pos: [-307.205, 33.87, 5.2896], facing: 3.14072, gier: 0, neig: -0.179395 },
  { name: 'St11-Ri0', stelle: 11, ri: 0, pos: [-291.379, 32.22, -2.9584], facing: 3.13863, gier: 0, neig: -0.179395 },
  { name: 'St11-Ri1', stelle: 11, ri: 1, pos: [-292.8288, 32.22, -0.8894], facing: -1.57159, gier: 1.57, neig: -0.179395 },
];

(async () => {
  const opt = {};
  if (ALT) opt.fadeAlt = true;
  if (POSE_ALT) opt.kamPoseAlt = true;
  if (MIN !== undefined) opt.fadeMin = MIN;
  const { b, page } = await starte(1280, 720, 4711, opt);
  const aus = await page.evaluate(async (O) => {
    const d = __dbg, P = d.player;
    d.frier(true); d.setzeRegen(0);
    const SLAB_H = 0.25;
    const PUNKTE = ['head', 'spine2', 'hips', 'leftarm', 'rightarm'];
    const los = () => { for (const k of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space']) d.taste(k, false); };
    /* Die Dachstellen wie in kamera-restfaelle.js */
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const stellen = [];
    for (const o of d.hausModelle()) {
      const K = o.userData && o.userData.hausKiste;
      if (!K || K.h < 12 || stellen.length >= 12) continue;
      let koll = null;
      for (const c of d.colliderNah(K.x, K.z))
        if (fest(c) && Math.abs(c.x0 - (K.x - K.w / 2)) < 0.05 && Math.abs(c.z0 - (K.z - K.d / 2)) < 0.05) { koll = c; break; }
      if (!koll) continue;
      let krone = null, hoeher = null;
      for (const c of d.colliderNah(K.x, K.z)) {
        if (c === koll) continue;
        if (c.klein && c.y0 !== undefined && c.y0 > SLAB_H + K.h - 1) krone = c.id;
        if (fest(c) && (c.h || 0) > (koll.h || 0) + 4) hoeher = c.id;
      }
      if (!krone && !hoeher) continue;
      const st = d.freierDachpunkt(K.x, K.z, SLAB_H + K.h, koll.x0, koll.x1, koll.z0, koll.z1);
      stellen.push({ x: st[0], z: st[1], h: K.h, dach: [koll.x0, koll.x1, koll.z0, koll.z1] });
    }
    /* Ein Bild auswerten */
    const probe = (st) => {
      const fz = d.fadeZustand();
      const ks = d.koerperSicht(PUNKTE);
      const gefadet = new Map(fz.aktiv.map((a) => [a.id, a.wert]));
      /* welche Objekte trifft ein Strahl Kamera -> Koerperpunkt zuerst? */
      const getroffen = new Set();
      let rohLesbar = true, fadeLesbar = true;
      for (const q of ['head', 'spine2']) {
        const k = ks.punkte[q];
        if (!k || !k.imBild) { rohLesbar = false; fadeLesbar = false; continue; }
        if (!k.frei) {
          rohLesbar = false;
          const id = k.wer && (k.wer.dachProp ? k.wer.dachProp.koll : k.wer.dachleben ? k.wer.dachleben.koll : null);
          if (!(id !== null && gefadet.has(id) && gefadet.get(id) <= fz.min + 0.05)) fadeLesbar = false;
        }
      }
      for (const q of PUNKTE) {
        const k = ks.punkte[q];
        if (k && k.wer) {
          const id = k.wer.dachProp ? k.wer.dachProp.koll : k.wer.dachleben ? k.wer.dachleben.koll : null;
          if (id !== null) getroffen.add(id);
        }
      }
      let falsch = 0;
      /* Nur was gerade AUSGEDUENNT wird (Ziel), nicht was zurueckblendet. */
      for (const a of fz.aktiv) if (a.ziel && a.wert < 0.95 && !getroffen.has(a.id)) falsch++;
      st.proben++;
      /* playerFramed (d.figurRahmen): Kopf, Brust, Becken im Bild und
         nicht im aeussersten Zwanzigstel am Rand. */
      const fr = d.figurRahmen();
      if (fr && fr.gerahmt) st.gerahmt++;
      if (rohLesbar) st.rohLesbar++;
      if (fadeLesbar) st.fadeLesbar++;
      if (falsch) st.wrongObjectFaded++;
      for (const a of fz.aktiv) st.objekte.add(a.id + ' (' + a.art + ')');
      st.minWert = Math.min(st.minWert, ...fz.aktiv.map((a) => a.wert), 1);
      return fz;
    };
    const lauf = (L, art) => {
      los();
      const st = { name: L.name, art, proben: 0, rohLesbar: 0, fadeLesbar: 0, wrongObjectFaded: 0, gerahmt: 0,
                   objekte: new Set(), minWert: 1, maxSprung: 0, fadeVorher: 0, wechselVorher: 0,
                   bilder: [] };
      const S = stellen[L.stelle];
      if (art === 'nachgestellt') {
        d.setzePos(L.pos[0], L.pos[1], L.pos[2]);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null; P.facing = L.facing;
        d.kamStart(L.gier, L.neig);
      } else {
        d.setzePos(S.x, SLAB_H + S.h + 0.1, S.z);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null; P.facing = L.ri * Math.PI / 2;
        d.kamStart(L.ri * Math.PI / 2);
      }
      const f0 = d.fadeZustand();
      st.fadeVorher = f0.ausgeloest; st.wechselVorher = f0.wechsel;
      let laeuft = art === 'lauf';
      if (laeuft) d.taste('KeyW', true);
      let vor = null;
      const N = art === 'lauf' ? 300 : 180;
      for (let i = 0; i < N; i++) {
        const DK = S.dach;
        if (laeuft && Math.min(P.pos.x - DK[0], DK[1] - P.pos.x, P.pos.z - DK[2], DK[3] - P.pos.z) < 1.5) {
          d.taste('KeyW', false); laeuft = false;
        }
        d.schritt(1 / 60);
        const k = d.kamera();
        if (vor) st.maxSprung = Math.max(st.maxSprung, Math.hypot(k.pos[0] - vor[0], k.pos[1] - vor[1], k.pos[2] - vor[2]));
        vor = k.pos;
        if (i % 6 === 0) probe(st);
      }
      los();
      const f1 = d.fadeZustand();
      st.fadeTriggered = f1.ausgeloest - st.fadeVorher;
      st.occluderSwitchesJeSek = +((f1.wechsel - st.wechselVorher) / (N / 60)).toFixed(2);
      st.objekte = [...st.objekte];
      st.maxSprung = +st.maxSprung.toFixed(3);
      st.minWert = +st.minWert.toFixed(3);
      if (O.bilder) st.bild = d.bildDaten(0.85);
      st.kosten = d.renderKosten();
      return st;
    };
    const erg = [];
    for (const L of O.lagen) erg.push(lauf(L, 'nachgestellt'));
    for (const L of O.lagen) erg.push(lauf(L, 'lauf'));
    /* ---- Video: Pflichtfall, 2 s stehen (Fade ein), dann seitlich
       heraus (Fade aus) ---- */
    const video = [];
    if (O.video) {
      const L = O.lagen.find((q) => q.name === O.videoLage) || O.lagen[0];
      los();
      d.setzePos(L.pos[0], L.pos[1], L.pos[2]);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true; P.facing = L.facing;
      d.kamStart(L.gier, L.neig);
      for (let i = 0; i < 240; i++) {
        if (i === 120) d.taste('KeyD', true);
        if (i === 200) d.taste('KeyD', false);
        d.schritt(1 / 60);
        if (i % 2 === 0) video.push(d.bildDaten(0.75));
      }
      los();
    }
    return { erg, video };
  }, { lagen: LAGEN, bilder: !!BILDER, video: VIDEO, videoLage: VIDEO_LAGE });
  await b.close();
  const tag = (ALT ? 'ohneFade' : 'fade' + (MIN === undefined ? '' : MIN)) + (POSE_ALT ? '-poseAlt' : '');
  console.log('\n== Kamera-Fade (' + tag + ') ==');
  console.log('  Fall        Art           fadeTriggered  Objekte                    min Fade  wrongObjectFaded  roh lesbar  durch Fade lesbar  playerFramed  Wechsel/s  maxSprung  Aufrufe  Materialien  Objekte');
  for (const e of aus.erg) {
    console.log('  ' + e.name.padEnd(11) + ' ' + e.art.padEnd(13) + String(e.fadeTriggered).padStart(14) + '  ' +
                JSON.stringify(e.objekte).padEnd(26) + String(e.minWert).padStart(9) +
                String(e.wrongObjectFaded).padStart(18) + String(e.rohLesbar + '/' + e.proben).padStart(12) +
                String(e.fadeLesbar + '/' + e.proben).padStart(19) + String(e.gerahmt + '/' + e.proben).padStart(14) +
                String(e.occluderSwitchesJeSek).padStart(11) +
                String(e.maxSprung).padStart(11) + String(e.kosten.calls).padStart(9) +
                String(e.kosten.materialien).padStart(13) + String(e.kosten.objekte).padStart(9));
    if (BILDER && e.bild)
      fs.writeFileSync(path.join(BILDER, tag + '-' + e.name + '-' + e.art + '.jpg'), Buffer.from(e.bild.split(',')[1], 'base64'));
  }
  if (BILDER && aus.video.length) {
    const dir = path.join(BILDER, tag + '-video-' + VIDEO_LAGE);
    fs.mkdirSync(dir, { recursive: true });
    aus.video.forEach((u, i) => fs.writeFileSync(path.join(dir, String(i).padStart(4, '0') + '.jpg'),
      Buffer.from(u.split(',')[1], 'base64')));
  }
})();
