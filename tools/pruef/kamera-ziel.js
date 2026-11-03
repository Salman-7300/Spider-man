/* problem-2, letzter Kamera-Befund vor dem Human-Test: der Blickpunkt
   folgt der Koerperhaltung (KAM_POSE in game.js).

   St9 Ri1: die Figur kauert an der Dachkante, die Kamera steht dicht
   daneben und schaute auf player.pos + 1,7 m - die Figur lag unter dem
   Bildrand. Verdeckt war nichts.

   Teil 1  Rumpfhoehe H = 0,25 Kopf + 0,5 Brust + 0,25 Becken ueber
           player.pos je Zustand - die Grundlage fuer Bezug und Knie
   Teil 2  St9 Ri1 (Pflichtfall) vorher/nachher: Haltung, Becken-,
           Brust-, Kopfhoehe, alter und neuer Zielpunkt, Bildlage von
           Kopf, Brust und Becken, playerFramed
   Teil 3  Kontrollfaelle vorher/nachher. Die Kamera STEHT in beiden
           Laeufen gleich (geaendert ist nur, wohin sie schaut) - je
           Bild wird deshalb dieselbe Lage verglichen:
             Bildlage der Brust (Mittel, groesste Verschiebung)
             playerFramed (Bilder mit hartem Fehler)
             groesster Drehsprung je Bild (Unruhe)
             wie tief der Blickpunkt gesenkt wurde

   playerFramed (d.figurRahmen): Kopf, Brust und Becken im Bild und nicht
   im aeussersten Zwanzigstel am Rand.

   Aufruf:  node tools/pruef/kamera-ziel.js [teil=1,2,3] [bilder=ordner]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const tArg = process.argv.find((v) => v.indexOf('teil=') === 0);
const TEILE = tArg === undefined ? [1, 2, 3] : tArg.slice(5).split(',').map(Number);
const bArg = process.argv.find((v) => v.indexOf('bilder=') === 0);
const BILDER = bArg === undefined ? null : bArg.slice(7);
if (BILDER) fs.mkdirSync(BILDER, { recursive: true });

/* Die Lage aus kamera-restfaelle.js nach 290 Bildern Ruhe (wie in
   kamera-fade.js). */
const ST9 = {
  Ri0: { pos: [-308.324, 33.16, -13.3456], facing: 3.14035, gier: 0, neig: -0.179395 },
  Ri1: { pos: [-308.5365, 33.16, -10.7215], facing: -1.57159, gier: 1.57, neig: -0.179395 },
};

