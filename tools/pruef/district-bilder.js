/* CITY V2, Stufe 8A: feste Bezirksbilder fuer den Vorher/Nachher-Vergleich.

   Je Stadtteil zwei Strassenaufnahmen mit der ECHTEN Spielkamera (Figur
   steht auf dem Gehweg, Blick laengs der Strasse) und eine erhoehte
   Luftansicht; dazu drei Bezirksgrenzen (Spielkamera) und drei
   Lichtkontrollen (Daemmerung, Nacht, Regen). Wagen und Passanten
   bleiben im Bild - der Ablauf ist eingefroren und ab dem Laden
   festgelegt, solange der Stadtzufall unberuehrt bleibt; gleiche Bilder
   an gleicher Stelle sind damit zugleich eine Probe auf den Zufallsstrom.
   Die Bilder bauen aufeinander auf (jede Aufnahme rechnet die Welt
   weiter): ein Lauf mit nur= zeigt andere Wagen und Passanten als der
   volle Lauf - vergleichbar sind nur volle Laeufe untereinander (zwei
   volle Laeufe desselben Stands: 4 von 12,4 Millionen Pixeln anders).

   Aufruf:  node tools/pruef/district-bilder.js <ordner> [seed=4711] [zeit=0.45] [nur=name,name]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2];
if (!ziel) { console.log('Aufruf: node tools/pruef/district-bilder.js <ordner>'); process.exit(1); }
const arg = (k, def) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? def : a.slice(k.length + 1); };
const SEED = +arg('seed', 4711), ZEIT = +arg('zeit', 0.45);
const NUR = arg('nur', '') ? arg('nur', '').split(',') : null;
fs.mkdirSync(ziel, { recursive: true });

/* Strassenaufnahme: Blockmitte (cx, cz), Seite N/S/O/W, die Figur steht
   2,5 m innen vom Bordstein bei laengs a und schaut in Richtung r (+1/-1
   laengs der Kante). */
const S = (name, bezirk, cx, cz, seite, a, r, titel, extra) =>
  Object.assign({ name, bezirk, art: 'strasse', kante: { cx, cz, seite, a, r }, titel }, extra || {});
const L = (name, bezirk, x, y, z, zx, zz, titel) =>
  ({ name, bezirk, art: 'erhoeht', frei: { x, y, z, zx, zy: 0, zz }, titel });
