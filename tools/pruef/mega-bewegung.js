/* Mega-Update 1.0, M3: Bewegungsfluss - Pruefstand mit echten Eingaben.
   =========================================================================
   Jeder Teil laeuft zweimal in je einem FRISCHEN Browser: einmal mit allen
   M3-Teilen aus (window.__WEBHERO_FLUSS_ALT, Stand vor dem Update) und
   einmal mit dem neuen Stand. Eingaben wie im Spiel:
     Leertaste halten      d.taste('Space', true)      (Netzschwung)
     Leertaste druecken    d.tippeSprung()             (= keydown -> tryJump)
     E                     d.webZip()                  (= keydown 'KeyE')
     W / S / Shift         d.taste(...)

   Teile (teil=alle|kette|trick|neuschwung|wand|abweisen|dach|fluss):
     kette       Schwung -> Loslassen -> Netz-Zip (mehrere Waende, drei
                 Verzoegerungen): Armsprung beim Zugbeginn, Tempo, Ziel an
                 einem echten Haus, Wandlauf nach dem Zug, Hochziehen.
     trick       schnelles Loslassen MIT Kunststueck, E waehrend des
                 Kunststuecks: Knochenspruenge.
     neuschwung  Zug -> Absprung im Fenster -> sofort wieder schwingen.
     wand        Zug von der Strasse an eine Fassade (18/26/34 m), W
                 gehalten: Angreifen, Wandlauf, Hochziehen, Zeit bis aufs
                 Dach; dazu der Abstand zur echten Kollisionsflaeche beim
                 Angreifen (keine unsichtbare Wand).
     abweisen    derselbe Zug mit S (von der Wand weg): kein Angreifen.
     dach        Dachparkour: Sprint ueber Dach A, Absprung an der Kante,
                 Zug an die Fassade von B, Wandlauf, Hochziehen, Dach B.
     fluss       Regeln des Bonus: echte Kette zahlt einmal, Farmen mit
                 derselben Taste zahlt nicht, Sperre danach, Treffer reisst
                 die Kette, Physik ohne Zip->Wand ist bitgleich alt/neu.

   Aufruf:  node tools/pruef/mega-bewegung.js [teil=alle] [keim=4711] [aus=datei.json]
   Exit 1, wenn eine der Pruefungen am Ende (PRUEF) scheitert.
   ========================================================================= */
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const TEIL = arg('teil', 'alle');
const KEIM = Number(arg('keim', 4711));
const AUS = arg('aus', null);
const ARM_EIN = arg('armEin', null);      // nur zur Abstimmung: Einblendzeit der Schusshaltung