/* Im Spiel: gemeinsame Helfer und die Ablaeufe der Kontrollfaelle. */
const SEITE = () => {
  const d = __dbg, P = d.player;
  const W = window.__kz = {};
  W.TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'AltLeft', 'KeyX', 'Space', 'KeyZ'];
  W.frei = () => { for (const t of W.TASTEN) d.taste(t, false); };
  /* Nach jedem Umsetzen faehrt die Kamera erst heran - diese Bilder
     zaehlen nicht (siehe EINSCHWINGEN). */
  W.marke = (spur) => spur.push({ marke: 1 });
  W.strasse = (facing, spur) => {
    W.marke(spur);
    W.frei(); d.setzePos(-170, 0, -25); P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0;
    P.facing = facing; d.kamStart(facing + Math.PI, 0.22);
  };
  W.probe = (i) => {
    const r = d.figurRahmen(), z = d.kamZiel(), k = d.kamera();
    const kn = d.animKnochen(['head', 'spine2', 'hips']);
    return { i, st: P.state, g: P.onGround ? 1 : 0, pm: +(P.perchMix || 0).toFixed(2),
             y: +P.pos.y.toFixed(3),
             kopf: kn.head ? +(kn.head.y - P.pos.y).toFixed(3) : null,
             brust: kn.spine2 ? +(kn.spine2.y - P.pos.y).toFixed(3) : null,
             becken: kn.hips ? +(kn.hips.y - P.pos.y).toFixed(3) : null,
             zielY: +(z.zielY - P.pos.y).toFixed(3), blickY: +(z.blickY - P.pos.y).toFixed(3),
             tief: +z.tief.toFixed(3), H: z.H === null ? null : +z.H.toFixed(3),
             gerahmt: r ? r.gerahmt : null, grund: r ? r.grund : null,
             punkte: r ? r.punkte : null,
             kam: k.pos.map((v) => +v.toFixed(3)), blick: k.blick.map((v) => +v.toFixed(4)),
             abstand: k.abstand };
  };
  W.lauf = (n, spur, jede) => {
    for (let i = 0; i < n; i++) {
      d.schritt(1 / 60);
      if (!jede || i % jede === 0) spur.push(W.probe(spur.length));
    }
  };
  /* Die Dachstellen wie in kamera-restfaelle.js */
  W.stellen = () => {
    const SLAB_H = 0.25;
    const fest = (c) => !(c.klein || c.innen || c.parkAuto || c.dachProp);
    const aus = [];
    for (const o of d.hausModelle()) {
      const K = o.userData && o.userData.hausKiste;
      if (!K || K.h < 12 || aus.length >= 12) continue;
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
      aus.push({ x: st[0], z: st[1], h: K.h, dach: [koll.x0, koll.x1, koll.z0, koll.z1] });
    }
    return aus;
  };
  /* Bis 1,5 m vor die Dachkante laufen und stehen bleiben - dieselbe
     Ruhe wie in kamera-restfaelle.js, mit festem Kamerastart. */
  W.dachRuhe = (S, r, spur, n) => {
    const SLAB_H = 0.25, gier = r * Math.PI / 2;
    W.marke(spur);
    W.frei();
    d.setzePos(S.x, SLAB_H + S.h + 0.1, S.z);
    P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
    P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0; P.facing = gier;
    d.kamStart(gier);
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
    d.taste('KeyW', true);
    const DK = S.dach;
    let laeuft = true;
    for (let i = 0; i < n; i++) {
      if (laeuft && Math.min(P.pos.x - DK[0], DK[1] - P.pos.x, P.pos.z - DK[2], DK[3] - P.pos.z) < 1.5) {
        d.taste('KeyW', false); laeuft = false;
      }
      d.schritt(1 / 60);
      spur.push(W.probe(spur.length));
    }
    W.frei();
  };
  W.kollVon = (h) => {
    for (const c of d.colliderNah(h.x, h.z)) {
      if (c.klein || c.innen || c.parkAuto) continue;
      if (Math.abs((c.x0 + c.x1) / 2 - h.x) < 0.02 && Math.abs((c.z0 + c.z1) / 2 - h.z) < 0.02) return c;
    }
    return null;
  };
  /* Zeilennaht und Aussenecke: dieselben Starts wie zeilenuebergang.js,
     seitlich kriechen, 100 Bilder. */
  W.zeilen = () => {
    const K = d.hausKisten().filter((h) => h.zeile);
    const z = new Map();
    for (const h of K) { if (!z.has(h.zeile)) z.set(h.zeile, []); z.get(h.zeile).push(h); }
    const aus = [];
    for (const [key, liste] of z) {
      if (liste.length < 2) continue;
      const seite = key.split('|')[2];
      const laengsX = seite === 'N' || seite === 'S';
      const nx = seite === 'O' ? 1 : seite === 'W' ? -1 : 0;
      const nz = seite === 'N' ? 1 : seite === 'S' ? -1 : 0;
      liste.sort((p, q) => (laengsX ? p.x - q.x : p.z - q.z));
      aus.push({ laengsX, nx, nz, liste });
    }
    return aus;
  };
  W.kriech = (c, laengsX, nx, nz, laengs, y, ziel, spur) => {
    const front = nx !== 0 ? (nx > 0 ? c.x1 : c.x0) : (nz > 0 ? c.z1 : c.z0);
    W.marke(spur);
    W.frei();
    d.setzePos(laengsX ? laengs : front + nx * 0.15, y, laengsX ? front + nz * 0.15 : laengs);
    P.vel.set(0, 0, 0); P.state = 'climb';
    P.wallInfo = P.wall = { nx, nz, col: c };
    P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
    d.kamStart(Math.atan2(nx, nz), 0.1);
    const vor = laengsX ? P.pos.x : P.pos.z;
    d.taste('KeyD', true);
    for (let i = 0; i < 10; i++) { d.schritt(1 / 60); spur.push(W.probe(spur.length)); }
    const jetzt = laengsX ? P.pos.x : P.pos.z;
    if ((jetzt - vor) * (ziel - vor) <= 0) { d.taste('KeyD', false); d.taste('KeyA', true); }
    W.lauf(100, spur);
    W.frei();
    W.lauf(40, spur);
  };
  W.faelle = {
    stehen(spur) { W.strasse(Math.PI / 2, spur); W.lauf(240, spur); },
    rennen(spur) {
      W.strasse(Math.PI / 2, spur); W.lauf(30, spur);
      d.taste('KeyW', true); W.lauf(150, spur);
      d.taste('ShiftLeft', true); W.lauf(120, spur);
      W.frei(); W.lauf(90, spur);
    },
    hocken(spur) {
      W.strasse(Math.PI / 2, spur); W.lauf(30, spur);
      d.taste('KeyX', true); W.lauf(150, spur);
      d.taste('KeyW', true); W.lauf(120, spur);
      W.frei(); W.lauf(60, spur);
    },
    klettern(spur) {
      /* Anlauf, Hochkriechen, Ueberziehen, oben stehen - der echte Weg */
      const haus = d.hausStellen[3];
      W.marke(spur);
      W.frei(); d.setzePos(haus.x, 0.25, haus.z - 8);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.facing = 0;
      P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0;
      d.kamStart(Math.PI, 0.22);
      W.lauf(20, spur);
      d.taste('KeyW', true); W.lauf(200, spur);
      d.taste('KeyZ', true);
      for (let i = 0; i < 1500; i++) {
        d.schritt(1 / 60); spur.push(W.probe(spur.length));
        if (P.state === 'ground' && P.pos.y > 8 && i > 60) break;
      }
      W.frei(); W.lauf(240, spur);
    },
    dachkante(spur) {
      const S = W.stellen();
      W.dachRuhe(S[0], 0, spur, 300);
    },
    perch(spur) {
      /* Masthocke: Ampel oder Laterne, wie in landung-hocke.js */
      let mast = null;
      for (const c of d.colliders) {
        if (!c.klein || !c.h || c.h < 3 || c.h > 8) continue;
        if (Math.max(c.x1 - c.x0, c.z1 - c.z0) > 1.6) continue;
        mast = c; break;
      }
      if (!mast) return;
      W.marke(spur);
      W.frei();
      d.setzePos((mast.x0 + mast.x1) / 2, mast.h + 0.001, (mast.z0 + mast.z1) / 2);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0; P.facing = 0;
      d.kamStart(Math.PI, 0.22);
      W.lauf(240, spur);
      spur.push({ mastHocke: !!P.mastHocke });
    },
    aussenecke(spur) {
      const z = W.zeilen();
      for (let k = 0; k < 2 && k < z.length; k++) {
        const { laengsX, nx, nz, liste } = z[k];
        const E = liste[liste.length - 1], c = W.kollVon(E);
        if (!c) continue;
        const aussen = laengsX ? c.x1 : c.z1;
        W.kriech(c, laengsX, nx, nz, aussen - 0.8, E.h * 0.5, aussen, spur);
      }
    },
    zeilennaht(spur) {
      const z = W.zeilen();
      for (let k = 0; k < 2 && k < z.length; k++) {
        const { laengsX, nx, nz, liste } = z[k];
        const cA = W.kollVon(liste[0]), cB = W.kollVon(liste[1]);
        if (!cA || !cB) continue;
        const naht = laengsX ? (cA.x1 + cB.x0) / 2 : (cA.z1 + cB.z0) / 2;
        W.kriech(cA, laengsX, nx, nz, naht - 0.8, Math.min(liste[0].h, liste[1].h) * 0.5, naht, spur);
      }
    },
    landung(spur) {
      /* Sprung vom Dach auf die Strasse (Landung aus 12 m) und aus 30 m */
      for (const hoehe of [12, 30]) {
        W.strasse(Math.PI / 2, spur);
        P.pos.y += hoehe; P.state = 'air'; P.onGround = false;
        W.lauf(20, spur);
        for (let i = 0; i < 300 && !P.onGround; i++) { d.schritt(1 / 60); spur.push(W.probe(spur.length)); }
        W.lauf(120, spur);
      }
    },
    'St9-Ri0-Fade'(spur) {
      const L = window.__kzST9.Ri0;
      W.marke(spur);
      W.frei(); d.setzePos(L.pos[0], L.pos[1], L.pos[2]);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0; P.facing = L.facing;
      d.kamStart(L.gier, L.neig);
      W.lauf(180, spur);
    },
  };
};

