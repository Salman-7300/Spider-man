/* problem-1, Punkt 2: sitzen dort wirklich Menschen?

   Der Human-Screenshot mit dem gelben Taxi ist der Pflichtfall. Hier
   wird jede Bauart einzeln aufgenommen, von schraeg vorn und von der
   Seite, so nah, dass man den Fahrer erkennt.

   Echte Fahrer erscheinen nur im Umkreis von AUTO_FAHRER_WEITE um die
   FIGUR - die Figur wird deshalb zu jedem Wagen gebracht, bevor
   aufgenommen wird.

   Aufruf:  node tools/pruef/fahrer-bilder.js <ordner> [seed=4711]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte, ausgabePfad } = require('./basis');
const ziel = ausgabePfad(process.argv[2]) || 'bilder-fahrer';
const sArg = process.argv.find((v) => v.indexOf('seed=') === 0);
const seed = sArg === undefined ? 4711 : +sArg.slice(5);
fs.mkdirSync(ziel, { recursive: true });

const ARTEN = ['taxi', 'pkw', 'polizei', 'lkw', 'bus'];

(async () => {
  const { b, page } = await starte(1280, 720, seed, { autos: 70 });
  await page.evaluate(() => { __dbg.setzeRegen(0); });
  const werte = [];
  for (const art of ARTEN) {
    for (const sicht of ['vorn', 'seite']) {
      const mess = await page.evaluate(async (a) => {
        const d = __dbg, P = d.player;
        /* Einen fahrenden Wagen dieser Bauart suchen und die Figur
           daneben stellen, damit der Fahrerpool ihn bedient. */
        let ziel = null;
        for (let versuch = 0; versuch < 400 && !ziel; versuch++) {
          for (const c of d.cars) {
            if (c.aus || !c.mesh || !c.typ || c.typ.art !== a.art) continue;
            if (!c.mesh.userData.fahrerSitz) continue;
            ziel = c; break;
          }
          if (!ziel) d.schritt(1 / 60);
        }
        if (!ziel) return { fehlt: true };
        /* Die Figur in die Naehe bringen und ein paar Bilder laufen
           lassen, damit der Pool zuteilt. */
        const q = ziel.mesh.position;
        d.setzePos(q.x + 6, 1.0, q.z + 6);
        P.vel.set(0, 0, 0);
        for (let i = 0; i < 90; i++) d.schritt(1 / 60);
        d.frier(true);
        d.zeichne();
        d.szene.updateMatrixWorld(true);
        /* Sitzt jetzt ein echter Fahrer darin? */
        let fahrer = null;
        for (const f of d.autoFahrer()) if (f.auto === ziel) fahrer = f;
        const m = ziel.mesh, ry = m.rotation.y;
        const co = Math.cos(ry), si = Math.sin(ry);
        const sitz = m.userData.fahrerSitz;
        /* Der Fahrersitz in Weltkoordinaten - dorthin schaut die
           Kamera. */
        const sx = m.position.x + sitz.x * co + sitz.z * si;
        const sz = m.position.z - sitz.x * si + sitz.z * co;
        const sy = m.position.y + sitz.y + 0.35;
        /* Von schraeg vorn links (Fahrerseite) oder quer von der Seite. */
        const wl = a.sicht === 'vorn' ? 2.3 : 3.2;     // seitlich
        const wv = a.sicht === 'vorn' ? 3.0 : 0.0;     // nach vorn
        const kx = sx - wl * co - wv * si;
        const kz = sz + wl * si - wv * co;
        d.aufnahme(kx, sy + 0.25, kz, sx, sy, sz);
        return { art: a.art, fahrer: !!fahrer,
                 echt: !!(fahrer && fahrer.visual && !fahrer.visual.procedural &&
                          fahrer.visual.root.visible),
                 pos: [+m.position.x.toFixed(1), +m.position.z.toFixed(1)] };
      }, { art, sicht });
      if (mess.fehlt) { console.log('  ' + art + ': kein Wagen gefunden'); continue; }
      await page.screenshot({ path: path.join(ziel, art + '-' + sicht + '.png') });
      werte.push({ art, sicht, ...mess });
      console.log('  ' + (art + '-' + sicht).padEnd(16) +
                  (mess.echt ? 'echter Fahrer' : (mess.fahrer ? 'Pool, aber unsichtbar'
                                                             : 'kein Fahrer')) +
                  '   bei ' + mess.pos.join(' / '));
      await page.evaluate(() => __dbg.frier(false));
    }
  }
  await b.close();
  fs.writeFileSync(path.join(ziel, 'messwerte.json'), JSON.stringify(werte, null, 1));
  console.log('  ' + werte.length + ' Aufnahmen in ' + ziel);
})();