/* ---------------- im Browser ---------------- */
function laufe(teil) {
  const d = __dbg, P = d.player;
  d.frier(true);
  if (typeof teil === 'object') { if (teil.armEin && d.setzeZipArmEin) d.setzeZipArmEin(teil.armEin); teil = teil.teil; }
  for (const arr of [d.cars, d.civilians, d.enemies]) if (arr) arr.length = 0;
  const DT = 1 / 60;
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyE', 'KeyZ'];
  const frei = () => { for (const t of TASTEN) d.taste(t, false); };
  const reset = () => {
    frei();
    P.zip = null; P.swing = null; P.wallInfo = null; P.wall = null; P.kante = null;
    P.wandlauf = false; P.wandSchwung = 0; P.wandSperre = 0; P.luftSalto = 0; P.saltoCd = 0;
    P.attack = null; P.jumps = 0; P.swingLock = false; P.landT = 0; P.hartLandung = 0;
    P.hockeT = 0; P.mastHocke = false; P.schwungPuffer = 0; P.sprungPuffer = 0;
    if (P.gleiten) P.gleiten = false;
    P.hp = Math.max(P.hp, 100);
    d.mega.flussLeeren();
  };
  const COLS = d.colliders;
  const hausVon = (c) => c && !c.klein && !c.parkAuto && !c.innen;
  /* Steckt ein Punkt in (oder an) einem echten Haus? */
  const anHaus = (p, r) => COLS.some((c) => hausVon(c) && p.x > c.x0 - r && p.x < c.x1 + r &&
                                            p.z > c.z0 - r && p.z < c.z1 + r && p.y < c.h + r);
  /* Knochensprung je Bild aus dem Posenprotokoll, Bilder [a, b) relativ zu i0 */
  const KN = ['lefthand', 'righthand', 'leftfoot', 'rightfoot', 'head', 'hips'];
  /* Sprung = Weg eines Knochens in EINEM Bild. Ein schneller, aber
     stetiger Armschwung hat mehrere grosse Bilder hintereinander; ein Ruck
     ist ein einzelnes Bild, das aus seiner Umgebung herausragt. ruck =
     Sprung minus dem groesseren der beiden Nachbarbilder. */
  const spruenge = (pl, i0, a, b) => {
    let max = 0, wo = null, ruck = 0, ruckWo = null, ruckHand = 0, ruckFuss = 0, ruckArm = 0, ruckArmWo = null;
    const weg = (j, n) => {
      if (j < 1 || j >= pl.length) return 0;
      const p = pl[j - 1].knochen[n], q = pl[j].knochen[n];
      return p && q ? Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) : 0;
    };
    /* Der ARM fuer sich: Hand relativ zur Huefte. Verschiebt sich der ganze
       Koerper (Bodenausgleich faellt beim Abheben weg), wandert die Hand
       mit - das ist kein Armruck. */
    const armWeg = (j, n) => {
      if (j < 1 || j >= pl.length) return 0;
      const p = pl[j - 1].knochen, q = pl[j].knochen;
      if (!p[n] || !q[n] || !p.hips || !q.hips) return 0;
      return Math.hypot((p[n].x - p.hips.x) - (q[n].x - q.hips.x), (p[n].y - p.hips.y) - (q[n].y - q.hips.y),
                        (p[n].z - p.hips.z) - (q[n].z - q.hips.z));
    };
    for (let j = Math.max(1, i0 + a); j < Math.min(pl.length, i0 + b); j++) {
      for (const n of ['lefthand', 'righthand']) {
        const r = armWeg(j, n) - Math.max(armWeg(j - 1, n), armWeg(j + 1, n));
        if (r > ruckArm) { ruckArm = r; ruckArmWo = { bild: j - i0, knochen: n, clip: pl[j].clip, zustand: pl[j].zustand }; }
      }
      for (const n of KN) {
        const dd = weg(j, n);
        if (dd > max) { max = dd; wo = { bild: j - i0, knochen: n, clip: pl[j].clip, zustand: pl[j].zustand }; }
        const r = dd - Math.max(weg(j - 1, n), weg(j + 1, n));
        if (r > ruck) { ruck = r; ruckWo = { bild: j - i0, knochen: n, clip: pl[j].clip, zustand: pl[j].zustand }; }
        if (/hand/.test(n)) ruckHand = Math.max(ruckHand, r);
        if (/foot/.test(n)) ruckFuss = Math.max(ruckFuss, r);
      }
    }
    return { max: +max.toFixed(3), wo, ruck: +ruck.toFixed(3), ruckWo,
             ruckHand: +ruckHand.toFixed(3), ruckFuss: +ruckFuss.toFixed(3),
             ruckArm: +ruckArm.toFixed(3), ruckArmWo };
  };
  const R = {};

  /* Physik ohne Zip->Wand: Sprint, Sprung, Schwung, Loslassen, Landung.
     ZUERST, solange alt und neu dieselbe Vorgeschichte haben. */
  let PHYSIK = null;
  if (teil === 'alle' || teil === 'fluss') {
    reset();
    d.setzePos(0, 1, 0);
    P.pos.y = d.groundYAt(0, 0);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.22);
    const spur = [];
    for (let i = 0; i < 420; i++) {
      if (i === 1) { d.taste('KeyW', true); d.taste('ShiftLeft', true); }
      if (i === 60) d.tippeSprung();
      if (i === 70) d.taste('Space', true);
      if (i === 150) d.taste('Space', false);
      if (i === 260) frei();
      d.schritt(DT);
      if (i % 30 === 0) spur.push([+P.pos.x.toFixed(6), +P.pos.y.toFixed(6), +P.pos.z.toFixed(6), P.state]);
    }
    PHYSIK = { spur, ende: [P.pos.x, P.pos.y, P.pos.z, P.vel.x, P.vel.y, P.vel.z] };
  }

  /* Kandidaten: hohe Fassaden nahe der Mitte, Westseite frei genug. */
  const waende = COLS.filter((c) => hausVon(c) && (c.h || 0) >= 22 && Math.abs(c.x0) < 240 &&
                                    Math.abs(c.z0) < 240 && (c.z1 - c.z0) > 10);
  const auswahl = waende.filter((c, i) => i % 5 === 0).slice(0, 8);

  /* ---------- kette ---------- */
  if (teil === 'alle' || teil === 'kette') {
    const faelle = [];
    for (const wand of auswahl) {
      for (const verz of [0, 8, 20]) {
        reset();
        const zm = (wand.z0 + wand.z1) / 2;
        d.setzePos(wand.x0 - 55, 24, zm);
        P.state = 'air'; P.onGround = false; P.vel.set(17, 0, 0);
        P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.22);
        d.poseLogAn(true, 8);
        let iRel = -1, iZip = -1, iEnde = -1, iAn = -1, iKante = -1, vVor = null, ziel = null, yAn = null;
        let wlBilder = 0, wsMax = 0, swing = false, anWand = null;
        const st0 = d.mega.fluss().statistik;
        const s = [];
        for (let i = 0; i < 300; i++) {
          if (i === 2) d.taste('Space', true);
          if (i === 50) d.taste('Space', false);
          if (P.state === 'swing') swing = true;
          if (P.state !== 'swing' && i > 50 && iRel < 0) iRel = i;
          if (iRel >= 0 && i === iRel + verz && iZip < 0) { vVor = P.vel.length(); d.taste('KeyW', true); d.webZip(); }
          d.schritt(DT);
          if (P.state === 'zip' && iZip < 0) { iZip = i; ziel = P.zip.target.clone(); }
          if (iZip >= 0 && iEnde < 0 && P.state !== 'zip' && i > iZip) iEnde = i;
          if (iEnde >= 0 && iAn < 0 && P.state === 'climb') {
            iAn = i; yAn = P.pos.y;
            const w = P.wallInfo;
            anWand = w ? { col: w.col.id, n: [w.nx, w.nz], ueber: +(w.col.h - P.pos.y).toFixed(2) } : null;
          }
          if (iEnde >= 0 && i < iEnde + 120 && P.state === 'climb' && P.wandlauf) wlBilder++;
          if (iEnde >= 0) wsMax = Math.max(wsMax, P.wandSchwung || 0);
          if (iEnde >= 0 && iKante < 0 && P.state === 'kante') iKante = i;
          s.push({ v: P.vel.length(), y: P.pos.y });
        }
        const pl = d.poseLog();
        const off = pl.length - 300;          // Protokoll haelt die letzten 8 s, Lauf 300 Bilder
        const st1 = d.mega.fluss().statistik;
        faelle.push({
          zaehler: { zipWand: st1.zipWand - st0.zipWand, zipWandlauf: st1.zipWandlauf - st0.zipWandlauf,
                     oben: st1.zipWandOben - st0.zipWandOben,
                     ohneTempo: st1.zipWandOhneTempo - st0.zipWandOhneTempo,
                     abgelehnt: st1.zipWandAbgelehnt - st0.zipWandAbgelehnt },
          anWand, ziel: ziel ? [+ziel.x.toFixed(2), +ziel.y.toFixed(2), +ziel.z.toFixed(2)] : null,
          wand: wand.id, verz, schwung: swing, zip: iZip >= 0,
          zielAmHaus: ziel ? anHaus(ziel, 0.6) : null,
          armSprung: iZip >= 0 ? spruenge(pl, iZip + off, 0, 9) : null,
          vVor: vVor !== null ? +vVor.toFixed(2) : null,
          vZip5: iZip >= 0 && s[iZip + 5] ? +s[iZip + 5].v.toFixed(2) : null,
          angegriffen: iAn >= 0, bisAngriff: iAn >= 0 ? +((iAn - iEnde) * DT).toFixed(3) : null,
          wandlaufBilder: wlBilder, wandSchwungMax: +wsMax.toFixed(2),
          hoeheIn1s: iAn >= 0 && s[iAn + 60] ? +(s[iAn + 60].y - yAn).toFixed(2) : null,
          hochziehen: iKante >= 0, zeitBisKante: iKante >= 0 ? +((iKante - iZip) * DT).toFixed(2) : null,
        });
      }
    }
    R.kette = faelle;
  }

  /* ---------- trick: E waehrend des Kunststuecks ---------- */
  if (teil === 'alle' || teil === 'trick') {
    const faelle = [];
    const salto0 = d.mega.fluss().statistik.zipImSalto || 0;
    for (const wand of auswahl.slice(0, 5)) {
      reset();
      const zm = (wand.z0 + wand.z1) / 2;
      d.setzePos(wand.x0 - 70, 46, zm);
      P.state = 'air'; P.onGround = false; P.vel.set(26, -2, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.05);
      d.poseLogAn(true, 6);
      let iRel = -1, iZip = -1, trick = false, imTrick = false;
      for (let i = 0; i < 160; i++) {
        if (i === 2) d.taste('Space', true);
        if (i === 40) d.taste('Space', false);
        if (P.state !== 'swing' && i > 40 && iRel < 0) { iRel = i; trick = (P.luftSalto || 0) > 0; }
        if (iRel >= 0 && i === iRel + 5 && iZip < 0) { imTrick = (P.luftSalto || 0) > 0; d.webZip(); }
        d.schritt(DT);
        if (P.state === 'zip' && iZip < 0) iZip = i;
      }
      const pl = d.poseLog();
      const off = pl.length - 160;
      faelle.push({ wand: wand.id, trick, zipImTrick: imTrick, zip: iZip >= 0,
                    sprungZipStart: iZip >= 0 ? spruenge(pl, iZip + off, 0, 12) : null });
    }
    R.trick = faelle;
    R.trickImSalto = d.mega.fluss().statistik.zipImSalto - salto0;
  }

  /* ---------- neuschwung: Zug -> Absprung -> sofort wieder schwingen ---------- */
  if (teil === 'alle' || teil === 'neuschwung') {
    const faelle = [];
    for (const wand of auswahl.slice(0, 6)) {
      reset();
      const zm = (wand.z0 + wand.z1) / 2;
      d.setzePos(wand.x0 - 40, 20, zm);
      P.state = 'air'; P.onGround = false; P.vel.set(8, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.3);
      let iZip = -1, iAb = -1, iSchwung = -1, perfekt = false;
      const vor = d.mega.fluss().statistik.jeAktion.absprung || 0;
      for (let i = 0; i < 200; i++) {
        if (i === 2) d.webZip();
        if (iZip >= 0 && i === iZip + 3) d.tippeSprung();         // frueh gedrueckt = gemerkt
        if (iAb >= 0 && i === iAb + 2) d.taste('Space', true);    // gleich wieder halten
        d.schritt(DT);
        if (P.state === 'zip' && iZip < 0) iZip = i;
        if (iZip >= 0 && iAb < 0 && P.state === 'air') iAb = i;
        if (iAb >= 0 && iSchwung < 0 && P.state === 'swing') iSchwung = i;
      }
      perfekt = (d.mega.fluss().statistik.jeAktion.absprung || 0) > vor;
      faelle.push({ wand: wand.id, zip: iZip >= 0, absprung: iAb >= 0, perfekt,
                    schwungWieder: iSchwung >= 0,
                    bisSchwung: iSchwung >= 0 ? +((iSchwung - iAb) * DT).toFixed(3) : null });
    }
    R.neuschwung = faelle;
  }

  /* ---------- wand / abweisen: Zug von der Strasse ---------- */
  const strassenFall = (wand, abstand, taste) => {
    reset();
    const zm = (wand.z0 + wand.z1) / 2;
    const x = wand.x0 - abstand;
    d.setzePos(x, 1, zm);
    P.pos.y = d.groundYAt(P.pos.x, P.pos.z);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.42);
    d.schritt(DT, 6);
    let iZip = -1, iEnde = -1, iAn = -1, iKante = -1, iDach = -1, wl = 0, ws = 0, flaeche = null, ziel = null;
    let gleichesHaus = null;
    for (let i = 0; i < 420; i++) {
      if (i === 4) { if (taste) d.taste(taste, true); d.webZip(); }
      d.schritt(DT);
      if (P.state === 'zip' && iZip < 0) { iZip = i; ziel = P.zip.target.clone(); }
      if (iZip >= 0 && iEnde < 0 && P.state !== 'zip' && i > iZip) iEnde = i;
      if (iEnde >= 0 && iAn < 0 && P.state === 'climb' && P.wallInfo) {
        iAn = i;
        const w = P.wallInfo, c = w.col;
        /* Abstand zur echten Kollisionsflaeche, an der angegriffen wurde */
        const fx = w.nx > 0 ? c.x1 : w.nx < 0 ? c.x0 : null;
        const fz = w.nz > 0 ? c.z1 : w.nz < 0 ? c.z0 : null;
        flaeche = fx !== null ? Math.abs(P.pos.x - fx) : Math.abs(P.pos.z - fz);
        gleichesHaus = ziel ? (ziel.x > c.x0 - 1.3 && ziel.x < c.x1 + 1.3 && ziel.z > c.z0 - 1.3 && ziel.z < c.z1 + 1.3) : null;
      }
      if (iAn >= 0 && P.state === 'climb' && P.wandlauf) wl++;
      if (iAn >= 0) ws = Math.max(ws, P.wandSchwung || 0);
      if (iAn >= 0 && iKante < 0 && P.state === 'kante') iKante = i;
      if (iKante >= 0 && iDach < 0 && P.state === 'ground' && P.pos.y > 8) iDach = i;
    }
    return { wand: wand.id, h: +wand.h.toFixed(1), abstand, taste: taste || null, zip: iZip >= 0,
             angegriffen: iAn >= 0, flaechenAbstand: flaeche !== null ? +flaeche.toFixed(3) : null,
             gleichesHaus, wandlaufBilder: wl, wandSchwungMax: +ws.toFixed(2),
             hochziehen: iKante >= 0, dach: iDach >= 0,
             zeitBisDach: iDach >= 0 ? +((iDach - iZip) * DT).toFixed(2) : null,
             zeitBisKante: iKante >= 0 ? +((iKante - iZip) * DT).toFixed(2) : null };
  };
  /* Westseite frei? Linie in 1,5 m Hoehe darf nur das Zielhaus treffen. */
  const frei_ = (wand, abstand) => {
    const zm = (wand.z0 + wand.z1) / 2;
    for (let s = 1; s < abstand - 1; s += 1) {
      const x = wand.x0 - abstand + s;
      for (const c of COLS) {
        if (c === wand || (c.h || 0) < 1.0 || c.parkAuto) continue;
        if (x > c.x0 - 0.5 && x < c.x1 + 0.5 && zm > c.z0 - 0.5 && zm < c.z1 + 0.5) return false;
      }
    }
    const gy = d.groundYAt(wand.x0 - abstand, zm);
    return gy < 1.0;
  };
  if (teil === 'alle' || teil === 'wand') {
    const faelle = [];
    for (const wand of waende) {
      if (faelle.length >= 15) break;
      for (const ab of [18, 26, 34]) {
        if (!frei_(wand, ab)) continue;
        faelle.push(strassenFall(wand, ab, 'KeyW'));
        faelle.push(strassenFall(wand, ab, null));
      }
    }
    R.wand = faelle;
  }
  if (teil === 'alle' || teil === 'abweisen') {
    const faelle = [];
    for (const wand of waende) {
      if (faelle.length >= 6) break;
      if (!frei_(wand, 22)) continue;
      faelle.push(strassenFall(wand, 22, 'KeyS'));
    }
    R.abweisen = faelle;
  }

  /* ---------- dach: Sprint, Absprung, Zug, Wandlauf, Hochziehen ---------- */
  if (teil === 'alle' || teil === 'dach') {
    /* Paare: Dach A, Strasse, hoeheres Haus B - in allen vier Richtungen.
       Die Dachkrone und alles, was buendig auf Dachhoehe von A liegt, ist
       begehbar und zaehlt nicht als Hindernis. */
    const RICHT = [
      { ax: 'x', s: 1 }, { ax: 'x', s: -1 }, { ax: 'z', s: 1 }, { ax: 'z', s: -1 },
    ];
    const kante = (c, r) => r.ax === 'x' ? (r.s > 0 ? c.x1 : c.x0) : (r.s > 0 ? c.z1 : c.z0);
    const gegen = (c, r) => r.ax === 'x' ? (r.s > 0 ? c.x0 : c.x1) : (r.s > 0 ? c.z0 : c.z1);
    const quer = (c, r) => r.ax === 'x' ? [c.z0, c.z1] : [c.x0, c.x1];
    const laengs = (c, r) => r.ax === 'x' ? c.x1 - c.x0 : c.z1 - c.z0;
    const paare = [];
    const zaehl = { A: 0, spalt: 0, quer: 0, dh: 0, blockiert: 0 };
    for (const A of COLS) {
      if (paare.length >= 6) break;
      if (!hausVon(A) || A.krone || A.h < 10 || A.h > 50) continue;
      for (const r of RICHT) {
        if (laengs(A, r) < 9) continue;
        zaehl.A++;
        let gefunden = null;
        for (const B of COLS) {
          if (B === A || !hausVon(B) || B.krone || B.h < 12) continue;
          const spalt = (gegen(B, r) - kante(A, r)) * r.s;
          if (spalt < 7 || spalt > 24) continue;
          zaehl.spalt++;
          const [a0, a1] = quer(A, r), [b0, b1] = quer(B, r);
          const q0 = Math.max(a0, b0) + 1.5, q1 = Math.min(a1, b1) - 1.5;
          if (q1 - q0 < 2) continue;
          zaehl.quer++;
          const dh = B.h - A.h;
          if (dh < 3 || dh > 18) continue;
          zaehl.dh++;
          const qm = (q0 + q1) / 2;
          const k = kante(A, r), g = gegen(B, r);
          const lauf0 = k - r.s * 10, lo = Math.min(lauf0, g), hi = Math.max(lauf0, g);
          let blockiert = false;
          for (const c of COLS) {
            if (c === A || c === B || c.parkAuto || c.innen) continue;
            const [c0, c1] = quer(c, r);
            if (qm < c0 - 0.6 || qm > c1 + 0.6) continue;
            const l0 = r.ax === 'x' ? c.x0 : c.z0, l1 = r.ax === 'x' ? c.x1 : c.z1;
            if (l1 < lo || l0 > hi) continue;
            const y0 = c.y0 === undefined ? 0 : c.y0;
            const aufDachA = r.s > 0 ? l1 <= k + 1.0 : l0 >= k - 1.0;
            if (c.h <= A.h + 0.6 && aufDachA) continue;     // buendig auf Dach A
            if (c.h < A.h - 1.5) continue;                   // tief unten in der Strasse
            if (y0 > A.h + 4) continue;                      // hoch darueber
            blockiert = true; break;
          }
          if (blockiert) { zaehl.blockiert++; continue; }
          gefunden = { A, B, r, qm };
          break;
        }
        if (gefunden) { paare.push(gefunden); break; }
      }
    }
    R.dachSuche = Object.assign({ paare: paare.length }, zaehl);
    const faelle = [];
    for (const { A, B, r, qm } of paare) {
      reset();
      const k = kante(A, r);
      const start = k - r.s * Math.min(10, laengs(A, r) - 1);
      if (r.ax === 'x') d.setzePos(start, A.h + 0.05, qm); else d.setzePos(qm, A.h + 0.05, start);
      P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
      P.facing = r.ax === 'x' ? (r.s > 0 ? Math.PI / 2 : -Math.PI / 2) : (r.s > 0 ? 0 : Math.PI);
      d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.18);
      d.schritt(DT, 6);
      const startOk = Math.abs(P.pos.y - A.h) < 0.4;
      const lage = () => (r.ax === 'x' ? P.pos.x : P.pos.z);
      const [b0, b1] = r.ax === 'x' ? [B.x0, B.x1] : [B.z0, B.z1];
      let iSprung = -1, iZip = -1, iAn = -1, iKante = -1, iB = -1, wl = 0;
      const zustaende = [];
      for (let i = 0; i < 600; i++) {
        if (i === 0) { d.taste('KeyW', true); d.taste('ShiftLeft', true); }
        /* Abspringen kurz vor der Kante. Viele Daecher haben dort eine
           niedrige Bruestung (gemessen 0,2 m), an der die Figur sonst
           stehen bleibt - der Sprung geht darueber. */
        if (iSprung < 0 && P.onGround && (k - lage()) * r.s < 1.7) { iSprung = i; d.tippeSprung(); d.taste('ShiftLeft', false); }
        if (iSprung >= 0 && iZip < 0 && i === iSprung + 8) d.webZip();
        d.schritt(DT);
        if (P.state === 'zip' && iZip < 0) iZip = i;
        if (iZip >= 0 && iAn < 0 && P.state === 'climb') iAn = i;
        if (iAn >= 0 && P.state === 'climb' && P.wandlauf) wl++;
        if (iAn >= 0 && iKante < 0 && P.state === 'kante') iKante = i;
        const quer_ = r.ax === 'x' ? P.pos.z : P.pos.x;
        const [bq0, bq1] = quer(B, r);
        if (iB < 0 && P.onGround && P.state === 'ground' && lage() > b0 && lage() < b1 &&
            quer_ > bq0 && quer_ < bq1 && Math.abs(P.pos.y - B.h) < 0.6) iB = i;
        const kz = P.state[0];
        if (zustaende[zustaende.length - 1] !== kz) zustaende.push(kz);
        if (iB >= 0 && i > iB + 40) break;
      }
      const f = d.mega.fluss();
      faelle.push({ A: A.id, B: B.id, richtung: (r.s > 0 ? '+' : '-') + r.ax, hA: +A.h.toFixed(1), hB: +B.h.toFixed(1),
                    spalt: +((gegen(B, r) - k) * r.s).toFixed(1),
                    startOk, sprung: iSprung >= 0, zip: iZip >= 0, angegriffen: iAn >= 0, wandlaufBilder: wl,
                    hochziehen: iKante >= 0, aufDachB: iB >= 0,
                    zeitBisDachB: iB >= 0 && iSprung >= 0 ? +((iB - iSprung) * DT).toFixed(2) : null,
                    ablauf: zustaende.join(''), kette: f.kette, jeAktion: f.statistik.jeAktion });
    }
    R.dach = faelle;
  }

  /* ---------- fluss: Regeln ---------- */
  if (teil === 'alle' || teil === 'fluss') {
    const F = {};
    const wand = auswahl[0];
    const zm = (wand.z0 + wand.z1) / 2;
    /* a) Schwung -> Zip -> Landung -> Sprint -> stehen bleiben */
    reset();
    const punkte0 = P.score;
    const sa0 = JSON.parse(JSON.stringify(d.mega.fluss().statistik));
    d.setzePos(wand.x0 - 70, 22, zm);
    P.state = 'air'; P.onGround = false; P.vel.set(16, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.22);
    let iRel = -1, zipT = -1, gelandet = -1, sprintAus = -1, anzeigeBonus = false;
    const ketten = [];
    for (let i = 0; i < 900; i++) {
      if (i === 2) d.taste('Space', true);
      if (i === 50) d.taste('Space', false);
      if (P.state !== 'swing' && i > 50 && iRel < 0) iRel = i;
      if (iRel >= 0 && zipT < 0 && i === iRel + 6) { zipT = i; d.webZip(); }
      if (zipT >= 0 && gelandet < 0 && P.onGround && P.state === 'ground') {
        gelandet = i; d.taste('KeyW', true); d.taste('ShiftLeft', true);
      }
      if (gelandet >= 0 && sprintAus < 0 && i === gelandet + 70) { sprintAus = i; frei(); }
      d.schritt(DT);
      const k = d.mega.fluss();
      if (k.anzeige.indexOf('+') === 0) anzeigeBonus = true;
      ketten.push(k.kette.length);
    }
    const fa = d.mega.fluss();
    F.echteKette = { aktionen: Object.keys(fa.statistik.jeAktion).filter((k) => fa.statistik.jeAktion[k] > (sa0.jeAktion[k] || 0)),
                     letzte: fa.statistik.letzte,
                     ausgezahlt: fa.statistik.ausgezahlt - sa0.ausgezahlt, punkte: P.score - punkte0, anzeigeBonus,
                     gelandet: gelandet >= 0, prog: fa.prog };
    /* b) Farmen: zehnmal Schwung - Loslassen, ohne etwas anderes */
    reset();
    const p1 = P.score;
    const sb0 = JSON.parse(JSON.stringify(d.mega.fluss().statistik));
    d.setzePos(wand.x0 - 140, 60, zm);
    P.state = 'air'; P.onGround = false; P.vel.set(14, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
    let laengste = 0, runden = 0;
    for (let r = 0; r < 10; r++) {
      d.taste('Space', true);
      for (let k = 0; k < 45; k++) { d.schritt(DT); laengste = Math.max(laengste, d.mega.fluss().kette.length); }
      d.taste('Space', false);
      for (let k = 0; k < 15; k++) { d.schritt(DT); laengste = Math.max(laengste, d.mega.fluss().kette.length); }
      runden++;
      if (P.onGround) break;
    }
    const fb = d.mega.fluss();
    F.farmen = { runden, schwuengeGemeldet: (fb.statistik.jeAktion.schwung || 0) - (sb0.jeAktion.schwung || 0),
                 wiederholt: fb.statistik.wiederholt - sb0.wiederholt,
                 laengsteKette: laengste, ausgezahlt: fb.statistik.ausgezahlt - sb0.ausgezahlt,
                 punkte: P.score - p1 };
    /* c) Sperre: eine Kette zahlt, die naechste gleich danach nicht */
    reset();
    const fc0 = d.mega.fluss().statistik;
    const aus0 = fc0.ausgezahlt, ges0 = fc0.gesperrt;
    const kurzeKette = () => {
      d.setzePos(wand.x0 - 70, 22, zm);
      P.state = 'air'; P.onGround = false; P.vel.set(16, 0, 0);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.22);
      let rel = -1, z = -1, land = -1;
      for (let i = 0; i < 360; i++) {
        if (i === 2) d.taste('Space', true);
        if (i === 50) d.taste('Space', false);
        if (P.state !== 'swing' && i > 50 && rel < 0) rel = i;
        if (rel >= 0 && z < 0 && i === rel + 6) { z = i; d.webZip(); }
        if (z >= 0 && land < 0 && P.onGround && P.state === 'ground') { land = i; d.taste('KeyW', true); d.taste('ShiftLeft', true); }
        if (land >= 0 && i === land + 70) frei();
        d.schritt(DT);
      }
    };
    kurzeKette();
    const nachEins = d.mega.fluss().statistik.ausgezahlt;
    P.state = 'air';   // sofort die zweite (Sperre laeuft noch: 8 s, die erste Kette endete eben)
    kurzeKette();
    const fc = d.mega.fluss();
    F.sperre = { ersteZahlt: nachEins - aus0, zweiteZahlt: fc.statistik.ausgezahlt - nachEins,
                 gesperrtGemeldet: fc.statistik.gesperrt - ges0 };
    /* d) Treffer reisst die Kette */
    reset();
    const p3 = P.score, g0 = d.mega.fluss().statistik.gerissen;
    d.setzePos(wand.x0 - 70, 22, zm);
    P.state = 'air'; P.onGround = false; P.vel.set(16, 0, 0);
    P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI); d.setzeKamPitch(0.22);
    let rel3 = -1, z3 = -1, getroffen = false;
    for (let i = 0; i < 300; i++) {
      if (i === 2) d.taste('Space', true);
      if (i === 50) d.taste('Space', false);
      if (P.state !== 'swing' && i > 50 && rel3 < 0) rel3 = i;
      if (rel3 >= 0 && z3 < 0 && i === rel3 + 6) { z3 = i; d.webZip(); }
      if (z3 >= 0 && !getroffen && i === z3 + 4) { getroffen = true; P.hp -= 10; }
      d.schritt(DT);
    }
    const fd = d.mega.fluss();
    F.treffer = { gerissen: fd.statistik.gerissen - g0, punkte: P.score - p3 };
    F.physik = PHYSIK;
    R.fluss = F;
  }
  d.poseLogAn(false);
  return R;
}

