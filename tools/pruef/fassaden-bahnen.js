/* Qualitaets-Pass, Endabnahme: Kletterbahnen an Fassadenstellen (frueher
   Leuchttafeln) - klettert die Figur an der SICHTBAREN Fassade?

   Je Rechteck drei Bahnen mit echten Tasten: hoch (W, von 2,2 m unter bis
   ueber das Rechteck), runter (S, von oben durch), quer (A/D in
   Brusthoehe von 1,5 m links bis 1,5 m rechts daneben). Je <jede> Bilder:
     fassBrust / fassBecken  Brust (spine2) bzw. Becken (hips) liegen
                hinter einer sichtbaren Flaeche des Hausmodells (Strahl
                von 3 m aussen); Ausnahme Anbau wie kletterproxy.js:
                dahinter steht innerhalb 0,75 m eine Wand
     Sprung     groesster Satz der Lage zur Kolliderebene von Bild zu Bild
     steht      laengster Stillstand (Bilder), Ende ziel / zustand / null
   Die Werte brustHinter, beckenHinter, knieHinter, schnitt beziehen sich
   auf die Ebene des Rechtecks - nur mit Tafel sinnvoll.
   Mit render=1 zusaetzlich der verdeckte Anteil der Figur (Bildvergleich),
   mit foto=1 beim ersten Fassadentreffer (oder mit fotobild=<n> bei Bild n)
   zwei Aufnahmen (Spielkamera, seitlich), danach endet die Bahn.

   rechtecke=<json>: [{id (Kollider), typ, seite [nx,nz], x [x0,x1], y [y0,y1],
   z [z0,z1]}]. Ohne rechtecke werden die Tafeln aus der Leuchtreklame
   gelesen - nur mit schalter=neonAn (Pruefschalter, alte Tafeln).
   Daten in fassaden-bahnen/: pflicht.json (die neun Pflicht-Schilder der
   Neon-Overlay-Stufe), rechtecke-pflicht.json (ihre Tafelrechtecke),
   rechtecke-verschoben.json (dieselben Fassaden 2,2 bis 6 m daneben),
   rechtecke-brutal.json (Mitte von 32 tafelfreien Brutal_1-Seiten).

   Aufruf (aus dem Spielordner):
     node tools/pruef/fassaden-bahnen.js <ordner> liste=tools/pruef/fassaden-bahnen/pflicht.json
          rechtecke=tools/pruef/fassaden-bahnen/rechtecke-pflicht.json [render=0] [jede=3]
          [bahnen=hoch,runter,quer] [schalter=neonAn] [foto=1] [fotobild=<n>] [fotobahn=<id><bahn>]
          [breit=640] [hoch=360]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { starte } = require('./basis');
const ziel = process.argv[2];
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const LISTE = JSON.parse(fs.readFileSync(arg('liste', ''), 'utf8'));
const BAHNEN = arg('bahnen', 'hoch,runter,quer').split(',');
const FOTO_BILD = +arg('fotobild', -1), FOTO_BAHN = arg('fotobahn', ''), FOTO = arg('foto', '') === '1' || FOTO_BILD >= 0;
const JEDE = +arg('jede', 6), BREIT = +arg('breit', 640), HOCH = +arg('hoch', 360), BILDER = +arg('bilder', 1), RENDER = +arg('render', 1);
const [TEIL, TEILE] = arg('teil', '0/1').split('/').map(Number);
const SCHALTER = {};
for (const k of arg('schalter', '').split(',').filter(Boolean)) SCHALTER[k] = true;
fs.mkdirSync(ziel, { recursive: true });
async function roh(buf) { const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, w: info.width, h: info.height }; }
function anteile(N, H, O) {
  const hg = [H.data[0], H.data[1], H.data[2]];
  const m0 = new Uint8Array(N.w * N.h);
  for (let q = 0; q < N.w * N.h; q++) if (Math.abs(H.data[q * 3] - hg[0]) + Math.abs(H.data[q * 3 + 1] - hg[1]) + Math.abs(H.data[q * 3 + 2] - hg[2]) > 12) m0[q] = 1;
  let mz = 0, n = 0, neon = 0;
  const weg = (X, q) => Math.max(Math.abs(X.data[q * 3] - H.data[q * 3]), Math.abs(X.data[q * 3 + 1] - H.data[q * 3 + 1]), Math.abs(X.data[q * 3 + 2] - H.data[q * 3 + 2])) > 24;
  for (let y = 2; y < N.h - 2; y++) for (let x = 2; x < N.w - 2; x++) {
    let ok = 1;
    for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) if (!m0[(y + dy) * N.w + x + dx]) { ok = 0; break; }
    if (!ok) continue;
    mz++;
    const q = y * N.w + x;
    const wN = weg(N, q);
    if (wN) { n++; if (!weg(O, q)) neon++; }
  }
  return { mz, a: mz ? n / mz : 0, neon: mz ? neon / mz : 0 };
}

(async () => {
  const { b, page } = await starte(BREIT, HOCH, 4711, SCHALTER);
  const RECHTECKE = arg('rechtecke', ''), DUMP = arg('dump', '');
  const schilder = RECHTECKE ? (await page.evaluate(() => { window.__neon = { visible: true }; }), JSON.parse(fs.readFileSync(RECHTECKE, 'utf8')))
                             : await page.evaluate((LISTE) => {
    const d = __dbg;
    d.frier(true);
    const NEON = [0xff2d55, 0x18d7ff, 0xff45c8, 0xffb020, 0x36ff7a, 0xf5f1ff];
    let neon = null;
    d.szene.traverse((k) => {
      if (neon || !k.isMesh || !k.material || k.material.type !== 'MeshBasicMaterial' || !k.material.vertexColors) return;
      const co = k.geometry.attributes.color; if (!co) return;
      const hex = (Math.round(co.getX(0) * 255) << 16) | (Math.round(co.getY(0) * 255) << 8) | Math.round(co.getZ(0) * 255);
      if (k.geometry.attributes.position.count % 24 === 0 && NEON.includes(hex)) neon = k;
    });
    window.__neon = neon;
    const p = neon.geometry.attributes.position, col = neon.geometry.attributes.color;
    const typ = new Map();
    for (const o of d.hausModelle()) { const K = o.userData.hausKiste; if (K && K.koll) typ.set(K.koll, o.userData.modellName); }
    const aus = [];
    for (let s = 0; s < p.count; s += 24) {
      const hex = (Math.round(col.getX(s) * 255) << 16) | (Math.round(col.getY(s) * 255) << 8) | Math.round(col.getZ(s) * 255);
      if (hex === 0x14161a) continue;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let i = s; i < s + 24; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const L = LISTE.find((q) => Math.abs(q.y0 - y0) < 0.06);
      if (!L) continue;
      let haus = null;
      for (const c of d.colliderNah((x0 + x1) / 2, (z0 + z1) / 2)) {
        if (c.klein || c.dachProp || c.parkAuto || c.innen || !(c.h > 3) || c.bau !== c) continue;
        for (const [nx, nz, ab] of [[-1, 0, c.x0 - x1], [1, 0, x0 - c.x1], [0, -1, c.z0 - z1], [0, 1, z0 - c.z1]]) {
          if (ab < -2.5 || ab > 0.3) continue;
          const laengs = nx !== 0 ? (z0 >= c.z0 - 0.01 && z1 <= c.z1 + 0.01) : (x0 >= c.x0 - 0.01 && x1 <= c.x1 + 0.01);
          if (laengs && (nx !== 0 ? x1 - x0 : z1 - z0) < 0.2) { haus = { c, nx, nz }; break; }
        }
        if (haus) break;
      }
      if (!haus) continue;
      if (!LISTE.some((q) => q.id === haus.c.id && q.seite[0] === haus.nx && q.seite[1] === haus.nz && Math.abs(q.y0 - y0) < 0.06)) continue;
      aus.push({ id: haus.c.id, typ: typ.get(haus.c) || 'prozedural/Turm', seite: [haus.nx, haus.nz], x: [x0, x1], y: [y0, y1], z: [z0, z1] });
    }
    return aus;
  }, LISTE);
  if (DUMP) fs.writeFileSync(DUMP, JSON.stringify(schilder));
  let wahl = schilder.sort((a, c) => a.id - c.id || a.y[0] - c.y[0]).filter((s, i) => i % TEILE === TEIL);
  await page.evaluate((r) => { window.__bnRender = !!r; }, RENDER);
  console.log('neonStand ' + JSON.stringify(await page.evaluate(() => __dbg.neonStand())));
  console.log('Schilder ' + wahl.length + ' von Liste ' + LISTE.length + ' (Teil ' + TEIL + '/' + TEILE + ')');
  const erg = [];
  for (const S of wahl) for (const bahn of BAHNEN) {
    /* Start mit Rueckfall: liegt der erste Startpunkt vor einem Loch
       (Arkadenoeffnung), kommt die Figur dort nicht weg - im Spiel kann
       man dort auch nicht ankleben. Dann naeher ans Schild. */
    let vor = null, versuch = -1;
    const einrichten = (v) => page.evaluate((a) => {
      const { S, bahn } = a, vv = a.v;
      window.__bnHaus = null;                // Hausmeshes je Schild neu suchen
      const d = __dbg, P = d.player;
      d.frier(true); d.setzeRegen(0); d.kamNah(0);
      d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
      for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ']) d.taste(t, false);
      window.__setzeZeit(0.44);
      const c = d.colliders.find((q) => q.id === S.id);
      const [nx, nz] = S.seite, ax = nx !== 0;
      const ebene = nx > 0 ? c.x1 : nx < 0 ? c.x0 : nz > 0 ? c.z1 : c.z0;
      const lr = ax ? S.z : S.x, lm = (lr[0] + lr[1]) / 2, ym = (S.y[0] + S.y[1]) / 2;
      const setze = (l, y) => {
        d.setzePos(ax ? ebene + nx * 0.15 : l, y, ax ? l : ebene + nz * 0.15);
        P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
        P.wallInfo = P.wall = { nx, nz, col: c };
        P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
        P.hautTiefe = 0; P.eckBogen = null; P.eckT = 0;
        d.kamStart(Math.atan2(nx, nz), 0.1);
      };
      let taste = 'KeyW', start;
      if (bahn === 'hoch') { start = [lm, S.y[0] - [2.2, 1.0, -0.3][vv]]; taste = 'KeyW'; }
      else if (bahn === 'runter') { start = [lm, S.y[1] + [1.5, 0.9, 0.3][vv]]; taste = 'KeyS'; }
      else {
        /* quer: Brust (pos.y + 0,36) auf Schildmitte. D fuehrt laengs
           (nz, 0, -nx) (gemessen: an einer Ostwand nach -z, an einer
           Nordwand nach -x); welche Taste geht nach +t? */
        taste = (ax ? nx < 0 : nz > 0) ? 'KeyD' : 'KeyA';
        start = [lr[0] - [1.5, 0.8, 0.2][vv], ym - 0.36];
      }
      setze(start[0], start[1]);
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      const hero = d.heroVisual.root, neon = window.__neon;
      const rel = (v) => nx > 0 ? v.x - ebene : nx < 0 ? ebene - v.x : nz > 0 ? v.z - ebene : ebene - v.z;
      const lat = (v) => ax ? v.z : v.x;
      const front = nx > 0 ? S.x[1] - ebene : nx < 0 ? ebene - S.x[0] : nz > 0 ? S.z[1] - ebene : ebene - S.z[0];
      const rueck = nx > 0 ? S.x[0] - ebene : nx < 0 ? ebene - S.x[1] : nz > 0 ? S.z[0] - ebene : ebene - S.z[1];
      const imR = (v) => lat(v) >= lr[0] && lat(v) <= lr[1] && v.y >= S.y[0] && v.y <= S.y[1];
      const v = new THREE.Vector3();
      window.__bn = { front, rueck,
        nurHero() { this.sicht = d.szene.children.map((q) => q.visible); d.szene.children.forEach((q) => { if (!q.isLight) q.visible = q === hero; }); },
        zurueck() { d.szene.children.forEach((q, i) => { q.visible = this.sicht[i]; }); },
        ohneNeon(an) { neon.visible = !an; },
        lage() {
          const ohne = d.hautFlaecheAn(c, nx, nz, P.pos.y, lat(P.pos), true).r, mit = d.hautFlaecheAn(c, nx, nz, P.pos.y, lat(P.pos), false).r;
          return { rel: rel(P.pos), haut: P.hautTiefe || 0, t: lat(P.pos), y: P.pos.y, zustand: P.state, ueber: ohne !== mit ? 1 : 0 };
        },
        koerper() {
          const kn = d.heroVisual.laborKnochen(['spine2', 'hips', 'leftleg', 'rightleg']), k = {};
          for (const [n, q] of Object.entries(kn)) { const w = new THREE.Vector3(q.x, q.y, q.z); k[n] = { rel: rel(w), im: imR(w) }; }
          const z = { vor: 0, tief: 0, hinter: 0, kontaktTief: 0, kontaktMin: null, n: 0, tiefster: null };
          hero.updateMatrixWorld(true);
          hero.traverse((m) => {
            if (!m.isMesh || !m.visible || !m.geometry || !m.geometry.attributes.position) return;
            const pa = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
            for (let i = 0; i < pa.count; i += 2) {
              if (m.isSkinnedMesh && si) { m.boneTransform(i, v); v.applyMatrix4(m.matrixWorld); }
              else v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
              if (!imR(v)) continue;
              let kontakt = false;
              if (m.isSkinnedMesh && si) {
                const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
                let best = 0, bi = 0; for (let j = 0; j < 4; j++) if (ws[j] > best) { best = ws[j]; bi = is[j]; }
                kontakt = /hand|finger|thumb|index|middle|ring|pinky|foot|toe/.test((m.skeleton.bones[bi].name || '').toLowerCase().replace(/[^a-z]/g, ''));
              }
              const t = rel(v);
              if (kontakt) { if (t < rueck - 0.02) z.kontaktTief++; if (z.kontaktMin === null || t < z.kontaktMin) z.kontaktMin = t; continue; }
              z.n++;
              if (t > front) z.vor++;
              if (t < rueck) z.hinter++;
              if (t < rueck - 0.02) z.tief++;
              if (z.tiefster === null || t < z.tiefster) z.tiefster = t;
            }
          });
          /* Qualitaets-Pass: Brust/Becken hinter der SICHTBAREN Fassade
             (Strahl von aussen gegen die Meshes des Hausmodells, Ausnahme
             Anbau wie kletterproxy.js: Flaeche <= 0,1 m hinter der Kiste
             und dahinter innerhalb 0,75 m eine Wand). Ohne Modell
             (prozedurales Haus, Turm) ist die Fassade die Kiste:
             hinter = mehr als 2 cm hinter der Kolliderebene. */
          if (!window.__bnHaus) {
            window.__bnHaus = [];
            for (const o of d.hausModelle()) { const K = o.userData.hausKiste; if (K && K.koll === c) o.traverse((m) => { if (m.isMesh) window.__bnHaus.push(m); }); }
          }
          const kf = d.animKnochen(['spine2', 'hips']), RC = new THREE.Raycaster();
          const fass = { brust: 0, becken: 0, anbau: 0 };
          for (const [q, kk] of [['brust', kf.spine2], ['becken', kf.hips]]) {
            if (!kk) continue;
            const w = new THREE.Vector3(kk.x, kk.y, kk.z);
            if (!window.__bnHaus.length) { if (rel(w) < -0.02) fass[q] = 1; continue; }
            RC.set(new THREE.Vector3(kk.x + nx * 3, kk.y, kk.z + nz * 3), new THREE.Vector3(-nx, 0, -nz)); RC.near = 0; RC.far = 3 - 0.02;
            const vorn = RC.intersectObjects(window.__bnHaus, false);
            if (!vorn.length) continue;
            RC.set(w, new THREE.Vector3(-nx, 0, -nz)); RC.near = 0; RC.far = 0.75;
            const wand = RC.intersectObjects(window.__bnHaus, false).length > 0;
            if (vorn[0].distance - 3 <= 0.1 && wand) fass.anbau = 1; else fass[q] = 1;
          }
          /* Knie = Ursprung des Unterschenkelknochens (leftleg/rightleg) */
          const knieH = (q) => q.im && q.rel < front;
          return { brustHinter: k.spine2.im && k.spine2.rel < front ? 1 : 0, beckenHinter: k.hips.im && k.hips.rel < front ? 1 : 0,
                   knieHinter: knieH(k.leftleg) || knieH(k.rightleg) ? 1 : 0,
                   brust: +k.spine2.rel.toFixed(3), becken: +k.hips.rel.toFixed(3), brustIm: k.spine2.im, beckenIm: k.hips.im,
                   knieL: +k.leftleg.rel.toFixed(3), knieR: +k.rightleg.rel.toFixed(3), knieIm: (k.leftleg.im ? 1 : 0) + (k.rightleg.im ? 1 : 0),
                   schnitt: z.vor > 0 && z.tief > 0 ? 1 : 0, rumpfIm: z.n, rumpfHinter: z.hinter, rumpfTief: z.tief, kontaktTief: z.kontaktTief,
                   tiefster: z.tiefster === null ? null : +z.tiefster.toFixed(3),
                   kontaktHinterRueck: z.kontaktMin === null ? 0 : +Math.max(0, rueck - z.kontaktMin).toFixed(3),
                   fassBrust: fass.brust, fassBecken: fass.becken, fassAnbau: fass.anbau };
        } };
      d.taste(taste, true);
      return { taste, front, rueck, ende: bahn === 'hoch' ? S.y[1] + 1.3 : bahn === 'runter' ? S.y[0] - 2.0 : lr[1] + 1.5, lr, ax };
    }, { S, bahn, v });
    for (let v = 0; v < 3 && !vor; v++) {
      const x = await einrichten(v);
      /* kommt sie vom Fleck? 30 Bilder Probe (Soll 1,3 m), verlangt 0,8 m */
      const p0 = await page.evaluate(() => window.__bn.lage());
      let p1 = p0;
      for (let i = 0; i < 30; i++) p1 = await page.evaluate(() => { __dbg.schritt(1 / 60); return window.__bn.lage(); });
      const weg = bahn === 'hoch' ? p1.y - p0.y : bahn === 'runter' ? p0.y - p1.y : p1.t - p0.t;
      await page.evaluate((t) => { __dbg.taste(t, false); }, x.taste);
      /* Probe bestanden: noch einmal an denselben Start, dann die ganze Bahn messen */
      if (weg >= 0.8 && p1.zustand === 'climb') { vor = await einrichten(v); versuch = v; }
    }
    if (!vor) {
      erg.push({ id: S.id, typ: S.typ, seite: S.seite, y: [+S.y[0].toFixed(2), +S.y[1].toFixed(2)], bahn, ende: 'kein Start', proben: 0, verlauf: [] });
      console.log((S.id + ' ' + S.seite.join(',') + ' y' + S.y[0].toFixed(1) + ' ' + bahn).padEnd(24) + ' kein Start (drei Startpunkte, Figur kommt nicht weg)');
      continue;
    }
    const proben = [], bilder = [];
    let ende = null;
    for (let f = 0; f < 420; f++) {
      const messen = f % JEDE === 0;
      const st = await page.evaluate((m) => { const d = __dbg; d.schritt(1 / 60);
        const l = window.__bn.lage();
        if (m) { if (window.__bnRender) d.zeichne(); l.k = window.__bn.koerper(); }
        return l; }, messen);
      const q = { f, rel: +st.rel.toFixed(4), haut: +st.haut.toFixed(4), t: +st.t.toFixed(3), y: +st.y.toFixed(3), zustand: st.zustand, ueber: st.ueber };
      if (messen && !RENDER) Object.assign(q, st.k, { maske: 999, a: 0, neon: 0 });
      const fotoJetzt = FOTO && messen && (!FOTO_BAHN || FOTO_BAHN === S.id + bahn) && (FOTO_BILD >= 0 ? f === FOTO_BILD : (st.k && (st.k.fassBrust || st.k.fassBecken)));
      if (fotoJetzt) {
        const name = S.id + '_' + bahn + '_f' + f;
        await page.evaluate(() => { __dbg.zeichne(); });
        fs.writeFileSync(path.join(ziel, name + '_spiel.jpg'), await sharp(await page.screenshot()).jpeg({ quality: 88 }).toBuffer());
        const kam = await page.evaluate(({ S }) => {
          const d = __dbg, kn = d.heroVisual.laborKnochen(['spine2']).spine2, [nx, nz] = S.seite;
          const tx = nz, tz = -nx;
          const k = [kn.x + nx * 1.6 + tx * 1.9, kn.y + 0.5, kn.z + nz * 1.6 + tz * 1.9, kn.x, kn.y - 0.1, kn.z];
          d.aufnahme(k[0], k[1], k[2], k[3], k[4], k[5]); d.aufnahme(k[0], k[1], k[2], k[3], k[4], k[5]);
          return k;
        }, { S });
        fs.writeFileSync(path.join(ziel, name + '_seite.jpg'), await sharp(await page.screenshot()).jpeg({ quality: 88 }).toBuffer());
        console.log('FOTO ' + name + ' brust ' + (st.k && st.k.brust) + ' becken ' + (st.k && st.k.becken) + ' fass ' + (st.k && st.k.fassBrust) + '/' + (st.k && st.k.fassBecken) + ' rel ' + q.rel + ' kam ' + JSON.stringify(kam.map((v) => +v.toFixed(2))));
        proben.push(q); ende = 'foto'; break;
      }
      if (messen && RENDER) {
        const bN = await page.screenshot();
        await page.evaluate(() => { window.__bn.nurHero(); __dbg.zeichne(); });
        const bH = await page.screenshot();
        await page.evaluate(() => { window.__bn.zurueck(); window.__bn.ohneNeon(true); __dbg.zeichne(); });
        const bO = await page.screenshot();
        await page.evaluate(() => { window.__bn.ohneNeon(false); });
        const r = anteile(await roh(bN), await roh(bH), await roh(bO));
        Object.assign(q, st.k, { maske: r.mz, a: +r.a.toFixed(3), neon: +r.neon.toFixed(3) });
        if (BILDER && (r.neon > 0.05 || st.k.schnitt || st.k.brustHinter || st.k.beckenHinter || st.k.knieHinter) && bilder.length < 3) {
          const name = S.id + '_' + S.seite.join('') + '_y' + S.y[0].toFixed(1) + '_' + bahn + '_' + f + '.jpg';
          fs.writeFileSync(path.join(ziel, name), await sharp(bN).jpeg({ quality: 85 }).toBuffer());
          bilder.push(name);
        }
      }
      proben.push(q);
      const fort = bahn === 'hoch' ? st.y : bahn === 'runter' ? -st.y : st.t;
      const zielW = bahn === 'runter' ? -vor.ende : vor.ende;
      if (fort > zielW || st.zustand !== 'climb') { ende = st.zustand !== 'climb' ? 'zustand ' + st.zustand : 'ziel'; break; }
    }
    await page.evaluate((t) => { __dbg.taste(t, false); }, vor.taste);
    /* Auswertung */
    const g = proben.filter((q) => q.maske !== undefined && q.maske > 150 && q.zustand === 'climb');
    let maxSprung = 0, stehen = 0, maxStehen = 0;
    for (let i = 1; i < proben.length; i++) {
      const a = proben[i - 1], c = proben[i];
      if (c.zustand !== 'climb' || a.zustand !== 'climb') continue;
      maxSprung = Math.max(maxSprung, Math.abs(c.rel - a.rel));
      const fort = bahn === 'quer' ? Math.abs(c.t - a.t) : Math.abs(c.y - a.y);
      if (fort < 0.002) { stehen++; maxStehen = Math.max(maxStehen, stehen); } else stehen = 0;
    }
    const r = { id: S.id, typ: S.typ, seite: S.seite, y: [+S.y[0].toFixed(2), +S.y[1].toFixed(2)], bahn, versuch, taste: vor.taste, front: +vor.front.toFixed(3), rueck: +vor.rueck.toFixed(3),
                bilder: proben.length, proben: g.length, ende,
                maxA: g.length ? Math.max(...g.map((q) => q.a)) : 0, maxNeon: g.length ? Math.max(...g.map((q) => q.neon)) : 0,
                neonUeber5: g.filter((q) => q.neon > 0.05).length, neonUeber10: g.filter((q) => q.neon > 0.1).length, neonUeber20: g.filter((q) => q.neon > 0.2).length,
                brustHinter: g.filter((q) => q.brustHinter).length, beckenHinter: g.filter((q) => q.beckenHinter).length, knieHinter: g.filter((q) => q.knieHinter).length,
                schnitt: g.filter((q) => q.schnitt).length, kontaktTief: g.filter((q) => q.kontaktTief > 0).length,
                kontaktMaxTiefe: g.length ? Math.max(...g.map((q) => q.kontaktHinterRueck || 0)) : 0,
                fassBrust: g.filter((q) => q.fassBrust).length, fassBecken: g.filter((q) => q.fassBecken).length, fassAnbau: g.filter((q) => q.fassAnbau).length,
                maxSprung: +maxSprung.toFixed(4), maxStehen, ueberBilder: proben.filter((q) => q.ueber).length, relMin: Math.min(...proben.map((q) => q.rel)), relMax: Math.max(...proben.map((q) => q.rel)),
                fotos: bilder };
    erg.push({ ...r, verlauf: proben });
    fs.writeFileSync(path.join(ziel, 'bahn-' + TEIL + '.json'), JSON.stringify(erg));
    console.log((S.id + ' ' + S.seite.join(',') + ' y' + S.y[0].toFixed(1) + ' ' + bahn).padEnd(24) + ' ' + S.typ.slice(0, 24).padEnd(24) +
      ' Proben ' + String(g.length).padEnd(3) + ' verdeckt max ' + String((r.maxA * 100).toFixed(0)).padStart(3) + ' %  Neon max ' + String((r.maxNeon * 100).toFixed(0)).padStart(3) + ' % (>10 %: ' + r.neonUeber10 + ')' +
      '  Fassade Brust/Becken ' + r.fassBrust + '/' + r.fassBecken + ' (Anbau ' + r.fassAnbau + ')' +
      '  Brust/Becken/Knie hinter ' + r.brustHinter + '/' + r.beckenHinter + '/' + r.knieHinter + '  Schnitt ' + r.schnitt + '  Kontakt tief ' + r.kontaktTief +
      '  Sprung ' + r.maxSprung.toFixed(3) + ' m  steht ' + r.maxStehen + '  rel ' + r.relMin.toFixed(2) + '..' + r.relMax.toFixed(2) + '  Overlay ' + r.ueberBilder + '/' + r.bilder + '  Start ' + versuch + '  Ende ' + ende);
  }
  fs.writeFileSync(path.join(ziel, 'bahn-' + TEIL + '.json'), JSON.stringify(erg));
  const s2 = (f) => erg.filter((r) => r.ende !== 'kein Start').filter(f).length;
  console.log('kein Start: ' + erg.filter((r) => r.ende === 'kein Start').length + ', Rueckfallstart: ' + erg.filter((r) => r.versuch > 0).length);
  console.log('\nBahnen ' + erg.length + ':  Neon >10 %: ' + s2((r) => r.neonUeber10 > 0) + '  >20 %: ' + s2((r) => r.neonUeber20 > 0) +
    '  Fassade Brust: ' + s2((r) => r.fassBrust > 0) + '  Fassade Becken: ' + s2((r) => r.fassBecken > 0) +
    '  Brust hinter: ' + s2((r) => r.brustHinter > 0) + '  Becken hinter: ' + s2((r) => r.beckenHinter > 0) + '  Knie hinter: ' + s2((r) => r.knieHinter > 0) + '  Schnitt: ' + s2((r) => r.schnitt > 0) +
    '  Sprung >0,11 m: ' + s2((r) => r.maxSprung > 0.11) + '  steht >30 Bilder: ' + s2((r) => r.maxStehen > 30) + '  Ende nicht Ziel: ' + s2((r) => r.ende !== 'ziel'));
  await b.close();
})();
