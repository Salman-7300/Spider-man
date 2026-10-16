/* Wie weit reicht die Welt wirklich?

   Mission 6 bekommt einen eigenen Missionsinnenraum. Der soll in einem
   reservierten Bereich AUSSERHALB der Open World stehen, damit dort keine
   Weltkollision, kein Weltboden und keine Weltgeometrie hineinreicht.

   Welcher Bereich das sein darf, wird hier gemessen und nicht geraten:
   Ausdehnung aller Kollider, Ausdehnung der Szene, und fuer mehrere
   Kandidaten die drei Fragen, auf die es ankommt - welchen Boden liefert
   groundY, gilt dort Wasser, und liegt ein Kollider in der Naehe. */
const { starte } = require('./basis');
(async () => {
  const { b, page } = await starte(900, 600, 4711);
  const aus = await page.evaluate(() => {
    const d = __dbg;
    const k = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, y1: -1e9, n: 0 };
    for (const c of d.colliders) {
      k.n++;
      k.x0 = Math.min(k.x0, c.x0); k.x1 = Math.max(k.x1, c.x1);
      k.z0 = Math.min(k.z0, c.z0); k.z1 = Math.max(k.z1, c.z1);
      k.y1 = Math.max(k.y1, c.h === undefined ? 0 : c.h);
    }
    /* Die Szene als Ganzes - alles, was gezeichnet wird. */
    const box = new THREE.Box3();
    box.setFromObject(d.szene);
    const s = {
      x0: +box.min.x.toFixed(1), x1: +box.max.x.toFixed(1),
      y0: +box.min.y.toFixed(1), y1: +box.max.y.toFixed(1),
      z0: +box.min.z.toFixed(1), z1: +box.max.z.toFixed(1),
    };
    /* Kandidaten fuer den reservierten Bereich. */
    const kand = [];
    for (const [x, z] of [[600, 0], [800, 800], [1000, 1000], [1500, 0], [2000, 2000]]) {
      let nah = 0, minD = 1e9;
      for (const c of d.colliders) {
        const bx = Math.max(c.x0 - x, 0, x - c.x1);
        const bz = Math.max(c.z0 - z, 0, z - c.z1);
        const dd = Math.hypot(bx, bz);
        if (dd < minD) minD = dd;
        if (dd < 200) nah++;
      }
      kand.push({ x, z,
        boden: d.groundYAt(x, z, 2),
        wasser: d.inWasser ? d.inWasser(x, z) : null,
        imGebiet: d.imGebiet ? d.imGebiet(x, z) : null,
        kolliderInnerhalb200: nah,
        naechsterKollider: +minD.toFixed(1) });
    }
    /* Der Spieler wird in updatePlayer hart auf die Spielfeldgrenzen
       geklemmt - das ist die Zahl, die ein Innenraum draussen braucht. */
    const g = d.spielfeldGrenzen ? d.spielfeldGrenzen() : null;
    const r = d.renderInfo ? d.renderInfo() : null;
    return { kollider: k, szene: s, kand, grenzen: g, render: r,
             kinder: d.szene.children.length };
  });
  const p = (s) => console.log(s);
  p('');
  p('Kollider: ' + aus.kollider.n + ' Stueck');
  p('  x ' + aus.kollider.x0.toFixed(1) + ' .. ' + aus.kollider.x1.toFixed(1) +
    '   z ' + aus.kollider.z0.toFixed(1) + ' .. ' + aus.kollider.z1.toFixed(1) +
    '   hoechste Oberkante ' + aus.kollider.y1.toFixed(1));
  p('Szene (alles Gezeichnete):');
  p('  x ' + aus.szene.x0 + ' .. ' + aus.szene.x1 +
    '   y ' + aus.szene.y0 + ' .. ' + aus.szene.y1 +
    '   z ' + aus.szene.z0 + ' .. ' + aus.szene.z1);
  p('  Kinder direkt an der Szene: ' + aus.kinder);
  if (aus.grenzen) p('Spielfeldgrenzen des Spielers: ' + JSON.stringify(aus.grenzen));
  if (aus.render) p('Renderzahlen aussen: ' + JSON.stringify(aus.render));
  p('');
  p('Kandidaten fuer den reservierten Bereich:');
  for (const c of aus.kand)
    p('  [' + String(c.x).padStart(5) + ',' + String(c.z).padStart(5) + ']' +
      '  groundY ' + String(c.boden).padStart(6) +
      '  Wasser ' + String(c.wasser).padStart(5) +
      '  imGebiet ' + String(c.imGebiet).padStart(5) +
      '  Kollider <200 m: ' + String(c.kolliderInnerhalb200).padStart(4) +
      '  naechster ' + c.naechsterKollider + ' m');
  await b.close();
})();
