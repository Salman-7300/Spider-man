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
  /* Die Stellen sind an den neuen 42 x 30 m ausgerichtet, nicht mehr an
     den alten 30 x 22 - sonst stuenden die Kameras in Waenden. */
  const blicke = [
    ['01-eingang', [-18.5, 1.7, 0], [-6, 1.4, 0]],
    ['02-halle-ost', [-12.0, 1.7, 0], [2, 1.4, 0]],
    ['03-halle-west', [0.0, 1.7, 0], [-16, 1.4, 0]],
    ['04-hallentor', [-8.0, 1.7, 3.0], [6, 1.4, -1.0]],
    ['05-lager', [-1.0, 1.7, -2.0], [10, 1.3, 2.0]],
    ['06-geisel-zone', [11.5, 1.7, 13.0], [16.5, 1.1, 10.0]],
    ['07-geisel-nah', [14.6, 1.25, 12.6], [15.5, 0.85, 10.5]],
    ['08-funkpunkt', [11.5, 1.7, -2.0], [17, 1.2, -7.0]],
    ['09-hinterausgang', [13.5, 1.7, -1.5], [20.5, 1.5, -1.5]],
    ['10-boden-flach', [-8.0, 0.22, -6.0], [12, 0.16, 6.0]],
    ['11-boden-flach2', [14.0, 0.20, 8.0], [-16, 0.14, -6.0]],
    /* Der Uebersichtsblick lag im ersten Anlauf bei (-17 | -11) - das
       ist im Vorraum HINTER der Trennwand, und im Bild stand ein
       schwarzer Keil vor der halben Halle. Jetzt unter der Decke auf der
       Hauptachse. */
    /* Zweiter Anlauf stand bei (-6 | 0) auf 5,4 m - das ist die Stelle
       einer Deckenleuchte, und das halbe Bild war ihre Leuchtflaeche aus
       naechster Naehe. Jetzt zwischen den Leuchten. */
    ['12-uebersicht', [-9.0, 5.1, 3.6], [12, 0.5, -1.0]],
    ['13-geisel-seite', [17.5, 1.3, 12.8], [15.5, 0.75, 10.5]],
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
    /* ---- Zweimal zeichnen, dann erst aufnehmen ----
       Ein Bild aus dem ersten Anlauf hatte eine harte senkrechte Kante
       mit einer braunen Haelfte - kein Objekt in der Szene, sondern ein
       halb fertiger Puffer: die Aufnahme lief, waehrend SwiftShader noch
       zeichnete. Seit die Lichter des Raums dazugekommen sind, dauert
       das erste Bild laenger. Also ein Bild abwarten und neu zeichnen. */
    await page.evaluate(() => new Promise((res) => requestAnimationFrame(res)));
    await page.evaluate(([k, z]) => {
      const d = __dbg;
      const o = d.innen.raum;
      const mx = (o.grenzen.x0 + o.grenzen.x1) / 2;
      const mz = (o.grenzen.z0 + o.grenzen.z1) / 2;
      d.aufnahme(mx + k[0], k[1], mz + k[2], mx + z[0], z[1], mz + z[2]);
    }, [kam, blick]);
    const datei = path.join(ZIEL, name + '.png');
    await page.screenshot({ path: datei });
    console.log('  ' + name);
  }
  console.log('');
  console.log('Bilder in ' + ZIEL);
  await b.close();
})();
