/* Welche Heldenbewegung laeuft wirklich als Schleife, welche wird als
   Haltung an einer festen Stelle gehalten? Gemessen, nicht gelesen. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player, HV = d.heroVisual;
    if (!HV || !HV.laufStand) return { fehler: 'laufStand fehlt' };
    d.frier(true);
    const gesehen = new Map();
    const eintrag = (s, einmal) => {
      if (!s) return;
      let e = gesehen.get(s.clip);
      if (!e) { e = { tsMin: 9, tsMax: -9, bilder: 0, tMin: 9, tMax: -9, einmal }; gesehen.set(s.clip, e); }
      e.bilder++;
      e.tsMin = Math.min(e.tsMin, s.ts); e.tsMax = Math.max(e.tsMax, s.ts);
      e.tMin = Math.min(e.tMin, s.t); e.tMax = Math.max(e.tMax, s.t);
    };
    const merke = () => {
      eintrag(HV.laufStand(), false);
      if (HV.angriffStand) eintrag(HV.angriffStand(), true);
    };
    const lauf = (n) => { for (let i = 0; i < n; i++) { d.schritt(1 / 60); merke(); } };
    const taste = (t, an) => d.taste(t, an);
    const alleAus = () => { for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','KeyC','KeyZ','Space']) taste(t, false); };

    /* Stehen */
    d.setzePos(0, 0.25, 0); P.state = 'ground'; P.onGround = true;
    alleAus(); lauf(180);
    /* Gehen, Laufen, Sprinten */
    d.geheAn(true); taste('KeyW', true); lauf(240); d.geheAn(false);
    lauf(300);
    taste('ShiftLeft', true); lauf(600);
    taste('ShiftLeft', false); alleAus(); lauf(120);
    /* Ducken und Schleichen */
    d.duckenAn(true); lauf(180); taste('KeyW', true); lauf(180);
    d.duckenAn(false); alleAus(); lauf(60);
    /* Springen, Fallen, Landen */
    d.tippeSprung(); lauf(120);
    d.setzePos(0, 40, 0); P.state = 'air'; P.onGround = false; lauf(180);
    lauf(240);
    /* Schwingen - dieselbe Vorgehensweise wie im Brueckentest, die
       nachweislich zwanzig von zwanzig Fluegen getragen hat. */
    for (let k = 0; k < 6; k++) {
      d.setzePos(-160 + k * 20, 34, -120 + k * 12);
      P.state = 'air'; P.onGround = false;
      P.vel.set(18, 0, 4);
      P.facing = Math.PI / 2; d.setzeKamYaw(P.facing + Math.PI);
      taste('KeyW', true);
      taste('Space', true);        // wie ein Spieler: Netztaste HALTEN
      for (let i = 0; i < 420; i++) { d.schritt(1 / 60); merke(); }
      taste('Space', false);
      alleAus();
    }
    /* Klettern und Wand - ueber den echten Weg: an eine Fassade stellen
       und hineinlaufen, nicht den Zustand von Hand setzen. */
    const haus = d.hausStellen && d.hausStellen.length ? d.hausStellen[3] : null;
    if (haus) {
      d.setzePos(haus.x, 0.25, haus.z - 8);
      P.state = 'ground'; P.onGround = true; P.facing = 0;
      d.setzeKamYaw(Math.PI);
      taste('KeyW', true); lauf(300);
      taste('KeyZ', true); lauf(420);        // KeyZ ist das Wandkleben
      taste('KeyS', true); lauf(120); taste('KeyS', false);
      taste('KeyA', true); lauf(120); taste('KeyA', false);
      taste('KeyW', false); lauf(180);       // still an der Wand
      taste('KeyZ', false); alleAus(); lauf(180);
    }
    /* Gleiten: aus grosser Hoehe fallen und die Gleittaste halten. */
    d.setzePos(-100, 70, -100); P.state = 'air'; P.onGround = false;
    P.vel.set(6, 0, 0); taste('Space', false);
    taste('ShiftLeft', true); lauf(300); taste('ShiftLeft', false); alleAus(); lauf(120);
    /* Landen: kurz ueber dem Boden abwerfen. */
    for (let k = 0; k < 4; k++) {
      d.setzePos(0, 12 + k * 6, 0); P.state = 'air'; P.onGround = false;
      P.vel.set(0, 0, 0); lauf(180);
    }
    /* Kampf */
    alleAus();
    d.setzePos(0, 0.25, 0); P.state = 'ground'; P.onGround = true;
    /* Einen Gegner in Reichweite holen, sonst geht der Schlag ins Leere. */
    if (d.enemies && d.enemies.length) {
      const e = d.enemies[0];
      e.pos.set(2, 0.25, 0); e.dead = false;
    }
    for (let k = 0; k < 10; k++) { d.tryAttack(); lauf(40); }
    for (let k = 0; k < 3; k++) { d.uppercut(); lauf(70); }
    for (let k = 0; k < 3; k++) { d.dodge(); lauf(70); }
    d.webShot(); lauf(60);
    d.setzePos(0, 0.25, 0); P.state = 'ground'; P.onGround = true;
    for (let k = 0; k < 8; k++) { d.tryAttack && d.tryAttack(); lauf(45); }
    d.dodge && d.dodge(); lauf(90);
    d.uppercut && d.uppercut(); lauf(90);
    d.webShot && d.webShot(); lauf(60);
    d.webZip && d.webZip(); lauf(120);

    const out = [];
    for (const [clip, e] of gesehen) out.push({ clip, ...e,
      tsMin: +e.tsMin.toFixed(2), tsMax: +e.tsMax.toFixed(2),
      tMin: +e.tMin.toFixed(3), tMax: +e.tMax.toFixed(3) });
    out.sort((a, b) => b.bilder - a.bilder);
    return { out };
  });
  if (aus.fehler) { console.log('FEHLER', aus.fehler); await b.close(); return; }
  console.log('Clip'.padEnd(18) + 'Bilder'.padStart(7) + 'tsMin'.padStart(7) +
              'tsMax'.padStart(7) + 'tMin'.padStart(8) + 'tMax'.padStart(8) + '  Art');
  for (const r of aus.out) {
    const art = r.tsMax === 0 && r.tsMin === 0 ? 'HALTUNG (Zeit gesetzt)'
              : r.tsMin === 0 ? 'gemischt' : 'laeuft ab';
    console.log(r.clip.padEnd(18) + String(r.bilder).padStart(7) +
      String(r.tsMin).padStart(7) + String(r.tsMax).padStart(7) +
      String(r.tMin).padStart(8) + String(r.tMax).padStart(8) + '  ' + art);
  }
  await b.close();
})();
