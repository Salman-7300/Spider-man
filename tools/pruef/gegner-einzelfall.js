/* Punkt 5: EINEN Fall aus Frage E isoliert nachfahren.
   Aus dem Massentest kommt nur "erreicht: nein". Das genuegt nicht, um
   zwischen SPIELFEHLER und TESTFEHLER zu entscheiden. Hier laeuft genau
   eine Verfolgung, Bild fuer Bild mitgeschrieben: Zustand, Abstand,
   Sichtkontakt, Suchziel.

   Aufruf:  node pruef/gegner-einzelfall.js <ax> <az> <zx> <zz> [seed]
   Beispiel (Uferpromenade, 14 m Luftlinie, im Massentest gescheitert):
            node pruef/gegner-einzelfall.js 186.5 -92 186.5 -78
*/
const { starte } = require('./basis');

const AX = Number(process.argv[2]);
const AZ = Number(process.argv[3]);
const ZX = Number(process.argv[4]);
const ZZ = Number(process.argv[5]);
const SEED = Number(process.argv[6]) || 4711;
/* Mit "mitzivis" bleibt die normale Zivilbevoelkerung stehen - genau wie
   im Massentest, der die Liste vor der E-Schleife wiederherstellt. */
const ZIVIS = process.argv.includes('mitzivis');

(async () => {
  const { b, page } = await starte(700, 420, SEED);
  const aus = await page.evaluate(async ([AX, AZ, ZX, ZZ, ZIVIS]) => {
    const d = __dbg, P = d.player;
    d.frier(true);

    d.enemies.length = 0;
    if (d.gangs) d.gangs.length = 0;
    if (d.cars) d.cars.length = 0;
    if (d.civilians && !ZIVIS) d.civilians.length = 0;
    const zivZahl = d.civilians ? d.civilians.length : 0;

    P.pos.set(ZX, d.groundYAt(ZX, ZZ, 0), ZZ);
    P.state = 'ground'; P.onGround = true; P.vel.set(0, 0, 0);
    d.spawnGang(AX, AZ, 1, 'test');
    d.schritt(1 / 30, 3);
    const e = (d.enemies || [])[0];
    if (!e) return { fehler: 'kein Gegner erzeugt' };
    e.pos.set(AX, d.groundYAt(AX, AZ, 0), AZ);
    if (e.visual && e.visual.root) e.visual.root.position.copy(e.pos);
    e.state = 'chase'; e.target = 'player';

    const luft = Math.hypot(ZX - AX, ZZ - AZ);
    const spur = [];
    let letzterZustand = null, letztesZiel = null, nachalarm = 0, erreicht = null, minAbstand = 1e9;
    const zielDauer = {};
    let fliehtBilder = 0, diebBilder = 0, rueckzugBilder = 0;
    let strecke = 0, vx = e.pos.x, vz = e.pos.z;
    const zustandsDauer = {};
    for (let i = 0; i < 3000; i++) {
      d.schritt(1 / 30);
      const t = +((i + 1) / 30).toFixed(2);
      strecke += Math.hypot(e.pos.x - vx, e.pos.z - vz);
      vx = e.pos.x; vz = e.pos.z;
      const dp = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
      if (dp < minAbstand) minAbstand = dp;
      const zst = e.dead ? 'tot' : (e.bewacht && e.state !== 'chase' && e.state !== 'suchen'
                                    ? 'bewacht' : e.state);
      zustandsDauer[zst] = +((zustandsDauer[zst] || 0) + 1 / 30).toFixed(2);
      if (e.flieht) fliehtBilder++;
      if (e.dieb) diebBilder++;
      if ((e.rueckzugT || 0) > 0) rueckzugBilder++;
      const zk = e.target === 'player' ? 'spieler' : (e.target ? 'zivilist' : 'keins');
      zielDauer[zk] = +((zielDauer[zk] || 0) + 1 / 30).toFixed(2);
      const zielArt = e.target === 'player' ? 'spieler' : (e.target ? 'zivilist' : 'keins');
      if (zst !== letzterZustand || zielArt !== letztesZiel) {
        letztesZiel = zielArt;
        spur.push({ t, zustand: zst, abstand: +dp.toFixed(2),
                    ort: [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1)],
                    ziel: e.target === 'player' ? 'spieler'
                          : (e.target ? ('zivilist@' + (+e.target.pos.x.toFixed(0)) + ',' +
                                         (+e.target.pos.z.toFixed(0))) : null),
                    suchZiel: e.suchZiel ? [+e.suchZiel.x.toFixed(1), +e.suchZiel.z.toFixed(1)] : null,
                    sichtVerloren: +(e.sichtVerlorenT || 0).toFixed(2),
                    flieht: !!e.flieht, dieb: !!e.dieb,
                    rueckzugT: +(e.rueckzugT || 0).toFixed(2),
                    mut: e.mut !== undefined ? +(+e.mut).toFixed(2) : null,
                    hp: e.hp !== undefined ? e.hp : null });
        letzterZustand = zst;
      }
      /* gleiche Nachalarmierung wie im Massentest */
      if (e.state === 'patrol' && !e.dead) { e.state = 'chase'; e.target = 'player'; nachalarm++; }
      if (e.dead) break;
      if (dp < 2.5) { erreicht = t; break; }
    }
    return { luft: +luft.toFixed(1), erreicht, minAbstand: +minAbstand.toFixed(2),
             strecke: +strecke.toFixed(1), umweg: +(strecke / luft).toFixed(2),
             nachalarm, zivilisten: zivZahl,
             fliehtBilder, diebBilder, rueckzugBilder, zustandsDauer, zielDauer, spur: spur.slice(0, 60), spurGesamt: spur.length,
             endOrt: [+e.pos.x.toFixed(1), +e.pos.z.toFixed(1)],
             spielerOrt: [+P.pos.x.toFixed(1), +P.pos.z.toFixed(1)],
             typ: e.typ ? e.typ.art : null, tempo: e.typ ? e.typ.tempo : null };
  }, [AX, AZ, ZX, ZZ, ZIVIS]);

  console.log(JSON.stringify(aus, null, 1));
  await b.close();
})();
