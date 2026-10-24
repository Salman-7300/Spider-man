/* CITY V2, Stufe 8A: Gameplay-Video durch die sechs Stadtteile.

   Normale Spielkamera, Gehen mit Alt+W (echte Tasten, 60 Hz, jedes 4.
   Bild -> 15 Bilder/s = Echtzeit). Das Spiel ist im ersten Bild nach dem
   Laden eingefroren und 60 s vorgerechnet (die Figur steht dabei auf einem
   Dach), Gangs und Vorfaelle aus - das Video zeigt die Stadt, keinen
   Kampf. Zwei erhoehte Abschnitte: die Figur steht an einer Dachkante,
   die Spielkamera dreht sich langsam um sie (kamStart, kein freier Blick).
   Die Bezirksnamen setzt erst der Schnitt als Aufnahmeinformation ins
   Bild - im Spiel gibt es dafuer keine Anzeige.

   Aufruf:  node tools/pruef/district-video.js <ordner> [nur=<abschnitt>] [zeit=0.45]
   ========================================================================= */
const fs = require('node:fs');
const path = require('node:path');
const { starte } = require('./basis');
const ziel = process.argv[2];
if (!ziel) { console.log('Aufruf: node tools/pruef/district-video.js <ordner> [nur=<abschnitt>]'); process.exit(1); }
const arg = (k, d) => { const a = process.argv.find((v) => v.indexOf(k + '=') === 0); return a === undefined ? d : a.slice(k.length + 1); };
const NUR = arg('nur', null), ZEIT = +arg('zeit', 0.45);
fs.mkdirSync(ziel, { recursive: true });
/* gehen: Start und Wegpunkte; dach: Dachpunkt, Blick-Anfang, Drehung (rad).
   Park: der 7A/7B-Weg (-205,6/-146,2) fuehrt in die Bank am Brunnen
   (x -208,1..-205,9, z -147,9..-147,3) - die Figur blieb dort stehen, schon
   im 7B-Video. Hier zwischen Bank und Brunnenrand (x -203,25) hindurch. */
