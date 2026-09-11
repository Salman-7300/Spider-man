/* Punkt 5: EINEN Fall aus Test D isoliert nachfahren.
   Kein Massentest, keine hundert Szenarien - ein einziger Weg, Bild fuer
   Bild mitgeschrieben, damit sich entscheiden laesst:
   SPIELFEHLER oder TESTFEHLER.

   Aufruf:  node pruef/npc-einzelfall.js <knotenVon> <knotenNach> [seed]
   Beispiel aus Test D (B unter Boden, anderes Ufer):
            node pruef/npc-einzelfall.js 657 648 4711
*/
const { starte } = require('./basis');

const VON = Number(process.argv[2]);
const NACH = Number(process.argv[3]);
const SEED = Number(process.argv[4]) || 4711;
/* Mit "folgt" bleibt der Spieler in Sichtweite der Figur. Das schaltet
   die Steckrettung des Spiels ab, die NUR ausser Sicht feuert
   (ausserSicht: Abstand > 55 m). */
const FOLGT = process.argv.includes('folgt');

(async () => {
  const { b, page } = await starte(700, 420, SEED);
  const aus = await page.evaluate(async ([VON, NACH, FOLGT]) => {
    const d = __dbg, P = d.player;
    d.frier(true);
    const knoten = d.gehKnotenListe();
    const kA = knoten[VON], kB = knoten[NACH];
    if (!kA || !kB) return { fehler: 'Knoten nicht vorhanden' };

    /* Nur die Testfigur, wie im Massentest. */
    d.spawnZivi();
    const civ = d.civilians[d.civilians.length - 1];
    d.civilians.length = 0; d.civilians.push(civ);
    if (d.cars) d.cars.length = 0;
    if (d.enemies) d.enemies.length = 0;

    const route = d.gehRoute(VON, NACH);
    civ.pos.set(kA.x, d.groundYAt(kA.x, kA.z, 0), kA.z);
    civ.knoten = VON; civ.route = route; civ.routeI = 0; civ.gehZustand = 'gehen';
    civ.vel.set(0, 0, 0);
    if (civ.visual && civ.visual.root) civ.visual.root.position.copy(civ.pos);

    const boxBei = (x, z, y) => {
      for (const c of d.colliderNah(x, z)) {
        if (x > c.x0 + 0.25 && x < c.x1 - 0.25 && z > c.z0 + 0.25 && z < c.z1 - 0.25 &&
            y < (c.h || 0) - 0.3 && y > (c.y0 || -1) + 0.3)
          return { x0: +c.x0.toFixed(1), x1: +c.x1.toFixed(1),
                   z0: +c.z0.toFixed(1), z1: +c.z1.toFixed(1), h: +(c.h || 0).toFixed(1) };
      }
      return null;
    };

    const routeStart = route;            // Identitaet merken
    let routeGewechselt = -1, routeNeu = null;
    const spur = [];
    let erstesImHaus = null, erstesUnterBoden = null;
    let still = 0, stillAb = null;
    let groessterSprung = 0, sprungBei = null;
    let maxFestStufe = 0, gerettetVor = (d.gehStat ? d.gehStat().gerettet : 0) || 0;
    for (let i = 0; i < 3000; i++) {
      if (FOLGT) {
        /* Der Spieler bleibt zwanzig Meter daneben und schaut hin. */
        P.pos.set(civ.pos.x + 14, d.groundYAt(civ.pos.x + 14, civ.pos.z, 0), civ.pos.z);
        P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
        P.facing = Math.atan2(civ.pos.x - P.pos.x, civ.pos.z - P.pos.z);
      }
      const vorX = civ.pos.x, vorZ = civ.pos.z;
      d.schritt(1 / 30);
      const boden = d.groundYAt(civ.pos.x, civ.pos.z, civ.pos.y);
      const box = boxBei(civ.pos.x, civ.pos.z, civ.pos.y + 0.9);
      const s = Math.hypot(civ.pos.x - vorX, civ.pos.z - vorZ);
      if (s > groessterSprung) { groessterSprung = s; sprungBei = { i, von: [+vorX.toFixed(2), +vorZ.toFixed(2)],
                                                                   nach: [+civ.pos.x.toFixed(2), +civ.pos.z.toFixed(2)] }; }
      if (s < 0.005) { still += 1 / 30; if (stillAb === null) stillAb = i; }
      else { still = 0; stillAb = null; }
      if ((civ.festStufeN || 0) > maxFestStufe) maxFestStufe = civ.festStufeN;
      const e = { i, x: +civ.pos.x.toFixed(2), y: +civ.pos.y.toFixed(2), z: +civ.pos.z.toFixed(2),
                  boden: +boden.toFixed(2), gz: civ.gehZustand,
                  routeI: civ.routeI, routeLen: civ.route ? civ.route.length : 0,
                  zielKnoten: civ.route ? civ.route[civ.routeI] : null,
                  still: +still.toFixed(1), fest: civ.festStufeN || 0, box };
      if (civ.route !== routeStart && routeGewechselt < 0) {
        routeGewechselt = i;
        routeNeu = civ.route ? civ.route.map((k) => [Math.round(knoten[k].x), Math.round(knoten[k].z)]) : null;
        e.ROUTE_GEWECHSELT = true;
      }
      spur.push(e);
      if (box && !erstesImHaus) erstesImHaus = e;
      if (civ.pos.y < boden - 0.4 && !erstesUnterBoden) erstesUnterBoden = e;
      if (Math.hypot(civ.pos.x - kB.x, civ.pos.z - kB.z) < 3.0) break;
      if (still > 25) break;
    }
    const letzt = spur[spur.length - 1];
    return {
      von: [+kA.x.toFixed(2), +kA.z.toFixed(2)], nach: [+kB.x.toFixed(2), +kB.z.toFixed(2)],
      routeLaenge: route ? route.length : 0,
      routeKnoten: route ? route.map((k) => [Math.round(knoten[k].x), Math.round(knoten[k].z), knoten[k].art]) : [],
      bilder: spur.length,
      erstesImHaus, erstesUnterBoden,
      ende: letzt,
      abstandZumZiel: +Math.hypot(letzt.x - kB.x, letzt.z - kB.z).toFixed(2),
      umfeld: (() => {
        const idx = (erstesUnterBoden || erstesImHaus || letzt).i;
        return spur.slice(Math.max(0, idx - 4), idx + 5);
      })(),
      letzte10: spur.slice(-10),
      verlauf: spur.filter((e) => e.i % 60 === 0),
      routeGewechselt, routeNeu,
      spielerFolgt: FOLGT,
      groessterSprung: +groessterSprung.toFixed(2), sprungBei,
      maxFestStufe,
      gerettet: ((d.gehStat ? d.gehStat().gerettet : 0) || 0) - gerettetVor,
      naechsterZumZiel: (() => {
        let best = 1e9, bi = -1;
        for (const e of spur) { const dd = Math.hypot(e.x - kB.x, e.z - kB.z);
          if (dd < best) { best = dd; bi = e.i; } }
        return { abstand: +best.toFixed(2), beiBild: bi };
      })(),
    };
  }, [VON, NACH, FOLGT]);

  if (aus.fehler) { console.log(aus.fehler); await b.close(); return; }
  console.log('');
  console.log('Einzelfall  Knoten ' + VON + ' -> ' + NACH + '   Seed ' + SEED);
  console.log('  von ' + JSON.stringify(aus.von) + '  nach ' + JSON.stringify(aus.nach));
  console.log('  Route ueber ' + aus.routeLaenge + ' Knoten:');
  console.log('    ' + JSON.stringify(aus.routeKnoten));
  console.log('  gelaufene Bilder: ' + aus.bilder + '   Abstand zum Ziel am Ende: ' + aus.abstandZumZiel + ' m');
  console.log('  NAEHESTE Annaeherung ans Ziel: ' + aus.naechsterZumZiel.abstand + ' m bei Bild ' + aus.naechsterZumZiel.beiBild);
  console.log('  Route vom Spiel ersetzt: ' + (aus.routeGewechselt < 0 ? 'nein' : 'ja, bei Bild ' + aus.routeGewechselt));
  console.log('  Spieler folgt: ' + (aus.spielerFolgt ? 'ja (Steckrettung aus)' : 'nein (Steckrettung aktiv)'));
  console.log('  GROESSTER SPRUNG in einem Bild: ' + aus.groessterSprung + ' m' +
              (aus.sprungBei ? '  bei Bild ' + aus.sprungBei.i + ': ' +
               JSON.stringify(aus.sprungBei.von) + ' -> ' + JSON.stringify(aus.sprungBei.nach) : ''));
  console.log('  hoechste Steckstufe: ' + aus.maxFestStufe + '   Rettungen in diesem Lauf: ' + aus.gerettet);
  if (aus.routeNeu) console.log('    neue Route: ' + JSON.stringify(aus.routeNeu));
  console.log('');
  console.log('  erstes Bild IM GEBAEUDE   : ' + (aus.erstesImHaus ? JSON.stringify(aus.erstesImHaus) : 'keines'));
  console.log('  erstes Bild UNTER BODEN   : ' + (aus.erstesUnterBoden ? JSON.stringify(aus.erstesUnterBoden) : 'keines'));
  console.log('');
  console.log('  Umfeld der ersten Auffaelligkeit:');
  for (const e of aus.umfeld) console.log('    ' + JSON.stringify(e));
  console.log('');
  console.log('  Verlauf (alle 60 Bilder):');
  for (const e of aus.verlauf) console.log('    ' + JSON.stringify(e));
  console.log('');
  console.log('  letzte zehn Bilder:');
  for (const e of aus.letzte10) console.log('    ' + JSON.stringify(e));
  await b.close();
})();
