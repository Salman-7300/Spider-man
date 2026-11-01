/* Mega-Update 1.0: der Spiel-Bot fuer Pruefstand und Abnahmevideo.
   =========================================================================
   Ein einziger Bot fuer beides - tools/pruef/mega-ereignisse.js laesst ihn
   im Browser in einem Zug durchlaufen, tools/pruef/mega-video.js ruft ihn
   Bild fuer Bild auf und fotografiert dazwischen. So zeigt das Video genau
   die Eingaben, die der Pruefstand misst.

   Eingaben sind die echten Spielfunktionen: W/A/D/Shift ueber d.taste,
   Linksklick = tryAttack('punch'), Q = webShot, E = webZip, Leertaste =
   tryJump, C = interagieren. Abgekuerzt wird nur, was nicht Teil des Tests
   ist (siehe Kopf von mega-ereignisse.js): die Anreise und bei der
   Verfolgungsjagd das Mithalten mit dem Wagen.

   Im Browser:  window.__mb.fall(name)        ganzer Ablauf, Ergebnis zurueck
                window.__mb.start(name)       nur aufbauen
                window.__mb.takt(n)           n Bilder weiter, Zustand zurueck
                window.__mb.ergebnis()        Zusammenfassung
                window.__mb.dauer(minuten)    freier Regisseur
   ========================================================================= */
