/* problem-2, Brutal_1: folgt die Kollision in der offenen Erdgeschosshalle
   der SICHTBAREN Geometrie (Grundriss-Raster, siehe baueBodenRaster)?

   Gemessen wird gegen die Dreiecke des Hausmodells selbst, nicht gegen
   die Quader, die das Spiel daraus baut: je Haus waagrechte Schnitte
   (exakte Schnittlinien) alle 0,25 m vom Boden bis 7 m, je Schnitt die
   geschlossenen Umrisse (Saeulen, Kern) mit Material. Ein Punkt liegt in
   sichtbarer Geometrie, wenn ein Strahl von ihm aus eine ungerade Zahl
   von Linien eines Umrisses kreuzt.

   Teile (teil=...):
     anlauf   die 30 Anlaeufe des Audits (brutal-stopp.js: Haeuser, Seiten,
              25/50/75 % mit freiem Zugang), gehend (Alt+W) und rennend (W).
              Je Fall aus der sichtbaren Geometrie, was der Koerper auf
              seinem Weg zuerst trifft:
                A  nichts - freier Weg durch die Halle
                B  Saeule     C  Kernwand     D  Glas/Tuerflaeche
                E  echte Oeffnung (Durchgang)   F  sonstiges Hindernis
              A und E muessen frei durchlaufen, B-D an der sichtbaren
              Flaeche halten.
     saeulen  alle 12 Saeulen von Haus 2780 und zwei weiteren Haeusern
              (kleinstes und groesstes Brutal-Haus): frontal aus vier
              Richtungen, schraeg (30 Grad), rollend, springend, und durch
              jede Luecke zwischen zwei benachbarten Saeulen hindurch.
     kern     Kernwaende von allen Seiten, Nische (Tuerflaeche), Laibung,
              Sprung an den Kern (Kopf unter dem Kapitell).
     kamera   Figur an mehreren Stellen der Halle, Kamera einmal rundum
              (24 Richtungen): steht die Kamera in sichtbarer Geometrie,
              liegt sichtbare Geometrie zwischen Kopf und Kamera, faellt
              sie zusammen, obwohl Platz ist?
     hoch     an jeder frei anlaufbaren Aussenflaeche hochklettern bis aufs
              Dach: Brust/Becken hinter sichtbarer Flaeche (wie
              arkade-rumpf.js)?
     fremd    durch die Halle an das Nachbarhaus dahinter und an dessen Wand
              hoch: Koerper im Brutal-Obergeschoss oder in Hallengeometrie?
     klettern Anrennen an Aussenflaechen (aeussere Saeulen, buendige
              Kernwand) und an Innenflaechen (innere Saeulen, Kernwaende
              zur Halle): Wandlauf/Klettern nur aussen; nie in der Halle
              hinter Kern oder Saeule.

   Kennzahlen:
     invisibleCollisionInBrutalHall  Figur steht still (Eingabe gehalten),
                                     obwohl vor ihr mehr als TOL_LUFT
                                     sichtbar frei ist
     playerThroughVisibleBarrier     Bilder, in denen sichtbare Geometrie
                                     tiefer als PEN_TOL in den Koerper
                                     reicht (Koerperkasten +-0,45 m)
     playerInsideCore                Bilder mit dem Mittelpunkt im Kern
     playerThroughPillar             dasselbe wie oben, an einer Saeule

   Aufruf: node tools/pruef/brutal-halle.js teil=anlauf|saeulen|kern|kamera|klettern|hoch|fremd
           [alt=1] [json=datei] [max=30]
   alt=1: ohne Grundriss-Raster (Stand 97849d6) - zum Vergleich. */
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const TEIL = arg('teil', 'anlauf');
const ALT = arg('alt', '0') === '1';
const JSON_AUS = arg('json', null);
const MAX = +arg('max', 30);

