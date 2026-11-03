/* Mega-Update 1.0, M5: der Pruef-Bot fuer die Nebenreihe (Browserseite).
   Benutzt von tools/pruef/mega-neben.js; page.evaluate(botCode) legt
   window.__nb an. Eingaben wie im Spiel (d.taste, tryAttack, webShot,
   tryJump, interagieren), Anreise zu einem Einsatzort abgekuerzt (35 m
   davor). */
/* ---- Bot im Browser: Laufen, Kaempfen, Empfang, Einsatz ---- */
function botCode() {
  const d = __dbg, P = d.player;
  const N = d.neben;
  const TASTEN = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space'];
  const tasten = (an) => { for (const t of TASTEN) d.taste(t, an.includes(t)); };
  const B = window.__nb = { heilen: true, bild: 0, log: [] };
  const HP = () => d.player.hpMax || 100;
  B.schritt = (n) => {
    for (let i = 0; i < (n || 1); i++) {
      if (B.heilen && P.hp < (B.hpVoll || 100) * 0.6) P.hp = B.hpVoll || 100;
      d.mega.blockiere(true);                 // keine fremden Weltereignisse
      d.schritt(1 / 60); B.bild++;
    }
  };
  const blick = (x, z, neig) => {
    const dx = x - P.pos.x, dz = z - P.pos.z;
    d.kamStart(Math.atan2(-dx, -dz), neig === undefined ? 0.2 : neig);
  };
  B.setze = (x, z) => {
    const y = d.groundYAt(x, z, 2);
    P.pos.set(x, y, z); P.vel.set(0, 0, 0);
    P.state = 'ground'; P.onGround = true;
    tasten([]);
  };
  /* Gerade Strecke ohne Haus, Wasser oder Schacht dazwischen? Der Bot geht
     geradeaus - laeuft er gegen eine Fassade, klettert die Figur sie hoch. */
  const strecke = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let i = 0; i <= n; i++) {
      const o = d.mega.ort(ax + (bx - ax) * i / n, az + (bz - az) * i / n);
      if (o.haus || o.wasser || o.y < -0.5 || o.y > 1.5) return false;
    }
    return true;
  };
  /* Ein freier Startpunkt r Meter vor einem Ziel (Strassenebene, kein Haus,
     freie Strecke zum Ziel). */
  B.vorOrt = (x, z, r) => {
    let notfall = null;
    for (const rr of [r, r - 8, r + 8, r - 16, r + 16, 12]) {
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
        if (!N.punktOk(px, pz)) continue;
        if (strecke(px, pz, x, z)) return { x: px, z: pz };
        if (!notfall) notfall = { x: px, z: pz };
      }
    }
    return notfall || { x, z };
  };
  const H = { ziel: null, best: 1e9, t: 0, aus: 0, seite: 'KeyA' };
  /* Gehen: geradeaus, eine Sekunde ohne Fortschritt: kurz seitlich und springen. */
  B.hin = (x, z, sprint, tol) => {
    /* Ungewollt an einer Fassade: abspringen und seitlich weiter. */
    if (P.state === 'climb' && Math.abs(d.groundYAt(x, z, 2) - P.pos.y) > 1.5) {
      d.tryJump(); H.aus = 0.8; H.seite = H.seite === 'KeyA' ? 'KeyD' : 'KeyA';
      B.kletterAb = (B.kletterAb || 0) + 1;
      tasten(['KeyS', H.seite]);
      return false;
    }
    const dist = Math.hypot(x - P.pos.x, z - P.pos.z);
    if (dist < (tol || 1.2)) { tasten([]); return true; }
    if (!H.ziel || Math.hypot(H.ziel[0] - x, H.ziel[1] - z) > 3) { H.ziel = [x, z]; H.best = dist; H.t = 0; }
    if (dist < H.best - 0.3) { H.best = dist; H.t = 0; } else H.t += 1 / 60;
    if (H.aus > 0) { H.aus -= 1 / 60; tasten(['KeyW', H.seite]); return false; }
    if (H.t > 1.0 && P.onGround) { H.t = 0; H.aus = 0.6; H.seite = H.seite === 'KeyA' ? 'KeyD' : 'KeyA'; d.tryJump(); }
    if (B.bild % 2 === 0) blick(x, z);
    tasten(sprint && dist > 4 ? ['KeyW', 'ShiftLeft'] : ['KeyW']);
    return false;
  };
  B.stopp = () => tasten([]);
  /* Naechster lebender Auftragsgegner */
  B.gegner = () => {
    let g = null, gd = 1e9;
    for (const e of d.enemies) {
      if (e.dead || !e.storyGegner || e.policeCustody) continue;
      if (e.schatten && e.schatten.weg > 0) continue;        // im Rauch: nicht zu sehen
      const dd = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
      if (dd < gd) { gd = dd; g = e; }
    }
    return g ? { e: g, d: gd } : null;
  };
  /* Kampf: hingehen, ansehen, schlagen; Fluechtige und SCHATTEN beim
     Auftauchen bekommen das Netz. */
  B.kaempfe = (g) => {
    const e = g.e;
    const S = e.schatten;
    if (S && S.fenster > 0 && g.d < 14) {
      blick(e.pos.x, e.pos.z, 0.05);
      tasten([]);
      if (!B.netzGeschossen || B.bild - B.netzGeschossen > 8) { d.webShot(); B.netzGeschossen = B.bild; B.netzFenster = (B.netzFenster || 0) + 1; }
      return;
    }
    const gewickelt = (e.webT || 0) > 0 && (e.webStufe || 0) >= 2;
    if (e.flieht && !gewickelt) {
      if (g.d < 22) { blick(e.pos.x, e.pos.z, 0.05); if (B.bild % 20 === 0) d.webShot(); }
      B.hin(e.pos.x, e.pos.z, true, 1.0);
    } else if (g.d > 1.6) B.hin(e.pos.x, e.pos.z, false, 1.4);
    else { tasten([]); blick(e.pos.x, e.pos.z, 0.1); if (B.bild % 14 === 0) d.tryAttack('punch'); }
  };

  /* ---- Der Empfang im Kai 7: Tuer (C), drinnen hin (W), C, hinaus ---- */
  B.empfang = () => {
    const T = d.mega.orteTueren().buero;
    const r = { tuer: !!T };
    if (!T) return r;
    B.setze(T.ex + T.nx * 0.6, T.ez + T.nz * 0.6);
    P.facing = Math.atan2(-T.nx, -T.nz);
    B.schritt(8);                              // der Hinweis wird alle 0,1 s aufgefrischt
    r.hinweisTuer = d.mega.prompt();
    d.mega.interagieren();
    for (let i = 0; i < 90 && !(d.innen.active && !d.innen.phase); i++) B.schritt(1);
    B.schritt(10);
    r.drinnen = !!d.innen.active && d.innen.id === 'buero';
    const raum = d.innen.raum;
    const h = raum.aktionen.find((a) => a.id === 'empfang');
    for (let i = 0; i < 600 && !B.hin(h.x, h.z, false, 0.9); i++) B.schritt(1);
    B.stopp(); B.schritt(10);
    r.hinweisEmpfang = d.mega.prompt();
    r.vorher = d.storyStand().aktiv;
    d.mega.interagieren();
    B.schritt(2);
    r.nachher = d.storyStand().aktiv;
    r.phase = d.storyStand().phase;
    r.ziel = d.storyStand().ziel;
    /* hinaus */
    const a = raum.ausgang;
    for (let i = 0; i < 600 && !B.hin(a.x, a.z, false, 0.8); i++) B.schritt(1);
    B.stopp(); B.schritt(6);
    r.hinweisAusgang = d.mega.prompt();
    d.mega.interagieren();
    for (let i = 0; i < 90 && (d.innen.active || d.innen.phase); i++) B.schritt(1);
    B.schritt(4);
    r.draussen = !d.innen.active;
    return r;
  };

  /* ---- Einen Nebenauftrag mit dem Bot spielen, bis er endet ----
     max: Sekunden; opt.stopBei(info) -> true: Bot haelt an (fuer Teile,
     die mitten im Auftrag etwas pruefen). */
  B.spiele = (opt) => {
    opt = opt || {};
    const r = { phasen: [], ausgang: null, rauch: { spruenge: 0, sichtbarImRauch: 0, abstand: [], ungueltig: 0,
                trefferImRauch: 0, fenster: 0, netzImFenster: 0, gerissen: 0, phasenBoss: [] },
                spurenGesehen: [], maxMarken: 0, beobachterFlucht: false, kofferGesehen: false,
                bossLeiste: false, hpMin: 1e9, zielOhneLeuchtturm: 0, bilder: 0 };
    const id = d.storyStand().aktiv;
    let phase = -1, phaseT = 0, letzteAnreise = -1;
    let bossVorher = null, warWeg = false;
    const statVorher = N.statistik();
    const maxBilder = Math.round((opt.max || 600) * 60);
    for (let i = 0; i < maxBilder; i++) {
      const st = d.storyStand();
      if (st.aktiv !== id) { r.ausgang = 'beendet'; break; }
      const info = N.daten();
      if (!info) { r.ausgang = 'keineDaten'; break; }
      if (info.phase !== phase) {
        phase = info.phase; phaseT = 0;
        r.phasen.push([phase, info.ziel, +(B.bild / 60).toFixed(1)]);
      }
      phaseT += 1 / 60;
      if (opt.stopBei && opt.stopBei(info, phaseT)) { r.ausgang = 'gestoppt'; break; }
      /* Anreise abkuerzen: einmal je Phase, wenn das Ziel weit weg ist. */
      const zp = info.zielPos;
      if (zp && letzteAnreise !== phase && Math.hypot(zp.x - P.pos.x, zp.z - P.pos.z) > 60 && !d.innen.active) {
        const s = B.vorOrt(zp.x, zp.z, 35);
        B.setze(s.x, s.z);
        letzteAnreise = phase;
      }
      if (info.spuren) r.maxMarken = Math.max(r.maxMarken, N.marken());
      if (info.beobachter && info.beobachter.flucht) r.beobachterFlucht = true;
      if (info.koffer && info.koffer.sichtbar) r.kofferGesehen = true;
      /* ---- SCHATTEN beobachten ---- */
      const b = info.boss;
      if (b) {
        if (document.getElementById('bosswrap') && document.getElementById('bosswrap').style.display === 'block') r.bossLeiste = true;
        if (r.rauch.phasenBoss.indexOf(b.phase) < 0) r.rauch.phasenBoss.push(b.phase);
        if (b.weg > 0) {
          if (!warWeg) { r.rauch.spruenge++; warWeg = true; bossVorher = b.hp; }
          if (b.sichtbar) r.rauch.sichtbarImRauch++;
          /* Treffer im Rauch zaehlen nicht */
          if (b.hp < bossVorher) r.rauch.trefferImRauch++;
        } else if (warWeg) {
          warWeg = false;
          r.rauch.abstand.push(+Math.hypot(b.pos.x - P.pos.x, b.pos.z - P.pos.z).toFixed(2));
          const o = d.mega.ort(b.pos.x, b.pos.z);
          if (o.haus || o.wasser || Math.abs(b.pos.y - P.pos.y) > 0.8) r.rauch.ungueltig++;
        }
        if (b.fenster > 0) r.rauch.fenster++;
      }
      /* ---- Was der Bot tut ---- */
      const k = N.kandidat();
      if (k === 'Spur untersuchen' || k === 'Koffer sichern') {
        B.stopp();
        if (k === 'Spur untersuchen') r.spurenGesehen.push(d.mega.prompt());
        d.mega.interagieren();
      } else {
        /* Gegner in der Naehe zuerst, sonst zum Ziel (Leuchtturm), sonst
           zum naechsten Auftragsgegner (dorthin zeigt der Leuchtturm). */
        const g = B.gegner();
        if (g && g.d < 30) B.kaempfe(g);
        else if (zp) B.hin(zp.x, zp.z, true, 1.0);
        else if (g) B.kaempfe(g);
        else B.stopp();
      }
      if (!zp && !B.gegner() && info.aufgebaut === false) r.zielOhneLeuchtturm++;
      r.hpMin = Math.min(r.hpMin, P.hp);
      B.schritt(1);
      r.bilder++;
    }
    B.stopp();
    const statNach = N.statistik();
    r.rauch.gerissen = statNach.rauchGerissen - statVorher.rauchGerissen;
    r.rauch.netzImFenster = B.netzFenster || 0;
    r.statistik = statNach;
    return r;
  };
  return true;
}

module.exports = { botCode };
