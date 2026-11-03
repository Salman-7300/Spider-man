/* Problem-2 (Ueberhaenge): Bilder fuer die Human-Abnahme - dieselben
   regulaeren Wege wie tools/pruef/ueberhang-klettern.js (echte Tasten,
   kein gesetzter Kletterzustand), jedes 4. Bild (15 Bilder/s = Echtzeit).

     ansicht=spiel  normale Spielkamera (sie laeuft in jedem Schritt mit)
     ansicht=seite  feste Diagnosekamera seitlich der Zielstelle, 3,5 m
                    laengs und 1,6 m vor der Kiste, auf Hoehe der Figur:
                    Koerper gegen Ueberhang im Profil

   Aufgenommen wird
     runter  ab 6 m ueber dem Band bis unten,
     abquer  ab 6 m ueber dem Band bis zum Ende der Seitwaertsbewegung,
     quer    vom Steigen ab 2 m Hoehe bis zum Ende.
   alt=1 zeigt die Kletterhaut ohne Koerperrahmen (Stand vor dem Fix).
   Oben links steht je Bild, was ueberhang-klettern.js dort misst: wie
   tief Kopf, Schultern und Brust in der sichtbaren Geometrie stecken
   (rot) - oder "frei" (gruen).

   Aufruf:  node tools/pruef/ueberhang-video.js <ordner> faelle=<json> bahn=runter|quer|abquer
              [ansicht=spiel|seite] [alt=1] [nur=<name>]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const { messCode } = require('./ueberhang-mess');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const ZIEL = process.argv[2];
if (!ZIEL || !arg('faelle', '')) {
  console.log('Aufruf: node tools/pruef/ueberhang-video.js <ordner> faelle=<json> bahn=runter|quer|abquer [ansicht=spiel|seite] [alt=1] [nur=<name>]');
  process.exit(1);
}
const FAELLE = JSON.parse(fs.readFileSync(arg('faelle', ''), 'utf8')).filter((F) => !arg('nur', '') || F.name === arg('nur', ''));
const BAHN = arg('bahn', 'runter'), ANSICHT = arg('ansicht', 'spiel'), ALT = arg('alt', '0') === '1';

(async () => {
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true, koerperHautAlt: ALT });
  await page.evaluate(messCode);
  for (const F of FAELLE) {
    const ordner = path.join(ZIEL, F.name + '-' + BAHN + '-' + ANSICHT + (ALT ? '-vorher' : '-nachher'));
    fs.mkdirSync(ordner, { recursive: true });
    await page.evaluate(({ F, BAHN }) => window.__uk.start(F, BAHN, 'regulaer'), { F, BAHN });
    let bild = 0, ende = null, f = 0;
    const liste = [];
    while (!ende) {
      const r = await page.evaluate(({ F, BAHN, ANSICHT, f }) => {
        const d = __dbg, P = d.player, UK = window.__uk;
        const s = UK.schritte(1, false);
        const L = s.aus[0] || {};
        const yTop = F.y[1] + 6;
        const an = BAHN === 'quer' ? (['steigen', 'halten', 'quer'].includes(s.phase) && P.pos.y > 2)
                 : (['runter', 'halten', 'quer'].includes(s.phase) && P.pos.y < yTop);
        if (!an || f % 4 !== 0) return { ende: s.ende, an };
        /* Messung wie im Pruefstand, als Einblendung ins Bild */
        let tafel = document.getElementById('ukMess');
        if (!tafel) {
          tafel = document.createElement('div'); tafel.id = 'ukMess';
          tafel.style.cssText = 'position:fixed;left:10px;top:44px;z-index:99999;font:600 15px/1.35 sans-serif;padding:4px 8px;border-radius:4px;background:rgba(0,0,0,.6);white-space:pre';
          document.body.appendChild(tafel);
        }
        const aufZiel = P.state === 'climb' && P.wallInfo && P.wallInfo.col.id === F.id;
        let mess = null;
        if (aufZiel) {
          const K = UK.koerper(), r = K.reg;
          mess = { kopf: r.kopf.in ? r.kopf.max : 0, schulter: r.schulter.in ? r.schulter.max : 0, brust: r.rumpf.in || r.rumpf.hinter ? r.rumpf.max : 0 };
        }
        const zahl = (v) => v.toFixed(2).replace('.', ',') + ' m';
        if (!mess) { tafel.style.color = '#c8ccd4'; tafel.textContent = 'nicht an der Zielwand'; }
        else if (mess.kopf + mess.schulter + mess.brust === 0) { tafel.style.color = '#7ee08a'; tafel.textContent = 'Kopf, Schultern, Brust: frei'; }
        else { tafel.style.color = '#ff6b5e'; tafel.textContent = 'in der Platte: Kopf ' + zahl(mess.kopf) + '  Schulter ' + zahl(mess.schulter) + '  Brust ' + zahl(mess.brust); }
        if (ANSICHT === 'seite') {
          const [nx, nz] = F.seite, tx = nz, tz = -nx;
          const eb = UK.ebene(F.seite);
          const X = BAHN === 'quer' ? (nx !== 0 ? P.pos.z : P.pos.x) : F.X;
          const px = nx !== 0 ? eb + nx * 1.6 : X + tx * 3.5, pz = nx !== 0 ? X + tz * 3.5 : eb + nz * 1.6;
          const ax = nx !== 0 ? eb - nx * 0.2 : X, az = nx !== 0 ? X : eb - nz * 0.2;
          const y = P.pos.y + (BAHN === 'quer' ? 0.6 : 1.6);
          d.aufnahme(px + (nx !== 0 ? 0 : 0), y + 0.4, pz, ax, y, az);
        } else d.zeichne();
        return { ende: s.ende, an, bild: true, y: +P.pos.y.toFixed(2), ph: s.phase, d: L.d, haut: L.haut, mess };
      }, { F, BAHN, ANSICHT, f });
      f++;
      ende = r.ende;
      if (r.bild) {
        fs.writeFileSync(path.join(ordner, String(bild++).padStart(4, '0') + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 86 }));
        liste.push({ f, y: r.y, ph: r.ph, d: r.d, haut: r.haut, mess: r.mess });
      }
      if (f > 8000) ende = 'abbruch';
    }
    await page.evaluate(() => window.__uk.ende());
    fs.writeFileSync(path.join(ordner, 'bilder.json'), JSON.stringify({ ende, liste }));
    const treffer = liste.filter((q) => q.mess && q.mess.kopf + q.mess.schulter + q.mess.brust > 0).length;
    console.log(F.name, BAHN, ANSICHT, ALT ? 'vorher' : 'nachher', 'Bilder', bild, 'mit Kopf/Schulter/Brust in der Platte', treffer, 'Ende', ende);
  }
  await b.close();
})();
