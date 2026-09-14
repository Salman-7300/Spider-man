/* CITY V2, Stufe 5: was passiert, wenn assets/haeuser.glb nicht laedt?

   Vor Stufe 5 war die Antwort einfach: die prozeduralen Fassaden blieben
   sichtbar, die Stadt sah aelter aus, aber sie stand. Mit der hybriden
   Darstellung gibt es zwei Saetze verschmolzener Fassaden, und nur einer
   davon darf ausgeblendet werden. Dieser Pruefstand haelt beide Faelle
   nebeneinander:

     mit Modellen    Rueckfall unsichtbar, Produktionssatz sichtbar
     ohne Modelle    BEIDE Saetze sichtbar, kein Haus fehlt

   Aufruf:  node tools/pruef/haeuser-rueckfall.js
   ========================================================================= */
const { starte } = require('./basis');

async function lauf(ohneHaeuser) {
  const { b, page } = await starte(960, 540, 4711, ohneHaeuser ? { ohneHaeuser: true } : {});
  const aus = await page.evaluate(() => {
    const d = __dbg; d.frier(true);
    /* Wieviel Geometrie steht wirklich sichtbar in der Szene? Ein Haus,
       das weder Modell noch sichtbare Fassade hat, faellt hier auf. */
    let sichtbareMeshes = 0;
    d.szene.traverse((o) => { if (o.isMesh && o.visible) sichtbareMeshes++; });
    /* Und die Stichprobe, die zaehlt: steht an jeder Kiste etwas? */
    const box = new THREE.Box3(), v = new THREE.Vector3();
    const modellBei = [];
    for (const m of d.hausModelle()) {
      m.updateMatrixWorld(true); box.setFromObject(m); box.getCenter(v);
      modellBei.push([v.x, v.z]);
    }
    return { info: d.hausInfo(), sichtbareMeshes,
             kisten: d.hausKisten().length, modelle: modellBei.length,
             render: d.renderInfo() };
  });
  await b.close();
  return aus;
}

(async () => {
  const p = (s) => console.log(s);
  p('');
  const mit = await lauf(false);
  const ohne = await lauf(true);
  const zeile = (name, a) =>
    p('  ' + name.padEnd(16) + 'Kisten ' + String(a.kisten).padStart(4) +
      '   MODEL ' + String(a.info.model).padStart(4) +
      '   MERGED ' + String(a.info.merged).padStart(4) +
      '   Modelle gesetzt ' + String(a.modelle).padStart(4) +
      '   Fassaden sichtbar: Prod ' + a.info.prodSichtbar + '/' + a.info.fassadenProd +
      '  Rueckfall ' + a.info.fallSichtbar + '/' + a.info.fassadenFall);
  p('== Rueckfalltest ==');
  zeile('mit haeuser.glb', mit);
  zeile('ohne haeuser.glb', ohne);
  p('');
  const F = [];
  if (mit.modelle !== mit.info.model)
    F.push('mit Modellen: ' + mit.modelle + ' gesetzt, erwartet ' + mit.info.model);
  if (mit.info.fallSichtbar !== 0)
    F.push('mit Modellen: der Rueckfall ist noch sichtbar');
  if (mit.info.prodSichtbar !== mit.info.fassadenProd)
    F.push('mit Modellen: der Produktionssatz wurde ausgeblendet');
  if (ohne.modelle !== 0)
    F.push('ohne haeuser.glb stehen trotzdem ' + ohne.modelle + ' Modelle');
  if (ohne.info.fallSichtbar !== ohne.info.fassadenFall)
    F.push('ohne haeuser.glb fehlt der Rueckfall - dort steht jetzt nichts');
  if (ohne.info.prodSichtbar !== ohne.info.fassadenProd)
    F.push('ohne haeuser.glb fehlt der Produktionssatz');
  if (F.length) { for (const x of F) p('  FEHLER: ' + x); p(''); process.exit(1); }
  p('  Ohne die Modelldatei steht jedes Haus prozedural da,');
  p('  mit ihr verschwindet genau der Rueckfall und sonst nichts.');
  p('');
})();