async function lauf(alt, teile) {
  const { b, page } = await starte(1280, 720, 4711, alt ? { kamPoseAlt: true } : {});
  await page.evaluate((st9) => { window.__kzST9 = st9; }, ST9);
  await page.evaluate(SEITE);
  const aus = {};
  if (teile.includes(2)) {
    aus.st9ri1 = await page.evaluate((bild) => {
      const d = __dbg, P = d.player, W = window.__kz, L = window.__kzST9.Ri1;
      d.frier(true); d.setzeRegen(0);
      W.frei(); d.setzePos(L.pos[0], L.pos[1], L.pos[2]);
      P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
      P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0; P.facing = L.facing;
      d.kamStart(L.gier, L.neig);
      const spur = [];
      W.lauf(180, spur);
      d.zeichne();
      const aus = { spur, ende: W.probe(180), bild: bild ? d.bildDaten(0.9) : null };
      /* Derselbe Ort als Anlauf wie in kamera-restfaelle.js (Ruhe) und
         kamera-fade.js (lauf): vom Startpunkt der Stelle 9 in Richtung 1.
         Die Figur laeuft gegen die Bruestung. gedrueckt: W bleibt
         gedrueckt (so faehrt es der Pruefstand); losgelassen: W wird
         losgelassen, sobald sie steht (so macht es ein Mensch). */
      const S = W.stellen()[9];
      for (const art of ['gedrueckt', 'losgelassen']) {
        const sp = [];
        W.frei();
        d.setzePos(S.x, 0.25 + S.h + 0.1, S.z);
        P.vel.set(0, 0, 0); P.state = 'ground'; P.onGround = true;
        P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0; P.facing = Math.PI / 2;
        d.kamStart(Math.PI / 2);
        d.taste('KeyW', true);
        let steht = 0, los = false;
        for (let i = 0; i < 300; i++) {
          d.schritt(1 / 60);
          sp.push(W.probe(i));
          steht = Math.hypot(P.vel.x, P.vel.z) < 0.05 ? steht + 1 : 0;
          if (art === 'losgelassen' && !los && steht >= 10) { d.taste('KeyW', false); los = true; sp[sp.length - 1].los = true; }
        }
        W.frei();
        d.zeichne();
        aus[art] = { spur: sp, ende: W.probe(300), bild: bild ? d.bildDaten(0.9) : null,
                     pos: [P.pos.x, P.pos.y, P.pos.z] };
      }
      return aus;
    }, !!BILDER);
  }
  if (teile.includes(3)) {
    aus.kontrolle = {};
    const namen = await page.evaluate(() => Object.keys(window.__kz.faelle));
    for (const name of namen) {
      aus.kontrolle[name] = await page.evaluate((nm) => {
        const d = __dbg; d.frier(true); d.setzeRegen(0);
        d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
        const spur = [];
        window.__kz.faelle[nm](spur);
        return spur;
      }, name);
    }
  }
  /* Teil 1 zuletzt: so haben Teil 2 und 3 in beiden Laeufen dieselbe
     Vorgeschichte. */
  if (teile.includes(1) && !alt) {
    aus.posen = await page.evaluate(() => {
      const d = __dbg, P = d.player, W = window.__kz;
      d.frier(true); d.setzeRegen(0);
      d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
      const gruppen = {};
      const merke = (name) => {
        const kn = d.animKnochen(['head', 'spine2', 'hips']);
        if (!kn.head) return;
        const H = 0.25 * (kn.head.y - P.pos.y) + 0.5 * (kn.spine2.y - P.pos.y) + 0.25 * (kn.hips.y - P.pos.y);
        (gruppen[name] || (gruppen[name] = [])).push(H);
      };
      const n = (k, name, ab) => { for (let i = 0; i < k; i++) { d.schritt(1 / 60); if (i >= (ab || 0)) merke(name); } };
      const leer = [];
      W.strasse(Math.PI / 2, leer); n(240, 'Stehen', 60);
      W.strasse(Math.PI / 2, leer); d.taste('AltLeft', true); d.taste('KeyW', true); n(240, 'Gehen', 90);
      W.strasse(Math.PI / 2, leer); d.taste('KeyW', true); n(240, 'Rennen', 90);
      W.strasse(Math.PI / 2, leer); d.taste('KeyW', true); d.taste('ShiftLeft', true); n(200, 'Sprinten', 90);
      W.strasse(Math.PI / 2, leer); d.taste('KeyX', true); n(200, 'Ducken', 60);
      W.strasse(Math.PI / 2, leer); d.taste('KeyX', true); d.taste('KeyW', true); n(200, 'Duckgang', 90);
      W.strasse(Math.PI / 2, leer); for (let k = 0; k < 6; k++) { d.tryAttack(); n(40, 'Kampf'); }
      W.strasse(Math.PI / 2, leer); n(30, '-'); for (let k = 0; k < 3; k++) { d.dodge(); n(50, 'Rolle'); }
      W.strasse(Math.PI / 2, leer); P.pos.y += 12; P.state = 'air'; P.onGround = false;
      for (let i = 0; i < 300 && !P.onGround; i++) d.schritt(1 / 60);
      n(80, 'Landung');
      const L = window.__kzST9.Ri1;
      W.frei(); d.setzePos(L.pos[0], L.pos[1], L.pos[2]); P.vel.set(0, 0, 0);
      P.state = 'ground'; P.onGround = true; P.facing = L.facing;
      n(240, 'Kauern an der Kante', 120);
      /* Klettern: nur die Bilder im Zustand climb */
      const haus = d.hausStellen[3];
      W.frei(); d.setzePos(haus.x, 0.25, haus.z - 8); P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0); P.facing = 0;
      P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0; d.kamStart(Math.PI, 0.22);
      d.taste('KeyW', true); n(200, '-');
      d.taste('KeyZ', true);
      for (let i = 0; i < 1500; i++) {
        d.schritt(1 / 60);
        const wand = (P.state === 'climb' || P.state === 'kante');
        merke(P.state === 'kante' ? 'Ueberziehen' : P.state === 'climb' ? (P.wandlauf ? 'Wandlauf' : 'Klettern') : '-');
        if (!wand && P.state === 'ground' && P.pos.y > 8 && i > 60) break;
      }
      W.frei();
      /* Schwingen und Gleiten (Luft) */
      d.setzePos(-160, 34, -120); P.state = 'air'; P.onGround = false; P.vel.set(18, 0, 4);
      P.wallInfo = null; P.wall = null; P.hockeT = 0; P.perchMix = 0;
      P.facing = Math.PI / 2; d.kamStart(P.facing + Math.PI, 0.22);
      d.taste('KeyW', true); d.taste('Space', true);
      for (let i = 0; i < 420; i++) { d.schritt(1 / 60); if (P.state === 'swing') merke('Schwung'); }
      W.frei();
      d.setzePos(-100, 70, -100); P.state = 'air'; P.onGround = false; P.vel.set(6, 0, 0);
      d.taste('ShiftLeft', true); n(300, 'Gleiten', 30); W.frei();
      const aus = {};
      for (const [k, a] of Object.entries(gruppen)) {
        if (k === '-') continue;
        const s = a.slice().sort((x, y) => x - y);
        aus[k] = { n: a.length, mittel: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3),
                   min: +s[0].toFixed(3), max: +s[s.length - 1].toFixed(3) };
      }
      return aus;
    });
  }
  await b.close();
  return aus;
}