const ORTE = [
  S('Z-A1', 'ZENTRUM', 0, 50, 'S', -14, 1, 'Zentrum - Boulevard z=25, Block 0/50, nach Osten'),
  S('Z-A2', 'ZENTRUM', -50, -50, 'O', -14, 1, 'Zentrum - Strasse x=-25, Block -50/-50, nach Norden'),
  L('Z-B', 'ZENTRUM', 45, 80, -45, 0, 30, 'Zentrum - Luftansicht'),
  S('G-A1', 'GESCHAEFT', -150, -100, 'O', 14, -1, 'Geschaeft - Boulevard x=-125, Block -150/-100, nach Sueden'),
  S('G-A2', 'GESCHAEFT', -100, 200, 'W', 14, -1, 'Geschaeft - Boulevard x=-125, Block -100/200, nach Sueden'),
  L('G-B', 'GESCHAEFT', -90, 60, -60, -130, -125, 'Geschaeft - Luftansicht'),
  S('M-A1', 'MISCHUNG', -200, 50, 'N', -14, 1, 'Mischung - Strasse z=75, Block -200/50, nach Osten'),
  S('M-A2', 'MISCHUNG', 50, 200, 'W', -14, 1, 'Mischung - Avenue x=25, Block 50/200, nach Norden'),
  L('M-B', 'MISCHUNG', -160, 55, 100, -200, 40, 'Mischung - Luftansicht'),
  S('W-A1', 'WOHN', -250, 100, 'N', -14, 1, 'Wohnen - Strasse z=125, Block -250/100, nach Osten'),
  S('W-A2', 'WOHN', -250, -200, 'S', -14, 1, 'Wohnen - Strasse z=-225, Block -250/-200, nach Osten'),
  L('W-B', 'WOHN', -228, 72, 62, -282, 132, 'Wohnen - Luftansicht'),
  { name: 'U-A1', bezirk: 'UFER', art: 'strasse', held: { x: 186.5, z: 20, zx: 186.5, zz: 60 }, titel: 'Ufer - Promenade nach Norden' },
  S('U-A2', 'UFER', 150, -50, 'O', -14, 1, 'Ufer - Uferstrasse x=175, Block 150/-50, nach Norden'),
  L('U-B', 'UFER', 110, 55, -40, 180, 10, 'Ufer - Luftansicht'),
  S('P-A1', 'PARK', -200, -150, 'O', -14, 1, 'Park - Parkrand x=-175, Park -200/-150, nach Norden'),
  { name: 'P-A2', bezirk: 'PARK', art: 'strasse', held: { x: -50, z: -216, zx: -50, zz: -186 }, titel: 'Park - Weg im Park -50/-200 zum Brunnen' },
  L('P-B', 'PARK', -150, 70, -108, -200, -152, 'Park - Luftansicht'),
  S('GR1', 'ZENTRUM>MISCHUNG', -50, 100, 'W', 5, 1, 'Grenze Zentrum -> Mischung - Strasse x=-75 nach Norden'),
  S('GR2', 'GESCHAEFT>WOHN', -150, 200, 'W', -10, 1, 'Grenze Geschaeft -> Wohnen - Strasse x=-175 nach Norden'),
  S('GR3', 'MISCHUNG>UFER', 100, -150, 'O', -10, 1, 'Grenze Mischung -> Ufer - Strasse x=125 nach Norden'),
  S('K-DAEMMER', 'WOHN', -250, 100, 'N', -14, 1, 'Kontrolle Daemmerung - wie W-A1', { zeit: 0.765 }),
  S('K-NACHT', 'GESCHAEFT', -150, -100, 'W', 14, -1, 'Kontrolle Nacht - Geschaeftsviertel, Strasse x=-175 nach Sueden', { zeit: 0.92 }),
  S('K-REGEN', 'ZENTRUM', 0, 50, 'S', -14, 1, 'Kontrolle Regen - wie Z-A1', { regen: 1 }),
];

function heldLage(o) {
  if (o.held) return o.held;
  const k = o.kante;
  const HALB = 19, INNEN = 2.5;
  const n = { N: [0, 1], S: [0, -1], O: [1, 0], W: [-1, 0] }[k.seite];
  const l = n[0] !== 0 ? [0, 1] : [1, 0];
  const x = k.cx + n[0] * (HALB - INNEN) + l[0] * k.a, z = k.cz + n[1] * (HALB - INNEN) + l[1] * k.a;
  return { x, z, zx: x + l[0] * k.r * 30, zz: z + l[1] * k.r * 30 };
}

