/* problem-3, Blocker 2: Kamera beim Ueberziehen an der Dachkante.

   Nachgestellt werden die ersten sechs Sekunden aus dem Human-Video:
   die Figur klettert die letzten Meter einer Fassade hinauf, zieht sich
   ueber die Kante und steht auf dem Dach. Je Haus (GLB-Modelle, eine
   Zeilenfassade, ein Turm, dazu der echte Weg vom Boden aus
   hausStellen[3], wie kamera-ziel.js "klettern") jedes Bild:

     imGebaeude      Kamera steckt in einem Kollider
     unterDach       Kamera liegt waagrecht ueber der SICHTBAREN
                     Grundflaeche des Hauses und tiefer als das Dach
     hinterFassade   Kamera liegt hinter der Fassadenebene (Abstand zur
                     Ebene < Kameraradius + 0,05) und nicht ueber dem Dach
     nahVoll         die Kamera steht naeher als 0,5 m an einer Kiste - das
                     Bild ist "voll Dachkante"
     unlesbar        Kopf oder Brust nicht im Bild (figurRahmen) oder die
                     Strecke Kamera-Kopf/Brust schneidet eine Kiste
     sprung          Kamera springt mehr als 0,6 m oder dreht sich mehr
                     als 12 Grad in einem Bild

   Die Stadt im Bild wird an den Bildern geprueft (bilder=...), nicht
   gezaehlt: Strahltests gegen die zusammengefassten Stadtmeshes kosten
   20 Minuten je Haus.

   Aufruf:  node tools/pruef/topout.js [bilder=ordner] [topAlt | vorausAlt] [nur=Name]
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
const ALT = process.argv.indexOf('topAlt') > 0;
/* spur=von,bis: Zustand von CLIMB_TOP_OUT je Bild ausgeben */
const spArg = process.argv.find((v) => v.indexOf('spur=') === 0);
const SPUR = spArg === undefined ? null : spArg.slice(5).split(',').map(Number);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });
const TYPEN = ['Downtown_PublicBuilding_1', 'Downtown_ModernOffice_2', 'Brownstone_Commercial_1_C',
               'Brownstone_FlatFacade_6', 'Brownstone_FlatFacade_1', 'Brownstone_Harlem_1'];