const f3 = (v) => (v === null || v === undefined) ? '-' : (+v).toFixed(3);
(async () => {
  const neu = await lauf(false, TEILE);
  const alt = TEILE.some((t) => t !== 1) ? await lauf(true, TEILE) : {};

  if (neu.posen) {
    console.log('\n== Teil 1: Rumpfhoehe H ueber player.pos je Zustand ==');
    console.log('  ' + 'Zustand'.padEnd(22) + 'Bilder  Mittel     Min     Max');
    for (const [k, v] of Object.entries(neu.posen))
      console.log('  ' + k.padEnd(22) + String(v.n).padStart(6) + String(v.mittel).padStart(8) +
                  String(v.min).padStart(8) + String(v.max).padStart(8));
  }

  if (neu.st9ri1) {
    console.log('\n== Teil 2: St9 Ri1, Pflichtfall (Lage nach 290 Bildern Ruhe, 3 s gehalten) ==');
    const zeile = (name, e) => {
      const p = e.punkte || {};
      const xy = (q) => p[q] ? '(' + p[q].x.toFixed(2) + ', ' + p[q].y.toFixed(2) + ')' : '-';
      console.log('  ' + name.padEnd(8) + ' Zustand ' + e.st + (e.pm > 0.5 ? ' (Hocke ' + e.pm + ')' : '') +
                  '  Becken ' + f3(e.becken) + '  Brust ' + f3(e.brust) + '  Kopf ' + f3(e.kopf) +
                  '  Ziel alt ' + f3(e.zielY) + '  Blick ' + f3(e.blickY) + '  (m ueber den Fuessen)');
      console.log('           Bildlage (x, y; -1..1):  Kopf ' + xy('head') + '  Brust ' + xy('spine2') +
                  '  Becken ' + xy('hips') + '   playerFramed ' + e.gerahmt + (e.grund ? ' (' + e.grund + ')' : '') +
                  '   Kamera ' + JSON.stringify(e.kam) + ' Abstand ' + e.abstand);
    };
    zeile('vorher', alt.st9ri1.ende);
    zeile('nachher', neu.st9ri1.ende);
    const verlauf = neu.st9ri1.spur.filter((s, i) => i % 15 === 0)
      .map((s) => s.i + ':' + s.tief.toFixed(2) + (s.gerahmt ? '' : '!'));
    console.log('  Senkung im Verlauf (Bild:tief, ! = nicht gerahmt): ' + verlauf.join(' '));
    const nG = (sp) => sp.filter((s) => s.gerahmt === false).length;
    console.log('  nicht gerahmt ueber 180 Bilder: vorher ' + nG(alt.st9ri1.spur) + '  nachher ' + nG(neu.st9ri1.spur));
    for (const art of ['gedrueckt', 'losgelassen']) {
      console.log('\n  St9 Ri1 als Anlauf gegen die Bruestung, W ' + art + ' (300 Bilder):');
      zeile('vorher', alt.st9ri1[art].ende);
      zeile('nachher', neu.st9ri1[art].ende);
      console.log('  nicht gerahmt: vorher ' + nG(alt.st9ri1[art].spur) + '/300  nachher ' + nG(neu.st9ri1[art].spur) + '/300' +
                  (art === 'losgelassen' ? '   (losgelassen bei Bild ' + (neu.st9ri1[art].spur.findIndex((q) => q.los)) + ')' : ''));
      const v = neu.st9ri1[art].spur.filter((q, i) => i % 20 === 0).map((q) => q.i + ':' + q.tief.toFixed(2) + (q.gerahmt ? '' : '!') + (q.pm > 0.5 ? 'h' : ''));
      console.log('  Verlauf nachher (Bild:tief, ! = nicht gerahmt, h = Hocke): ' + v.join(' '));
    }
    if (BILDER) {
      for (const [n, e] of [['st9-ri1-vorher', alt.st9ri1], ['st9-ri1-nachher', neu.st9ri1],
                            ['st9-ri1-anlauf-gedrueckt-vorher', alt.st9ri1.gedrueckt], ['st9-ri1-anlauf-gedrueckt-nachher', neu.st9ri1.gedrueckt],
                            ['st9-ri1-anlauf-losgelassen-vorher', alt.st9ri1.losgelassen], ['st9-ri1-anlauf-losgelassen-nachher', neu.st9ri1.losgelassen]])
        if (e.bild) fs.writeFileSync(path.join(BILDER, n + '.jpg'), Buffer.from(e.bild.split(',')[1], 'base64'));
    }
  }

  if (neu.kontrolle) {
    /* EINSCHWINGEN: nach jedem Umsetzen (Marke) faehrt die Kamera erst
       aus ihrer alten Lage heran - die ersten 30 Bilder danach zaehlen
       nicht; im Spiel wird nicht teleportiert. */
    const EINSCHWINGEN = 30;
    const ruhig = (S) => {
      const aus = [];
      let seit = 1e9;
      for (const s of S) {
        if (s.marke) { seit = 0; continue; }
        if (s.i === undefined) continue;
        if (seit++ >= EINSCHWINGEN) aus.push(s);
      }
      return aus;
    };
    console.log('\n== Teil 3: Kontrollfaelle, gleiche Kameralage vorher/nachher ==');
    console.log('  (ohne die ersten ' + EINSCHWINGEN + ' Bilder nach jedem Umsetzen; Bildlage -1..1, y nach oben)');
    console.log('  ' + 'Fall'.padEnd(14) + 'Bilder  gleicheLage  Brust y alt/neu (Mittel)  groesste Versch.  ' +
                'nicht gerahmt alt/neu  Drehsprung alt/neu   tief min / Mittel');
    for (const name of Object.keys(neu.kontrolle)) {
      const A = ruhig(alt.kontrolle[name]);
      const N = ruhig(neu.kontrolle[name]);
      const n = Math.min(A.length, N.length);
      let gleich = 0, sa = 0, sn = 0, maxV = 0, cnt = 0;
      const dreh = (S) => {
        let m = 0;
        for (let i = 1; i < S.length; i++) {
          if (S[i].i !== S[i - 1].i + 1) continue;
          const a = S[i - 1].blick, c = S[i].blick;
          m = Math.max(m, Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]));
        }
        return m;
      };
      for (let i = 0; i < n; i++) {
        const a = A[i], c = N[i];
        if (Math.hypot(a.kam[0] - c.kam[0], a.kam[1] - c.kam[1], a.kam[2] - c.kam[2]) < 1e-3) gleich++;
        const pa = a.punkte && a.punkte.spine2, pc = c.punkte && c.punkte.spine2;
        if (pa && pc && pa.vorn && pc.vorn) {
          sa += pa.y; sn += pc.y; cnt++;
          maxV = Math.max(maxV, Math.abs(pc.y - pa.y));
        }
      }
      const nG = (S) => S.filter((s) => s.gerahmt === false).length;
      const tief = N.map((s) => s.tief);
      const extra = neu.kontrolle[name].find((s) => s.mastHocke !== undefined);
      console.log('  ' + name.padEnd(14) + String(n).padStart(6) + String(gleich + '/' + n).padStart(13) +
                  ('   ' + (cnt ? (sa / cnt).toFixed(3) : '-') + ' / ' + (cnt ? (sn / cnt).toFixed(3) : '-')).padEnd(27) +
                  maxV.toFixed(3).padStart(10) +
                  String(nG(A) + ' / ' + nG(N)).padStart(22) +
                  (dreh(A).toFixed(4) + ' / ' + dreh(N).toFixed(4)).padStart(21) +
                  ('   ' + Math.min(...tief).toFixed(3) + ' / ' + (tief.reduce((x, y) => x + y, 0) / tief.length).toFixed(3)) +
                  (extra ? '   Masthocke ' + extra.mastHocke : ''));
      const gruende = {};
      for (const s of N) if (s.gerahmt === false) gruende[s.grund] = (gruende[s.grund] || 0) + 1;
      const gA = {};
      for (const s of A) if (s.gerahmt === false) gA[s.grund] = (gA[s.grund] || 0) + 1;
      if (Object.keys(gruende).length || Object.keys(gA).length)
        console.log('      Gruende alt ' + JSON.stringify(gA) + '   neu ' + JSON.stringify(gruende));
    }
    if (BILDER) fs.writeFileSync(path.join(BILDER, 'kontrolle.json'), JSON.stringify({ neu: neu.kontrolle, alt: alt.kontrolle }));
  }
})();