(async () => {
  const { b, page } = await starte(320, 180, 4711, ALT ? { bodenRasterAlt: true } : {});
  const r = await page.evaluate(async (a) => {
    const d = __dbg, P = d.player, T = window.THREE;
    d.frier(true); d.setzeRegen(0);
    const R = 0.45, PEN_TOL = 0.05, TOL_LUFT = 0.10, SLAB = 0.25;
    const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ'];
    const los = () => { for (const t of TASTEN) d.taste(t, false); };
    const druecke = (code) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    };
    const brutal = d.hausModelle().filter((o) => o.userData.modellName === 'Downtown_Brutal_1');

    /* ---------- sichtbare Geometrie eines Hauses ---------- */
    const SICHT = new Map();
    function sicht(c) {
      if (SICHT.has(c.id)) return SICHT.get(c.id);
      const obj = brutal.find((o) => o.userData.hausKiste.koll === c);
      obj.updateMatrixWorld(true);
      const v = new T.Vector3(), tris = [];
      let minY = 1e9;
      obj.traverse((m) => {
        if (!m.isMesh) return;
        const p = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : p.count;
        const glas = /Firstfloor/.test(m.material.name || '');
        for (let i = 0; i + 2 < n; i += 3) {
          const P3 = [];
          for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(m.matrixWorld); P3.push(v.x, v.y, v.z); }
          tris.push({ P3, glas });
          minY = Math.min(minY, P3[1], P3[4], P3[7]);
        }
      });
      const schnitte = [];
      for (let hy = 0.125; hy < 7.0; hy += 0.25) {
        const y = minY + hy, seg = [];
        for (const { P3: Q, glas } of tris) {
          const pts = [];
          for (let k = 0; k < 3; k++) {
            const i0 = k * 3, i1 = ((k + 1) % 3) * 3;
            if ((Q[i0 + 1] < y) !== (Q[i1 + 1] < y)) { const f = (y - Q[i0 + 1]) / (Q[i1 + 1] - Q[i0 + 1]); pts.push(Q[i0] + f * (Q[i1] - Q[i0]), Q[i0 + 2] + f * (Q[i1 + 2] - Q[i0 + 2])); }
          }
          if (pts.length === 4) seg.push({ x0: pts[0], z0: pts[1], x1: pts[2], z1: pts[3], glas, umriss: -1 });
        }
        /* Umrisse: Endpunkte auf 2 mm gleich */
        const key = (x, z) => Math.round(x * 500) + ',' + Math.round(z * 500);
        const par = new Map();
        const find = (k) => { while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; };
        for (const s of seg) for (const k of [key(s.x0, s.z0), key(s.x1, s.z1)]) if (!par.has(k)) par.set(k, k);
        for (const s of seg) { const p1 = find(key(s.x0, s.z0)), p2 = find(key(s.x1, s.z1)); if (p1 !== p2) par.set(p1, p2); }
        const umr = new Map();
        for (const s of seg) {
          const k = find(key(s.x0, s.z0));
          if (!umr.has(k)) umr.set(k, { id: umr.size, x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 });
          const u = umr.get(k); s.umriss = u.id;
          u.x0 = Math.min(u.x0, s.x0, s.x1); u.x1 = Math.max(u.x1, s.x0, s.x1); u.z0 = Math.min(u.z0, s.z0, s.z1); u.z1 = Math.max(u.z1, s.z0, s.z1);
        }
        const umrisse = [...umr.values()].sort((p, q) => p.id - q.id);
        /* der Rumpf der Obergeschosse (umfasst die ganze Kiste) zaehlt nicht */
        for (const u of umrisse) u.art = (u.x1 - u.x0 > (c.x1 - c.x0) * 0.9 && u.z1 - u.z0 > (c.z1 - c.z0) * 0.9) ? 'huelle'
                                       : Math.max(u.x1 - u.x0, u.z1 - u.z0) > 1.5 ? 'kern' : 'saeule';
        schnitte.push({ y, seg: seg.filter((s) => umrisse[s.umriss].art !== 'huelle'), umrisse });
      }
      const S = { c, obj, minY, schnitte };
      SICHT.set(c.id, S);
      return S;
    }
    /* Liegt (x, z) im Schnitt k in einem Umriss? -> Umriss oder null */
    function drin(S, k, x, z) {
      const sch = S.schnitte[k], n = new Map();
      for (const s of sch.seg) {
        if ((s.z0 < z) === (s.z1 < z)) continue;
        const xs = s.x0 + (z - s.z0) / (s.z1 - s.z0) * (s.x1 - s.x0);
        if (xs > x) n.set(s.umriss, (n.get(s.umriss) || 0) + 1);
      }
      for (const [u, k2] of n) if (k2 & 1) return sch.umrisse[u];
      return null;
    }
    /* Strahl (x, z) + t (dx, dz) im Schnitt k: erste Linie -> { t, umriss, glas } */
    function strahl(S, k, x, z, dx, dz, tMax) {
      let best = null;
      for (const s of S.schnitte[k].seg) {
        const ex = s.x1 - s.x0, ez = s.z1 - s.z0, den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((s.x0 - x) * ez - (s.z0 - z) * ex) / den, u = ((s.x0 - x) * dz - (s.z0 - z) * dx) / den;
        if (t < 0 || t > tMax || u < 0 || u > 1) continue;
        if (!best || t < best.t) best = { t, umriss: S.schnitte[k].umrisse[s.umriss], glas: s.glas };
      }
      return best;
    }
    /* Schnitte im Koerper (Fuss y bis Kopf y + 1,75) */
    const koerperSchnitte = (S, y) => { const aus = []; S.schnitte.forEach((s, k) => { if (s.y > y + 0.05 && s.y < y + 1.70) aus.push(k); }); return aus; };
    /* sichtbare Geometrie tiefer als PEN_TOL im Koerperkasten? */
    function eindringen(S, x, y, z) {
      const h = R - PEN_TOL;
      for (const k of koerperSchnitte(S, y)) {
        for (let q = -h; q <= h + 1e-9; q += 0.05) {
          for (const [px, pz] of [[x + q, z - h], [x + q, z + h], [x - h, z + q], [x + h, z + q]]) {
            const u = drin(S, k, px, pz);
            if (u) return u;
          }
        }
        const u = drin(S, k, x, z);
        if (u) return u;
      }
      return null;
    }
    /* sichtbar frei vor dem Koerperkasten in Richtung (dx, dz): kleinster
       Strahl von Punkten des Kastenrands aus, die in diese Richtung zeigen */
    function luft(S, x, y, z, dx, dz, tMax) {
      let best = null;
      const ks = koerperSchnitte(S, y);
      for (const k of ks) {
        for (let q = -R; q <= R + 1e-9; q += 0.05) {
          const kanten = [];
          if (dx > 1e-6) kanten.push([x + R, z + q]); if (dx < -1e-6) kanten.push([x - R, z + q]);
          if (dz > 1e-6) kanten.push([x + q, z + R]); if (dz < -1e-6) kanten.push([x + q, z - R]);
          for (const [px, pz] of kanten) {
            const h = strahl(S, k, px, pz, dx, dz, tMax);
            if (h && (!best || h.t < best.t)) best = h;
          }
        }
      }
      return best;
    }
    const artVon = (h) => !h ? 'A' : h.umriss.art === 'saeule' ? 'B' : h.glas ? 'D' : 'C';
    /* Kollider eines anderen Hindernisses auf dem Weg? (F) */
    function fremdAufWeg(c, x, z, dx, dz, tMax) {
      for (let t = 0; t <= tMax; t += 0.1) {
        const px = x + dx * t, pz = z + dz * t;
        for (const q of d.colliderNah(px, pz)) {
          if (q === c || q.bau === c || (q.h || 0) < 0.3 || (q.y0 !== undefined && q.y0 > 2)) continue;
          if (px > q.x0 - R && px < q.x1 + R && pz > q.z0 - R && pz < q.z1 + R) return { t, id: q.id };
        }
      }
      return null;
    }
    function aufstellen(x, z, dx, dz) {
      los(); d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
      if (P.dead) { druecke('Enter'); }
      d.setzePos(x, SLAB, z);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
      P.facing = Math.atan2(dx, dz); d.kamStart(Math.atan2(-dx, -dz), 0.22);
      P.hockeT = 0; P.landT = 0; P.rollT = 0; P.dodgeT = 0;
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
    }
    /* Ein Lauf: Eingabe halten (gehen/rennen), optional Sprung/Rolle zum
       Zeitpunkt; misst je Bild Eindringen und Kern, am Ende Stillstand
       und sichtbare Luft davor. */
    function lauf(S, x, z, dx, dz, opt) {
      aufstellen(x, z, dx, dz);
      const M = { bilder: 0, eindringen: 0, eindrArt: {}, imKern: 0, ersteEindr: null, kletter: false, wandlauf: false, kletterImHaus: false,
                  stillLuft: null, still: false, ende: null, maxSprung: 0 };
      if (!opt.renne) d.taste('AltLeft', true);
      d.taste('KeyW', true);
      d.kollLogAn(true);
      let stopper = [];
      let ruhe = 0, vx = P.pos.x, vz = P.pos.z;
      const kK = S.schnitte.findIndex((s) => s.y > S.minY + 0.9);
      for (let i = 0; i < opt.bilder; i++) {
        if (opt.sprungBei !== undefined && i === opt.sprungBei) druecke('Space');
        if (opt.rolleBei !== undefined && i === opt.rolleBei) druecke('ControlLeft');
        /* Doppelsprung ohne Netzschwung: in der Luft waere die Sprungtaste
           zuerst der Schwung - hier zaehlt nur die Hoehe des Koerpers */
        if (opt.sprung2Bei !== undefined && i === opt.sprung2Bei && P.state === 'air') { P.vel.y = 11.5 * 0.92; P.jumps = 2; }
        d.schritt(1 / 60);
        M.bilder++;
        /* wer hat in diesem Bild seitlich gehalten? (Brutal-Quader oder anderes) */
        const log = d.kollLogHol().filter((e) => e.art === 'seitlich');
        if (log.length) stopper = log.map((e) => e.id);
        const px = P.pos.x, py = P.pos.y, pz = P.pos.z;
        M.maxSprung = Math.max(M.maxSprung, Math.hypot(px - vx, pz - vz));
        if (P.state === 'climb') { M.kletter = true; if (P.wandlauf) M.wandlauf = true; }
        if (P.state !== 'climb' && P.state !== 'kante') {
          const u = eindringen(S, px, py, pz);
          if (u) { M.eindringen++; M.eindrArt[u.art] = (M.eindrArt[u.art] || 0) + 1; if (!M.ersteEindr) M.ersteEindr = { bild: i, art: u.art, pos: [px, py, pz].map((q) => +q.toFixed(3)) }; }
          const k = drin(S, kK, px, pz);
          if (k && k.art === 'kern') M.imKern++;
        }
        ruhe = Math.hypot(px - vx, pz - vz) < 0.004 && P.state !== 'climb' ? ruhe + 1 : 0;
        vx = px; vz = pz;
        if (opt.stopBeiRuhe && ruhe >= 25) { M.still = true; break; }
        if (opt.ziel && (px - opt.ziel[0]) * dx + (pz - opt.ziel[1]) * dz > 0) break;
      }
      los();
      d.kollLogAn(false);
      M.ende = [P.pos.x, P.pos.y, P.pos.z].map((q) => +q.toFixed(3));
      if (M.still) {
        const h = luft(S, P.pos.x, P.pos.y, P.pos.z, dx, dz, 30);
        M.stillLuft = h ? +h.t.toFixed(3) : 99;
        M.stillArt = artVon(h);
        /* gehalten von einem anderen Hindernis (nicht diesem Haus): F */
        M.halter = [...new Set(stopper)];
        M.fremdGehalten = M.halter.length > 0 && !M.halter.includes(S.c.id);
        if (M.fremdGehalten) M.stillArt = 'F';
      }
      return M;
    }

    const aus = { teil: a.TEIL, alt: a.ALT, faelle: [] };
    const c2780 = d.colliders.find((q) => q.id === 2780);

    if (a.TEIL === 'anlauf' || a.TEIL === 'fremd') {
      /* dieselbe Auswahl wie brutal-stopp.js */
      const faelle = [];
      for (const o of brutal) {
        const c = o.userData.hausKiste.koll;
        for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ax = nx !== 0, front = ax ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
          const l0 = ax ? c.z0 : c.x0, l1 = ax ? c.z1 : c.x1;
          for (const f of [0.25, 0.5, 0.75]) {
            const t = l0 + f * (l1 - l0);
            let frei = true;
            for (let s = -0.3; s <= 4.5 && frei; s += 0.25) {
              const x = ax ? front + nx * s : t, z = ax ? t : front + nz * s;
              if (Math.abs(d.groundYAt(x, z) - SLAB) > 0.05) frei = false;
              for (const q of d.colliderNah(x, z)) {
                if (q === c || q.bau === c || (q.h || 0) < 0.3 || (q.y0 !== undefined && q.y0 > 2)) continue;
                if (x > q.x0 - 0.6 && x < q.x1 + 0.6 && z > q.z0 - 0.6 && z < q.z1 + 0.6) frei = false;
              }
            }
            if (frei && faelle.length < a.MAX) faelle.push({ c, nx, nz, f, x: ax ? front + nx * 4 : t, z: ax ? t : front + nz * 4 });
          }
        }
      }
      if (a.TEIL === 'fremd') {
        /* Rennend durch die Halle an das Nachbarhaus dahinter und an dessen
           Wand weiter hoch (W halten): steckt der Koerper beim Klettern im
           Brutal-Haus - ueber der Hallendecke (massive Obergeschosse) oder
           in sichtbarer Geometrie der Halle? */
        for (const F of faelle) {
          const S = sicht(F.c), dx = -F.nx, dz = -F.nz, c = F.c;
          const tiefe = F.nx ? c.x1 - c.x0 : c.z1 - c.z0;
          const fremd = fremdAufWeg(c, F.x, F.z, dx, dz, 4 + tiefe + 0.5), h = luft(S, F.x, SLAB, F.z, dx, dz, 4 + tiefe + 0.5);
          if (!fremd || (h && h.t < fremd.t)) continue;
          aufstellen(F.x, F.z, dx, dz);
          d.taste('KeyW', true);
          const M = { koll: c.id, seite: [F.nx, F.nz], f: F.f, hindernis: fremd.id, kletter: 0, maxY: 0, imObergeschoss: 0, inHalleGeo: 0, wand: null, gesperrt: 0 };
          const yD = c.boden ? c.boden.yDecke : 9.42;
          const g0 = P.fremdGesperrt || 0;
          for (let i = 0; i < 900; i++) {
            d.schritt(1 / 60);
            if (P.state !== 'climb' && P.state !== 'kante') continue;
            M.kletter++; M.maxY = Math.max(M.maxY, P.pos.y);
            if (P.wallInfo && P.wallInfo.col) M.wand = P.wallInfo.col.id;
            for (const hy of [0.9, 1.4]) {
              const py = P.pos.y + hy;
              const imKiste = P.pos.x > c.x0 + 0.02 && P.pos.x < c.x1 - 0.02 && P.pos.z > c.z0 + 0.02 && P.pos.z < c.z1 - 0.02 && py < c.h;
              if (imKiste && py >= yD) { M.imObergeschoss++; break; }
            }
            if (eindringen(S, P.pos.x, P.pos.y, P.pos.z)) M.inHalleGeo++;
          }
          M.gesperrt = (P.fremdGesperrt || 0) - g0;
          los();
          aus.faelle.push(M);
        }
        return aus;
      }
      for (const F of faelle) {
        const S = sicht(F.c), dx = -F.nx, dz = -F.nz;
        const tiefe = F.nx ? F.c.x1 - F.c.x0 : F.c.z1 - F.c.z0;
        const h = luft(S, F.x, SLAB, F.z, dx, dz, 4 + tiefe + 0.5);
        const fremd = fremdAufWeg(F.c, F.x, F.z, dx, dz, 4 + tiefe + 0.5);
        const art = fremd && (!h || fremd.t < h.t) ? 'F' : artVon(h);
        const erg = { koll: F.c.id, seite: [F.nx, F.nz], f: F.f, art, sichtbarFrei: h ? +h.t.toFixed(3) : null };
        for (const renne of [false, true]) {
          const M = lauf(S, F.x, F.z, dx, dz, { renne, bilder: renne ? 200 : 420, stopBeiRuhe: true, ziel: [F.x + dx * (4 + tiefe + 0.6), F.z + dz * (4 + tiefe + 0.6)] });
          /* unsichtbar: still, obwohl sichtbar mehr als TOL_LUFT frei */
          /* unsichtbar: dieses Haus haelt die Figur, obwohl sichtbar mehr
             als TOL_LUFT frei ist (haelt ein anderes Hindernis: F) */
          M.unsichtbar = M.still && M.halter.includes(S.c.id) && M.stillLuft > TOL_LUFT;
          /* A/E muessen durch (am Ziel oder Zeit um, ohne stehenzubleiben);
             F darf am anderen Hindernis halten */
          M.ok = art === 'A' || art === 'E' ? !M.still && !M.kletter
               : art === 'F' ? !M.unsichtbar
               : M.kletter ? true : M.still && !M.unsichtbar;
          erg[renne ? 'rennen' : 'gehen'] = M;
        }
        aus.faelle.push(erg);
      }
    }

    if (a.TEIL === 'saeulen') {
      /* Haus 2780, das kleinste und das groesste Brutal-Haus */
      const nachGroesse = brutal.map((o) => o.userData.hausKiste.koll).sort((p, q) => (p.x1 - p.x0) * (p.z1 - p.z0) - (q.x1 - q.x0) * (q.z1 - q.z0));
      const haeuser = [c2780, nachGroesse[0], nachGroesse[nachGroesse.length - 1]].filter((c, i, l) => l.indexOf(c) === i);
      for (const c of haeuser) {
        const S = sicht(c);
        const k1 = S.schnitte.findIndex((s) => s.y > S.minY + 1.0);
        const saeulen = S.schnitte[k1].umrisse.filter((u) => u.art === 'saeule');
        const innen = (x, z) => x > c.x0 + R && x < c.x1 - R && z > c.z0 + R && z < c.z1 - R;
        const frei = (x, z) => { for (const k of [1, 4]) if (drin(S, k, x, z)) return false; return true; };
        for (const u of saeulen) {
          const mx = (u.x0 + u.x1) / 2, mz = (u.z0 + u.z1) / 2;
          const ri = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [nx, nz] of ri) {
            /* frontal: 2,5 m vor der Saeulenflaeche, auf die Mitte zu */
            const sx = mx + nx * 2.6, sz = mz + nz * 2.6;
            if (!frei(sx, sz) || Math.abs(d.groundYAt(sx, sz) - SLAB) > 0.05 || fremdAufWeg(c, sx, sz, -nx, -nz, 2.5)) continue;
            for (const art of ['frontal', 'schraeg', 'rolle', 'sprung']) {
              let dx = -nx, dz = -nz, x = sx, z = sz;
              if (art === 'schraeg') {
                const w = Math.PI / 6, cs = Math.cos(w), sn = Math.sin(w);
                dx = -nx * cs - -nz * sn * 1; dz = -nz * cs + -nx * sn;
                x = mx - dx * 2.6; z = mz - dz * 2.6;
                if (!frei(x, z) || Math.abs(d.groundYAt(x, z) - SLAB) > 0.05) continue;
              }
              const opt = { renne: art === 'rolle', bilder: art === 'sprung' ? 140 : 160, stopBeiRuhe: art !== 'sprung' && art !== 'rolle' };
              if (art === 'rolle') { opt.rolleBei = 8; opt.bilder = 70; }
              if (art === 'sprung') opt.sprungBei = 18;
              const M = lauf(S, x, z, dx, dz, opt);
              const h0 = luft(S, x, SLAB, z, dx, dz, 4);
              M.ziel = artVon(h0);
              M.unsichtbar = M.still && M.halter.includes(S.c.id) && M.stillLuft > TOL_LUFT;
              aus.faelle.push({ koll: c.id, saeule: [+(mx - c.x0).toFixed(2), +(mz - c.z0).toFixed(2)], von: [nx, nz], art, ...M });
            }
          }
        }
        /* Luecken zwischen benachbarten Saeulen (gleiche Reihe/Spalte) */
        for (let i = 0; i < saeulen.length; i++) for (let j = i + 1; j < saeulen.length; j++) {
          const p = saeulen[i], q = saeulen[j];
          const gleichX = Math.abs((p.x0 + p.x1) / 2 - (q.x0 + q.x1) / 2) < 0.2, gleichZ = Math.abs((p.z0 + p.z1) / 2 - (q.z0 + q.z1) / 2) < 0.2;
          if (!gleichX && !gleichZ) continue;
          /* nur direkte Nachbarn: keine dritte Saeule dazwischen */
          const zw = saeulen.some((s) => s !== p && s !== q && (gleichX ? Math.abs((s.x0 + s.x1) / 2 - (p.x0 + p.x1) / 2) < 0.2 && (s.z0 + s.z1) / 2 > Math.min(p.z1, q.z1) && (s.z0 + s.z1) / 2 < Math.max(p.z0, q.z0)
                                                                              : Math.abs((s.z0 + s.z1) / 2 - (p.z0 + p.z1) / 2) < 0.2 && (s.x0 + s.x1) / 2 > Math.min(p.x1, q.x1) && (s.x0 + s.x1) / 2 < Math.max(p.x0, q.x0)));
          if (zw) continue;
          const luecke = gleichX ? Math.max(p.z0, q.z0) - Math.min(p.z1, q.z1) : Math.max(p.x0, q.x0) - Math.min(p.x1, q.x1);
          if (luecke < 2 * R + 0.05) continue;
          const lm = gleichX ? [(p.x0 + p.x1) / 2, (Math.min(p.z1, q.z1) + Math.max(p.z0, q.z0)) / 2] : [(Math.min(p.x1, q.x1) + Math.max(p.x0, q.x0)) / 2, (p.z0 + p.z1) / 2];
          for (const sgn of [1, -1]) {
            const dx = gleichX ? sgn : 0, dz = gleichX ? 0 : sgn;
            const x = lm[0] - dx * 2.2, z = lm[1] - dz * 2.2;
            if (!frei(x, z) || !frei(lm[0] + dx * 2.2, lm[1] + dz * 2.2) || Math.abs(d.groundYAt(x, z) - SLAB) > 0.05) continue;
            const h0 = luft(S, x, SLAB, z, dx, dz, 4.4);
            const M = lauf(S, x, z, dx, dz, { renne: false, bilder: 200, stopBeiRuhe: true, ziel: [lm[0] + dx * 2.0, lm[1] + dz * 2.0] });
            M.unsichtbar = M.still && M.halter.includes(S.c.id) && M.stillLuft > TOL_LUFT;
            M.durch = (M.ende[0] - lm[0]) * dx + (M.ende[2] - lm[1]) * dz > 1.5;
            aus.faelle.push({ koll: c.id, art: 'luecke', luecke: +luecke.toFixed(3), mitte: [+(lm[0] - c.x0).toFixed(2), +(lm[1] - c.z0).toFixed(2)], dir: [dx, dz], weg: artVon(h0), ...M });
          }
        }
      }
    }

    if (a.TEIL === 'kern') {
      const c = c2780, S = sicht(c);
      const k1 = S.schnitte.findIndex((s) => s.y > S.minY + 1.0);
      const kern = S.schnitte[k1].umrisse.find((u) => u.art === 'kern');
      const laeufe = [];
      /* -x und +x: drei Stellen; +z: Nische (Mitte, +-0,5 m), Laibungen, Seitenstreifen; -z von aussen */
      for (const f of [0.2, 0.5, 0.8]) {
        const z = kern.z0 + f * (Math.min(kern.z1, kern.z0 + 2.6) - kern.z0);
        laeufe.push({ name: '-x Wand ' + f, x: kern.x0 - 2.5, z, dx: 1, dz: 0 });
        laeufe.push({ name: '+x Wand ' + f, x: kern.x1 + 2.5, z, dx: -1, dz: 0 });
        laeufe.push({ name: '-z Wand von aussen ' + f, x: kern.x0 + f * (kern.x1 - kern.x0), z: c.z0 - 3.5, dx: 0, dz: 1 });
      }
      const nm = c.x0 + 5.1 / 10.21 * (c.x1 - c.x0);
      for (const off of [0, -0.45, 0.45]) laeufe.push({ name: 'Nische ' + off, x: nm + off, z: kern.z1 + 2.5, dx: 0, dz: -1 });
      laeufe.push({ name: 'Seitenstreifen links', x: c.x0 + 3.87 / 10.21 * (c.x1 - c.x0), z: kern.z1 + 2.5, dx: 0, dz: -1 });
      laeufe.push({ name: 'Seitenstreifen rechts', x: c.x0 + 6.33 / 10.21 * (c.x1 - c.x0), z: kern.z1 + 2.5, dx: 0, dz: -1 });
      for (const L of laeufe) {
        const h0 = luft(S, L.x, SLAB, L.z, L.dx, L.dz, 6);
        const M = lauf(S, L.x, L.z, L.dx, L.dz, { renne: false, bilder: 200, stopBeiRuhe: true });
        M.ziel = artVon(h0); M.unsichtbar = M.still && M.halter.includes(S.c.id) && M.stillLuft > TOL_LUFT;
        aus.faelle.push({ name: L.name, ...M });
        /* springend an dieselbe Wand: Kopf unter dem Kapitell */
        if (!/von aussen/.test(L.name)) {
          const J = lauf(S, L.x, L.z, L.dx, L.dz, { renne: false, bilder: 150, sprungBei: 35 });
          /* Doppelsprung im Steigen */
          aus.faelle.push({ name: L.name + ' Sprung', ...J });
          const J2 = lauf(S, L.x, L.z, L.dx, L.dz, { renne: false, bilder: 170, sprungBei: 30, sprung2Bei: 52 });
          aus.faelle.push({ name: L.name + ' Sprung2', ...J2 });
        }
      }
    }

    if (a.TEIL === 'kamera') {
      const c = c2780, S = sicht(c);
      const W = c.x1 - c.x0, D = c.z1 - c.z0;
      const stellen = [['Hallenmitte', 5.1, 4.6], ['zwischen Saeulen', 5.1, 7.4], ['vor der Nische', 5.1, 4.0], ['neben dem Kern', 2.2, 1.6], ['an der Saeulenreihe', 8.6, 7.4], ['Ecke', 1.6, 7.4]];
      for (const [name, sx, sz] of stellen) {
        const x = c.x0 + sx / 10.21 * W, z = c.z0 + sz / 9.27 * D;
        for (let k = 0; k < 24; k++) {
          const gier = k / 24 * Math.PI * 2;
          los(); d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
          d.setzePos(x, SLAB, z);
          P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.wallInfo = null; P.wall = null;
          P.facing = gier + Math.PI;
          d.kamStart(gier, 0.22);
          for (let i = 0; i < 45; i++) d.schritt(1 / 60);
          const cam = d.camera.position, kopf = [P.pos.x, P.pos.y + 1.6, P.pos.z];
          const abst = Math.hypot(cam.x - kopf[0], cam.y - kopf[1], cam.z - kopf[2]);
          /* Kamera in sichtbarer Geometrie? */
          const kc = S.schnitte.findIndex((s) => Math.abs(s.y - cam.y) <= 0.125);
          const inGeo = kc >= 0 ? drin(S, kc, cam.x, cam.z) : null;
          /* sichtbare Geometrie zwischen Kopf und Kamera (Stichproben alle 0,05 m) */
          let dazwischen = null;
          const n = Math.ceil(abst / 0.05);
          for (let q = 1; q < n && !dazwischen; q++) {
            const f = q / n, px = kopf[0] + (cam.x - kopf[0]) * f, py = kopf[1] + (cam.y - kopf[1]) * f, pz = kopf[2] + (cam.z - kopf[2]) * f;
            const ks = S.schnitte.findIndex((s) => Math.abs(s.y - py) <= 0.125);
            if (ks >= 0) { const u = drin(S, ks, px, pz); if (u) dazwischen = u.art; }
            /* ueber der Hallendecke: Obergeschoss */
            if (c.boden && py > c.boden.yDecke && px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1) dazwischen = 'obergeschoss';
          }
          /* Platz: sichtbar frei in Blickrichtung zurueck (auf Kopfhoehe) */
          const kk = S.schnitte.findIndex((s) => s.y > S.minY + 1.5);
          const dx = Math.sin(gier), dz = Math.cos(gier);
          const h = strahl(S, kk, kopf[0], kopf[2], dx, dz, 6);
          aus.faelle.push({ stelle: name, gier: +gier.toFixed(3), abst: +abst.toFixed(3), cam: [cam.x, cam.y, cam.z].map((q) => +q.toFixed(3)),
                            inGeo: inGeo ? inGeo.art : null, dazwischen, platz: h ? +h.t.toFixed(2) : 6 });
        }
      }
    }

    if (a.TEIL === 'klettern' || a.TEIL === 'hoch') {
      /* Je Umriss (Saeule, Kern) und Seite: frei anlaufbar (der erste
         sichtbare Treffer auf dem Weg ist genau diese Flaeche)? Dann
         rennend anlaufen. Beginnt ein Wandlauf/Klettern, wird aus der Lage
         und wallInfo bestimmt, an WELCHER sichtbaren Flaeche: ist sie die
         vorderste zu ihrer Hausseite und in Reichweite (aussen)? Je 2780
         und die beiden anderen Haeuser. */
      const nachGroesse = brutal.map((o) => o.userData.hausKiste.koll).sort((p, q) => (p.x1 - p.x0) * (p.z1 - p.z0) - (q.x1 - q.x0) * (q.z1 - q.z0));
      const haeuser = [c2780, nachGroesse[0], nachGroesse[nachGroesse.length - 1]].filter((c, i, l) => l.indexOf(c) === i);
      const flaecheAussen = (S, c, k1, u, nx, nz, quer) => {
        const fl = nx > 0 ? u.x1 : nx < 0 ? u.x0 : nz > 0 ? u.z1 : u.z0;
        const kiste = nx > 0 ? c.x1 : nx < 0 ? c.x0 : nz > 0 ? c.z1 : c.z0;
        const tiefe = Math.abs(kiste - fl);
        const h = strahl(S, k1, nx ? fl + nx * 0.01 : quer, nz ? fl + nz * 0.01 : quer, nx, nz, tiefe);
        return { aussen: !h && tiefe <= 1.2, tiefe };
      };
      for (const c of haeuser) {
        const S = sicht(c);
        const k1 = S.schnitte.findIndex((s) => s.y > S.minY + 1.0);
        const um = S.schnitte[k1].umrisse.filter((u) => u.art !== 'huelle');
        for (const u of um) {
          for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const fl = nx > 0 ? u.x1 : nx < 0 ? u.x0 : nz > 0 ? u.z1 : u.z0;
            /* Mitte der Flaeche; beim Kern die Mitte des geraden Teils */
            const mx = (u.x0 + u.x1) / 2, mz = u.art === 'kern' ? u.z0 + Math.min(1.3, (u.z1 - u.z0) / 2) : (u.z0 + u.z1) / 2;
            const quer = nx ? mz : mx;
            const ziel = flaecheAussen(S, c, k1, u, nx, nz, quer);
            const sx = nx ? fl + nx * 4.5 : mx, sz = nz ? fl + nz * 4.5 : mz;
            if (Math.abs(d.groundYAt(sx, sz) - SLAB) > 0.05 || fremdAufWeg(c, sx, sz, -nx, -nz, 4.4)) continue;
            if (S.schnitte.slice(0, 6).some((s, k) => drin(S, k, sx, sz))) continue;
            /* frei anlaufbar: der Koerper trifft zuerst diesen Umriss */
            const h0 = luft(S, sx, SLAB, sz, -nx, -nz, 4.6);
            if (!h0 || h0.umriss.id !== u.id || Math.abs(h0.t - 4.05) > 0.15) continue;
            if (a.TEIL === 'hoch') {
              /* nur Aussenflaechen: anrennen, W halten bis oben (Ueberziehen,
                 dann am Boden des Dachs) - Brust und Becken hinter einer
                 sichtbaren Flaeche? Dieselbe Messung wie arkade-rumpf.js
                 (Strahl von aussen, 3 m entlang der Wandnormale; Anbau bis
                 0,1 m vor einer Wand dahinter zaehlt nicht). */
              if (!ziel.aussen) continue;
              const meshes = []; S.obj.traverse((k) => { if (k.isMesh) meshes.push(k); });
              const RC = new T.Raycaster(), V3 = (x, y, z) => new T.Vector3(x, y, z);
              aufstellen(sx, sz, -nx, -nz);
              d.taste('KeyW', true);
              const H = { koll: c.id, umriss: u.art, flaeche: [nx, nz], tiefe: +ziel.tiefe.toFixed(2), bilder: 0, brust: 0, becken: 0, anbau: 0, kante: false, oben: false, maxY: 0, eckBilder: 0, ersteFehler: null };
              for (let i = 0; i < 1400; i++) {
                d.schritt(1 / 60);
                if (P.state === 'kante') H.kante = true;
                if (H.kante && P.state === 'ground') { H.oben = true; break; }
                if (P.state !== 'climb' || !P.wallInfo || P.wallInfo.col !== c) continue;
                if (P.eckBogen || (P.eckT || 0) > 0) { H.eckBilder++; continue; }
                H.bilder++; H.maxY = Math.max(H.maxY, P.pos.y);
                const wnx = P.wallInfo.nx, wnz = P.wallInfo.nz;
                const kn = d.animKnochen(['spine2', 'hips']);
                for (const [q, k] of [['brust', kn.spine2], ['becken', kn.hips]]) {
                  if (!k) continue;
                  RC.set(V3(k.x + wnx * 3, k.y, k.z + wnz * 3), V3(-wnx, 0, -wnz)); RC.near = 0; RC.far = 3 - 0.02;
                  const vorn = RC.intersectObjects(meshes, false);
                  if (!vorn.length) continue;
                  const tiefeVorn = vorn[0].distance - 3;
                  RC.set(V3(k.x, k.y, k.z), V3(-wnx, 0, -wnz)); RC.near = 0; RC.far = 0.75;
                  const wandDahinter = RC.intersectObjects(meshes, false).length > 0;
                  if (tiefeVorn <= 0.1 && wandDahinter) { H.anbau++; continue; }
                  H[q]++;
                  if (!H.ersteFehler) H.ersteFehler = { q, y: +(k.y - SLAB).toFixed(2) };
                }
              }
              los();
              aus.faelle.push(H);
              continue;
            }
            aufstellen(sx, sz, -nx, -nz);
            d.taste('KeyW', true);
            let an = null, eindr = 0, kern = 0;
            for (let i = 0; i < 150; i++) {
              d.schritt(1 / 60);
              if (P.state === 'climb' && !an) {
                const w = P.wallInfo;
                /* an welcher sichtbaren Flaeche? Strahl in Wandrichtung auf Brusthoehe */
                const kb = S.schnitte.findIndex((s2) => s2.y > P.pos.y + 1.3);
                const h = kb >= 0 ? strahl(S, kb, P.pos.x, P.pos.z, -w.nx, -w.nz, 1.5) : null;
                const fa = h ? flaecheAussen(S, c, kb, h.umriss, w.nx, w.nz, w.nx ? P.pos.z : P.pos.x) : null;
                an = { col: w.col && w.col.id, eigen: !!w.col && (w.col === c || w.col.bau === c), n: [w.nx, w.nz], umriss: h ? h.umriss.art : null,
                       gleich: !!h && h.umriss.id === u.id, aussen: fa ? fa.aussen : null, tiefe: fa ? +fa.tiefe.toFixed(2) : null };
              }
              if (P.state !== 'climb' && P.state !== 'kante') { if (eindringen(S, P.pos.x, P.pos.y, P.pos.z)) eindr++; const kk = drin(S, k1, P.pos.x, P.pos.z); if (kk && kk.art === 'kern') kern++; }
            }
            los();
            aus.faelle.push({ koll: c.id, umriss: u.art, flaeche: [nx, nz], tiefe: +ziel.tiefe.toFixed(2), aussen: ziel.aussen, an, eindringen: eindr, imKern: kern });
          }
        }
      }
    }
    return aus;
  }, { TEIL, ALT, MAX });
  await b.close();
  if (JSON_AUS) fs.writeFileSync(JSON_AUS, JSON.stringify(r, null, 1));
  const zeile = (s) => console.log(s);
  zeile('Brutal_1-Halle, teil=' + TEIL + (ALT ? '  (ALT: ohne Grundriss-Raster)' : ''));
  if (TEIL === 'anlauf') {
    const sum = { gehen: { unsichtbar: 0, eindr: 0, kern: 0, ok: 0 }, rennen: { unsichtbar: 0, eindr: 0, kern: 0, ok: 0 } };
    const arten = {};
    for (const F of r.faelle) {
      arten[F.art] = (arten[F.art] || 0) + 1;
      const t = [];
      for (const w of ['gehen', 'rennen']) {
        const M = F[w];
        sum[w].unsichtbar += M.unsichtbar ? 1 : 0; sum[w].eindr += M.eindringen; sum[w].kern += M.imKern; sum[w].ok += M.ok ? 1 : 0;
        t.push(w + ': ' + (M.kletter ? (M.wandlauf ? 'Wandlauf' : 'Klettern') : M.still ? (M.fremdGehalten ? 'steht am Hindernis ' + M.halter.join(',') : 'steht, Luft ' + M.stillLuft.toFixed(2) + ' m (' + M.stillArt + ')') : 'durch') +
               (M.eindringen ? ' EINDRINGEN ' + M.eindringen : '') + (M.imKern ? ' IM KERN ' + M.imKern : '') + (M.ok ? '' : '  <- FEHLER'));
      }
      zeile('  Haus ' + String(F.koll).padStart(5) + ' Seite ' + F.seite.join(',').padEnd(5) + ' ' + F.f.toFixed(2) + '  ' + F.art + (F.sichtbarFrei !== null ? ' (sichtbar ' + F.sichtbarFrei.toFixed(2) + ' m)' : '') + '   ' + t.join('  |  '));
    }
    zeile('\nKategorien: ' + JSON.stringify(arten));
    for (const w of ['gehen', 'rennen'])
      zeile(w.padEnd(7) + ' ok ' + sum[w].ok + '/' + r.faelle.length + '  invisibleCollisionInBrutalHall ' + sum[w].unsichtbar + '  playerThroughVisibleBarrier ' + sum[w].eindr + '  playerInsideCore ' + sum[w].kern);
  }
  if (TEIL === 'saeulen' || TEIL === 'kern') {
    const s = { faelle: 0, unsichtbar: 0, eindr: 0, saeule: 0, kern: 0, luecken: 0, lueckenDurch: 0 };
    for (const F of r.faelle) {
      s.faelle++; s.unsichtbar += F.unsichtbar ? 1 : 0; s.eindr += F.eindringen; s.kern += F.imKern;
      s.saeule += (F.eindrArt && F.eindrArt.saeule) || 0;
      /* Luecke frei (A): muss durch; vom Kern versperrt: muss an ihm halten */
      const lueckeOk = F.art !== 'luecke' || (F.weg === 'A' ? F.durch : F.still && !F.unsichtbar);
      if (F.art === 'luecke') { s.luecken++; if (lueckeOk) s.lueckenDurch++; }
      const name = F.name || ((F.art || '') + ' ' + (F.saeule ? 'Saeule ' + F.saeule.join('/') + ' von ' + F.von.join(',') : 'Luecke ' + F.luecke + ' m bei ' + F.mitte.join('/') + ' Richtung ' + F.dir.join(',')));
      const bad = F.unsichtbar || F.eindringen || F.imKern || !lueckeOk;
      zeile('  Haus ' + String(F.koll || 2780).padStart(5) + '  ' + name.padEnd(46) + (F.still ? 'steht, Luft ' + F.stillLuft.toFixed(2) + ' m (' + F.stillArt + ')' : F.kletter ? (F.wandlauf ? 'Wandlauf' : 'Klettern') : 'frei') +
            (F.eindringen ? '  EINDRINGEN ' + F.eindringen + ' ' + JSON.stringify(F.ersteEindr) : '') + (F.imKern ? '  IM KERN ' + F.imKern : '') + (bad ? '  <- FEHLER' : ''));
    }
    zeile('\n' + s.faelle + ' Laeufe: invisibleCollisionInBrutalHall ' + s.unsichtbar + '  playerThroughVisibleBarrier ' + s.eindr + ' (davon Saeule = playerThroughPillar ' + s.saeule + ')  playerInsideCore ' + s.kern +
          (s.luecken ? '  Luecken richtig (frei: durch, vom Kern versperrt: Halt am Kern) ' + s.lueckenDurch + '/' + s.luecken : ''));
  }
  if (TEIL === 'kamera') {
    let inGeo = 0, dazw = 0, zus = 0;
    for (const F of r.faelle) {
      if (F.inGeo) inGeo++;
      if (F.dazwischen) dazw++;
      const zusammen = F.abst < 1.2 && F.platz > 2.5;
      if (zusammen) zus++;
      if (F.inGeo || F.dazwischen || zusammen) zeile('  ' + F.stelle.padEnd(20) + ' Gier ' + F.gier.toFixed(2) + '  Abstand ' + F.abst.toFixed(2) + ' m  Platz ' + F.platz + '  ' + (F.inGeo ? 'KAMERA IN ' + F.inGeo + ' ' : '') + (F.dazwischen ? 'DAZWISCHEN ' + F.dazwischen + ' ' : '') + (zusammen ? 'ZUSAMMENGEFALLEN' : ''));
    }
    const st = {};
    for (const F of r.faelle) { (st[F.stelle] = st[F.stelle] || []).push(F.abst); }
    for (const [k, v] of Object.entries(st)) zeile('  ' + k.padEnd(20) + ' Kameraabstand min ' + Math.min(...v).toFixed(2) + '  median ' + v.slice().sort((p, q) => p - q)[12].toFixed(2) + '  max ' + Math.max(...v).toFixed(2));
    zeile('\n' + r.faelle.length + ' Kamerastellungen: Kamera in sichtbarer Geometrie ' + inGeo + '  Geometrie zwischen Kopf und Kamera ' + dazw + '  zusammengefallen trotz Platz ' + zus);
  }
  if (TEIL === 'fremd') {
    let ob = 0, geo = 0;
    for (const F of r.faelle) {
      ob += F.imObergeschoss; geo += F.inHalleGeo;
      zeile('  Haus ' + String(F.koll).padStart(5) + ' Seite ' + F.seite.join(',').padEnd(5) + ' ' + F.f.toFixed(2) + '  Hindernis ' + F.hindernis + '  Kletterbilder ' + String(F.kletter).padStart(3) + '  Wand ' + F.wand + '  maxY ' + F.maxY.toFixed(1) +
            '  Koerper in Brutal-Obergeschoss ' + F.imObergeschoss + '  in Hallengeometrie ' + F.inHalleGeo + '  Sperre ' + F.gesperrt + (F.imObergeschoss || F.inHalleGeo ? '  <- FEHLER' : ''));
    }
    zeile('\n' + r.faelle.length + ' Laeufe: playerInsideForeignBuildingWhileClimbing (Brutal-Obergeschoss) ' + ob + '  in Hallengeometrie ' + geo);
  }
  if (TEIL === 'hoch') {
    let br = 0, be = 0, bi = 0, oben = 0;
    for (const H of r.faelle) {
      br += H.brust; be += H.becken; bi += H.bilder; if (H.oben) oben++;
      zeile('  Haus ' + String(H.koll).padStart(5) + ' ' + H.umriss.padEnd(7) + ' Flaeche ' + H.flaeche.join(',').padEnd(5) + ' Tiefe ' + H.tiefe.toFixed(2).padStart(5) + '  Kletterbilder ' + String(H.bilder).padStart(4) +
            '  Brust hinter Flaeche ' + H.brust + '  Becken ' + H.becken + '  (Anbau ' + H.anbau + ')  ' + (H.oben ? 'oben' : 'nicht oben, maxY ' + H.maxY.toFixed(1)) + (H.ersteFehler ? '  erstes: ' + JSON.stringify(H.ersteFehler) : ''));
    }
    zeile('\n' + r.faelle.length + ' Aufstiege an Aussenflaechen, ' + bi + ' Kletterbilder: chestBehindVisibleSurface ' + br + '  pelvisBehindVisibleSurface ' + be + '  oben angekommen ' + oben + '/' + r.faelle.length);
  }
  if (TEIL === 'klettern') {
    let aussenN = 0, aussenK = 0, innenN = 0, innenK = 0, fremdK = 0, eindr = 0, kern = 0;
    for (const F of r.faelle) {
      if (F.aussen) aussenN++; else innenN++;
      eindr += F.eindringen; kern += F.imKern;
      let urteil = 'kein Klettern';
      if (F.an) {
        if (!F.an.eigen) { fremdK++; urteil = 'Klettern an Haus ' + F.an.col + '  <- FEHLER (fremd)'; }
        else if (F.an.aussen) { if (F.aussen && F.an.gleich) aussenK++; urteil = 'Wandlauf an ' + F.an.umriss + ' (aussen, Tiefe ' + F.an.tiefe + ')' + (F.an.gleich ? '' : ' - anderer Umriss'); }
        else { innenK++; urteil = 'Wandlauf an ' + F.an.umriss + ' (INNEN, Tiefe ' + F.an.tiefe + ')  <- FEHLER'; }
      }
      zeile('  Haus ' + String(F.koll).padStart(5) + ' ' + F.umriss.padEnd(7) + ' Flaeche ' + F.flaeche.join(',').padEnd(5) + ' Tiefe ' + F.tiefe.toFixed(2).padStart(5) + ' ' + (F.aussen ? 'aussen' : 'innen ') + '  ' + urteil +
            (F.eindringen ? '  EINDRINGEN ' + F.eindringen : '') + (F.imKern ? '  IM KERN' : ''));
    }
    zeile('\nAussenflaechen frei angelaufen: Wandlauf an genau dieser Flaeche ' + aussenK + '/' + aussenN + '   Innenflaechen frei angelaufen: ' + innenN +
          ', Wandlauf an einer Innenflaeche ' + innenK + ' (muss 0 sein)   an fremdem Haus ' + fremdK + '   playerThroughVisibleBarrier ' + eindr + '  playerInsideCore ' + kern);
  }
})();