(async () => {
  const { b, page } = await starte(1280, 720, SEED, { frierSofort: true });
  /* Vorlauf: 30 s Spielzeit, die Figur auf einem Dach nahe dem Start -
     Passanten und Wagen verteilen sich, niemand bleibt bei ihr stehen. */
  await page.evaluate(() => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0);
    d.player.iFrames = 1e9;
    d.setzeTempo('maxEnemies', 0); d.setzeMissionCd(1e9);
    const ruhe = () => { d.evAlleBeenden(); for (const e of d.enemies) { const w = e.visual && (e.visual.root || e.visual.group); if (w) w.visible = false; } d.enemies.length = 0; };
    let dach = null;
    for (const col of d.colliders) {
      if (col.klein || col.strassenDetail || col.boden) continue;
      const h = col.h || 0;
      if (h < 10 || h > 60 || col.x1 - col.x0 < 8 || col.z1 - col.z0 < 8) continue;
      const mx = (col.x0 + col.x1) / 2, mz = (col.z0 + col.z1) / 2, dd = Math.hypot(mx - 25, mz - 25);
      if (!dach || dd < dach.dd) dach = { x: mx, z: mz, h, dd };
    }
    ruhe();
    for (let s = 0; s < 30; s++) {
      if (dach && Math.abs(d.player.pos.y - dach.h) > 1) d.setzePos(dach.x, dach.h + 0.05, dach.z);
      d.schritt(1 / 30, 30); ruhe();
    }
  });
  const info = [];
  for (const o of ORTE) {
    if (NUR && NUR.indexOf(o.name) < 0) continue;
    const r = await page.evaluate((a) => {
      const d = __dbg, P = d.player;
      d.evAlleBeenden(); d.enemies.length = 0;
      d.setzeRegen(a.regen || 0);
      window.__setzeZeit(a.zeit);
      if (a.frei) {
        /* Luftansicht: die Figur steht unter der Kamera auf dem Boden
           (Sichtweiten und Felder haengen an ihr), unsichtbar. */
        const gy = d.groundYAt(a.frei.zx, a.frei.zz);
        d.setzePos(a.frei.zx, gy, a.frei.zz);
        d.schritt(1 / 60, 20);
        window.__setzeZeit(a.zeit); d.setzeRegen(a.regen || 0);
        d.schritt(1 / 60, 1);
        if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = false;
        d.aufnahme(a.frei.x, a.frei.y, a.frei.z, a.frei.zx, a.frei.zy, a.frei.zz);
        d.aufnahme(a.frei.x, a.frei.y, a.frei.z, a.frei.zx, a.frei.zy, a.frei.zz);
        if (d.heroVisual && d.heroVisual.root) d.heroVisual.root.visible = true;
      } else {
        const h = a.held;
        const gy = d.groundYAt(h.x, h.z);
        d.setzePos(h.x, gy, h.z);
        const blick = Math.atan2(h.zx - h.x, h.zz - h.z);
        P.facing = blick;
        d.kamStart(blick + Math.PI, 0.22);
        for (let i = 0; i < 20; i++) { P.facing = blick; d.schritt(1 / 60, 1); }
        window.__setzeZeit(a.zeit); d.setzeRegen(a.regen || 0);
        P.facing = blick; d.schritt(1 / 60, 1);
        d.zeichne();
      }
      const ri = d.renderInfo();
      return { calls: ri.calls, dreiecke: ri.dreiecke, cam: d.camera.position.toArray().map((v) => +v.toFixed(2)),
               held: [+P.pos.x.toFixed(2), +P.pos.y.toFixed(2), +P.pos.z.toFixed(2)] };
    }, { frei: o.frei || null, held: o.frei ? null : heldLage(o), zeit: o.zeit !== undefined ? o.zeit : ZEIT, regen: o.regen || 0 });
    await page.screenshot({ path: path.join(ziel, o.name + '.png') });
    info.push(Object.assign({ name: o.name, bezirk: o.bezirk, art: o.art, titel: o.titel }, r));
    /* Strassenaufnahmen stehen auf dem Gehweg (0,25 m) - sonst ist die
       Stelle falsch gewaehlt (Schacht, Treppe, Bruecke). */
    const warn = !o.frei && Math.abs(r.held[1] - 0.25) > 0.1 ? '  WARNUNG: Held nicht auf Gehweghoehe' : '';
    console.log(o.name.padEnd(10) + ' ' + o.bezirk.padEnd(17) + ' Aufrufe ' + r.calls + '  Dreiecke ' + r.dreiecke + '  Held ' + r.held.join('/') + warn);
  }
  fs.writeFileSync(path.join(ziel, 'orte.json'), JSON.stringify({ seed: SEED, zeit: ZEIT, orte: info }, null, 1));
  await b.close();
})();
