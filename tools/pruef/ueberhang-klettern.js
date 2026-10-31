/* Problem-2 (Ueberhaenge): klettert die Figur mit dem GANZEN Koerper an der
   sichtbaren Fassade - auch Kopf und Schultern?

   Zwei Wege an dieselbe Stelle:
     weg=regulaer    (Standard) nur echte Tasten, kein gesetzter
                     Kletterzustand:
                       runter  Start auf dem Gehweg, Anlauf (W + Shift)
                               gegen die Fassade, hinauf bis aufs Dach,
                               auf dem Dach zur Zielstelle, ueber die
                               Kante hinaus (W), mit S zurueck an die Wand
                               (Abfangen), mit S hinunter bis zum Boden.
                               Der Aufstieg wird mitgemessen (hoch).
                       quer    Start auf dem Gehweg 2,5 m neben der
                               Zielstelle, an die Wand gehen, abspringen
                               und ankleben (W + Space), mit W bis auf
                               Bandhoehe, kurz halten, dann mit A/D
                               seitlich durch die Zielstelle.
     weg=kuenstlich  wie tools/pruef/fassaden-bahnen.js: Lage, Kletterzustand
                     und Wand werden gesetzt, danach echte Tasten.

   Gemessen wird in jedem Bild im Band (Zielhoehe -2 bis +2 m) gegen die
   SICHTBARE Geometrie des Hauses, nicht gegen die Kletterhaut:
     Feinraster   je 5 x 5 cm ein Strahl von 3 m vor der Kiste senkrecht
                  hinein, gegen die Meshes des Hausmodells, beidseitig:
                  jede Flaeche zaehlt als Eintritt (Normale gegen den
                  Strahl) oder Austritt. Ein Punkt in der Tiefe dv liegt
                    in    mehr Eintritte als Austritte davor - IN einem
                          Koerper der Fassade (Platte, Saeule),
                    hinter  hinter einem duennen Teil (Eintritt und
                          Austritt davor) - Anbau, wenn dieses Teil
                          hoechstens 0,1 m hinter der Kiste liegt und
                          dahinter innerhalb 0,75 m eine Wand kommt,
                    frei  sonst.
                  Ohne Modell (prozedural, Turm) ist die Kiste die Flaeche.
     Koerper      jede zweite Ecke der Figur, nach ihrem staerksten
                  Knochen: Kopf (head, neck), Schulter (Schluesselbein und
                  Oberarm bis 0,2 m vom Gelenk), Rumpf (spine*), Becken
                  (hips); Arme und Beine getrennt (Haende und Fuesse
                  greifen, sie zaehlen nicht).
     Weg          Kopf, Schultergelenke, Brust, Becken zusaetzlich auf drei
                  Zwischenpunkten zum vorigen Bild - ein Weg durch eine
                  Platte zaehlt, auch wenn beide Enden frei sind.
     Lage         Position, Zustand, Wand (Kollider, Normale), Hauttiefe,
                  Hautnormale, Ziel der Haut am Fussabdruck
                  (y-0,3 bis y+0,8, mit und ohne Vorausschau), Tiefe der
                  sichtbaren Flaeche an der Stelle von Kopf, Brust und
                  Becken, Unterkante des Ueberhangs ueber der Figur,
                  Sprung von Bild zu Bild.

   Aufruf:  node tools/pruef/ueberhang-klettern.js <ordner> faelle=<json>
              [weg=regulaer|kuenstlich] [bahnen=runter,quer] [protokoll=1]
              [video=1] [alt=1] [band=alle] [breit=960] [hoch=540]
            alt=1 misst die Kletterhaut ohne Koerperrahmen (vor dem Fix)
   faelle:  [{name, id (Kollider), seite: [nx, nz], X (Laengslage der
             Zielstelle), y: [y0, y1] (Band), xStart? (freier Anlauf fuer
             runter, sonst X), xAnsatz? (Ankleben vom Boden fuer quer,
             sonst X - 2,5), aufstieg? ({seite, x}: hinauf an einer
             anderen Seite, wenn die Zielseite unten nicht frei ist),
             wegpunkte? ([[x, z], ...] auf dem Dach an Aufbauten vorbei),
             dachAbstand? (Punkt vor der Kante, 1 m), toleranz? (0,3 m),
             bahnen? (nur diese Bahnen)}]
   runter ohne aufstieg und xStart steigt an der Zielstelle selbst
   hinauf und dreht oben nur um. Ueber die Kante geht es mit der Gehtaste
   (Alt + W), S kommt 0,1 s danach. Gemessen (vom Dach aus, 0,3 / 0,7 /
   1,2 m vor der Kante, an 3825, 2938 und 6408): so greift die Figur in
   allen neun Faellen die Fassade knapp unter der Dachkrone. Mit
   Lauftempo flog sie bis 1,9 m hinaus und fiel, als S sie zurueckbrachte,
   schon mit 19 m/s - dann zerlegt das Spiel den Schritt in Teilschritte,
   der Wandkontakt des ersten ist im letzten wieder weg, sie greift nicht
   (2 von 9 Faellen auf dem Boden). Mit S sofort greift sie an
   ModernOffice_1 die Dachkrone (siehe ueberhang-mess.js).
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const ZIEL = process.argv[2];
if (!ZIEL || !arg('faelle', '')) {
  console.log('Aufruf: node tools/pruef/ueberhang-klettern.js <ordner> faelle=<json> [weg=regulaer|kuenstlich] [bahnen=runter,quer] [protokoll=1] [video=1]');
  process.exit(1);
}
const FAELLE = JSON.parse(fs.readFileSync(arg('faelle', ''), 'utf8'));
const WEG = arg('weg', 'regulaer');
const BAHNEN = arg('bahnen', 'runter,quer').split(',');
const PROTOKOLL = arg('protokoll', '0') === '1', VIDEO = arg('video', '0') === '1';
const BREIT = +arg('breit', 960), HOCH = +arg('hoch', 540);
/* alt=1: Kletterhaut ohne Koerperrahmen (Stand vor dem Ueberhang-Fix) */
const ALT = arg('alt', '0') === '1';
/* band=alle: jede Kletterhoehe an der Zielwand messen, nicht nur das Band */
const ALLE = arg('band', '') === 'alle';
fs.mkdirSync(ZIEL, { recursive: true });