function installiere() {
  const d = __dbg, P = d.player;
  d.frier(true);
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft'];
  const tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
  const HP = P.hpMax || P.hp || 100;
  const MB = window.__mb = {};
  let S = null;                     // Zustand des laufenden Falls

  const neuerZustand = (fall) => ({
    fall, bild: 0, zeit: 0, sperren: fall !== 'dauer', evId: null,
    hart: { haengt: 0, doppelt: 0, fahrzeugBlockiert: 0, markerOhne: 0, gegnerNachCleanup: 0, fahrzeugImHaus: 0 },
    details: new Set(),
    HZ: { ziel: null, best: 1e9, t: 0, aus: 0, seite: 'KeyA', n: 0 },
    aus: { fall, ok: false, phasen: [], ausgang: null, notiz: [] },
    phase: 'aufbau', t0: 0, nachBilder: 0, unten: 0, verfolgT: 0, drift: 0, interT: 0,
    respVorher: d.mega.resp().stat,
    anfang: { gegner: d.enemies.filter((g) => !g.dead).length, zivis: d.civilians.length, wagen: d.cars.length },
  });
  const pruefe = () => {
    if (S.bild % 30) return;
    const h = d.mega.hart();
    for (const k in S.hart) S.hart[k] += h[k];
    for (const x of h.details) if (S.details.size < 20) S.details.add(x);
  };
  const schritt = (n) => {
    for (let i = 0; i < (n || 1); i++) {
      /* Nicht unverwundbar, aber zwischen den Schritten geheilt: getestet
         wird der Ablauf, nicht wie lange der Bot einen Kampf uebersteht. */
      if (P.hp < HP * 0.6) P.hp = HP;
      /* Im Einzelablauf bleibt der Regisseur gesperrt - evEnde gibt ihn
         sonst nach 45-120 s frei, und ein fremdes Ereignis mischt sich ein. */
      if (S.sperren) d.mega.blockiere(true);
      d.schritt(1 / 60); S.bild++; S.zeit += 1 / 60; pruefe();
    }
  };
  const blick = (x, z, neig) => {
    const dx = x - P.pos.x, dz = z - P.pos.z;
    d.kamStart(Math.atan2(-dx, -dz), neig === undefined ? 0.2 : neig);
  };
  const setze = (x, z) => {
    const y = d.groundYAt(x, z, 2);
    P.pos.set(x, y, z); P.vel.set(0, 0, 0);
    P.state = 'ground'; P.onGround = true; P.dead = false; P.hp = HP;
    tasten([]);
  };
  const startPunkt = (x, z, r, wunschX, wunschZ) => {
    let best = null, bw = 1e9;
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const o = d.mega.ort(px, pz);
      if (o.haus || o.wasser || o.y < -0.5 || o.y > 1.5 || o.oben > o.y + 0.5) continue;
      const w = wunschX === undefined ? i : Math.hypot(px - wunschX, pz - wunschZ);
      if (w < bw) { bw = w; best = { x: px, z: pz }; }
    }
    return best;
  };
  const strecke = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let i = 0; i <= n; i++) {
      const o = d.mega.ort(ax + (bx - ax) * i / n, az + (bz - az) * i / n);
      if (o.haus || o.wasser || o.y < -0.5 || o.y > 1.5) return false;
    }
    return true;
  };
  const startAchse = (zx, zz, ax, az, r, zielX, zielZ) => {
    for (const s of [1, -1]) for (const rr of [r, r - 6, r + 6, r - 12]) {
      const px = zx + ax * s * rr, pz = zz + az * s * rr;
      if (strecke(px, pz, zielX, zielZ)) return { x: px, z: pz };
    }
    return null;
  };
  /* Gehen: geradeaus, mit zwei Bot-Grenzen. In einen U-Bahn-Abgang
     gelaufen: zurueck auf die Strasse. Eine Sekunde kein Fortschritt
     (Baum, Bank, Kiosk): kurz seitlich und einmal springen. */
  const hin = (x, z, sprint, tol) => {
    const H = S.HZ;
    if (P.pos.y < -1.0 && P.onGround) {
      const sp2 = startPunkt(x, z, 3) || startPunkt(x, z, 6);
      if (sp2) { setze(sp2.x, sp2.z); S.unten++; }
    }
    const dist = Math.hypot(x - P.pos.x, z - P.pos.z);
    if (dist < (tol || 1.2)) { tasten([]); return true; }
    if (!H.ziel || Math.hypot(H.ziel[0] - x, H.ziel[1] - z) > 3) { H.ziel = [x, z]; H.best = dist; H.t = 0; }
    if (dist < H.best - 0.3) { H.best = dist; H.t = 0; } else H.t += 1 / 60;
    if (H.aus > 0) { H.aus -= 1 / 60; tasten(['KeyW', H.seite]); return false; }
    if (H.t > 1.0 && P.onGround) {
      H.t = 0; H.aus = 0.6; H.seite = H.seite === 'KeyA' ? 'KeyD' : 'KeyA'; H.n++;
      d.tryJump();
    }
    if (S.bild % 2 === 0) blick(x, z);
    tasten(sprint && dist > 4 ? ['KeyW', 'ShiftLeft'] : ['KeyW']);
    return false;
  };
  const ev = () => {
    const l = d.mega.ereignisse();
    return (S.evId === null ? l[0] : l.find((q) => q.id === S.evId)) || null;
  };
  const naechsterGegner = (e) => {
    let g = null, gd = 1e9;
    for (const x of e.gegner) {
      if (x.tot || x.gestoppt || x.imAuto) continue;
      const dd = Math.hypot(x.x - P.pos.x, x.z - P.pos.z);
      if (dd < gd) { gd = dd; g = x; }
    }
    return g ? Object.assign({ d: gd }, g) : null;
  };
  /* Kampf: hingehen, ansehen, schlagen. Wer flieht, bekommt das Netz. */
  const kaempfe = (g) => {
    if (g.flieht) {
      if (g.d < 22) { blick(g.x, g.z, 0.05); if (S.bild % 20 === 0) d.webShot(); }
      hin(g.x, g.z, true, 1.0);
    } else if (g.d > 1.6) hin(g.x, g.z, false, 1.4);
    else { tasten([]); blick(g.x, g.z, 0.1); if (S.bild % 14 === 0) d.tryAttack('punch'); }
  };
  const ART = { laden: 'laden', autodieb: 'autodieb', direkt: 'autodieb', dach: 'dachrettung', unfall: 'unfall' };

  /* ---- Steuerung je Fall: eine Entscheidung je Bild ---- */
  const steuern = {
    laden(x) {
      const B = x.beute;
      if (B && B.zustand === 'liegt') hin(B.x, B.z, true, 0.8);
      else if (B && B.zustand === 'held') {
        hin(x.laden.kx, x.laden.kz, true, 1.6);
        if (d.mega.kandidat() === 'Beute zurückgeben') d.mega.interagieren();
      } else {
        const g = naechsterGegner(x);
        if (g) kaempfe(g); else hin(x.ort.x, x.ort.z, true, 2);
      }
    },
    autodieb(x) { steuern.direkt(x, true); },
    direkt(x, zuLangsam) {
      const dieb = x.gegner.find((g) => g.rolle === 'dieb' || g.rolle === 'gefasst') || x.gegner[0];
      if (x.phase === 'eskalation' && x.autoPos) {
        /* Verfolgung: dem Wagen nachgefuehrt, Netz im Blickkegel. */
        S.verfolgT += 1 / 60;
        const A = x.autoPos, dd = Math.hypot(A.x - P.pos.x, A.z - P.pos.z);
        if (dd > 14 || dd < 5) {
          const car = d.cars[x.auto];
          const ax = car.axis === 'x' ? car.dir : 0, az = car.axis === 'z' ? car.dir : 0;
          setze(A.x - ax * 10, A.z - az * 10);
          S.drift++;
        }
        blick(A.x, A.z, 0.0);
        tasten(['KeyW', 'ShiftLeft']);
        if (S.bild % 25 === 0) d.webShot();
      } else if (zuLangsam && ['annaeherung', 'entdeckt', 'verborgen', 'intervention'].includes(x.phase)) {
        /* Bewusst zu langsam: hingehen, nicht angreifen - er soll einsteigen. */
        hin(dieb.x, dieb.z, false, 8);
      } else {
        const g = (!dieb.tot && !dieb.gestoppt && !dieb.imAuto)
          ? Object.assign({ d: Math.hypot(dieb.x - P.pos.x, dieb.z - P.pos.z) }, dieb) : naechsterGegner(x);
        if (g && !zuLangsam && x.phase === 'intervention') {
          blick(g.x, g.z, 0.05);
          if (S.bild % 6 === 0) d.webShot();
          S.interT++;
        } else if (g) kaempfe(g);
        else hin(x.ort.x, x.ort.z, true, 3);
      }
    },
    dach(x) {
      const pers = x.person, D = x.dach;
      const z = pers ? pers.zustand : null;
      if (z === 'getragen') {
        /* Vom Dach zur Strasse: ueber die Kante, springen, fallen, landen.
           An der Wand stoesst er sich mit der Leertaste ab; kommt er auf
           einem Dachteil nicht weiter, sucht er eine Richtung zur Strasse. */
        S.ab = S.ab || { best: 1e9, t: 0, richt: null, dreh: 0 };
        const A = S.ab;
        let zx = D.ox + D.nx * 10, zz = D.oz + D.nz * 10;
        const dz0 = Math.hypot(zx - P.pos.x, zz - P.pos.z);
        if (dz0 < A.best - 0.5) { A.best = dz0; A.t = 0; } else A.t += 1 / 60;
        if (A.t > 1.5 && P.pos.y > 4) {
          A.t = 0; A.best = 1e9; A.richt = null;
          for (let k = 0; k < 8 && !A.richt; k++) {
            A.dreh += 3;
            const w = (k + A.dreh) / 8 * Math.PI * 2;
            const o = d.mega.ort(P.pos.x + Math.cos(w) * 7, P.pos.z + Math.sin(w) * 7);
            if (!o.haus && o.oben < 3) A.richt = { x: P.pos.x + Math.cos(w) * 12, z: P.pos.z + Math.sin(w) * 12 };
          }
        }
        if (A.richt) { zx = A.richt.x; zz = A.richt.z; }
        hin(zx, zz, false, 1.0);
        if (P.state === 'climb' && S.bild % 30 === 0) { blick(zx, zz, 0.2); d.tryJump(); }
        else if (P.onGround && P.pos.y > 5 && S.bild % 30 === 0) d.tryJump();
      } else if (z === 'wartet' || z === 'haengt') {
        /* Wie ein Spieler: bis 12 m vor die Fassade, steil nach oben zielen
           und mit E zur Kante ziehen; an der Wand hinauf; haengt er fest
           (Vordach), noch einmal ziehen; oben zur Person und C. */
        S.weg = S.weg || { zuege: 0, letzteY: 0, stillT: 0 };
        const W = S.weg;
        const fx = D.hx + D.nx * 0.2, fz = D.hz + D.nz * 0.2;
        const dd = Math.hypot(fx - P.pos.x, fz - P.pos.z);
        if (d.mega.kandidat() === 'Person sichern') { tasten([]); d.mega.interagieren(); }
        else if (P.state === 'zip') tasten([]);
        else if (P.state === 'climb') {
          tasten(['KeyW']);
          W.stillT = Math.abs(P.pos.y - W.letzteY) < 0.05 ? W.stillT + 1 / 60 : 0;
          W.letzteY = P.pos.y;
          if (W.stillT > 1.2 && W.zuege < 6 && P.pos.y < D.dachY - 3) {
            blick(D.hx - D.nx * 2, D.hz - D.nz * 2, 1.1);
            d.webZip(); W.zuege++; W.stillT = 0;
          }
        } else if (P.pos.y > D.dachY - 1) hin(D.px, D.pz, false, 0.6);
        else if (dd > 13) hin(fx + D.nx * 11, fz + D.nz * 11, true, 1.0);
        else if (W.zuege < 6 && P.onGround && S.bild % 40 === 0) {
          blick(D.hx - D.nx * 2, D.hz - D.nz * 2, 1.1);
          d.webZip(); W.zuege++;
        } else if (W.zuege >= 6) { blick(D.hx - D.nx * 3, D.hz - D.nz * 3, 0.2); tasten(['KeyW']); }
        else tasten([]);
      } else if (pers && pers.hilfeBar) {
        hin(pers.x, pers.z, true, 1.6);
        if (Math.hypot(pers.x - P.pos.x, pers.z - P.pos.z) < 2.6) d.mega.interagieren();
      } else tasten([]);
    },
    unfall(x) {
      const R = x.rettung, F = x.fahrer;
      if (R && R.hilfeBar) {
        hin(R.x, R.z, true, 1.4);
        if (Math.hypot(R.x - P.pos.x, R.z - P.pos.z) < 2.4) d.mega.interagieren();
      } else if (F && F.imWagen) {
        /* Erst eine Weile zusehen, damit die Eskalation (Rauch) kommt. */
        if (x.phase === 'intervention' && S.warten === undefined) S.warten = 0;
        if (S.warten !== undefined && x.phase !== 'eskalation' && S.warten < 15) {
          S.warten += 1 / 60; tasten([]);
        } else {
          hin(x.autoPos.x, x.autoPos.z, false, 2.4);
          if (d.mega.kandidat() === 'Tür aufreißen') d.mega.interagieren();
        }
      } else if (F && F.hilfeBar) {
        hin(F.x, F.z, true, 1.4);
        if (Math.hypot(F.x - P.pos.x, F.z - P.pos.z) < 2.4) d.mega.interagieren();
      } else hin(x.ort.x, x.ort.z, false, 4);
    },
  };

  MB.start = (fall) => {
    S = neuerZustand(fall);
    d.evAlleBeenden();
    d.mega.blockiere(true);
    schritt(10);
    const art = ART[fall];
    let e = null;
    for (let v = 0; v < 8 && !e; v++) {
      e = d.evStarte(art);
      /* evStarte gibt dem Regisseur 20 s Ruhe - fuer den Einzelablauf wieder sperren. */
      d.mega.blockiere(true);
      if (e) S.evId = e.id;
      if (e && fall === 'dach') {
        /* Nur Daecher bis 30 m, die ein Bot in der Zeit erreicht - die
           Auswahl selbst bleibt die des Spiels. */
        const x = ev();
        if (!x || !x.dach || x.dach.dachY > 30.5) { d.evAlleBeenden(); schritt(5); e = null; S.evId = null; }
      }
      if (!e) { setze(P.pos.x + 37, P.pos.z - 23); schritt(5); }
    }
    if (!e) { S.aus.notiz.push('Ereignis nicht aufgebaut'); S.phase = 'fertig'; return S.aus; }
    const x = ev();
    S.aus.aufbau = { ort: x.ort, gegner: x.gegner.length, laden: x.laden ? x.laden.programm : null,
                     dach: x.dach ? +x.dach.dachY.toFixed(1) : null, fahrer: !!x.fahrer, besitzer: x.besitzer >= 0 };
    /* Anreise abgekuerzt: 30-40 m vor den Ort, auf der Strasse, mit freiem Weg. */
    let sp = null;
    if (x.dach) {
      const D = x.dach;
      sp = startAchse(D.ox, D.oz, D.nx, D.nz, 20, D.ox, D.oz) || { x: D.ox + D.nx * 4, z: D.oz + D.nz * 4 };
    } else if (x.autoPos) {
      const car = d.cars[x.auto];
      sp = startAchse(x.autoPos.x, x.autoPos.z, car.axis === 'x' ? 1 : 0, car.axis === 'z' ? 1 : 0,
                      fall === 'direkt' ? 30 : 36, x.autoPos.x, x.autoPos.z);
    } else if (x.laden) {
      const L = x.laden;
      sp = startAchse(L.qx + L.nx * 5, L.qz + L.nz * 5, -L.nz, L.nx, 34, L.qx, L.qz);
    }
    if (!sp) sp = startPunkt(x.ort.x, x.ort.z, 34) || startPunkt(x.ort.x, x.ort.z, 44);
    if (!sp) S.aus.notiz.push('kein Startpunkt'); else setze(sp.x, sp.z);
    if (fall === 'dach') {
      /* E nimmt zuerst einen Gegner im Kegel - ein Strassenganove in der
         Naehe gehoert nicht zu diesem Ablauf und wird hier herausgenommen. */
      for (const g of d.enemies) {
        if (g.dead || g.eventId || g.boss) continue;
        if (Math.hypot(g.pos.x - x.ort.x, g.pos.z - x.ort.z) > 90) continue;
        g.dead = true; g.deadT = 0.05; g.liegt = true;
        S.aus.ganovenEntfernt = (S.aus.ganovenEntfernt || 0) + 1;
      }
    }
    S.t0 = S.zeit; S.phase = 'lauf';
    return { ok: true, aufbau: S.aus.aufbau };
  };

  /* n Bilder weiter. Rueckgabe: kurzer Zustand fuer das Video. */
  MB.takt = (n) => {
    for (let i = 0; i < (n || 1); i++) {
      if (!S || S.phase === 'fertig') break;
      if (S.phase === 'lauf') {
        const x = ev();
        if (!x) { S.phase = 'nach'; continue; }
        S.aus.phasen = x.phasen;
        if (x.zustand === 'GELOEST' || x.zustand === 'GESCHEITERT') {
          if (S.aus.ausgang === null) {
            S.aus.ausgang = x.zustand; S.aus.ziel = x.ziel; S.aus.dauer = +(S.zeit - S.t0).toFixed(1);
          }
          tasten([]);
        } else if (S.zeit - S.t0 > 240) {
          S.aus.notiz.push('kein Ausgang in 240 s'); S.phase = 'nach'; tasten([]); continue;
        } else {
          steuern[S.fall](x);
          if (S.bild % 30 === 0) {
            const z = d.mega.zuschauer(x.ort.x, x.ort.z, 30);
            S.aus.zuschauerMax = S.aus.zuschauerMax || { gaffen: 0, fliehen: 0, jubeln: 0 };
            for (const k in z) S.aus.zuschauerMax[k] = Math.max(S.aus.zuschauerMax[k], z[k]);
          }
        }
        schritt(1);
      } else if (S.phase === 'nach') {
        /* Nach dem Aufraeumen noch 10 s weiter - es darf nichts liegen bleiben. */
        S.nachBilder++;
        schritt(1);
        if (S.nachBilder >= 600 || S.zeit - S.t0 > 480) S.phase = 'fertig';
      }
    }
    const x = S && S.phase !== 'fertig' ? ev() : null;
    return { phase: S ? S.phase : 'fertig', ev: x ? { phase: x.phase, zustand: x.zustand, ziel: x.ziel } : null,
             prompt: d.mega.prompt(), zeit: S ? +S.zeit.toFixed(2) : 0 };
  };

  MB.ergebnis = () => {
    const aus = S.aus;
    aus.ok = aus.ausgang === 'GELOEST';
    aus.hart = S.hart;
    aus.details = [...S.details];
    aus.objekte = d.mega.objekte();
    aus.statistik = d.mega.statistik();
    const rs = d.mega.resp().stat;
    aus.resp = {};
    for (const k in rs) if (typeof rs[k] === 'number' && k !== 'autojagdMinAbstand' && rs[k] !== S.respVorher[k])
      aus.resp[k] = rs[k] - (S.respVorher[k] || 0);
    aus.respOffen = d.mega.resp().liste.length;
    aus.welt = { gegnerVorher: S.anfang.gegner, gegnerNachher: d.enemies.filter((g) => !g.dead).length,
                 zivisVorher: S.anfang.zivis, zivisNachher: d.civilians.length,
                 wagenVorher: S.anfang.wagen, wagenNachher: d.cars.length,
                 zivisMitRolle: d.civilians.filter((c) => c.eventId || c.dachRettung || c.imWagen || c.megaHeim).length,
                 wagenMitRolle: d.cars.filter((c) => c.eventId || c.flucht || c.leer || c.diebstahl).length };
    aus.bot = { ausUBahn: S.unten, ausweichen: S.HZ.n, verfolgungS: +S.verfolgT.toFixed(1),
                nachfuehrungen: S.drift, netzIntervention: S.interT, zuege: S.weg ? S.weg.zuege : 0 };
    aus.zeit = +S.zeit.toFixed(1);
    return aus;
  };

  MB.fall = (fall) => {
    const st = MB.start(fall);
    if (S.phase === 'fertig') return MB.ergebnis();
    while (S.phase !== 'fertig') MB.takt(60);
    return MB.ergebnis();
  };

  /* Freier Lauf: der Regisseur entscheidet allein, der Held laeuft nur
     herum. Prueft vor allem die Wege, auf denen Ereignisse auslaufen oder
     scheitern, und das Zusammenspiel aller Arten. */
  MB.dauer = (minuten) => {
    S = neuerZustand('dauer');
    d.evAlleBeenden();
    d.mega.blockiere(false);
    d.evRuheAus();
    const ziele = [[25, 25], [-120, 80], [-200, -150], [60, -180], [130, 40], [-60, 150], [-260, 20]];
    let zi = 0;
    const arten = {}, gesehen = new Set();
    const ende = minuten * 60;
    while (S.zeit < ende) {
      const z = ziele[zi % ziele.length];
      if (hin(z[0], z[1], false, 6)) zi++;
      if (S.bild % 600 === 0 && P.state !== 'ground') setze(P.pos.x, P.pos.z);
      if (S.bild % 1800 === 0) d.evRuheAus();
      if (S.bild % 30 === 0) {
        for (const e of d.mega.ereignisse()) {
          if (!gesehen.has(e.id)) { gesehen.add(e.id); arten[e.art] = (arten[e.art] || 0) + 1; }
        }
      }
      schritt(1);
    }
    tasten([]);
    S.aus.arten = arten;
    S.aus.evStatistik = d.evStatistik();
    S.aus.phasenStatistik = d.mega.phasenStatistik();
    S.sperren = true;
    d.evAlleBeenden();
    schritt(600);
    S.aus.ausgang = 'GELOEST';
    return MB.ergebnis();
  };
}
module.exports = { botCode: '(' + installiere.toString() + ')();' };
