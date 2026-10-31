/* Diagnose: baueBodenProfil UNVERAENDERT (Quelltext aus game.js) am Modell
   Downtown_Brutal_1 - was kommt heraus und warum? Dazu je Seite aus dem
   Roh-Raster: Bezug (Zeilen 50-60, Obergeschoss-Band des Algorithmus),
   Erdgeschoss (Zeilen 0-10) und die Hoehe der ersten Zeile mit Flaeche
   in Bezugstiefe (Hallendecke).
   Aufruf: node tools/pruef/brutal-profil.js [modell=Downtown_Brutal_1] */
const fs = require('node:fs');
const { starte } = require('./basis');
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const MODELL = arg('modell', 'Downtown_Brutal_1');
const src = fs.readFileSync(require('node:path').join(__dirname, '..', '..', 'game.js'), 'utf8');
const a = src.indexOf('const BODEN_PROFIL_MODELLE'), e = src.indexOf('function bodenProfilSetzen');
let teil = src.slice(a, e);
const RET = '  return { ruecksprung, decke, teile };';
if (teil.split(RET).length !== 2) throw new Error('return nicht eindeutig');
teil = teil.replace(RET, '  return { ruecksprung, decke, teile, _tiefe: tiefe };');
/* auch der Fall "keine Ruecksprung-Spalte": Raster trotzdem zurueckgeben */
const NULL = '  if (!ruecksprung.length) return null;';
if (teil.split(NULL).length !== 2) throw new Error('null-Zeile nicht eindeutig');
teil = teil.replace(NULL, '  if (!ruecksprung.length) return { leer: true, _tiefe: tiefe };');
const code = 'const FASS_SEITEN = [[1, 0], [-1, 0], [0, 1], [0, -1]];\nconst clamp = (v, a, b) => Math.max(a, Math.min(b, v));\nconst THREE = window.THREE;\n' +
             teil + '\nwindow.__bbp = baueBodenProfil; window.__bp = { NS: BODEN_SPALTEN, NZ: BODEN_ZEILEN, Z: BODEN_ZEILE, BEZUG: BODEN_BEZUG };';
(async () => {
  const { b, page } = await starte(320, 180, 4711, {});
  await page.addScriptTag({ content: '(function(){' + code + '})();' });
  const r = await page.evaluate((MODELL) => {
    const d = __dbg, T = window.THREE;
    d.frier(true);
    const o = d.hausModelle().find((q) => q.userData.modellName === MODELL);
    const alt = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() };
    o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrixWorld(true);
    const di = new T.Matrix4().copy(o.matrixWorld).invert();
    const box = new T.Box3().setFromObject(o);
    const anteil = o.userData.dachAnteil;
    const res = window.__bbp(o, di, box.min.x, box.max.x, box.min.z, box.max.z, box.min.y, box.max.y - box.min.y, anteil);
    o.position.copy(alt.p); o.rotation.copy(alt.r); o.scale.copy(alt.s); o.updateMatrixWorld(true);
    const { NS, NZ, Z, BEZUG } = window.__bp;
    const seiten = {};
    for (const k of Object.keys(res._tiefe)) {
      const g = res._tiefe[k];
      let buendig = 0, erdLeer = 0, erdZurueck = 0;
      const deckeZeilen = [];
      for (let s2 = 0; s2 < NS; s2++) {
        let bezug = 9, erd = 9;
        for (let z = BEZUG[0]; z < BEZUG[1]; z++) bezug = Math.min(bezug, g[z * NS + s2]);
        for (let z = 0; z < 10; z++) erd = Math.min(erd, g[z * NS + s2]);
        if (bezug <= 0.01) buendig++;
        if (erd >= 9) erdLeer++; else if (erd > 0.03) erdZurueck++;
        /* erste Zeile von unten mit Flaeche an der Kistenebene (<= 1 %) */
        let z0 = -1;
        for (let z = 0; z < NZ; z++) if (g[z * NS + s2] <= 0.01) { z0 = z; break; }
        deckeZeilen.push(z0);
      }
      const dz = deckeZeilen.filter((q) => q >= 0).sort((p2, q) => p2 - q);
      seiten[k] = { spalten: NS, bezugBuendig: buendig, erdgeschossOhneFlaeche: erdLeer, erdgeschossZurueck: erdZurueck,
                    ersteBuendigeZeileMedian: dz.length ? dz[Math.floor(dz.length / 2)] : null, ohneBuendigeZeileBis030: NS - dz.length };
    }
    return { modell: MODELL, anteil, ergebnis: res.leer ? 'kein Profil (keine Ruecksprung-Spalte)' : { ruecksprung: res.ruecksprung.length, teile: res.teile.length, decke: res.decke },
             zeile: Z, bezug: BEZUG, zeilen: NZ, seiten };
  }, MODELL);
  await b.close();
  console.log(JSON.stringify(r, null, 1));
})();
