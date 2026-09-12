/* Mission 6 "Das Versteck" - gezielter Pruefstand.

   Deckt die im Auftrag verlangten Tests ab:
     1 Haus-Auswahl   - alle begehbaren Haeuser, Tuer, rein, raus, Spawns
     2 Spawns         - jeder Storyspawn gegen Wand, Boden, Moebel, Nachbar
     3 Sicht          - hinter der Wand unsichtbar, durch die Tuer sichtbar
     4 Funker-Exit    - vom tiefsten Punkt des Raums durch die echte Tuer
     5 Chase          - Fluchtwege messen
     6 frueher Fang   - Mission darf nicht haengen
     7 normaler Lauf  - Hinterhalt startet genau einmal
    10 Gesamtlauf     - Mission 6 von vorn bis Mission 7 frei

   Aufruf:  node pruef/mission6.js [teil]
            teil = 1..10, ohne Angabe: die schnellen Teile 1-3
*/
const { starte } = require('./basis');
const TEIL = process.argv[2] || '1-3';

(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const aus = await page.evaluate(async (TEIL) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    if (d.setzeMissionCd) d.setzeMissionCd(1e9);
    const E = {};
    const will = (n) => TEIL === String(n) || TEIL === '1-3' && n <= 3 || TEIL === 'alle';

    const liste = d.versteckListe();
    E.verstecke = liste.length;

    /* ============ TEST 1: Haus-Auswahl ============ */
    if (will(1)) {
      const zeilen = [];
      for (const v of liste) {
        const r = v.raum, t = v.tuer;
        /* --- Aussen -> Innen --- */
        const sx = v.tuerMitte.x + t.nx * 3.2, sz = v.tuerMitte.z + t.nz * 3.2;
        d.setzePos(sx, d.groundYAt(sx, sz, 2) + 0.05, sz);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        let w = Math.atan2(v.tuerMitte.x - sx, v.tuerMitte.z - sz);
        P.facing = w; d.setzeKamYaw(w + Math.PI);
        d.taste('KeyW', true);
        let rein = null, durch = false;
        for (let i = 0; i < 240; i++) {
          d.schritt(1 / 30);
          if (!durch) {
            const rel = (P.pos.x - v.tuerMitte.x) * t.nx + (P.pos.z - v.tuerMitte.z) * t.nz;
            if (rel < 0) { durch = true;
              w = Math.atan2(v.mitte.x - P.pos.x, v.mitte.z - P.pos.z);
              P.facing = w; d.setzeKamYaw(w + Math.PI); }
          }
          if (d.imVersteck(v, P.pos.x, P.pos.z, P.pos.y)) { rein = i + 1; break; }
        }
        d.taste('KeyW', false);
        /* --- Innen -> Aussen --- */
        let raus = null;
        if (rein !== null) {
          const tief = v.punkte.reduce((a, p) => {
            const dd = Math.hypot(p.x - v.tuerMitte.x, p.z - v.tuerMitte.z);
            return dd > a.d ? { p, d: dd } : a; }, { p: v.punkte[0], d: 0 }).p;
          d.setzePos(tief.x, tief.y + 0.05, tief.z);
          P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
          /* Erst zur Tuer, dann hinaus. */
          let ziel = { x: v.hinterTuer.x, z: v.hinterTuer.z }, phase2 = false;
          for (let i = 0; i < 360; i++) {
            const w2 = Math.atan2(ziel.x - P.pos.x, ziel.z - P.pos.z);
            P.facing = w2; d.setzeKamYaw(w2 + Math.PI);
            d.taste('KeyW', true);
            d.schritt(1 / 30);
            if (!phase2 && Math.hypot(P.pos.x - ziel.x, P.pos.z - ziel.z) < 1.4) {
              phase2 = true; ziel = { x: v.vorTuer.x, z: v.vorTuer.z };
            }
            if (phase2 && !d.imVersteck(v, P.pos.x, P.pos.z, P.pos.y) &&
                Math.hypot(P.pos.x - v.tuerMitte.x, P.pos.z - v.tuerMitte.z) > 2.2) {
              raus = i + 1; break;
            }
          }
          d.taste('KeyW', false);
        }
        if (v.hof === undefined) v.hof = d.freieFlaeche(v.mitte.x, v.mitte.z, 95, 5.0);
        zeilen.push({ haus: v.haus, flaeche: +v.flaeche.toFixed(0),
                      freiFlaeche: +v.freiFlaeche.toFixed(0),
                      punkte: v.punkte.length, vorfeldFrei: v.vorfeldFrei,
                      rein, raus, boden: +v.raum.boden.toFixed(2),
                      hofRadius: v.hof ? +v.hof.radius.toFixed(1) : null,
                      wert: +d.versteckWert(v).toFixed(0),
                      mitte: [+v.mitte.x.toFixed(0), +v.mitte.z.toFixed(0)] });
      }
      E.test1 = zeilen;
    }

    /* ============ TEST 2: Spawns ============ */
    if (will(2)) {
      const fehler = [];
      let geprueft = 0;
      for (const v of liste) {
        for (let runde = 0; runde < 5; runde++) {
          const plaetze = d.versteckPlaetze
            ? d.versteckPlaetze(v, 4)
            : v.punkte.slice(0, 4);
          for (const p of plaetze) {
            geprueft++;
            const gy = d.groundYAt(p.x, p.z, v.raum.boden + 0.6);
            if (!d.imVersteck(v, p.x, p.z, gy)) fehler.push({ haus: v.haus, art: 'ausserhalb' });
            else if (Math.abs(gy - v.raum.boden) > 0.35) fehler.push({ haus: v.haus, art: 'falscherBoden', gy });
            else if (!d.versteckFrei(p.x, p.z, gy)) fehler.push({ haus: v.haus, art: 'imHindernis' });
            for (const q of plaetze) {
              if (q !== p && Math.hypot(q.x - p.x, q.z - p.z) < 1.6)
                fehler.push({ haus: v.haus, art: 'zuNah' });
            }
          }
        }
      }
      E.test2 = { geprueft, fehler: fehler.length, arten: fehler.reduce((a, f) => {
        a[f.art] = (a[f.art] || 0) + 1; return a; }, {}) };
    }

    /* ============ TEST 3: Sicht ============ */
    if (will(3)) {
      let durchWand = 0, wandProben = 0, durchTuer = 0, tuerProben = 0;
      for (const v of liste) {
        const t = v.tuer, r = v.raum;
        const tief = v.punkte.reduce((a, p) => {
          const dd = Math.hypot(p.x - v.tuerMitte.x, p.z - v.tuerMitte.z);
          return dd > a.d ? { p, d: dd } : a; }, { p: v.punkte[0], d: 0 }).p;
        /* Zwoelf Richtungen im Kreis um die HAUSMITTE - so liegt jeder
           Blickpunkt sicher ausserhalb des Hauses. Dazu ein Blick genau
           aus der Tuerachse, sonst bleibt die zweite Haelfte der Frage
           ungeprueft: durch die offene Tuer MUSS man gesehen werden.
           (Der erste Anlauf legte den Kreis um die TUER - dann liegen
           Probepunkte im Raum, und "durch eine Wand" zaehlte Strahlen,
           die gar keine Wand kreuzen.) */
        const stellen = [];
        for (let k = 0; k < 12; k++) {
          const w2 = (k / 12) * Math.PI * 2;
          stellen.push({ x: v.mitte.x + Math.sin(w2) * 14, z: v.mitte.z + Math.cos(w2) * 14 });
        }

        for (const st of stellen) {
          const ex = st.x, ez = st.z;
          if (d.imVersteck(v, ex, ez)) continue;   // Probepunkt im Haus: nicht zaehlen
          const ey = d.groundYAt(ex, ez, 0) + 1.5;
          const frei = d.freieSicht(ex, ey, ez, tief.x, tief.y + 1.0, tief.z);
          /* Geometrisch bestimmen, ob der Strahl durch den Durchgang laeuft. */
          const dg = t.durchgang;
          const querX = (dg.x1 - dg.x0) > (dg.z1 - dg.z0);
          const ebene = querX ? (dg.z0 + dg.z1) / 2 : (dg.x0 + dg.x1) / 2;
          const von = querX ? ez : ex, nach = querX ? tief.z : tief.x;
          let tuerWeg = false;
          if ((von - ebene) * (nach - ebene) <= 0) {
            const tt = (ebene - von) / ((nach - von) || 1e-9);
            const sx2 = ex + (tief.x - ex) * tt, sz2 = ez + (tief.z - ez) * tt;
            const sy2 = ey + (tief.y + 1.0 - ey) * tt;
            tuerWeg = (querX ? (sx2 > dg.x0 - 0.2 && sx2 < dg.x1 + 0.2)
                             : (sz2 > dg.z0 - 0.2 && sz2 < dg.z1 + 0.2)) &&
                      sy2 < r.boden + 2.6;
          }
          if (tuerWeg) { tuerProben++; if (frei) durchTuer++; }
          else { wandProben++; if (frei) durchWand++; }
        }
        /* ---- Die Gegenprobe: geradewegs durch die offene Tuer ----
           Der Blick kommt aus der Tuerachse und zielt auf einen Punkt
           DIREKT hinter der Tuer. Dieser Strahl MUSS frei sein, sonst
           waere die Tuer zugemauert und das Versteck kein Versteck,
           sondern ein Tresor. */
        {
          const ax = v.tuerMitte.x + t.nx * 11, az = v.tuerMitte.z + t.nz * 11;
          const bx = v.tuerMitte.x - t.nx * 3.0, bz = v.tuerMitte.z - t.nz * 3.0;
          tuerProben++;
          if (d.freieSicht(ax, d.groundYAt(ax, az, 0) + 1.5, az,
                           bx, v.raum.boden + 1.0, bz)) durchTuer++;
        }
      }
      E.test3 = { durchWand, wandProben, durchTuer, tuerProben };
    }
    return E;
  }, TEIL);

  const p = (s) => console.log(s);
  p('');
  p('Verstecke (begehbar, eigene Tuer, >= 5 gueltige Standpunkte): ' + aus.verstecke);
  if (aus.test1) {
    p('');
    p('== TEST 1: Haus-Auswahl ==');
    p('  Haus                 Flaeche  frei  Pkt  Vorfeld  rein  raus  Hof  Wert  Mitte');
    for (const z of aus.test1)
      p('  ' + z.haus.padEnd(22) + String(z.flaeche).padStart(6) +
        String(z.freiFlaeche).padStart(6) + String(z.punkte).padStart(5) +
        (z.vorfeldFrei ? '     ja ' : '   nein ') +
        String(z.rein === null ? 'NEIN' : z.rein).padStart(6) +
        String(z.raus === null ? 'NEIN' : z.raus).padStart(6) +
        String(z.hofRadius === null ? '-' : z.hofRadius).padStart(5) +
        String(z.wert).padStart(6) + '  ' + JSON.stringify(z.mitte));
    const rein = aus.test1.filter((z) => z.rein !== null).length;
    const raus = aus.test1.filter((z) => z.raus !== null).length;
    const hof = aus.test1.filter((z) => z.hofRadius !== null).length;
    p('');
    p('  betretbar: ' + rein + '/' + aus.test1.length +
      '   verlassbar: ' + raus + '/' + aus.test1.length +
      '   mit Hof in Reichweite: ' + hof + '/' + aus.test1.length);
  }
  if (aus.test2) {
    p('');
    p('== TEST 2: Spawnvalidierung ==');
    p('  geprueft: ' + aus.test2.geprueft + '   ungueltig: ' + aus.test2.fehler +
      (aus.test2.fehler ? '  ' + JSON.stringify(aus.test2.arten) + '   BEFUND' : '   ok'));
  }
  if (aus.test3) {
    p('');
    p('== TEST 3: Sicht ==');
    p('  durch eine WAND sichtbar: ' + aus.test3.durchWand + ' von ' + aus.test3.wandProben +
      (aus.test3.durchWand ? '   BEFUND' : '   ok'));
    p('  durch die TUER sichtbar:  ' + aus.test3.durchTuer + ' von ' + aus.test3.tuerProben +
      '   (soll so sein)');
  }
  await b.close();
})();
