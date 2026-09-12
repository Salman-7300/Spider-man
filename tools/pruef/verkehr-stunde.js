/* Eine Stunde Verkehr am Stueck. Gezaehlt wird alles, was ein Fahrzeug
   NICHT tun darf. Der Spieler wandert dabei ueber die Karte, damit nicht
   immer dieselbe Ecke simuliert wird. Laufzeit rund eine halbe Stunde. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(800, 480, 4711);
  const aus = await page.evaluate(async () => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const ORIGIN = -175, PITCH = 50, BLOCKS = 7, ROAD_HALF = 6;
    const BZ = -25, BR_X0 = 181, BR_X1 = 334;
    const RIVER_X0 = 192, RIVER_X1 = 330, SHORE_X0 = 330;
    const onBridge = (x, z) => Math.abs(z - BZ) < 10 && x > BR_X0 - 6 && x < BR_X1 + 6;
    /* Liegt der Punkt auf einer Fahrbahn des Stadtrasters? */
    function aufStrasse(x, z) {
      if (onBridge(x, z)) return true;
      if (x > RIVER_X0 && x < SHORE_X0) return false;         // Fluss
      if (x > 175 + 6) return x >= SHORE_X0;                  // Promenade / drueben
      const u = ((x - ORIGIN) % PITCH + PITCH) % PITCH;
      const v = ((z - ORIGIN) % PITCH + PITCH) % PITCH;
      return u <= ROAD_HALF + 1 || u >= PITCH - ROAD_HALF - 1 ||
             v <= ROAD_HALF + 1 || v >= PITCH - ROAD_HALF - 1;
    }
    const Z = { proben: 0, nebenFahrbahn: 0, imWasser: 0, imHaus: 0,
                steht: 0, langStand: 0, ortsSprung: 0, geisterfahrer: 0,
                bruecke: 0, bruecke0: 0, maxStand: 0, ineinander: 0, naheKreuzung: 0 };
    const bsp = {};
    const merk = (k, x, z) => { if (!bsp[k]) bsp[k] = [+x.toFixed(1), +z.toFixed(1)]; };
    const stand = new Map(), vorher = new Map();
    const wanderung = [[0,0],[-140,-140],[140,140],[-140,140],[140,-140],
                       [255,-25],[60,-160],[-60,160]];
    const SEK = 3600, dt = 1 / 60;
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
        const kl = ORIGIN + Math.round((c.lane - ORIGIN) / PITCH) * PITCH;
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
            Z.ineinander++; merk('ineinander', pa.x, pa.z);
            if (wach[a].axis !== wach[bb].axis) Z.naheKreuzung++;
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
  });
  console.log(JSON.stringify(aus, null, 1));
  await b.close();
})();
