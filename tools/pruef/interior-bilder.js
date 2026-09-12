/* Bilder aus dem Missions-Innenraum.

   Zahlen koennen gruen sein, waehrend das Bild sichtbar falsch ist -
   flackernder Boden, eine Wand ohne Textur, eine Figur im Tisch. Deshalb
   werden hier echte Bildschirmfotos aus der SPIELKAMERA gemacht, aus
   jeder Zone und aus mehreren Winkeln.

   Aufruf:  node tools/pruef/interior-bilder.js [zielordner] */
const path = require('node:path');
const fs = require('node:fs');
const { starte } = require('./basis');
const ZIEL = process.argv[2] || path.resolve(__dirname, '..', '..', 'bilder-interior');

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });
  const { b, page } = await starte(1100, 700, 4711);

  /* Hinein, mit Gegnern und Geisel - also das, was der Spieler sieht. */
  const vorbereitet = await page.evaluate(() => {
    const d = __dbg, P = d.player;
    d.frier(true);
    d.setzeMissionCd(1e9);
    if (d.story.aktiv) d.storyAufraeumen();
    d.story.fertig.length = 0;
    for (const id of ['m1', 'm2', 'm3', 'm4', 'm5']) d.story.fertig.push(id);
    d.enemies.length = 0;
    if (d.gangs) d.gangs.length = 0;
    for (const c of d.civilians) c.geisel = false;
    d.setzePos(25, 0.05, 25);
    P.state = 'ground'; P.onGround = true; P.dead = false; P.hp = 100;
    /* Direkt in die Kampfphase - dort steht alles im Raum. */
    const los = d.storyStarte('m6', 3);
    for (let i = 0; i < 120; i++) d.schritt(1 / 60);
    const r = d.innen.raum;
    return { los, innen: d.innenAktiv,
             gegner: d.enemies.filter((e) => e.storyGegner && !e.dead).length,
             geiseln: d.civilians.filter((c) => c.geisel).length,
             masse: r ? r.masse : null };
  });
  console.log('Vorbereitet: ' + JSON.stringify(vorbereitet));
  if (!vorbereitet.innen) {
    console.log('FEHLER: der Innenraum ist nicht aktiv - keine Bilder.');
    await b.close();
    return;
  }

  /* Neun Blicke: jede Zone aus Spielerhoehe, dazu zwei flache Blicke
     ueber den Boden (dort faellt Flackern am ehesten auf) und einer von
     oben auf den ganzen Raum. */
  const blicke = [
    ['1-eingang', [-13.0, 1.7, 0], [-2, 1.4, 0]],
    ['2-halle-ost', [-7.0, 1.7, 0], [8, 1.4, 0]],
    ['3-halle-west', [7.0, 1.7, 0], [-9, 1.4, 0]],
    ['4-geisel', [3.0, 1.7, 2.0], [6.5, 1.2, 8.5]],
    ['5-funkpunkt', [7.0, 1.7, -2.0], [12.4, 1.2, -4.2]],
    ['6-hinterausgang', [8.0, 1.7, 1.0], [14.6, 1.6, 0]],
    ['7-boden-flach', [-6.0, 0.22, -4.0], [10, 0.16, 4.0]],
    ['8-boden-flach2', [10.0, 0.20, 6.0], [-12, 0.14, -6.0]],
    ['9-uebersicht', [-12.0, 4.6, -8.0], [4, 0.6, 2.0]],
  ];

  for (const [name, kam, blick] of blicke) {
    await page.evaluate(([k, z]) => {
      const d = __dbg;
      const o = d.innen.raum;
      /* Die Raummitte ist die Mitte der Grenzen - lokale Koordinaten aus
         mission-interiors.js liegen um sie herum. */
      const mx = (o.grenzen.x0 + o.grenzen.x1) / 2;
      const mz = (o.grenzen.z0 + o.grenzen.z1) / 2;
      const X = (v) => mx + v;
      const Z = (v) => mz + v;
      d.aufnahme(X(k[0]), k[1], Z(k[2]), X(z[0]), z[1], Z(z[2]));
    }, [kam, blick]);
    const datei = path.join(ZIEL, name + '.png');
    await page.screenshot({ path: datei });
    console.log('  ' + name);
  }
  console.log('');
  console.log('Bilder in ' + ZIEL);
  await b.close();
})();
