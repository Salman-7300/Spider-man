/* Messcode fuer tools/pruef/ueberhang-klettern.js (laeuft im Spiel, per
   page.evaluate(messCode)): Feinraster der sichtbaren Geometrie, Koerper-
   pruefung, regulaere und kuenstliche Kletterwege. Siehe dort. */
function messCode() {
  const T = THREE, d = __dbg, P = d.player;
  const UK = window.__uk = {};
  const ray = new T.Raycaster(), vO = new T.Vector3(), vD = new T.Vector3(), nm = new T.Matrix3(), nW = new T.Vector3();
  let H = null;                      // aktuelles Haus: {c, nx, nz, ebene, meshe, cache}
  UK.haus = (id, nx, nz) => {
    const c = d.colliders.find((q) => q.id === id);
    const meshe = [];
    for (const o of d.hausModelle()) { const K = o.userData.hausKiste; if (K && K.koll === c) o.traverse((m) => { if (m.isMesh) meshe.push(m); }); }
    d.szene.updateMatrixWorld(true);
    H = { c, nx, nz, ebene: nx > 0 ? c.x1 : nx < 0 ? c.x0 : nz > 0 ? c.z1 : c.z0, meshe, cache: new Map(), modell: meshe.length > 0 };
    return { modell: H.modell, meshe: meshe.length, x: [c.x0, c.x1], z: [c.z0, c.z1], h: c.h };
  };
  const lat = (x, z) => (H.nx !== 0 ? z : x);
  UK.ebene = (seite) => (seite[0] > 0 ? H.c.x1 : seite[0] < 0 ? H.c.x0 : seite[1] > 0 ? H.c.z1 : H.c.z0);
  const tief = (x, z) => (H.nx !== 0 ? (H.ebene - x) * H.nx : (H.ebene - z) * H.nz);   // + = hinter der Kiste
  /* Schnitte eines Strahls von 3 m vor der Kiste an (t, y) hinein */
  const schnitte = (t, y) => {
    const ti = Math.round(t / 0.05), yi = Math.round(y / 0.05), k = ti + '|' + yi;
    let s = H.cache.get(k);
    if (s) return s;
    s = [];
    if (H.modell) {
      const tt = ti * 0.05, yy = yi * 0.05;
      if (H.nx !== 0) vO.set(H.ebene + H.nx * 3, yy, tt); else vO.set(tt, yy, H.ebene + H.nz * 3);
      vD.set(-H.nx, 0, -H.nz);
      ray.set(vO, vD); ray.near = 0; ray.far = 6;
      const seiten = H.meshe.map((m) => { const a = m.material.side; m.material.side = T.DoubleSide; return a; });
      const tr = ray.intersectObjects(H.meshe, false);
      H.meshe.forEach((m, i) => { m.material.side = seiten[i]; });
      for (const h of tr) {
        nm.getNormalMatrix(h.object.matrixWorld);
        nW.copy(h.face.normal).applyMatrix3(nm).normalize();
        s.push({ d: +(h.distance - 3).toFixed(3), ein: nW.dot(vD) < 0 });
      }
    } else s.push({ d: 0, ein: true });
    H.cache.set(k, s);
    return s;
  };
  /* Ein Punkt in der Tiefe dv an (t, y): 'in' | 'hinter' | 'anbau' | 'frei' */
  UK.punkt = (x, y, z) => {
    const t = lat(x, z), dv = tief(x, z), s = schnitte(t, y);
    let bilanz = 0, vorn = null, erste = null;
    for (const q of s) {
      if (q.d >= dv - 0.01) break;
      if (erste === null) erste = q;
      bilanz += q.ein ? 1 : -1;
      if (q.ein && vorn === null) vorn = q.d;
    }
    if (bilanz > 0) return { k: 'in', tiefe: +(dv - (vorn === null ? 0 : vorn)).toFixed(3) };
    if (vorn !== null) {
      const dahinter = s.find((q) => q.d > dv + 0.01 && q.ein);
      if (erste && erste.d <= 0.1 && dahinter && dahinter.d - dv <= 0.75) return { k: 'anbau', tiefe: 0 };
      return { k: 'hinter', tiefe: +(dv - vorn).toFixed(3) };
    }
    return { k: 'frei', tiefe: 0 };
  };
  /* vorderste sichtbare Flaeche (Tiefe hinter der Kiste) an (t, y) */
  UK.flaeche = (t, y) => { const s = schnitte(t, y); const e = s.find((q) => q.ein); return e ? e.d : null; };
  /* Unterkante des naechsten Ueberhangs ueber y an t: wo die sichtbare
     Flaeche um mehr als 0,2 m vor der Flaeche an der Brust liegt */
  UK.ueberhang = (t, y, dBrust) => {
    for (let yy = y; yy <= y + 3; yy += 0.05) {
      const f = UK.flaeche(t, yy);
      if (f !== null && dBrust !== null && f < dBrust - 0.2) return { y: +yy.toFixed(2), tiefe: f };
    }
    return null;
  };
  const REGION = (name) => {
    const n = name.toLowerCase().replace(/[^a-z]/g, '');
    if (/head|neck/.test(n)) return 'kopf';
    if (/shoulder/.test(n)) return 'schulter';
    if (/forearm|hand|thumb|index|middle|ring|pinky/.test(n)) return 'arm';
    if (/arm/.test(n)) return 'oberarm';
    if (/spine/.test(n)) return 'rumpf';
    if (/hips/.test(n)) return 'becken';
    return 'bein';
  };
  const vv = new T.Vector3(), vA = new T.Vector3();
  let vorher = null;
  UK.koerper = () => {
    const hero = d.heroVisual.root;
    hero.updateMatrixWorld(true);
    const kn = d.animKnochen(['head', 'neck', 'leftarm', 'rightarm', 'spine2', 'hips']);
    const hk = kn.head, nk = kn.neck;
    let ex = hk.x - nk.x, ey = hk.y - nk.y, ez = hk.z - nk.z; const el = Math.hypot(ex, ey, ez) || 1;
    const top = { x: hk.x + ex / el * 0.18, y: hk.y + ey / el * 0.18, z: hk.z + ez / el * 0.18 };
    const reg = { kopf: { n: 0, in: 0, hinter: 0, max: 0 }, schulter: { n: 0, in: 0, hinter: 0, max: 0 }, rumpf: { n: 0, in: 0, hinter: 0, max: 0 },
                  becken: { n: 0, in: 0, hinter: 0, max: 0 }, oberarm: { n: 0, in: 0, hinter: 0, max: 0 }, arm: { n: 0, in: 0, hinter: 0, max: 0 }, bein: { n: 0, in: 0, hinter: 0, max: 0 } };
    hero.traverse((m) => {
      if (!m.isSkinnedMesh || !m.visible || !m.geometry || !m.geometry.attributes.skinIndex) return;
      const pa = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      for (let i = 0; i < pa.count; i += 2) {
        m.boneTransform(i, vv); vv.applyMatrix4(m.matrixWorld);
        const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
        let best = 0, bi = 0;
        for (let j = 0; j < 4; j++) if (ws[j] > best) { best = ws[j]; bi = is[j]; }
        const bone = m.skeleton.bones[bi];
        let r = REGION(bone.name || '');
        if (r === 'oberarm') {
          bone.getWorldPosition(vA);
          if (vA.distanceTo(vv) <= 0.2) r = 'schulter';
        }
        const R = reg[r]; R.n++;
        const p = UK.punkt(vv.x, vv.y, vv.z);
        if (p.k === 'in') { R.in++; if (p.tiefe > R.max) R.max = p.tiefe; }
        else if (p.k === 'hinter') { R.hinter++; if (p.tiefe > R.max) R.max = p.tiefe; }
      }
    });
    for (const R of Object.values(reg)) R.max = +R.max.toFixed(3);
    /* Knochenpunkte und ihr Weg seit dem vorigen Bild */
    const pkt = { kopf: hk, scheitel: top, schulterL: kn.leftarm, schulterR: kn.rightarm, brust: kn.spine2, becken: kn.hips };
    const lageP = {}, weg = {};
    for (const [k, q] of Object.entries(pkt)) {
      const pr = UK.punkt(q.x, q.y, q.z);
      lageP[k] = { t: +lat(q.x, q.z).toFixed(3), y: +q.y.toFixed(3), d: +tief(q.x, q.z).toFixed(3), k: pr.k, tiefe: pr.tiefe };
      if (vorher && vorher[k]) {
        const a = vorher[k];
        for (const f of [0.25, 0.5, 0.75]) {
          const x = a.x + (q.x - a.x) * f, y = a.y + (q.y - a.y) * f, z = a.z + (q.z - a.z) * f;
          if (UK.punkt(x, y, z).k === 'in') { weg[k] = 1; break; }
        }
      }
    }
    vorher = Object.fromEntries(Object.entries(pkt).map(([k, q]) => [k, { x: q.x, y: q.y, z: q.z }]));
    /* Halt: Abstand von Kopf, Brust, Becken, Haenden und Fuessen bis zur
       naechsten sichtbaren Flaeche dahinter; der kleinste zaehlt. Liegt
       hinter KEINEM Koerperteil binnen 0,6 m etwas Sichtbares, haengt die
       Figur an einer unsichtbaren Flaeche. */
    const kh = d.animKnochen(['lefthand', 'righthand', 'leftfoot', 'rightfoot']);
    let halt = Infinity;
    for (const q of [hk, kn.spine2, kn.hips, kh.lefthand, kh.righthand, kh.leftfoot, kh.rightfoot]) {
      if (!q) continue;
      const f = UK.flaeche(lat(q.x, q.z), q.y);
      if (f === null) continue;
      const g = f - tief(q.x, q.z);
      if (g < halt) halt = g;
    }
    return { reg, pkt: lageP, weg, halt: halt === Infinity ? null : +halt.toFixed(3) };
  };
  UK.wegZuruecksetzen = () => { vorher = null; };
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'AltLeft', 'Space', 'KeyZ'];
  UK.tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
  let altPos = null, seitKlettern = 0;
  /* Rahmen des Koerpers (Kopf, Hals, Schultergelenke, Brust, Becken,
     Oberschenkel, Knie) relativ zu player.pos: y0..y1 und laengs l0..l1 */
  const RUMPF = ['head', 'neck', 'leftarm', 'rightarm', 'spine2', 'hips', 'leftupleg', 'rightupleg', 'leftleg', 'rightleg'];
  UK.rumpfRahmen = () => {
    const kn = d.animKnochen(RUMPF);
    let y0 = Infinity, y1 = -Infinity, l0 = Infinity, l1 = -Infinity;
    for (const k of RUMPF) { const q = kn[k]; if (!q) continue; const y = q.y - P.pos.y, l = lat(q.x, q.z) - lat(P.pos.x, P.pos.z);
      if (y < y0) y0 = y; if (y > y1) y1 = y; if (l < l0) l0 = l; if (l > l1) l1 = l; }
    return { y0: +y0.toFixed(3), y1: +y1.toFixed(3), l0: +l0.toFixed(3), l1: +l1.toFixed(3) };
  };
  UK.lage = () => {
    const w = P.wallInfo;
    const t = lat(P.pos.x, P.pos.z);
    const sk = P.state === 'climb' && w && w.col === H.c ? d.hautFlaecheAn(H.c, H.nx, H.nz, P.pos.y, t, true, 0) : null;
    const skV = P.state === 'climb' && w && w.col === H.c ? d.hautFlaecheAn(H.c, H.nx, H.nz, P.pos.y, t, true, 0.6) : null;
    /* Spruenge: senkrecht zur Wand (Tiefe) und was die Geschwindigkeit
       des vorigen Bildes nicht erklaert (Ortssprung) */
    const dJetzt = tief(P.pos.x, P.pos.z);
    const sprungTiefe = altPos ? Math.abs(dJetzt - altPos.d) : 0;
    const sprungRest = altPos ? Math.hypot(P.pos.x - altPos.x - altPos.vx / 60, P.pos.y - altPos.y - altPos.vy / 60, P.pos.z - altPos.z - altPos.vz / 60) : 0;
    const zustandWechsel = altPos ? altPos.st !== P.state : false;
    seitKlettern = P.state === 'climb' ? (zustandWechsel ? 0 : seitKlettern + 1) : 0;
    altPos = { x: P.pos.x, y: P.pos.y, z: P.pos.z, d: dJetzt, vx: P.vel.x, vy: P.vel.y, vz: P.vel.z, st: P.state };
    /* Ziel der Haut ueber dem Rumpfrahmen der gezeigten Haltung */
    let rahmen = null, hautRumpf = null;
    if (sk) {
      rahmen = UK.rumpfRahmen();
      const ya = rahmen.y0 - 0.2, yb = rahmen.y1 + 0.2;
      hautRumpf = d.hautFlaecheAn(H.c, H.nx, H.nz, P.pos.y + ya + 0.3, t + (rahmen.l0 + rahmen.l1) / 2, true, (yb - ya) - 1.1).r;
    }
    return { x: +P.pos.x.toFixed(3), y: +P.pos.y.toFixed(3), z: +P.pos.z.toFixed(3), t: +t.toFixed(3), d: +dJetzt.toFixed(3),
             st: P.state, wand: w ? w.col.id + ':' + w.nx + ',' + w.nz : null, haut: +(P.hautTiefe || 0).toFixed(3),
             hautN: P.hautN ? [+P.hautN.x.toFixed(3), +P.hautN.z.toFixed(3)] : null, vy: +P.vel.y.toFixed(2),
             hautZiel: sk ? sk.r : null, hautZielVoraus: skV ? skV.r : null, rahmen, hautRumpf,
             sprungTiefe: +sprungTiefe.toFixed(3), sprungRest: +sprungRest.toFixed(3), wechsel: zustandWechsel, ansatz: seitKlettern <= 2 };
  };
  UK.altPosLoeschen = () => { altPos = null; };
  /* ---- Wege ---- */
  let W = null;
  const vor = (x, y, z) => ({ x, y, z });
  UK.start = (F, bahn, weg, alleHoehen) => {
    d.frier(true); d.setzeRegen(0); window.__setzeZeit(0.44); d.kamNah(0);
    d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
    UK.tasten([]);
    const info = UK.haus(F.id, F.seite[0], F.seite[1]);
    const [nx, nz] = F.seite;
    const ym = (F.y[0] + F.y[1]) / 2;
    P.wallInfo = null; P.wall = null; P.eckBogen = null; P.vel.set(0, 0, 0);
    W = { F, bahn, weg, nx, nz, ym, phase: 'start', f: 0, pf: 0, info, ende: null, band: [F.y[0] - 2, F.y[1] + 2], seitTaste: null, alleHoehen: !!alleHoehen };
    const pos = (t, ab) => (nx !== 0 ? vor(H.ebene + nx * ab, 0, t) : vor(t, 0, H.ebene + nz * ab));
    if (weg === 'kuenstlich') {
      /* wie fassaden-bahnen.js */
      const tx = nz, tz = -nx;
      const lm = F.X;
      let start;
      if (bahn === 'runter') { start = [lm, F.y[1] + 1.5]; W.taste = 'KeyS'; }
      else if (bahn === 'hoch') { start = [lm, F.y[0] - 2.2]; W.taste = 'KeyW'; }
      else { W.taste = (nx !== 0 ? nx < 0 : nz > 0) ? 'KeyD' : 'KeyA'; start = [lm - 0.475 - 1.5, ym - 0.36]; }
      const p = pos(start[0], 0.15);
      d.setzePos(p.x, start[1], p.z);
      P.vel.set(0, 0, 0); P.state = 'climb'; P.onGround = false;
      P.wallInfo = P.wall = { nx, nz, col: H.c };
      P.eckSperre = 0; P.wandUebergaenge = 0; P.hockeT = 0; P.perchMix = 0;
      P.hautTiefe = 0; P.eckBogen = null; P.eckT = 0;
      d.kamStart(Math.atan2(nx, nz), 0.1);
      for (let i = 0; i < 20; i++) d.schritt(1 / 60);
      d.taste(W.taste, true);
      W.phase = 'bahn'; W.ziel = bahn === 'runter' ? F.y[0] - 2.0 : bahn === 'hoch' ? F.y[1] + 1.3 : lm + 0.475 + 1.5;
      UK.altPosLoeschen();
      return { info };
    }
    /* regulaer: auf dem Gehweg stehen. runter und abquer steigen an der
       Aufstiegsseite (F.aufstieg, sonst die Zielseite) hinauf, quer klebt
       an der Zielseite vom Boden aus an. */
    W.seitTaste = (nx !== 0 ? nx < 0 : nz > 0) ? 'KeyD' : 'KeyA';
    const A = F.aufstieg || { seite: F.seite, x: F.xStart !== undefined ? F.xStart : F.X };
    W.A = A;
    /* direkt: an der Zielstelle selbst hinauf - oben nur umdrehen und an
       derselben Stelle wieder ueber die Kante (kein Weg uebers Dach) */
    W.direkt = !F.aufstieg && F.xStart === undefined;
    W.wege = (F.wegpunkte || []).map((q) => ({ x: q[0], z: q[1] }));
    W.tol = F.toleranz !== undefined ? F.toleranz : 0.3;
    const ebA = UK.ebene(A.seite);
    const posA = (t, ab) => (A.seite[0] !== 0 ? vor(ebA + A.seite[0] * ab, 0, t) : vor(t, 0, ebA + A.seite[1] * ab));
    let p;
    if (bahn === 'quer') p = pos(F.xAnsatz !== undefined ? F.xAnsatz : F.X - 2.5, 4);
    else p = posA(A.x, 6);
    d.setzePos(p.x, d.groundYAt(p.x, p.z), p.z);
    P.state = 'ground'; P.onGround = true;
    for (let i = 0; i < 30; i++) d.schritt(1 / 60);
    W.phase = 'anlauf';
    UK.altPosLoeschen();
    if (bahn === 'quer') { d.kamStart(Math.atan2(nx, nz), 0.15); UK.tasten(['KeyW']); }
    else { d.kamStart(Math.atan2(A.seite[0], A.seite[1]), 0.15); UK.tasten(['KeyW', 'ShiftLeft']); }
    return { info };
  };
  /* n Bilder weiter; liefert, was gemessen wurde */
  UK.schritte = (n, messen) => {
    const aus = [];
    for (let i = 0; i < n && !W.ende; i++) {
      d.schritt(1 / 60);
      W.f++; W.pf++;
      const F = W.F, nx = W.nx, nz = W.nz;
      const im = (y) => W.alleHoehen || (y >= W.band[0] && y <= W.band[1]);
      if (W.weg === 'kuenstlich') {
        const fort = W.bahn === 'hoch' ? P.pos.y : W.bahn === 'runter' ? -P.pos.y : lat(P.pos.x, P.pos.z);
        const zielW = W.bahn === 'runter' ? -W.ziel : W.ziel;
        if (P.state !== 'climb') W.ende = 'zustand ' + P.state;
        else if (fort > zielW) W.ende = 'ziel';
        else if (W.pf > 420) W.ende = 'zeit';
      } else {
        /* regulaer: runter, abquer (hinab bis aufs Band, dann seitwaerts), quer */
        const quer = W.bahn === 'quer';
        if (W.phase === 'anlauf') {
          if (P.state === 'climb') { W.phase = quer ? 'steigen' : 'hoch'; W.pf = 0; UK.tasten(['KeyW']); }
          else if (quer && P.wall && P.onGround && W.pf > 10 && !W.gesprungen) {
            /* wie die echte Taste: keydown setzt die Taste und springt */
            UK.tasten(['KeyW', 'Space']); d.tryJump(); W.gesprungen = W.pf;
          }
          else if (quer && W.gesprungen && W.pf - W.gesprungen === 6) UK.tasten(['KeyW']);
          else if (W.pf > (quer ? 240 : 300)) W.ende = 'kein Ankleben';
        } else if (W.phase === 'hoch') {
          if (P.state === 'ground' && P.pos.y > H.c.h - 0.5) { W.phase = 'dach'; W.pf = 0; UK.tasten([]); }
          else if (W.pf > 2400) W.ende = 'nicht oben (' + P.state + ', y ' + P.pos.y.toFixed(1) + ')';
        } else if (W.phase === 'dach') {
          if (W.pf === 40) { W.phase = W.direkt ? 'halt' : 'zumPunkt'; W.pf = 0; }
        } else if (W.phase === 'zumPunkt') {
          /* auf dem Dach ueber die Wegpunkte (F.wegpunkte, an Dachaufbauten
             vorbei) zum Punkt (F.dachAbstand, sonst 1 m) innerhalb der
             Zielkante, gesteuert wie mit der Maus. Losgelassen wird, wenn
             die Figur von selbst (Auslaufen, rund 0,3 s) im Ziel stehen
             bleibt; nah am Ziel mit der Gehtaste (Alt). */
          const ab = F.dachAbstand !== undefined ? F.dachAbstand : 1.0;
          const wp = W.wege.length > 0;
          const ziel = wp ? W.wege[0] : nx !== 0 ? { x: H.ebene - nx * ab, z: F.X } : { x: F.X, z: H.ebene - nz * ab };
          const sx = P.pos.x + P.vel.x * 0.3, sz = P.pos.z + P.vel.z * 0.3;
          const dx = ziel.x - sx, dz = ziel.z - sz, dist = Math.hypot(dx, dz);
          if (dist < (wp ? 0.5 : W.tol)) {
            if (wp) W.wege.shift();
            else { UK.tasten([]); W.phase = 'halt'; W.pf = 0; }
          } else if (W.pf % 2 === 1) {
            d.kamStart(Math.atan2(-dx / dist, -dz / dist), 0.3);
            UK.tasten(dist < 2 ? ['KeyW', 'AltLeft'] : ['KeyW']);
          }
          if (W.pf > 1200) W.ende = 'Dachpunkt nicht erreicht';
        } else if (W.phase === 'halt') {
          /* stehen, dann mit der Gehtaste (Alt) zur Kante: langsam ueber
             die Kante, damit S die Figur zurueck an die Wand bringt, bevor
             sie schnell faellt */
          if (W.pf >= 30 && Math.hypot(P.vel.x, P.vel.z) < 0.05) {
            W.phase = 'zurKante'; W.pf = 0; W.kanteT = lat(P.pos.x, P.pos.z);
            d.kamStart(Math.atan2(-nx, -nz), 0.3); UK.tasten(['KeyW', 'AltLeft']);
          } else if (W.pf > 300) W.ende = 'steht nicht still';
        } else if (W.phase === 'zurKante') {
          /* steht nach 1 s noch auf dem Dach (Gelaender an der Kante):
             wie ein Spieler darueber springen (W + Space) */
          if (P.state !== 'ground') { W.phase = 'fang'; W.pf = 0; UK.tasten([]); }
          else if (W.pf === 60) { UK.tasten(['KeyW', 'AltLeft', 'Space']); d.tryJump(); }
          else if (W.pf === 66) UK.tasten(['KeyW', 'AltLeft']);
          else if (W.pf > 400) W.ende = 'Kante nicht erreicht';
        } else if (W.phase === 'fang') {
          /* 0,1 s nach der Kante mit S zurueck an die Wand. Sofort
             gedrueckt greift die Figur an ModernOffice_1 die Dachkrone
             (Gesims, eigener Kollider) und klettert an deren Ebene durch
             die Luft hinunter - ein eigener, alter Befund; gemessen wird
             hier die Fassade. Greift sie trotzdem etwas anderes als die
             Zielkiste, endet der Weg mit diesem Befund. */
          if (W.pf === 6) UK.tasten(['KeyS']);
          if (P.state === 'climb') {
            const w = P.wallInfo;
            if (!w || w.col !== H.c) W.ende = 'gefangen an ' + (w ? w.col.id + (w.col.krone ? ' (Dachkrone)' : '') : '?');
            else { W.phase = 'runter'; W.pf = 0; W.fangY = P.pos.y; UK.tasten(['KeyS']); }
          } else if (P.onGround || W.pf > 300) W.ende = 'nicht abgefangen';
        } else if (W.phase === 'runter') {
          if (P.state !== 'climb') W.ende = P.pos.y < 1.2 ? 'unten' : P.state === 'ground' ? 'aufgesetzt (y ' + P.pos.y.toFixed(2) + ')'
                                         : 'losgelassen (' + P.state + ', y ' + P.pos.y.toFixed(2) + ')';
          else if (W.bahn === 'abquer' && P.pos.y <= W.ym - 0.36) { UK.tasten([]); W.phase = 'halten'; W.pf = 0; }
          else if (W.pf > 2400) W.ende = 'zeit';
        } else if (W.phase === 'steigen') {
          if (P.pos.y >= W.ym - 0.36) { UK.tasten([]); W.phase = 'halten'; W.pf = 0; }
          else if (P.state !== 'climb' || W.pf > 600) W.ende = 'nicht auf Bandhoehe (' + P.state + ')';
        } else if (W.phase === 'halten') {
          if (W.pf >= 30) { UK.tasten([W.seitTaste]); W.phase = 'quer'; W.pf = 0; W.tQ0 = lat(P.pos.x, P.pos.z); }
          if (P.state !== 'climb') W.ende = 'losgelassen beim Halten';
        } else if (W.phase === 'quer') {
          const tt = lat(P.pos.x, P.pos.z);
          if (P.state !== 'climb') W.ende = 'losgelassen (' + P.state + ')';
          else if (tt > (W.bahn === 'abquer' ? W.tQ0 + 5 : F.X + 2.5)) W.ende = 'ziel';
          else if (W.pf > 420) W.ende = 'zeit (steht bei t ' + tt.toFixed(2) + ')';
        }
      }
      const L = UK.lage();
      L.f = W.f; L.ph = W.phase;
      const aufZiel = P.wallInfo && P.wallInfo.col === H.c && P.wallInfo.nx === nx && P.wallInfo.nz === nz;
      const messeHier = messen && P.state === 'climb' && aufZiel && im(P.pos.y) &&
        (W.weg === 'kuenstlich' || ['hoch', 'runter', 'steigen', 'halten', 'quer'].includes(W.phase));
      if (messeHier) {
        const K = UK.koerper();
        L.reg = K.reg; L.pkt = K.pkt; L.weg = K.weg; L.halt = K.halt;
        const dB = UK.flaeche(K.pkt.brust.t, K.pkt.brust.y);
        L.flaecheBrust = dB; L.flaecheKopf = UK.flaeche(K.pkt.kopf.t, K.pkt.kopf.y); L.flaecheBecken = UK.flaeche(K.pkt.becken.t, K.pkt.becken.y);
        L.ueberhang = UK.ueberhang(K.pkt.brust.t, K.pkt.brust.y, dB);
      } else UK.wegZuruecksetzen();
      aus.push(L);
    }
    return { ende: W.ende, phase: W.phase, f: W.f, aus };
  };
  UK.ende = () => { UK.tasten([]); return W.ende; };
}

module.exports = { messCode };
