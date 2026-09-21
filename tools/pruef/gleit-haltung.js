/* problem-2, Punkt C: die Haltung im Gleitflug mit W - drei Vorschlaege.

   Der Human-Befund betrifft nicht mehr das UMSCHALTEN (das ist mit
   problem-1 Punkt 7 gemessen und behoben), sondern wie die Figur dabei
   AUSSIEHT. Das ist keine Zahl, das ist eine Wahl - deshalb werden hier
   drei Haltungen nebeneinander fotografiert und vorgelegt.

     A   der heutige Stand: Arme weit zur Seite, Beine leicht gespreizt
     B   Deltasegel: Arme etwas nach hinten gepfeilt, Beine geschlossen,
         Koerper flacher - so haelt sich ein Wingsuit-Flieger
     C   Sturzbereit: Arme dichter am Koerper, Kopf hoeher, Beine
         gestreckt mit angezogenen Spitzen

   Jede Haltung aus drei Richtungen: von der Seite, von schraeg vorn
   unten und von hinten oben. Dazu die Zahlen, die die Haltung
   bestimmen.

   Der Rig wird NICHT angefasst - es sind dieselben Knochen und
   dieselbe Bewegung, nur andere Zielpunkte (CHARACTER LOCK).

   Aufruf:  node tools/pruef/gleit-haltung.js <ordner> [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'bilder-gleithaltung';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
fs.mkdirSync(ziel, { recursive: true });

/* Nah genug, dass man die Haltung beurteilen kann: der erste Versuch
   stand 7,5 m weg, und die Figur war ein Fleck von einem Sechstel der
   Bildhoehe. */
const RICHTUNGEN = [
  { name: 'seite',  ab: [3.0, 0.2, 0] },
  { name: 'vorn',   ab: [0.8, -1.2, 2.8] },
  { name: 'hinten', ab: [0.4, 1.4, -3.0] },
];

(async () => {
  const { b, page } = await starte(1280, 720, seed, {});
  const werte = [];
  for (const variante of ['A', 'B', 'C']) {
    const mess = await page.evaluate(async (v) => {
      const d = __dbg, P = d.player;
      d.frier(true); d.setzeRegen(0);
      for (const t of ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','Space'])
        d.taste(t, false);
      d.setzeGleitHaltung(v);
      /* Hoch ueber der Stadt, Tempo nach Norden - so, wie man aus einem
         Netzschwung in den Gleitflug geht. */
      d.setzePos(-120, 95, -40);
      P.vel.set(0, 0, 18);
      P.facing = 0; P.state = 'air'; P.onGround = false;
      P.gleiten = false; P.gleitMisch = 0; P.gleitNase = 0; P.gleitKurve = 0;
      d.taste('ShiftLeft', true);
      /* ---- Den richtigen Augenblick treffen ----
         Zwei Fallen stecken hier, beide beim Bauen hineingelaufen:

         1. Wer W lange genug haelt, landet im Sturzflug, und der ist
            ein eigener Clip - poseGleiten kommt dort gar nicht mehr
            vor. Der erste Versuch fotografierte genau das: alle drei
            Vorschlaege sahen gleich aus, weil keiner zu sehen war.
         2. Wer sofort W drueckt, fotografiert die Haltung, waehrend sie
            erst zur Haelfte eingeblendet ist (gemessen gleitMisch
            0,52, Haltungsgewicht also 0,47) - den Rest fuehrt die
            Bewegungsdatei, und die steht schief. Das sah aus wie ein
            Fehler der Haltung und war keiner.

         Deshalb: erst den Gleitflug voll einblenden lassen, dann W. */
      let i = 0;
      while (i < 300) {
        d.schritt(1 / 60); i++;
        if (P.gleiten && (P.gleitMisch || 0) >= 0.99) break;
      }
      d.taste('KeyW', true);
      while (i < 540) {
        d.schritt(1 / 60); i++;
        if (P.gleiten && !P.sturzflug && (P.gleitNase || 0) >= 0.55) break;
      }
      /* ---- Steht die Haltung symmetrisch? ----
         Auf den Bildern haengt ein Bein tiefer als das andere. Das ist
         keine Frage des Geschmacks, sondern eine Zahl: die Knochen
         werden im KOERPEREIGENEN System abgefragt, links gegen rechts
         gespiegelt und verglichen. Der Atemzug erklaert hoechstens
         0,02 m; was darueber liegt, ist eine Schieflage. */
      const kn = d.animKnochenLokal(['lefthand','righthand','leftfoot','rightfoot',
                                     'leftleg','rightleg','leftarm','rightarm']);
      const paare = [['hand', 'lefthand', 'righthand'],
                     ['fuss', 'leftfoot', 'rightfoot'],
                     ['knie', 'leftleg', 'rightleg'],
                     ['arm', 'leftarm', 'rightarm']];
      const schief = {};
      for (const [name, l, r] of paare) {
        if (!kn[l] || !kn[r]) continue;
        schief[name] = { quer: +(kn[l].x + kn[r].x).toFixed(3),
                         hoch: +(kn[l].y - kn[r].y).toFixed(3),
                         laengs: +(kn[l].z - kn[r].z).toFixed(3) };
      }
      const gew = d.animGewichte ? d.animGewichte() : {};
      const spur = d.gleitSpur ? d.gleitSpur() : {};
      return { pos: [P.pos.x, P.pos.y, P.pos.z], bild: i, schief, gew, spur,
               knochen: kn, misch: +(P.gleitMisch || 0).toFixed(3),
               nase: +(P.gleitNase || 0).toFixed(2), sturzflug: !!P.sturzflug,
               anim: P.anim, sinken: +P.vel.y.toFixed(1),
               tempo: +Math.hypot(P.vel.x, P.vel.z).toFixed(1) };
    }, variante);

    for (const r of RICHTUNGEN) {
      await page.evaluate((a) => {
        const p = a.pos, ab = a.ab;
        for (let i = 0; i < 3; i++)
          __dbg.aufnahme(p[0] + ab[0], p[1] + 1.0 + ab[1], p[2] + ab[2],
                         p[0], p[1] + 0.9, p[2]);
      }, { pos: mess.pos, ab: r.ab });
      await page.evaluate(() => new Promise((ok) => requestAnimationFrame(ok)));
      const name = variante + '-' + r.name;
      await page.screenshot({ path: path.join(ziel, name + '.png') });
      werte.push({ name, ...mess, pos: undefined });
    }
    console.log('  ' + variante + '   Nase ' + String(mess.nase).padStart(5) +
                '  Sturzflug ' + (mess.sturzflug ? 'ja ' : 'nein') +
                '  Bewegung ' + String(mess.anim).padEnd(10) +
                '  Sinken ' + String(mess.sinken).padStart(6) +
                '  Tempo ' + String(mess.tempo).padStart(5));
    console.log('      gleitMisch ' + mess.misch +
                '   (Haltungsgewicht = 0,9 mal gleitMisch)');
    console.log('      Gewichte ' + JSON.stringify(mess.gew));
    console.log('      Zielpunkte ' + JSON.stringify(mess.spur));
    console.log('      Fuesse ist  links ' + JSON.stringify(mess.knochen.leftfoot) +
                '  rechts ' + JSON.stringify(mess.knochen.rightfoot));
    console.log('      Schieflage links gegen rechts (quer / hoch / laengs):');
    for (const [name, v] of Object.entries(mess.schief))
      console.log('        ' + name.padEnd(6) +
                  String(v.quer).padStart(8) + String(v.hoch).padStart(8) +
                  String(v.laengs).padStart(8));
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen in ' + ziel);
})();