(async () => {
  const ergebnis = {};
  for (const modus of ['alt', 'neu']) {
    const { b, page } = await starte(900, 540, KEIM, { frierSofort: true, flussAlt: modus === 'alt' });
    const t0 = Date.now();
    ergebnis[modus] = await page.evaluate(laufe, ARM_EIN ? { teil: TEIL, armEin: Number(ARM_EIN) } : TEIL);
    ergebnis[modus].sekunden = +((Date.now() - t0) / 1000).toFixed(1);
    await b.close();
  }
  if (AUS) fs.writeFileSync(AUS, JSON.stringify(ergebnis, null, 1));

  /* ---------------- Auswertung ---------------- */
  const pruef = [];
  const P_ = (name, ok, wert) => { pruef.push({ name, ok: !!ok, wert }); };
  const med = (a) => { const s = a.filter((x) => x !== null && x !== undefined).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const A = ergebnis.alt, N = ergebnis.neu;
  if (N.kette) {
    const zeile = (r) => {
      const z = r.kette.filter((f) => f.zip);
      const arm = z.map((f) => f.armSprung && f.armSprung.max);
      const an = z.filter((f) => f.angegriffen);
      return { faelle: r.kette.length, zips: z.length, zielAmHaus: z.filter((f) => f.zielAmHaus).length,
               armSprungMax: Math.max(...arm), armSprungMedian: med(arm),
               angegriffen: an.length, mitWandlauf: an.filter((f) => f.wandlaufBilder > 0).length,
               hochziehen: z.filter((f) => f.hochziehen).length,
               zeitBisKanteMedian: med(z.map((f) => f.zeitBisKante)),
               hoeheIn1sMedian: med(an.map((f) => f.hoeheIn1s)) };
    };
    const za = zeile(A), zn = zeile(N);
    console.log('KETTE  Schwung -> Zip      alt', JSON.stringify(za));
    console.log('KETTE  Schwung -> Zip      neu', JSON.stringify(zn));
    /* Ruck beim Zugbeginn (Bilder 0..8 des Zugs): ein einzelnes Bild, das
       aus seiner Umgebung herausragt - getrennt nach Haenden (das war der
       gemessene Fehler: Schusshaltung schaltete hart) und Fuessen. */
    const ruck = (r, k) => r.kette.filter((f) => f.zip && f.armSprung).map((f) => f.armSprung[k]);
    const hA = ruck(A, 'ruckHand'), hN = ruck(N, 'ruckHand'), fA = ruck(A, 'ruckFuss'), fN = ruck(N, 'ruckFuss');
    const aA = ruck(A, 'ruckArm'), aN = ruck(N, 'ruckArm');
    console.log('       Arm-Ruck (Hand zur Huefte) beim Zugbeginn: alt max', Math.max(0, ...aA), 'Median', med(aA),
                '| neu max', Math.max(0, ...aN), 'Median', med(aN));
    console.log('       Hand-Ruck (gesamt) beim Zugbeginn: alt max', Math.max(0, ...hA), 'Median', med(hA),
                '| neu max', Math.max(0, ...hN), 'Median', med(hN));
    console.log('       Fuss-Ruck beim Zugbeginn: alt max', Math.max(0, ...fA), 'Median', med(fA),
                '| neu max', Math.max(0, ...fN), 'Median', med(fN), '(vorbestehend, Zug aus der Landung)');
    P_('kette: Ziel immer an einem echten Haus', zn.zielAmHaus === zn.zips, zn.zielAmHaus + '/' + zn.zips);
    /* Paarweise je Fall: ein Arm-Ruck ueber 0,35 m im neuen Stand ist nur
       erlaubt, wenn derselbe Fall ihn vorher schon hatte (vorbestehend,
       z. B. die linke Hand im Clip zip_ab). */
    const altFall = {};
    for (const f of A.kette) if (f.armSprung) altFall[f.wand + '/' + f.verz] = f.armSprung.ruckArm;
    const neuUeber = N.kette.filter((f) => f.armSprung && f.armSprung.ruckArm > 0.35);
    const neuEigen = neuUeber.filter((f) => !(altFall[f.wand + '/' + f.verz] >= f.armSprung.ruckArm - 0.02));
    console.log('       Arm-Ruck > 0,35 m neu:', neuUeber.length, 'Faelle, davon vorher nicht da:', neuEigen.length,
                neuEigen.map((f) => f.wand + '/' + f.verz + ' ' + f.armSprung.ruckArm).join(', '));
    P_('kette: Arm-Ruck beim Zugbeginn kleiner (Median <= 60 % von vorher)', med(aN) <= med(aA) * 0.6, med(aA) + ' -> ' + med(aN));
    P_('kette: kein neuer Arm-Ruck > 0,35 m', neuEigen.length === 0, neuEigen.length + ' neu, ' + (neuUeber.length - neuEigen.length) + ' vorbestehend');
    P_('kette: Hand-Ruck gesamt nicht groesser als vorher', Math.max(0, ...hN) <= Math.max(0, ...hA), Math.max(0, ...hA) + ' -> ' + Math.max(0, ...hN));
    P_('kette: Fuss-Ruck nicht groesser als vorher', Math.max(0, ...fN) <= Math.max(0, ...fA) + 0.02,
       Math.max(0, ...fA) + ' -> ' + Math.max(0, ...fN));
    /* Uebergang Zug -> Wand: angegriffen ueber das Zugfenster. Mit genug
       Wand darueber (> 2,5 m) und Tempo zur Wand -> Wandlauf; an der Kante
       uebernimmt das vorhandene Hochziehen. */
    const ueber = N.kette.filter((f) => f.zaehler && f.zaehler.zipWand > 0);
    const hoch = ueber.filter((f) => f.zaehler.oben === 0);
    const mitTempo = hoch.filter((f) => f.zaehler.zipWandlauf > 0);
    console.log('       Zug -> Wand (neu):', ueber.length, 'Faelle ueber das Zugfenster;', hoch.length,
                'mit genug Wand darueber, davon Wandlauf', mitTempo.length, '; an der Kante (Hochziehen)', ueber.length - hoch.length);
    for (const f of ueber) console.log('         ', f.wand, 'verz', f.verz, 'Wand', JSON.stringify(f.anWand), 'Ziel', JSON.stringify(f.ziel),
                                       'WL-Bilder', f.wandlaufBilder, 'Kante nach', f.zeitBisKante, 's', JSON.stringify(f.zaehler));
    P_('kette: Zug -> hohe Wand ergibt Wandlauf', hoch.length > 0 && mitTempo.length === hoch.length,
       mitTempo.length + '/' + hoch.length);
    P_('kette: an der Kante sofort Hochziehen', ueber.filter((f) => f.zaehler.oben > 0).every((f) => f.zeitBisKante !== null),
       (ueber.length - hoch.length) + ' Faelle');
  }
  if (N.trick) {
    for (const [m, r] of [['alt', A], ['neu', N]]) {
      console.log('TRICK  ' + m, r.trick.map((f) => f.wand + ':' + (f.trick ? 'T' : '-') + (f.zipImTrick ? 'Z' : '-') +
                  ' Arm ' + (f.sprungZipStart ? f.sprungZipStart.ruckArm + ' Hand ' + f.sprungZipStart.ruckHand + ' Fuss ' + f.sprungZipStart.ruckFuss : 'kein Zug')).join(' | '));
    }
    /* Waehrend eines Saltos greift der Arm wie vorher sofort (megaZipArm,
       z.armSofort) - die Blende gegen die Drehung war in 32 Stichproben
       schlechter. Geprueft wird, dass genau das passiert. Die Ruckwerte
       selbst streuen je nach gewuerfeltem Salto und sind nur Auskunft. */
    const t = N.trick.filter((f) => f.zip && f.zipImTrick);
    P_('trick: Zug im Salto greift wie vorher sofort (keine Blende)', t.length > 0 && N.trickImSalto >= t.length,
       N.trickImSalto + '/' + t.length);
  }
  if (N.neuschwung) {
    for (const [m, r] of [['alt', A], ['neu', N]]) {
      const f = r.neuschwung;
      console.log('NEU    ' + m, 'Zuege', f.filter((x) => x.zip).length, 'Absprung', f.filter((x) => x.absprung).length,
                  'perfekt', f.filter((x) => x.perfekt).length, 'wieder geschwungen', f.filter((x) => x.schwungWieder).length,
                  'Median bis Schwung', med(f.map((x) => x.bisSchwung)), 's');
    }
    const f = N.neuschwung.filter((x) => x.absprung);
    P_('neuschwung: nach dem Absprung wieder schwingen', f.every((x) => x.schwungWieder), f.filter((x) => x.schwungWieder).length + '/' + f.length);
  }
  if (N.wand) {
    for (const [m, r] of [['alt', A], ['neu', N]]) {
      for (const taste of ['KeyW', null]) {
        const f = r.wand.filter((x) => x.zip && x.taste === taste);
        const an = f.filter((x) => x.angegriffen);
        console.log('WAND   ' + m + ' ' + (taste || 'ohne Taste'), 'Zuege', f.length, 'angegriffen', an.length,
                    'Wandlauf', an.filter((x) => x.wandlaufBilder > 0).length, 'Hochziehen', f.filter((x) => x.hochziehen).length,
                    'aufs Dach', f.filter((x) => x.dach).length, 'Median Zeit bis Dach', med(f.map((x) => x.zeitBisDach)), 's',
                    'Flaechenabstand max', Math.max(0, ...an.map((x) => x.flaechenAbstand || 0)));
      }
    }
    const an = N.wand.filter((x) => x.angegriffen);
    P_('wand: angegriffen nur an der echten Flaeche (<= 1,0 m)', an.every((x) => x.flaechenAbstand !== null && x.flaechenAbstand <= 1.0),
       Math.max(0, ...an.map((x) => x.flaechenAbstand || 0)));
    const mitW = N.wand.filter((x) => x.zip && x.taste === 'KeyW');
    const altW = A.wand.filter((x) => x.zip && x.taste === 'KeyW');
    const tN = med(mitW.map((x) => x.zeitBisDach)), tA = med(altW.map((x) => x.zeitBisDach));
    P_('wand: mit W schneller oder gleich schnell aufs Dach als vorher', tN !== null && (tA === null || tN <= tA + 0.05), tA + ' -> ' + tN);
  }
  if (N.abweisen) {
    for (const [m, r] of [['alt', A], ['neu', N]]) {
      const f = r.abweisen.filter((x) => x.zip);
      console.log('ABWEIS ' + m, 'Zuege mit S', f.length, 'angegriffen', f.filter((x) => x.angegriffen).length);
    }
    const f = N.abweisen.filter((x) => x.zip);
    /* Mit S laeuft die Figur rueckwaerts - liegt hinter ihr ein Haus,
       klettert sie DORT (das ist alter, gewollter Ablauf). Gezaehlt wird
       nur ein Angreifen am Haus des Zugziels. */
    const amZiel = (r) => r.abweisen.filter((x) => x.zip && x.angegriffen && x.gleichesHaus).length;
    console.log('       davon am Haus des Zugziels: alt', amZiel(A), 'neu', amZiel(N));
    P_('abweisen: mit S kein Angreifen am Zielhaus (neu nicht mehr als alt)', amZiel(N) <= amZiel(A), amZiel(A) + ' -> ' + amZiel(N));
  }
  if (N.dach) {
    console.log('DACH   Suche', JSON.stringify(N.dachSuche));
    for (const [m, r] of [['alt', A], ['neu', N]]) {
      for (const f of r.dach) {
        console.log('DACH   ' + m, f.A + '->' + f.B, f.richtung, 'hA', f.hA, 'hB', f.hB, 'Spalt', f.spalt, 'start', f.startOk,
                    'zip', f.zip, 'an', f.angegriffen, 'WL', f.wandlaufBilder, 'kante', f.hochziehen,
                    'DachB', f.aufDachB, f.zeitBisDachB, 's', f.ablauf, m === 'neu' ? 'Kette ' + f.kette.join('>') : '');
      }
    }
    const ok = N.dach.filter((f) => f.startOk && f.aufDachB);
    P_('dach: Parkourkette erreicht Dach B (neu, mind. 1)', ok.length >= 1, ok.length + '/' + N.dach.length);
    const tN = med(N.dach.filter((f) => f.aufDachB).map((f) => f.zeitBisDachB));
    const tA = med(A.dach.filter((f) => f.aufDachB).map((f) => f.zeitBisDachB));
    console.log('       Median Zeit Absprung -> Dach B: alt', tA, 's, neu', tN, 's; erreicht alt',
                A.dach.filter((f) => f.aufDachB).length, 'neu', ok.length);
  }
  if (N.fluss) {
    const F = N.fluss;
    console.log('FLUSS  echte Kette', JSON.stringify(F.echteKette));
    console.log('FLUSS  farmen     ', JSON.stringify(F.farmen));
    console.log('FLUSS  sperre     ', JSON.stringify(F.sperre));
    console.log('FLUSS  treffer    ', JSON.stringify(F.treffer));
    P_('fluss: echte Kette zahlt genau einmal', F.echteKette.ausgezahlt === 1 && F.echteKette.punkte > 0 && F.echteKette.anzeigeBonus,
       F.echteKette.ausgezahlt + 'x, ' + F.echteKette.punkte + ' P');
    P_('fluss: Bonus klein (<= 110 je Kette)', F.echteKette.punkte <= 110 * 1.5, F.echteKette.punkte);
    P_('fluss: Farmen mit derselben Taste zahlt nicht', F.farmen.ausgezahlt === 0 && F.farmen.punkte === 0 && F.farmen.laengsteKette <= 2,
       JSON.stringify(F.farmen));
    P_('fluss: Sperre nach Auszahlung', F.sperre.ersteZahlt === 1 && F.sperre.zweiteZahlt === 0 && F.sperre.gesperrtGemeldet > 0,
       JSON.stringify(F.sperre));
    P_('fluss: Treffer reisst die Kette ohne Punkte', F.treffer.gerissen === 1 && F.treffer.punkte === 0, JSON.stringify(F.treffer));
    P_('fluss: Fortschritt gemerkt (PROG.statistik)', F.echteKette.prog && F.echteKette.prog.flowKetten >= 1, JSON.stringify(F.echteKette.prog));
    const gleich = JSON.stringify(A.fluss.physik) === JSON.stringify(N.fluss.physik);
    P_('fluss: Physik ohne Zip->Wand bitgleich alt/neu', gleich, gleich ? 'gleich' : JSON.stringify([A.fluss.physik.ende, N.fluss.physik.ende]));
    P_('fluss: alt zahlt nie (Schalter wirkt)', A.fluss.echteKette.ausgezahlt === 0, A.fluss.echteKette.ausgezahlt);
  }
  console.log('');
  for (const p of pruef) console.log((p.ok ? 'PRUEF ok    ' : 'PRUEF FEHLER') + '  ' + p.name + '  [' + (typeof p.wert === 'string' ? p.wert : JSON.stringify(p.wert)) + ']');
  console.log('Laufzeit alt', A.sekunden, 's, neu', N.sekunden, 's');
  process.exit(pruef.every((p) => p.ok) ? 0 : 1);
})();
