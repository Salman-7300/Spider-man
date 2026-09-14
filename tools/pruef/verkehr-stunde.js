/* Eine Stunde Verkehr am Stueck. Gezaehlt wird alles, was ein Fahrzeug
   NICHT tun darf. Der Spieler wandert dabei ueber die Karte, damit nicht
   immer dieselbe Ecke simuliert wird. Laufzeit rund eine halbe Stunde. */
const { starte } = require('./basis');
const SEKUNDEN = Number(process.argv[2]) || 3600;
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(async (SEKUNDEN) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    /* CITY V2: Rastermasse aus dem Spiel lesen, nicht abschreiben. */
    const R = __dbg.raster(), PITCH = R.pitch, ROAD_HALF = 6;
    const rasterO = (a) => (a === 'x' ? R.x0 : R.z0);
    const rasterN = (a) => (a === 'x' ? R.blocksX : R.blocksZ);
    const quer = (a) => (a === 'x' ? 'z' : 'x');
    const linieNah = (v, a) => rasterO(a) +
      Math.max(0, Math.min(rasterN(a), Math.round((v - rasterO(a)) / PITCH))) * PITCH;
    const BZ = -25, BR_X0 = 181, BR_X1 = 334;
    const RIVER_X0 = 192, RIVER_X1 = 330, SHORE_X0 = 330;
    const onBridge = (x, z) => Math.abs(z - BZ) < 10 && x > BR_X0 - 6 && x < BR_X1 + 6;
    /* Liegt der Punkt auf einer Fahrbahn des Stadtrasters? */
    function aufStrasse(x, z) {
      if (onBridge(x, z)) return true;
      if (x > RIVER_X0 && x < SHORE_X0) return false;         // Fluss
      if (x > R.x1 + 6) return x >= SHORE_X0;                 // Promenade / drueben
      const u = ((x - R.x0) % PITCH + PITCH) % PITCH;
      const v = ((z - R.z0) % PITCH + PITCH) % PITCH;
      return u <= ROAD_HALF + 1 || u >= PITCH - ROAD_HALF - 1 ||
             v <= ROAD_HALF + 1 || v >= PITCH - ROAD_HALF - 1;
    }
    const Z = { proben: 0, nebenFahrbahn: 0, imWasser: 0, imHaus: 0,
                steht: 0, langStand: 0, ortsSprung: 0, geisterfahrer: 0,
                bruecke: 0, bruecke0: 0, maxStand: 0, ineinander: 0, naheKreuzung: 0,
                /* ---- Was "ineinander" wirklich heisst ----
                   Die blosse Zahl war nicht zu gebrauchen: zwei Wagen
                   unter 2,5 m koennen dicht aufgefahren sein (gleiche
                   Spur), nebeneinander fahren (Nachbarspur - auf einer
                   Avenue liegen die Spuren 2,8 m auseinander, das ist
                   knapp ueber der Schwelle) oder sich an einer Kreuzung
                   schneiden. Das sind drei verschiedene Befunde. */
                inGleicheSpur: 0, inNachbarSpur: 0, inKreuzend: 0,
                inKurve: 0, inSteht: 0 };
    const bsp = {};
    const merk = (k, x, z) => { if (!bsp[k]) bsp[k] = [+x.toFixed(1), +z.toFixed(1)]; };
    const stand = new Map(), vorher = new Map();
    const wanderung = [[0,0],[-140,-140],[140,140],[-140,140],[140,-140],
                       [255,-25],[60,-160],[-60,160]];
    /* Laufzeit in Spielsekunden - als Argument, damit sich eine Frage
       auch in einer Viertelstunde beantworten laesst. */
    const SEK = SEKUNDEN, dt = 1 / 60;
    for (let i = 0; i < 60 * SEK; i++) {
      if (i % (60 * 450) === 0) {
        const w = wanderung[(i / (60 * 450)) % wanderung.length];
        d.setzePos(w[0], 40, w[1]);
      }
      d.schritt(dt);
      if (i % 15) continue;
      Z.proben++;
      let aufBr = 0;
      for (const c of d.cars) {
        if (c.aus) { stand.set(c, 0); vorher.set(c, null); continue; }
        const p = c.mesh.position, x = p.x, z = p.z;
        if (!aufStrasse(x, z)) { Z.nebenFahrbahn++; merk('nebenFahrbahn', x, z); }
        if (x > RIVER_X0 && x < SHORE_X0 && !onBridge(x, z)) { Z.imWasser++; merk('imWasser', x, z); }
        const halb = (c.typ ? c.typ.breite : 1.9) / 2;
        for (const k of d.colliderNah(x, z)) {
          if ((k.h || 0) < 1.2) continue;
          const unten = k.y0 === undefined ? -50 : k.y0;
          if (k.h <= p.y + 0.3 || unten >= p.y + 1.8) continue;
          if (x > k.x0 - halb && x < k.x1 + halb && z > k.z0 - halb && z < k.z1 + halb) {
            Z.imHaus++; merk('imHaus', x, z); break;
          }
        }
        const t = (c.tempoJetzt || 0) < 0.05 ? (stand.get(c) || 0) + 15 * dt : 0;
        stand.set(c, t);
        if (t > 0) Z.steht++;
        if (t > 12) { Z.langStand++; merk('langStand', x, z); }
        Z.maxStand = Math.max(Z.maxStand, t);
        const v = vorher.get(c);
        if (v && Math.hypot(x - v[0], z - v[1]) > 12) { Z.ortsSprung++; merk('ortsSprung', x, z); }
        vorher.set(c, [x, z]);
        /* Geisterfahrer: Spur und Richtung passen nicht zusammen. */
        const kl = linieNah(c.lane, quer(c.axis));
        const soll = c.lane > kl ? 1 : -1;
        if (!c.flucht && !c.notfall && !onBridge(x, z) && c.kurve <= 0 && c.dir !== soll) {
          Z.geisterfahrer++; merk('geisterfahrer', x, z);
        }
        if (x > BR_X0 && x < BR_X1 && Math.abs(z - BZ) < 10) aufBr++;
      }
      /* Zwei Wagen ineinander - besonders an Kreuzungen, wo jetzt eine
         feste Vorfahrt statt des Totbands gilt. */
      const wach = d.cars.filter((c) => !c.aus);
      for (let a = 0; a < wach.length; a++) {
        for (let bb = a + 1; bb < wach.length; bb++) {
          const pa = wach[a].mesh.position, pb = wach[bb].mesh.position;
          const dd = Math.hypot(pa.x - pb.x, pa.z - pb.z);
          if (dd < 2.5) {
            const A = wach[a], B = wach[bb];
            Z.ineinander++; merk('ineinander', pa.x, pa.z);
            if (A.axis !== B.axis) { Z.naheKreuzung++; Z.inKreuzend++; }
            else if (Math.abs(A.lane - B.lane) < 0.6) Z.inGleicheSpur++;
            else Z.inNachbarSpur++;
            if ((A.kurve || 0) > 0 || (B.kurve || 0) > 0) Z.inKurve++;
            if ((A.tempoJetzt || 0) < 0.5 && (B.tempoJetzt || 0) < 0.5) Z.inSteht++;
          }
        }
      }
      Z.bruecke += aufBr;
      if (!aufBr) Z.bruecke0++;
    }
    Z.autos = d.cars.length;
    Z.anteilBrueckeLeer = +(Z.bruecke0 / Z.proben).toFixed(3);
    Z.brueckeSchnitt = +(Z.bruecke / Z.proben).toFixed(2);
    Z.maxStand = +Z.maxStand.toFixed(1);
    Z.beispiele = bsp;
    return Z;
  }, SEKUNDEN);
  console.log(JSON.stringify(aus, null, 1));
  await b.close();
})();