(async () => {
  const VALT = process.argv.indexOf('vorausAlt') > 0;
  const { b, page } = await starte(960, 540, 4711, ALT ? { topAlt: true } : VALT ? { topVorausAlt: true } : {});
  const faelle = await page.evaluate((T) => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
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
    const seiteFrei = (c, K) => {
      for (const [nx, nz] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
        let ok = true;
        for (const f of [0.3, 0.5, 0.7]) {
          const t = nx !== 0 ? c.z0 + (c.z1 - c.z0) * f : c.x0 + (c.x1 - c.x0) * f;
          for (const y of [c.h - 6, c.h - 2]) if (!frei1m(c, nx, nz, y, t)) ok = false;
        }
        if (ok) return [nx, nz];
      }
      return null;
    };
    const aus = [];
    const genommen = new Set();
    for (const o of d.hausModelle()) {
      const n = o.userData.modellName, K = o.userData.hausKiste, c = K && K.koll;
      if (!c || genommen.has(n) || (T.indexOf(n) < 0 && n !== 'Turm_1')) continue;
      if (c.h < 10) continue;
      const s = seiteFrei(c, K);
      if (!s) continue;
      genommen.add(n);
      aus.push({ name: n, koll: c.id, nx: s[0], nz: s[1] });
    }
    /* ---- Zusatzfall: schraege Rueckseite (problem-3, finaler Pass) ----
       ModernOffice_1 an seiner +z-Seite: die Fassade weicht schraeg bis
       2,9 m hinter die Kiste zurueck. Getrennt gezaehlt, nicht in der
       Summe der 8 Haeuser. (Das Haus aus dem Human-Video ist der Turm -
       Fall Turm_1.) */
    for (const o of d.hausModelle()) {
      const K = o.userData.hausKiste, c = K && K.koll;
      if (o.userData.modellName !== 'Downtown_ModernOffice_1' || !c || aus.some((a) => a.mensch)) continue;
      let ok = true;
      for (const f of [0.3, 0.5, 0.7]) {
        const t = c.x0 + (c.x1 - c.x0) * f;
        for (const y of [c.h - 6, c.h - 2]) if (!frei1m(c, 0, 1, y, t)) ok = false;
      }
      if (ok) aus.push({ name: 'Zusatz ModernOffice_1 +z schraeg', koll: c.id, nx: 0, nz: 1, mensch: true });
    }
    /* eine Zeilenfassade (prozedural oder Modell, wie zeilenuebergang.js) */
    for (const h of d.hausKisten()) {
      if (!h.zeile || h.h < 12 || aus.some((a) => a.zeile)) continue;
      const seite = h.zeile.split('|')[2];
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      let c = null;
      for (const q of d.colliderNah(h.x, h.z)) {
        if (q.klein || q.innen || q.parkAuto) continue;
        if (Math.abs((q.x0 + q.x1) / 2 - h.x) < 0.02 && Math.abs((q.z0 + q.z1) / 2 - h.z) < 0.02) { c = q; break; }
      }
      if (!c) continue;
      aus.push({ name: 'Zeile ' + (h.modell || 'prozedural'), koll: c.id, nx, nz, zeile: true });
    }
    return aus;
  }, TYPEN);
  faelle.push({ name: 'hausStellen3 vom Boden', boden: true });
  const nurArg = process.argv.find((v) => v.indexOf('nur=') === 0);
  if (nurArg) for (let k = faelle.length - 1; k >= 0; k--) if (faelle[k].name.indexOf(nurArg.slice(4)) < 0) faelle.splice(k, 1);

  const summe = { bilder: 0, imGebaeude: 0, unterDach: 0, hinterFassade: 0, nahVoll: 0, unlesbar: 0, sprung: 0 };
  let nr = 0;
  for (const F of faelle) {
    const r = await page.evaluate(async (F) => {
      const d = __dbg, P = d.player, cam = d.camera;
      const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'KeyZ', 'Space', 'KeyX'];
      const frei = () => { for (const t of TASTEN) d.taste(t, false); };
      let c = null, nx = F.nx, nz = F.nz;
      if (F.boden) {
        const haus = d.hausStellen[3];
        frei(); d.setzePos(haus.x, 0.25, haus.z - 8);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.facing = 0;
        P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0;
        d.kamStart(Math.PI, 0.22);
        for (let i = 0; i < 20; i++) d.schritt(1 / 60);
        d.taste('KeyW', true);
        /* bis zur Wand und hinauf, bis 5 m unter der Kante */
        for (let i = 0; i < 1500; i++) {
          d.schritt(1 / 60);
          const w = P.wallInfo;
          if (P.state === 'climb' && w && w.col && w.col.h > 8 && w.col.h - P.pos.y < 5) { c = w.col; nx = w.nx; nz = w.nz; break; }
        }
        if (!c) return { fehler: 'kein Aufstieg' };
      } else {
        c = d.colliders.find((q) => q.id === F.koll);
        const ax = nx !== 0, l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
        const front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
        const t = l0 + (l1 - l0) * 0.45, y = c.h - 5.5;
        frei();
        d.setzePos(ax ? front + nx * 0.15 : t, y, ax ? t : front + nz * 0.15);
        P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
        P.wallInfo = P.wall = { nx, nz, col: c };
        P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
        d.kamStart(Math.atan2(nx, nz), 0.1);
        for (let i = 0; i < 30; i++) d.schritt(1 / 60);
        d.taste('KeyW', true);
      }
      /* sichtbare Grundflaeche des Hauses: Hausmodell, sonst Kollider */
      let gx0 = c.x0, gx1 = c.x1, gz0 = c.z0, gz1 = c.z1;
      for (const o of d.hausModelle()) {
        const K = o.userData.hausKiste;
        if (!K || K.koll !== c) continue;
        const bb = new THREE.Box3().setFromObject(o);
        gx0 = Math.min(gx0, bb.min.x); gx1 = Math.max(gx1, bb.max.x);
        gz0 = Math.min(gz0, bb.min.z); gz1 = Math.max(gz1, bb.max.z);
      }
      const front = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
      /* Kollisionskisten: Abstand eines Punktes zur Kiste, Strecke frei? */
      const kisten = (x, z) => d.colliderNah(x, z).filter((q) => !q.innen && !q.parkAuto);
      const luft = (p) => {
        let m = 1e9;
        for (const q of kisten(p.x, p.z)) {
          const y0 = q.y0 === undefined ? -1e9 : q.y0;
          const dx = Math.max(q.x0 - p.x, 0, p.x - q.x1), dy = Math.max(y0 - p.y, 0, p.y - (q.h || 0));
          const dz = Math.max(q.z0 - p.z, 0, p.z - q.z1);
          m = Math.min(m, Math.hypot(dx, dy, dz));
        }
        return m;
      };
      const streckeFrei = (a, b) => {
        const liste = new Set([...kisten(a.x, a.z), ...kisten(b.x, b.z), ...kisten((a.x + b.x) / 2, (a.z + b.z) / 2)]);
        /* Beim Klettern liegt die Figur auf der Kletterhaut, also hinter
           der Kistenebene der eigenen Wand - die Kiste ist dort nicht die
           sichtbare Flaeche. */
        if (P.state === 'climb') liste.delete(c);
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        for (const q of liste) {
          const y0 = q.y0 === undefined ? -1e9 : q.y0;
          let t0 = 0, t1 = 1, ok = true;
          for (const [o, dd, lo, hi] of [[a.x, dx, q.x0, q.x1], [a.y, dy, y0, q.h || 0], [a.z, dz, q.z0, q.z1]]) {
            if (Math.abs(dd) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
            let u0 = (lo - o) / dd, u1 = (hi - o) / dd;
            if (u0 > u1) [u0, u1] = [u1, u0];
            t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
            if (t0 > t1) { ok = false; break; }
          }
          /* die letzten 0,25 m vor dem Knochen zaehlen nicht (der Knochen
             liegt an der Fassade) */
          if (ok && t0 < 1 - 0.25 / Math.hypot(dx, dy, dz)) return false;
        }
        return true;
      };
      const zaehl = { bilder: 0, imGebaeude: 0, unterDach: 0, hinterFassade: 0, nahVoll: 0, unlesbar: 0, sprung: 0 };
      const schlimm = [], spur = [];
      const bilder = [];
      let alt = null, altR = null, oben = -1;
      const N = 360;
      for (let i = 0; i < N; i++) {
        /* Oben angekommen: W los, die Figur bleibt an der Kante stehen
           (wie im Human-Video) - sonst rennt sie ueber das Dach weiter. */
        if (i === 240 || (oben >= 0 && P.state === 'ground')) frei();
        d.schritt(1 / 60);
        d.camera.updateMatrixWorld(true);   // gezeichnet wird nur fuer die Standbilder
        const p = cam.position;
        const befund = [];
        const k = d.kamera();
        if (k.steckt) befund.push('imGebaeude');
        const ueber = p.x > gx0 && p.x < gx1 && p.z > gz0 && p.z < gz1;
        if (ueber && p.y < c.h + 0.3) befund.push('unterDach');
        const ab = nx !== 0 ? (p.x - front) * nx : (p.z - front) * nz;
        if (ab < 0.35 && p.y < c.h + 0.3 && !ueber) befund.push('hinterFassade');
        const lf = luft(p);
        const nah = +lf.toFixed(2);
        if (lf < 0.5) befund.push('nahVoll');
        const kn = d.animKnochen(['head', 'spine2']);
        const fr = d.figurRahmen();
        const kopf = kn.head && streckeFrei(p, kn.head), brust = kn.spine2 && streckeFrei(p, kn.spine2);
        if (!fr || !fr.punkte.head || !fr.punkte.head.imBild || !fr.punkte.spine2 || !fr.punkte.spine2.imBild ||
            !kopf || !brust) befund.push('unlesbar');
        const r = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        if (alt) {
          const sp = p.distanceTo(alt), dr = Math.acos(Math.min(1, r.dot(altR))) * 180 / Math.PI;
          if (sp > 0.6 || dr > 12) befund.push('sprung');
        }
        alt = p.clone(); altR = r.clone();
        if (oben < 0 && P.state === 'kante') oben = i;
        zaehl.bilder++;
        for (const x of befund) zaehl[x]++;
        if (befund.length && (schlimm.length < 12 || befund.indexOf('sprung') >= 0))
          schlimm.push({ i, zustand: P.state, befund: befund.join(','), cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
                         ab: +ab.toFixed(2), ueberDach: +(p.y - c.h).toFixed(2), luft: nah,
                         top: d.topOut ? (({ aktiv, wahl, grundEin, eintrittRest }) => ({ aktiv, wahl, grundEin, eintrittRest }))(d.topOut()) : null });
        if (F.spur && i >= F.spur[0] && i <= F.spur[1]) {
          const t = d.topOut();
          spur.push({ i, zustand: P.state, rest: +(c.h - P.pos.y - 1.75).toFixed(2), vy: +P.vel.y.toFixed(2), cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
                      luft: nah, top: t.aktiv, wahl: t.wahl, ein: t.grundEin, topPos: t.pos, befund: befund.join(',') });
        }
        if (F.bilder && i % 3 === 0) bilder.push(d.bildDaten(0.8));
      }
      frei();
      return { zaehl, schlimm, spur, bilder, kanteAb: oben, koll: c.id, h: +c.h.toFixed(2), seite: [nx, nz] };
    }, Object.assign({ bilder: !!BILDER, spur: SPUR }, F));
    if (r.fehler) { console.log(F.name.padEnd(34), r.fehler); continue; }
    const z = r.zaehl;
    if (!F.mensch) for (const k of Object.keys(summe)) summe[k] += z[k];
    console.log(F.name.padEnd(34) + ' koll ' + r.koll + ' h ' + r.h + ' Kante ab Bild ' + r.kanteAb + '  ' +
                Object.keys(z).filter((k) => k !== 'bilder').map((k) => k + ' ' + z[k]).join('  '));
    for (const s of r.schlimm) console.log('    ' + JSON.stringify(s));
    for (const s of (r.spur || [])) console.log('      spur ' + JSON.stringify(s));
    if (BILDER) {
      const dir = BILDER + '/' + String(nr).padStart(2, '0') + '-' + F.name.replace(/[^A-Za-z0-9_]/g, '_');
      fs.mkdirSync(dir, { recursive: true });
      r.bilder.forEach((u, i) => fs.writeFileSync(dir + '/' + String(i).padStart(4, '0') + '.jpg', Buffer.from(u.split(',')[1], 'base64')));
    }
    nr++;
  }
  console.log('\nSUMME ' + JSON.stringify(summe));
  const hart = summe.imGebaeude + summe.unterDach + summe.hinterFassade + summe.nahVoll + summe.sprung;
  console.log(hart === 0 ? 'TOPOUT: bestanden (hart 0)' : 'TOPOUT: NICHT bestanden (hart ' + hart + ')');
  await b.close();
})();