const { messCode } = require('./ueberhang-mess');

(async () => {
  const { b, page } = await starte(BREIT, HOCH, 4711, { frierSofort: true, koerperHautAlt: ALT });
  await page.evaluate(messCode);
  const alle = [];
  for (const F of FAELLE) for (const bahn of (F.bahnen ? BAHNEN.filter((q) => F.bahnen.includes(q)) : BAHNEN)) {
    const r0 = await page.evaluate(({ F, bahn, WEG, ALLE }) => window.__uk.start(F, bahn, WEG, ALLE), { F, bahn, WEG, ALLE });
    const verlauf = [];
    let ende = null, bild = 0;
    const vdir = VIDEO ? path.join(ZIEL, F.name + '-' + bahn + '-' + WEG) : null;
    if (vdir) fs.mkdirSync(vdir, { recursive: true });
    while (!ende) {
      const r = await page.evaluate(({ n }) => window.__uk.schritte(n, true), { n: VIDEO ? 1 : 3 });
      for (const L of r.aus) verlauf.push(L);
      ende = r.ende;
      if (vdir && r.aus.length && r.aus[r.aus.length - 1].reg) {
        await page.evaluate(() => __dbg.zeichne());
        await page.screenshot({ path: path.join(vdir, String(bild++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 85 });
      }
    }
    await page.evaluate(() => window.__uk.ende());
    /* Auswertung im Band */
    const g = verlauf.filter((L) => L.reg);
    const zaehl = (r, k) => g.filter((L) => L.reg[r][k] > 0).length;
    const maxT = (r) => Math.max(0, ...g.map((L) => L.reg[r].max));
    const wegN = (k) => g.filter((L) => L.weg && L.weg[k]).length;
    /* Spruenge nur im Kletterzustand und nicht im Bild des Ankletterns
       (dort setzt hautHalten die Figur an die Wand - eigener Wert) */
    const kl = verlauf.filter((L) => L.st === 'climb' && !L.ansatz);
    const sprung = Math.max(0, ...kl.map((L) => L.sprungTiefe));
    const ort = Math.max(0, ...kl.map((L) => L.sprungRest));
    const ansatz = Math.max(0, ...verlauf.filter((L) => L.st === 'climb' && L.ansatz).map((L) => L.sprungRest));
    const s = { name: F.name, id: F.id, bahn, weg: WEG, ende, bilder: verlauf.length, band: g.length,
                kopfIn: zaehl('kopf', 'in'), kopfHinter: zaehl('kopf', 'hinter'), kopfMax: maxT('kopf'),
                schulterIn: zaehl('schulter', 'in'), schulterHinter: zaehl('schulter', 'hinter'), schulterMax: maxT('schulter'),
                rumpfIn: zaehl('rumpf', 'in'), rumpfHinter: zaehl('rumpf', 'hinter'), rumpfMax: maxT('rumpf'),
                beckenIn: zaehl('becken', 'in'), beckenHinter: zaehl('becken', 'hinter'),
                oberarmIn: zaehl('oberarm', 'in'), armIn: zaehl('arm', 'in'), beinIn: zaehl('bein', 'in'),
                wegKopf: wegN('kopf') + wegN('scheitel'), wegSchulter: wegN('schulterL') + wegN('schulterR'), wegBrust: wegN('brust'), wegBecken: wegN('becken'),
                ohneHalt: g.filter((L) => L.halt === null || L.halt > 0.6).length, haltMax: Math.max(0, ...g.map((L) => (L.halt === null ? 9 : L.halt))),
                sprung: +sprung.toFixed(3), ortssprung: +ort.toFixed(3), ansatz: +ansatz.toFixed(3), tiefeMin: Math.min(...g.map((L) => L.d)), tiefeMax: Math.max(...g.map((L) => L.d)) };
    alle.push(s);
    console.log([s.name.padEnd(14), bahn.padEnd(6), WEG.padEnd(10), ('Ende ' + ende).padEnd(34), 'Band ' + String(s.band).padStart(3),
      ' Kopf in/hinter ' + s.kopfIn + '/' + s.kopfHinter + ' (' + s.kopfMax + ')', ' Schulter ' + s.schulterIn + '/' + s.schulterHinter + ' (' + s.schulterMax + ')',
      ' Rumpf ' + s.rumpfIn + '/' + s.rumpfHinter, ' Becken ' + s.beckenIn + '/' + s.beckenHinter, ' Weg K/S/B ' + s.wegKopf + '/' + s.wegSchulter + '/' + s.wegBrust,
      ' Sprung Tiefe/Ort ' + s.sprung + '/' + s.ortssprung + ' (Ansetzen ' + s.ansatz + ')', ' ohne Halt ' + s.ohneHalt + ' (max ' + +s.haltMax.toFixed(2) + ')'].join(''));
    if (PROTOKOLL) fs.writeFileSync(path.join(ZIEL, F.name + '-' + bahn + '-' + WEG + '.json'), JSON.stringify({ start: r0, s, verlauf }));
  }
  fs.writeFileSync(path.join(ZIEL, 'zusammenfassung-' + WEG + (ALT ? '-alt' : '') + '.json'), JSON.stringify(alle, null, 1));
  await b.close();
})();
