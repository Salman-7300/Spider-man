/* CITY V2, Stufe 6A: die zehn festen Strassenbilder und drei Luftbilder.

   Dieselben Orte fuer die ganze Stufe 6 - vorher und nachher mit
   gleicher Weltposition, Kamera, Tageszeit und Keim. Die Figur steht
   unsichtbar an der Kamera (davon haengen Sichtweiten, Schatten und
   die Instanzfelder ab); Wagen, Passanten und Gegner sind entfernt, damit
   sich die Bilder nur in der Stadt unterscheiden.

   Strassenbild: Augenhoehe 1,65 m ueber dem Gehweg, 2 m vom Bordstein,
   Blick laengs der Kante 28 m voraus.

   Aufruf:  node tools/pruef/street-bilder.js <ordner> [seed=4711] [zeit=0.45]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2];
if (!ziel) { console.log('Aufruf: node tools/pruef/street-bilder.js <ordner>'); process.exit(1); }
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : +a.slice(k.length + 1); };
const SEED = arg('seed', 4711), ZEIT = arg('zeit', 0.45);
fs.mkdirSync(ziel, { recursive: true });

/* Kante: Blockmitte (cx, cz), Seite N/S/O/W. Die Kamera steht 2 m innen vom
   Bordstein bei laengs a0 und blickt nach a1 (1 m vom Bordstein). */
const ORTE = [
  { name: '01-zentrum',     cx: 0,    cz: -50,  seite: 'N', a0: -13, a1: 15, titel: 'Zentrum - Block 0/-50, Nordkante (STREET)' },
  { name: '02-geschaeft',   cx: -150, cz: -100, seite: 'O', a0: -13, a1: 15, titel: 'Geschaeft - Block -150/-100, Ostkante am Boulevard' },
  { name: '03-mischung',    cx: -200, cz: 50,   seite: 'N', a0: -13, a1: 15, titel: 'Mischung - Block -200/50, Nordkante (STREET)' },
  { name: '04-wohnen',      cx: -250, cz: 100,  seite: 'N', a0: -13, a1: 15, titel: 'Wohnen - Block -250/100, Nordkante (STREET)' },
  { name: '05-parkrand',    cx: -200, cz: -150, seite: 'O', a0: -13, a1: 15, titel: 'Parkrand - Park -200/-150, Ostkante' },
  { name: '06-park-innen',  frei: { x: -213, y: 0.25 + 1.65, z: -151.2, zx: -195, zy: 1.6, zz: -150 }, titel: 'Park innen - Weg zum Brunnen' },
  { name: '07-ufer',        frei: { x: 186.5, y: 0.25 + 1.65, z: 30, zx: 186.0, zy: 1.5, zz: 58 }, titel: 'Ufer - Promenade nach Norden' },
  { name: '08-boulevard',   cx: 100,  cz: 0,    seite: 'N', a0: -13, a1: 15, titel: 'Boulevard z=25 - Block 100/0, Nordkante' },
  { name: '09-local',       cx: -300, cz: -250, seite: 'S', a0: -13, a1: 15, titel: 'Local Street z=-275 - Block -300/-250, Suedkante' },
  { name: '10-avenue',      cx: 0,    cz: 150,  seite: 'O', a0: -13, a1: 15, titel: 'Avenue x=25 - Block 0/150, Ostkante' },
  { name: 'L1-wohnen-west', frei: { x: -228, y: 72, z: 62, zx: -282, zy: 0, zz: 132 }, titel: 'Luftbild Wohnen West' },
  { name: 'L2-park-geschaeft', frei: { x: -150, y: 70, z: -108, zx: -200, zy: 0, zz: -152 }, titel: 'Luftbild Park und Geschaeft' },
  { name: 'L3-zentrum',     frei: { x: 45, y: 80, z: -45, zx: 0, zy: 0, zz: 30 }, titel: 'Luftbild Zentrum und Boulevard' },
];

function kamera(o) {
  if (o.frei) return o.frei;
  const HALB = 19;
  const n = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] }[o.seite];
  const laengs = n[0] !== 0 ? [0, 1] : [1, 0];
  const bord = (a, innen) => [o.cx + n[0] * (HALB - innen) + laengs[0] * a, o.cz + n[1] * (HALB - innen) + laengs[1] * a];
  const [x, z] = bord(o.a0, 2.0), [zx, zz] = bord(o.a1, 1.0);
  return { x, y: 0.25 + 1.65, z, zx, zy: 1.5, zz };
}

(async () => {
  const { b, page } = await starte(1280, 720, SEED);
  const info = [];
  for (const o of ORTE) {
    const k = kamera(o);
    await page.evaluate((a) => {
      const d = __dbg;
      d.frier(true); d.setzeRegen(0); window.__setzeZeit(a.zeit);
      /* Was sich bewegt, ist vorher und nachher an anderer Stelle - es
         wird ausgeblendet, nicht nur aus der Liste genommen. */
      for (const c of d.cars) if (c.mesh) c.mesh.visible = false;
      for (const c of d.civilians) { const r = c.visual && (c.visual.root || c.visual.group); if (r) r.visible = false; }
      for (const e of d.enemies) { const r = e.visual && (e.visual.root || e.visual.group); if (r) r.visible = false; }
      d.cars.length = 0; d.civilians.length = 0; d.enemies.length = 0;
      d.setzePos(a.k.x, 0.25, a.k.z);
      if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
      d.schritt(1 / 60, 40);
      window.__setzeZeit(a.zeit);
      d.schritt(1 / 60, 2);
      if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
      d.aufnahme(a.k.x, a.k.y, a.k.z, a.k.zx, a.k.zy, a.k.zz);
      d.aufnahme(a.k.x, a.k.y, a.k.z, a.k.zx, a.k.zy, a.k.zz);
    }, { k, zeit: ZEIT });
    await page.screenshot({ path: path.join(ziel, o.name + '.png') });
    const r = await page.evaluate(() => __dbg.renderInfo());
    info.push({ name: o.name, titel: o.titel, kamera: k, calls: r.calls, dreiecke: r.dreiecke });
    console.log(o.name.padEnd(20) + ' Aufrufe ' + r.calls + '  Dreiecke ' + r.dreiecke);
  }
  fs.writeFileSync(path.join(ziel, 'orte.json'), JSON.stringify({ seed: SEED, zeit: ZEIT, orte: info }, null, 1));
  await b.close();
})();