const ABSCHNITTE = [
  { name: '1-zentrum', titel: 'Zentrum - Boulevard z=25, Nordseite nach Osten', start: [-22, 33], wege: [[80, 33]], sek: 24 },
  { name: '2-geschaeft', titel: 'Geschaeftsviertel - Avenue z=175, Suedseite nach Osten', start: [-168, 167], wege: [[-60, 167]], sek: 24 },
  { name: '3-mischung', titel: 'Mischgebiet - Strasse z=75, Suedseite nach Osten', start: [-221, 66.5], wege: [[-128, 66.5]], sek: 24 },
  { name: '4-wohnen', titel: 'Wohngebiet - Strasse z=125, Nordseite nach Osten', start: [-312, 133], wege: [[-200, 133]], sek: 24 },
  { name: '5-ufer', titel: 'Ufer - Promenade nach Norden', start: [186.5, 20], wege: [[186.5, 120]], sek: 24 },
  { name: '6-park', titel: 'Park -200/-150 - vom Gehweg durch das Portal zum Brunnen', start: [-232, -150.6], wege: [[-207.8, -150.6], [-204.6, -149.6], [-204.6, -145.4], [-200.6, -144.6], [-200.6, -128]], sek: 24 },
  { name: '7-dach-zentrum', titel: 'Erhoeht - Dachkante im Zentrum, Spielkamera dreht', dach: [25, 25], sek: 14 },
  { name: '8-dach-ufer', titel: 'Erhoeht - Dachkante am Ufer, Spielkamera dreht', dach: [150, -40], sek: 14 },
];
(async () => {
  const { b, page } = await starte(960, 540, 4711, { frierSofort: true });
  await page.evaluate((zeit) => {
    const d = __dbg;
    d.frier(true); d.setzeRegen(0); window.__setzeZeit(zeit);
    for (const t of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'AltLeft', 'KeyZ']) d.taste(t, false);
    d.player.iFrames = 1e9; d.setzeTempo('maxEnemies', 0); d.setzeMissionCd(1e9);
    const ohne = () => { d.evAlleBeenden(); for (const e of d.enemies) { const w = e.visual && e.visual.root; if (w) w.visible = false; } d.enemies.length = 0; };
    let dach = null;
    for (const col of d.colliders) {
      if (col.klein || col.strassenDetail || col.boden) continue;
      const h = col.h || 0;
      if (h < 10 || h > 60 || col.x1 - col.x0 < 8 || col.z1 - col.z0 < 8) continue;
      const mx = (col.x0 + col.x1) / 2, mz = (col.z0 + col.z1) / 2, dd = Math.hypot(mx - 25, mz - 25);
      if (!dach || dd < dach.dd) dach = { x: mx, z: mz, h, dd };
    }
    ohne();
    for (let s = 0; s < 60; s++) { if (dach && Math.abs(d.player.pos.y - dach.h) > 1) d.setzePos(dach.x, dach.h + 0.05, dach.z); d.schritt(1 / 30, 30); ohne(); }
    window.__ohne = ohne;
    /* Dachkante nahe (x, z): das naechste Haus von 20 bis 70 m Hoehe */
    window.__dachBei = (x, z) => {
      let best = null;
      for (const k of d.hausKisten()) {
        if (k.h < 20 || k.h > 70) continue;
        const dd = Math.hypot(k.x - x, k.z - z);
        if (dd < 80 && (!best || dd < best.dd)) best = Object.assign({ dd }, k);
      }
      return best;
    };
  }, ZEIT);
  const liste = [];
  for (const A of ABSCHNITTE) {
    if (NUR && A.name !== NUR) continue;
    const ordner = path.join(ziel, A.name);
    fs.mkdirSync(ordner, { recursive: true });
    const info = await page.evaluate((a) => {
      const d = __dbg;
      for (const t of ['KeyW', 'AltLeft']) d.taste(t, false);
      window.__setzeZeit(a.zeit);
      if (a.dach) {
        const k = window.__dachBei(a.dach[0], a.dach[1]);
        /* an die Dachkante zur Strasse hin, 1,2 m innen */
        const sx = Math.sign(a.dach[0] - k.x) || 1;
        const x = k.x + sx * (k.w / 2 - 1.2), z = k.z;
        d.setzePos(x, 0.25 + k.h + 0.05, z);
        for (let i = 0; i < 30; i++) { d.schritt(1 / 60); window.__ohne(); }
        window.__dreh = Math.atan2(sx, 0) + Math.PI;
        d.kamStart(window.__dreh, 0.32);
        return { haus: [k.x, k.z, k.h], held: [x, z] };
      }
      d.setzePos(a.start[0], 0.25, a.start[1]);
      d.lookAt(a.wege[0][0], a.wege[0][1]);
      for (let i = 0; i < 40; i++) { d.schritt(1 / 60); window.__ohne(); }
      d.lookAt(a.wege[0][0], a.wege[0][1]);
      window.__wp = 0;
      return null;
    }, Object.assign({ zeit: ZEIT }, A));
    let bild = 0;
    const n = Math.round(A.sek * 60);
    for (let f = 0; f < n; f++) {
      const zeigen = f % 4 === 0;
      const st = await page.evaluate((a) => {
        const d = __dbg, P = d.player;
        if (a.dach) {
          /* eine halbe Umdrehung ueber die ganze Dauer */
          window.__dreh += Math.PI / (a.sek * 60);
          d.setzeKamYaw(window.__dreh);
          d.schritt(1 / 60);
        } else {
          let w = a.wege[window.__wp];
          if (Math.hypot(P.pos.x - w[0], P.pos.z - w[1]) < 1.0 && window.__wp < a.wege.length - 1) { window.__wp++; w = a.wege[window.__wp]; }
          const amEnde = window.__wp === a.wege.length - 1 && Math.hypot(P.pos.x - w[0], P.pos.z - w[1]) < 1.0;
          if (!amEnde) { d.lookAt(w[0], w[1]); d.taste('AltLeft', true); d.taste('KeyW', true); }
          else { d.taste('KeyW', false); d.taste('AltLeft', false); }
          d.schritt(1 / 60);
        }
        if (a.f % 30 === 0) window.__ohne();
        if (!a.zeigen) return null;
        d.zeichne();
        return { x: +P.pos.x.toFixed(1), y: +P.pos.y.toFixed(1), z: +P.pos.z.toFixed(1) };
      }, Object.assign({ zeigen, f }, A));
      if (!st) continue;
      fs.writeFileSync(path.join(ordner, String(bild++).padStart(4, '0') + '.jpg'), await page.screenshot({ type: 'jpeg', quality: 85 }));
      if (bild === 1 || bild % 60 === 0) console.log(A.name, bild, JSON.stringify(st), info ? JSON.stringify(info) : '');
    }
    await page.evaluate(() => { __dbg.taste('KeyW', false); __dbg.taste('AltLeft', false); });
    liste.push({ name: A.name, titel: A.titel, bilder: bild });
  }
  fs.writeFileSync(path.join(ziel, 'abschnitte' + (NUR ? '-' + NUR : '') + '.json'), JSON.stringify(liste, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
